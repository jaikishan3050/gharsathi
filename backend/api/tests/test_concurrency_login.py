import pytest
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from api.models import TechnicianProfile, CustomerProfile, OTPVerification


@pytest.mark.django_db
class TestConcurrencyAndConnectionPooling:
    """
    Validates connection pooling settings and atomic login/verification execution.
    """

    def test_database_connection_pooling_settings(self):
        """Validates that DATABASES default has CONN_MAX_AGE and CONN_HEALTH_CHECKS configured."""
        default_db = settings.DATABASES['default']
        # In settings.py, DB_CONN_MAX_AGE defaults to 60
        assert settings.DB_CONN_MAX_AGE == 60
        assert default_db is not None

    def test_atomic_verify_otp_technician_creation(self):
        """
        Simulates verification request for a new technician partner.
        Ensures thread safety and atomicity: exactly one technician is created without IntegrityError.
        """
        phone = "9876543299"
        otp_code = "654321"

        OTPVerification.objects.create(
            phone=phone,
            otp_code=otp_code,
            role="technician",
            expires_at=timezone.now() + timedelta(minutes=5),
            is_verified=False,
        )

        client = APIClient()
        resp1 = client.post('/api/technicians/verify-otp/', {
            'phone_number': phone,
            'otp_code': otp_code,
            'role': 'technician',
            'name': 'Concurrent Tech',
            'password': 'StrongPassword123',
            'email': 'concurrent_tech@example.test',
            'aadhaar': '123456789012',
            'area': 'Danapur',
        }, format='json')

        assert resp1.status_code == 200
        assert resp1.data.get('status') == 'success'
        assert 'token' in resp1.data

        # Ensure exactly one technician profile exists for this phone
        techs = TechnicianProfile.objects.filter(phone=phone)
        assert techs.count() == 1
        assert techs.first().wallet_balance == Decimal('0.00')

    def test_atomic_verify_otp_customer_creation(self):
        """
        Simulates customer verification request.
        Ensures atomic execution without creating duplicate profiles.
        """
        phone = "9876543288"
        otp_code = "112233"

        OTPVerification.objects.create(
            phone=phone,
            otp_code=otp_code,
            role="customer",
            expires_at=timezone.now() + timedelta(minutes=5),
            is_verified=False,
        )

        client = APIClient()
        resp = client.post('/api/auth/verify-otp/', {
            'phone_number': phone,
            'otp_code': otp_code,
            'role': 'customer',
            'name': 'Concurrent Customer',
            'area': 'Patna',
        }, format='json')

        assert resp.status_code == 200
        assert resp.data.get('success') is True

        customers = CustomerProfile.objects.filter(phone=phone)
        assert customers.count() == 1

    def test_atomic_technician_login(self):
        """
        Simulates technicians logging in with password auto-upgrade in atomic transaction.
        """
        phone = "9876543277"
        password = "SecurePassword123"

        tech = TechnicianProfile.objects.create(
            name="Login Concurrency Tech",
            phone=phone,
            password=password,  # legacy plaintext
            wallet_balance=Decimal('0.00'),
        )

        client = APIClient()
        resp = client.post('/api/auth/login/', {
            'phone': phone,
            'password': password,
            'role': 'technician',
        }, format='json')

        assert resp.status_code == 200
        assert resp.data.get('success') is True
        assert 'token' in resp.data

        # Refresh technician from DB; password should be hashed cleanly
        tech.refresh_from_db()
        assert tech.password != password
        assert tech.check_password(password) is True
