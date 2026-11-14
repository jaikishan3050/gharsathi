"""Contract tests for Brevo transactional email transport (no network calls)."""
import json
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import pytest
from django.test import override_settings

from api.services.brevo import (
    BREVO_ENDPOINT,
    EmailDeliveryError,
    send_happy_code,
    send_login_otp,
    send_transactional_email,
)


class AcceptedResponse:
    status = 201

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.mark.parametrize('code', [200, 201, 202])
@override_settings(BREVO_API_KEY='test-api-key', BREVO_SENDER_EMAIL='verified@example.test')
def test_brevo_accepts_supported_success_statuses(code):
    response = AcceptedResponse()
    response.status = code
    with patch('api.services.brevo.urlopen', return_value=response) as post:
        send_login_otp('customer@example.test', '123456')
    request = post.call_args.args[0]
    assert request.full_url == BREVO_ENDPOINT
    assert request.get_method() == 'POST'
    assert request.get_header('Api-key') == 'test-api-key'
    payload = json.loads(request.data.decode('utf-8'))
    assert payload['sender']['email'] == 'verified@example.test'
    assert payload['to'] == [{'email': 'customer@example.test'}]
    assert '123456' in payload['textContent']
    assert post.call_args.kwargs['timeout'] == 10


@override_settings(BREVO_API_KEY='test-api-key', BREVO_SENDER_EMAIL='verified@example.test')
def test_happy_code_uses_booking_identifier_and_recipient():
    with patch('api.services.brevo.urlopen', return_value=AcceptedResponse()) as post:
        send_happy_code('owner@example.test', 'GS-BOOK-0001', '9876')
    payload = json.loads(post.call_args.args[0].data.decode('utf-8'))
    assert payload['to'] == [{'email': 'owner@example.test'}]
    assert 'GS-BOOK-0001' in payload['subject']
    assert '9876' in payload['textContent']


@pytest.mark.parametrize('failure', [
    URLError('provider offline'),
    TimeoutError('timeout'),
    OSError('socket error'),
    HTTPError(BREVO_ENDPOINT, 401, 'Unauthorized', {}, BytesIO(b'')),
])
@override_settings(BREVO_API_KEY='test-api-key', BREVO_SENDER_EMAIL='verified@example.test')
def test_brevo_network_and_http_failures_are_safe(failure):
    with patch('api.services.brevo.urlopen', side_effect=failure):
        with pytest.raises(EmailDeliveryError):
            send_login_otp('customer@example.test', '123456')


@override_settings(BREVO_API_KEY='', BREVO_SENDER_EMAIL='')
def test_missing_configuration_never_calls_provider():
    with patch('api.services.brevo.urlopen') as post:
        with pytest.raises(EmailDeliveryError):
            send_transactional_email(
                recipient='customer@example.test', subject='Test', body='Test'
            )
    post.assert_not_called()


@override_settings(BREVO_API_KEY='test-api-key', BREVO_SENDER_EMAIL='verified@example.test')
def test_unexpected_brevo_status_rejected():
    response = AcceptedResponse()
    response.status = 429
    with patch('api.services.brevo.urlopen', return_value=response):
        with pytest.raises(EmailDeliveryError):
            send_login_otp('customer@example.test', '123456')
