from datetime import timedelta
import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from api.models import OTPVerification, CustomerProfile


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestOTPAuthenticationFlows:

    def test_send_otp_success_and_db_persistence(self, api_client):
        """
        Valid 10-digit mobile generates 6-digit OTP stored in database with 5-min expiry.
        """
        phone = "9876543210"
        response = api_client.post("/api/auth/send-otp/", {"phone_number": phone, "role": "customer"}, format="json")

        assert response.status_code == 200
        assert response.data["success"] is True
        assert response.data["phone"] == phone

        # Verify DB record
        record = OTPVerification.objects.filter(phone=phone, is_verified=False).first()
        assert record is not None
        assert len(record.otp_code) == 6
        assert record.otp_code.isdigit()
        assert record.expires_at > timezone.now()

    def test_invalid_phone_number_rejected(self, api_client):
        """
        Invalid mobile number formats are rejected with 400.
        """
        for bad_phone in ["12345", "abcd", "5555555555"]:
            response = api_client.post("/api/auth/send-otp/", {"phone_number": bad_phone}, format="json")
            assert response.status_code == 400

    def test_verify_otp_success(self, api_client):
        """
        Submitting correct OTP validates record, registers customer, and returns JWT token.
        """
        phone = "9876543211"
        otp_code = "654321"
        OTPVerification.objects.create(
            phone=phone,
            otp_code=otp_code,
            role="customer",
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        response = api_client.post(
            "/api/auth/verify-otp/",
            {
                "phone_number": phone,
                "otp_code": otp_code,
                "role": "customer",
                "name": "Kishan Kumar",
                "area": "Danapur",
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data["success"] is True
        assert "token" in response.data

        # Verify Customer Profile created
        customer = CustomerProfile.objects.filter(phone=phone).first()
        assert customer is not None
        assert customer.name == "Kishan Kumar"
        assert customer.status == "Active"

    def test_expired_otp_rejected(self, api_client):
        """
        Expired OTPs are rejected.
        """
        phone = "9876543212"
        OTPVerification.objects.create(
            phone=phone,
            otp_code="112233",
            role="customer",
            expires_at=timezone.now() - timedelta(minutes=1),  # Expired
        )

        response = api_client.post(
            "/api/auth/verify-otp/",
            {"phone_number": phone, "otp_code": "112233"},
            format="json",
        )

        assert response.status_code == 400
        assert "expired" in response.data.get("error", "").lower()

    def test_technician_forgot_password_phone_normalization_and_debug_otp(self, api_client):
        """
        Tests that technician forgot-password normalizes phone numbers with +91, spaces,
        saves OTP against TechnicianProfile, and returns debug_otp in JSON response.
        """
        from api.models import TechnicianProfile
        tech = TechnicianProfile.objects.create(
            partner_id="GS-TECH-FP01",
            name="Rakesh Kumar",
            phone="9876500099",
            password="oldPassword123",
            kyc_status="Verified",
        )

        # Test with formatting: +91 98765-00099
        res = api_client.post(
            "/api/technicians/forgot-password/",
            {"phone": "+91 98765-00099"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True
        assert "debug_otp" in res.data
        otp = res.data["debug_otp"]
        assert len(otp) == 6

        # Verify saved against TechnicianProfile
        tech.refresh_from_db()
        assert tech.otp_code == otp
        assert tech.otp_expires_at is not None
        assert tech.otp_expires_at > timezone.now()

    def test_technician_reset_password_success_and_otp_cleared(self, api_client):
        """
        Tests that submitting valid OTP resets technician password securely using set_password(),
        and clears OTP fields upon successful reset.
        """
        from api.models import TechnicianProfile
        tech = TechnicianProfile.objects.create(
            partner_id="GS-TECH-FP02",
            name="Suresh Yadav",
            phone="9876500088",
            password="initialPassword",
            otp_code="987654",
            otp_expires_at=timezone.now() + timedelta(minutes=5),
            otp_attempts=0,
            kyc_status="Verified",
        )

        res = api_client.post(
            "/api/technicians/reset-password-otp/",
            {
                "phone": "919876500088",
                "otp_code": "987654",
                "new_password": "NewSecretPassword@2026",
            },
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True

        tech.refresh_from_db()
        # Verify password updated and verified
        assert tech.check_password("NewSecretPassword@2026") is True
        assert tech.check_password("initialPassword") is False
        # Verify OTP cleared
        assert tech.otp_code == ""
        assert tech.otp_expires_at is None
        assert tech.otp_attempts == 0

    def test_technician_forgot_password_unknown_phone_rejected(self, api_client):
        """
        Submitting an unregistered phone number returns 404 with clear message.
        """
        res = api_client.post(
            "/api/technicians/forgot-password/",
            {"phone": "9876599999"},
            format="json",
        )
        assert res.status_code == 404
        assert "nahi mila" in res.data["error"]
