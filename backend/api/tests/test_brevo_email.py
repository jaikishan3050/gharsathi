from unittest.mock import patch
import pytest
from django.test import override_settings
from rest_framework.test import APIClient
from api.models import OTPVerification


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_customer_email_otp_sends_to_brevo():
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
    with patch("api.views.send_login_otp", side_effect=EmailDeliveryError()):
        response = APIClient().post("/api/auth/send-otp/", {
            "phone_number": "9876543013", "email": "customer@example.com", "role": "customer"
        }, format="json")
    assert response.status_code == 503
    assert not OTPVerification.objects.filter(phone="9876543013").exists()
