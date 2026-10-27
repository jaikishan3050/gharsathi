import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)
FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2'


def _failure(provider, message, status_code=None):
    result = {'success': False, 'provider': provider, 'error': message}
    if status_code is not None:
        result['status_code'] = status_code
    return result


def _fast2sms_request(api_key, payload):
    response = requests.post(
        FAST2SMS_URL,
        json=payload,
        headers={
            'authorization': api_key,
            'accept': 'application/json',
            'content-type': 'application/json',
        },
        timeout=15,
    )
    try:
        data = response.json()
    except ValueError:
        data = {}
    return response, data


def send_sms_otp(phone_number, otp_code, app_name='Ghar Sathi'):
    """Send an OTP using the configured gateway and report delivery failures honestly."""
    clean_phone = ''.join(filter(str.isdigit, str(phone_number)))[-10:]
    if len(clean_phone) != 10:
        return _failure('validation', 'A valid 10-digit Indian mobile number is required.')

    provider = getattr(settings, 'SMS_PROVIDER', 'fast2sms').strip().lower()
    fast2sms_key = getattr(settings, 'FAST2SMS_API_KEY', '').strip()
    twilio_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '').strip()
    twilio_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '').strip()
    twilio_from = getattr(settings, 'TWILIO_PHONE_NUMBER', '').strip()

    if provider == 'fast2sms':
        if not fast2sms_key:
            return _failure('fast2sms', 'Fast2SMS API key is not configured on the server.')

        try:
            response, data = _fast2sms_request(fast2sms_key, {
                'variables_values': str(otp_code),
                'route': 'otp',
                'numbers': clean_phone,
            })

            if response.ok and data.get('return') is True:
                logger.info('Fast2SMS accepted OTP delivery (status=%s).', data.get('status_code'))
                return {'success': True, 'provider': 'fast2sms', 'message': 'OTP sent by SMS.'}

            # Fast2SMS may require website KYC for its OTP route. Quick SMS is a
            # separate, potentially paid route; only report success when accepted.
            if data.get('status_code') == 996 and getattr(settings, 'FAST2SMS_ALLOW_QUICK_FALLBACK', False):
                quick_response, quick_data = _fast2sms_request(fast2sms_key, {
                    'route': 'q',
                    'message': f'Your {app_name} verification code is {otp_code}. Valid for 5 minutes.',
                    'language': 'english',
                    'flash': 0,
                    'numbers': clean_phone,
                })
                if quick_response.ok and quick_data.get('return') is True:
                    logger.info('Fast2SMS Quick SMS accepted OTP delivery.')
                    return {'success': True, 'provider': 'fast2sms', 'message': 'OTP sent by SMS.'}
                data = quick_data or data
                response = quick_response

            error = data.get('message') or 'Fast2SMS did not accept the SMS request.'
            logger.warning('Fast2SMS rejected OTP request (HTTP %s, code %s): %s', response.status_code, data.get('status_code'), error)
            return _failure('fast2sms', error, data.get('status_code') or response.status_code)
        except requests.RequestException as exc:
            logger.warning('Fast2SMS request failed: %s', exc.__class__.__name__)
            return _failure('fast2sms', 'Could not connect to Fast2SMS. Please try again.')

    if provider == 'twilio':
        if not (twilio_sid and twilio_token and twilio_from):
            return _failure('twilio', 'Twilio credentials are not fully configured on the server.')
        try:
            url = f'https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json'
            response = requests.post(
                url,
                data={
                    'To': f'+91{clean_phone}',
                    'From': twilio_from,
                    'Body': f'Your {app_name} verification code is: {otp_code}. Valid for 5 minutes. Please do not share this code.',
                },
                auth=(twilio_sid, twilio_token),
                timeout=15,
            )
            if response.status_code in (200, 201):
                return {'success': True, 'provider': 'twilio', 'message': 'OTP sent by SMS.'}
            logger.warning('Twilio rejected OTP delivery (HTTP %s).', response.status_code)
            return _failure('twilio', 'Twilio did not accept the SMS request.', response.status_code)
        except requests.RequestException as exc:
            logger.warning('Twilio request failed: %s', exc.__class__.__name__)
            return _failure('twilio', 'Could not connect to Twilio. Please try again.')

    if getattr(settings, 'DEBUG', False):
        logger.info('Development OTP for +91%s: %s', clean_phone, otp_code)
        return {'success': True, 'provider': 'development', 'message': 'Development OTP generated.'}

    return _failure(provider or 'unconfigured', 'No working SMS provider is configured.')
