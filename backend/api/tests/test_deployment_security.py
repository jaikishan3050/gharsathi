from datetime import timedelta
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.db import OperationalError
from django.utils import timezone
import jwt
import pytest
from rest_framework.test import APIClient

from api.authentication import credential_version
from api.consumers import JobDispatchConsumer
from api.models import OTPVerification, TechnicianProfile, CustomerProfile


@pytest.mark.django_db
def test_production_otp_uses_sms_and_never_returns_code(settings):
    settings.DEBUG = False
    settings.OTP_EXPOSE_DEBUG_CODE = True  # DEBUG=False must override this flag.
    with patch('api.services.sms.send_sms_otp', return_value={'success': True, 'provider': 'test_sms'}) as send:
        response = APIClient().post('/api/auth/send-otp/', {'phone_number': '9000000401'}, format='json')
    assert response.status_code == 200
    assert 'otp' not in response.data and 'debug_otp' not in response.data
    assert response.data['provider'] == 'test_sms'
    record = OTPVerification.objects.get(phone='9000000401')
    send.assert_called_once_with('9000000401', record.otp_code)


@pytest.mark.django_db
def test_failed_sms_does_not_leave_a_usable_otp(settings):
    settings.DEBUG = False
    with patch('api.services.sms.send_sms_otp', return_value={'success': False, 'error': 'provider details'}):
        response = APIClient().post('/api/auth/send-otp/', {'phone_number': '9000000402'}, format='json')
    assert response.status_code == 503
    assert not OTPVerification.objects.filter(phone='9000000402', is_verified=False).exists()
    assert 'provider details' not in str(response.data)


@pytest.mark.django_db
def test_otp_resend_has_a_real_phone_cooldown(settings):
    settings.DEBUG = True
    settings.OTP_EXPOSE_DEBUG_CODE = True
    client = APIClient()
    assert client.post('/api/auth/send-otp/', {'phone_number':'9000000403'}, format='json').status_code == 200
    assert client.post('/api/auth/send-otp/', {'phone_number':'9000000403'}, format='json').status_code == 429


@pytest.mark.django_db
def test_technician_password_reset_revokes_jwt_on_me_and_protected_routes(settings):
    tech = TechnicianProfile.objects.create(name='Local test', phone='9000000404')
    tech.set_password('initial-local-password')
    client = APIClient()
    login = client.post('/api/auth/login/', {'phone':tech.phone,'password':'initial-local-password','role':'technician'}, format='json')
    token = login.data['token']
    tech.otp_code = '123456'
    tech.otp_expires_at = timezone.now()+timedelta(minutes=5)
    tech.save()
    reset = client.post('/api/technicians/reset-password-otp/', {
        'phone':tech.phone,'otp_code':'123456','new_password':'replacement-local-password'}, format='json')
    assert reset.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    assert client.get('/api/auth/me/').status_code in (401,403)
    assert client.get('/api/bookings/').status_code in (401,403)
    assert APIClient().get('/api/auth/me/', {'token':token}).status_code in (401,403)


@pytest.mark.django_db
def test_health_checks_database_and_reports_revision(settings):
    settings.DEPLOYMENT_COMMIT = 'a'*40
    response = APIClient().get('/')
    assert response.status_code == 200
    assert response.json()['commit'] == 'a'*40
    assert 'no-store' in response['Cache-Control']
    with patch('gharsathi_backend.urls.connection.cursor', side_effect=OperationalError('private connection details')):
        response = APIClient().get('/')
    assert response.status_code == 503
    assert response.json()['database'] == 'unavailable'
    assert 'private connection details' not in response.content.decode()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize('identity', ['anonymous','customer','technician'])
def test_dispatch_authentication_before_broadcast(identity, settings):
    if identity == 'technician':
        profile = TechnicianProfile.objects.create(name='Local dispatch test',phone='9000000405')
        profile.set_password('dispatch-test-password')
        claims = {'role':'technician','id':profile.pk,'credential_version':credential_version(profile)}
    elif identity == 'customer':
        profile = CustomerProfile.objects.create(name='Local customer',phone='9000000406')
        claims = {'role':'customer','id':profile.pk}
    else:
        claims = {}
    token = jwt.encode({**claims, 'exp':timezone.now()+timedelta(minutes=5)},settings.SECRET_KEY,algorithm='HS256')

    async def scenario():
        socket = WebsocketCommunicator(JobDispatchConsumer.as_asgi(), '/ws/jobs/')
        connected, _ = await socket.connect()
        assert connected
        await get_channel_layer().group_send('jobs_broadcast', {'type':'job_broadcast','data':{'type':'secret_job'}})
        assert await socket.receive_nothing(timeout=0.05)
        await socket.send_json_to({'action':'authenticate','token':token} if identity!='anonymous' else {'action':'ping'})
        if identity=='technician':
            assert (await socket.receive_json_from())['type']=='authenticated'
            await get_channel_layer().group_send('jobs_broadcast', {'type':'job_broadcast','data':{'type':'allowed_job'}})
            assert (await socket.receive_json_from())['type']=='allowed_job'
        else:
            event = await socket.receive_output()
            assert event['type']=='websocket.close' and event['code']==4401
        await socket.disconnect()
    async_to_sync(scenario)()
