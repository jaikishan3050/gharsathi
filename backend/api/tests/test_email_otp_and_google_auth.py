from datetime import timedelta
from decimal import Decimal
import jwt
import pytest
from django.conf import settings
from django.utils import timezone
from rest_framework.test import APIClient
from api.models import CustomerProfile, TechnicianProfile, OTPVerification


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestEmailOTPAndGoogleAuth:
    def test_send_email_otp_success(self, api_client):
        res = api_client.post(
            "/api/auth/send-email-otp/",
            {"email": "testuser@gharsathi.in", "role": "customer"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["email"] == "testuser@gharsathi.in"

        # Verify OTP record in database
        otp_rec = OTPVerification.objects.filter(email="testuser@gharsathi.in").first()
        assert otp_rec is not None
        assert len(otp_rec.otp_code) == 6
        assert otp_rec.is_verified is False
        assert otp_rec.expires_at > timezone.now()

    def test_verify_email_otp_and_register_customer(self, api_client):
        email = "customer.new@gharsathi.in"
        phone = "9811223344"
        otp_code = "654321"

        OTPVerification.objects.create(
            email=email,
            otp_code=otp_code,
            role="customer",
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        res = api_client.post(
            "/api/auth/verify-email-otp/",
            {
                "email": email,
                "otp": otp_code,
                "phone": phone,
                "role": "customer",
                "name": "Rani Kumari",
                "area": "Danapur",
            },
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True
        assert "token" in res.data
        assert res.data["role"] == "customer"
        assert res.data["user"]["email"] == email

        # Verify customer created in DB
        cus = CustomerProfile.objects.filter(email=email).first()
        assert cus is not None
        assert cus.name == "Rani Kumari"
        assert cus.phone == phone

    def test_verify_email_otp_and_register_technician_with_zero_wallet(self, api_client):
        email = "tech.new@gharsathi.in"
        phone = "9899887766"
        otp_code = "789123"

        OTPVerification.objects.create(
            email=email,
            otp_code=otp_code,
            role="technician",
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        res = api_client.post(
            "/api/auth/verify-email-otp/",
            {
                "email": email,
                "otp": otp_code,
                "phone": phone,
                "role": "technician",
                "name": "Mohan Lal",
                "skills": "AC Repair, Electrician",
                "area": "Patna Central",
            },
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["role"] == "technician"

        # Verify technician created in DB with STRICTLY 0.00 wallet balance
        tech = TechnicianProfile.objects.filter(email=email).first()
        assert tech is not None
        assert tech.wallet_balance == Decimal("0.00")
        assert tech.name == "Mohan Lal"

    def test_verify_email_otp_invalid_code_rejected(self, api_client):
        email = "wrong.otp@gharsathi.in"
        OTPVerification.objects.create(
            email=email,
            otp_code="112233",
            role="customer",
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        res = api_client.post(
            "/api/auth/verify-email-otp/",
            {"email": email, "otp": "999999", "role": "customer"},
            format="json",
        )
        assert res.status_code == 400
        assert "invalid" in res.data["error"].lower()

    def test_verify_email_otp_expired_code_rejected(self, api_client):
        email = "expired.otp@gharsathi.in"
        OTPVerification.objects.create(
            email=email,
            otp_code="445566",
            role="customer",
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        res = api_client.post(
            "/api/auth/verify-email-otp/",
            {"email": email, "otp": "445566", "role": "customer"},
            format="json",
        )
        assert res.status_code == 400
        assert "expired" in res.data["error"].lower()

    def test_google_auth_new_customer(self, api_client):
        # Create a mock Google ID token JWT
        google_payload = {
            "iss": "https://accounts.google.com",
            "sub": "1234567890",
            "email": "google.user@gmail.com",
            "email_verified": True,
            "name": "Google User",
            "picture": "https://example.com/avatar.jpg",
        }
        mock_credential = jwt.encode(google_payload, "mock_secret", algorithm="HS256")

        res = api_client.post(
            "/api/auth/google/",
            {"credential": mock_credential, "role": "customer"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True
        assert "token" in res.data
        assert res.data["role"] == "customer"
        assert res.data["user"]["email"] == "google.user@gmail.com"

        # Verify created in DB
        cus = CustomerProfile.objects.filter(email="google.user@gmail.com").first()
        assert cus is not None
        assert cus.name == "Google User"

    def test_google_auth_new_technician_has_zero_wallet(self, api_client):
        google_payload = {
            "iss": "https://accounts.google.com",
            "sub": "9876543210",
            "email": "tech.google@gmail.com",
            "email_verified": True,
            "name": "Tech Google",
        }
        mock_credential = jwt.encode(google_payload, "mock_secret", algorithm="HS256")

        res = api_client.post(
            "/api/auth/google/",
            {"credential": mock_credential, "role": "technician"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["role"] == "technician"

        # Verify created in DB with STRICTLY 0.00 wallet balance
        tech = TechnicianProfile.objects.filter(email="tech.google@gmail.com").first()
        assert tech is not None
        assert tech.wallet_balance == Decimal("0.00")
