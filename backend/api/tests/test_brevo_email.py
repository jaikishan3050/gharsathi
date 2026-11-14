from unittest.mock import patch
import pytest
from django.test import override_settings
from rest_framework.test import APIClient
from api.models import OTPVerification, CustomerProfile
from api.views import email_otp_digest


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_customer_email_otp_sends_to_brevo():
    CustomerProfile.objects.create(phone="9876543011", email="customer@example.com", email_verified=True, name="Customer")
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
    CustomerProfile.objects.create(phone="9876543013", email="customer@example.com", email_verified=True, name="Customer")
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
    CustomerProfile.objects.create(phone="9876543077", email="linked@example.com", email_verified=True, name="Linked")
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


@pytest.mark.django_db
def test_email_link_requires_authenticated_customer():
    response = APIClient().post("/api/auth/link-email/", {"email": "new@example.com"}, format="json")
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_authenticated_customer_can_link_email():
    from api.authentication import AuthenticatedPrincipal
    customer = CustomerProfile.objects.create(phone="9876543066", name="Existing")
    client = APIClient()
    client.force_authenticate(user=AuthenticatedPrincipal('customer', customer))
    with patch("api.views.send_login_otp") as send:
        response = client.post("/api/auth/link-email/", {"email": "linked@example.com"}, format="json")
    assert response.status_code == 200
    customer.refresh_from_db()
    assert customer.email == ""
    code = send.call_args.args[1]
    bad = client.post("/api/auth/link-email/", {"email": "linked@example.com", "otp_code": "000000"}, format="json")
    assert bad.status_code == 400
    confirmed = client.post("/api/auth/link-email/", {"email": "linked@example.com", "otp_code": code}, format="json")
    assert confirmed.status_code == 200
    customer.refresh_from_db()
    assert customer.email == "linked@example.com"
    assert customer.email_verified is True


@pytest.mark.django_db
def test_customer_profile_patch_cannot_bypass_email_verification():
    from api.authentication import AuthenticatedPrincipal
    customer = CustomerProfile.objects.create(phone="9876543055", name="Protected", email="verified@example.com")
    client = APIClient()
    client.force_authenticate(user=AuthenticatedPrincipal('customer', customer))
    response = client.patch(f"/api/customers/{customer.pk}/", {
        "email": "attacker@example.com", "name": "Updated"
    }, format="json")
    assert response.status_code == 200
    customer.refresh_from_db()
    assert customer.email == "verified@example.com"
    assert customer.name == "Updated"


@pytest.mark.django_db
@override_settings(CUSTOMER_OTP_CHANNEL="email")
def test_legacy_unverified_email_cannot_login():
    CustomerProfile.objects.create(
        phone="9876543044", email="legacy@example.com", name="Legacy",
    )
    with patch("api.views.send_login_otp") as send:
        response = APIClient().post("/api/auth/send-otp/", {
            "phone_number": "9876543044", "email": "legacy@example.com", "role": "customer"
        }, format="json")
    assert response.status_code == 409
    send.assert_not_called()
    assert not OTPVerification.objects.filter(phone="9876543044").exists()
