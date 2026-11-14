"""Isolated database integration checks, never run against production."""
from datetime import timedelta
from decimal import Decimal
import hashlib
import hmac
from unittest.mock import patch
import jwt
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from api.models import Booking, CustomerProfile, Service, TechnicianProfile

pytestmark = pytest.mark.django_db

def customer_login(phone, name):
    client = APIClient()
    sent = client.post('/api/auth/send-otp/', {'phone_number': phone, 'role': 'customer'}, format='json')
    assert sent.status_code == 200, sent.data
    verified = client.post('/api/auth/verify-otp/', {
        'phone_number': phone, 'role': 'customer', 'otp_code': sent.data['debug_otp'],
        'name': name,
    }, format='json')
    assert verified.status_code == 200, verified.data
    token = verified.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client, token

def test_customer_jwt_booking_persistence_ownership_and_mocked_payment(settings):
    settings.RAZORPAY_KEY_ID = 'rzp_test_local_only'
    settings.RAZORPAY_KEY_SECRET = 'local-verification-secret-no-live-access'
    owner, token = customer_login('9000000101', 'LOCAL VERIFICATION ONLY')
    assert owner.get('/api/auth/me/').data['role'] == 'customer'
    service = Service.objects.create(name='LOCAL TEST SERVICE', slug='local-verify', base_price=Decimal('499'))
    response = owner.post('/api/bookings/', {
        'service': service.pk, 'service_name': service.name,
        'customer_name': 'Forged name', 'customer_phone': '9000000999',
        'address': 'Isolated SQLite test only', 'area': 'Local test',
        'base_price': '499.00', 'total_amount': '499.00',
        'payment_method': 'Online / Razorpay UPI', 'payment_status': 'Paid',
        'razorpay_payment_id': 'forged', 'razorpay_order_id': 'forged',
        'razorpay_signature': 'forged',
    }, format='json')
    assert response.status_code == 201, response.data
    booking = Booking.objects.get(pk=response.data['id'])
    assert booking.customer_phone == '9000000101'
    assert booking.customer_name == 'LOCAL VERIFICATION ONLY'
    assert booking.payment_status == 'Pending'
    assert not booking.razorpay_order_id and not booking.razorpay_payment_id
    assert booking.status == 'Pending' and booking.technician_id is None
    reloaded = APIClient()
    reloaded.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    assert reloaded.get(f'/api/bookings/{booking.pk}/').status_code == 200
    stranger, _ = customer_login('9000000102', 'Other local test')
    assert stranger.get(f'/api/bookings/{booking.pk}/').status_code == 404
    assert stranger.post('/api/payments/create-order/', {
        'booking_id': booking.booking_code, 'amount': '499.00'}, format='json').status_code == 403

    with patch('razorpay.Client') as gateway:
        gateway.return_value.order.create.return_value = {'id': 'order_local_verification'}
        created = owner.post('/api/payments/create-order/', {
            'booking_id': booking.booking_code, 'amount': '499.00'}, format='json')
        assert created.status_code == 200, created.data
        booking.refresh_from_db()
        assert booking.razorpay_order_id == 'order_local_verification'
        assert booking.payment_status == 'Pending'
        retry = owner.post('/api/payments/create-order/', {
            'booking_id': booking.booking_code, 'amount': '499.00'}, format='json')
        assert retry.data['order_id'] == created.data['order_id']
        gateway.return_value.order.create.assert_called_once()
        signature = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(),
            b'order_local_verification|pay_local_verification', hashlib.sha256).hexdigest()
        payload = {'booking_id': booking.booking_code, 'razorpay_order_id': 'order_local_verification',
                   'razorpay_payment_id': 'pay_local_verification', 'razorpay_signature': signature}
        payment = {'status': 'authorized', 'order_id': 'order_local_verification',
                   'currency': 'INR', 'amount': 49900}
        gateway.return_value.payment.fetch.return_value = payment
        assert owner.post('/api/payments/verify/', payload, format='json').status_code == 400
        booking.refresh_from_db()
        assert booking.payment_status == 'Pending'
        gateway.return_value.payment.fetch.return_value = {**payment, 'status': 'captured'}
        paid = owner.post('/api/payments/verify/', payload, format='json')
        assert paid.status_code == 200, paid.data
        booking.refresh_from_db()
        assert booking.payment_status == 'Paid'
        assert booking.razorpay_payment_id == 'pay_local_verification'
        assert owner.post('/api/payments/create-order/', {
            'booking_id': booking.booking_code, 'amount': '499.00'}, format='json').status_code == 409

def test_technician_password_login_jwt_and_wrong_role_denied():
    tech = TechnicianProfile.objects.create(name='Local technician', phone='9000000103')
    tech.set_password('local-test-password')
    client = APIClient()
    wrong = client.post('/api/auth/login/', {'phone': tech.phone,
        'password': 'wrong', 'role': 'technician'}, format='json')
    assert wrong.status_code == 400
    login = client.post('/api/auth/login/', {'phone': tech.phone,
        'password': 'local-test-password', 'role': 'technician'}, format='json')
    assert login.status_code == 200
    assert 'password' not in login.data['user']
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['token']}")
    assert client.get('/api/auth/me/').data['role'] == 'technician'
    assert client.post('/api/bookings/', {}, format='json').status_code == 403

def test_admin_login_expired_tampered_and_revoked_jwt(settings):
    admin = get_user_model().objects.create_superuser('local-admin', 'local-admin@example.test', 'local-admin-password')
    client = APIClient()
    login = client.post('/api/auth/login/', {'username': admin.email,
        'password': 'local-admin-password', 'role': 'admin'}, format='json')
    assert login.status_code == 200
    token = login.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    assert client.get('/api/technicians/').status_code == 200
    claims = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
    expired = jwt.encode({**claims, 'exp': timezone.now()-timedelta(seconds=5)}, settings.SECRET_KEY, algorithm='HS256')
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {expired}')
    assert client.get('/api/technicians/').status_code in (401,403)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}tampered')
    assert client.get('/api/technicians/').status_code in (401,403)
    admin.last_login = timezone.now()+timedelta(seconds=2)
    admin.save(update_fields=['last_login'])
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    assert client.get('/api/technicians/').status_code in (401,403)
