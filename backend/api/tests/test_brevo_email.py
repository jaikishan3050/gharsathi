from unittest.mock import patch
import pytest
from django.test import override_settings
from rest_framework.test import APIClient
from api.models import OTPVerification, CustomerProfile
from api.views import email_otp_digest


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_customer_email_otp_sends_to_brevo():
    CustomerProfile.objects.create(phone="9876543011", email="customer@example.com", name="Customer")
    client = APIClient()
    with patch("api.views.send_login_otp") as send:
        response = client.post("/api/auth/send-otp/", {
            "phone_number": "9876543011", "email": "customer@example.com", "role": "customer"
        }, format="json")
    assert response.status_code == 200
    send.assert_called_once()
    assert send.call_args.args[0] == "customer@example.com"
    otp = OTPVerification.objects.get(phone="9876543011")
    assert otp.email == "customer@example.com"
    assert len(otp.otp_code) == 64
    assert otp.otp_code != send.call_args.args[1]
    assert otp.otp_code == email_otp_digest(otp.phone, otp.email, send.call_args.args[1])


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_customer_email_otp_rejects_missing_email():
    response = APIClient().post("/api/auth/send-otp/", {
        "phone_number": "9876543012", "role": "customer"
    }, format="json")
    assert response.status_code == 400
    assert not OTPVerification.objects.filter(phone="9876543012").exists()


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_customer_email_otp_delivery_failure_fails_closed():
    from api.services.brevo import EmailDeliveryError
    CustomerProfile.objects.create(phone="9876543013", email="customer@example.com", name="Customer")
    with patch("api.views.send_login_otp", side_effect=EmailDeliveryError()):
        response = APIClient().post("/api/auth/send-otp/", {
            "phone_number": "9876543013", "email": "customer@example.com", "role": "customer"
        }, format="json")
    assert response.status_code == 503
    assert not OTPVerification.objects.filter(phone="9876543013").exists()


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_unlinked_phone_cannot_claim_email_account():
    CustomerProfile.objects.create(phone="9876543099", email="victim@example.com", name="Victim")
    with patch("api.views.send_login_otp") as send:
        response = APIClient().post("/api/auth/send-otp/", {
            "phone_number": "9876543088", "email": "victim@example.com", "role": "customer"
        }, format="json")
    assert response.status_code == 409
    send.assert_not_called()
    assert not OTPVerification.objects.filter(phone="9876543088").exists()


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_linked_customer_can_verify_hashed_email_otp():
    CustomerProfile.objects.create(phone="9876543077", email="linked@example.com", name="Linked")
    with patch("api.views.send_login_otp") as send:
        sent = APIClient().post("/api/auth/send-otp/", {
            "phone_number": "9876543077", "email": "linked@example.com", "role": "customer"
        }, format="json")
    assert sent.status_code == 200
    code = send.call_args.args[1]
    verified = APIClient().post("/api/auth/verify-otp/", {
        "phone_number": "9876543077", "email": "linked@example.com",
        "otp_code": code, "role": "customer"
    }, format="json")
    assert verified.status_code == 200
    assert "token" in verified.data
