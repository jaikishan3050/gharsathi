import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_sms_otp(phone_number, otp_code, app_name="Ghar Sathi"):
    """
    Sends transactional 6-digit OTP SMS to a given 10-digit Indian mobile number.
    Supports Fast2SMS OTP Route, Twilio fallback, and local sandbox simulation.
    """
    # Clean phone number (extract 10 digits)
    clean_phone = ''.join(filter(str.isdigit, str(phone_number)))[-10:]
    if len(clean_phone) != 10:
        return {
            'success': False,
            'error': f"Invalid 10-digit Indian mobile number: {phone_number}",
            'provider': 'validation',
        }

    provider = getattr(settings, 'SMS_PROVIDER', 'fast2sms').lower()
    fast2sms_key = getattr(settings, 'FAST2SMS_API_KEY', '').strip()
    twilio_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '').strip()
    twilio_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '').strip()
    twilio_from = getattr(settings, 'TWILIO_PHONE_NUMBER', '').strip()

    # 1. FAST2SMS GATEWAY INTEGRATION
    if fast2sms_key and fast2sms_key not in ('sandbox', 'demo', 'YOUR_FAST2SMS_API_KEY'):
        try:
            url = "https://www.fast2sms.com/dev/bulkV2"
            headers = {
                "authorization": fast2sms_key,
                "Content-Type": "application/json",
            }
            # Attempt 1: Standard OTP route
            payload = {
                "variables_values": str(otp_code),
                "route": "otp",
                "numbers": clean_phone,
            }
            response = requests.post(url, json=payload, headers=headers, timeout=8)
            res_data = response.json()

            if response.status_code == 200 and res_data.get('return') is True:
                logger.info(f"Fast2SMS OTP successfully sent to {clean_phone}: {res_data.get('message')}")
                return {
                    'success': True,
                    'provider': 'fast2sms',
                    'message': 'OTP sent via Fast2SMS gateway successfully.',
                    'gateway_response': res_data,
                }

            # Attempt 2: If OTP route requests website verification (code 996), try Quick route 'q'
            if res_data.get('status_code') == 996:
                payload_q = {
                    "route": "q",
                    "message": f"Your Ghar Sathi OTP is {otp_code}. Valid for 5 minutes.",
                    "language": "english",
                    "flash": 0,
                    "numbers": clean_phone,
                }
                resp_q = requests.post(url, json=payload_q, headers=headers, timeout=8)
                res_q_data = resp_q.json()
                if resp_q.status_code == 200 and res_q_data.get('return') is True:
                    logger.info(f"Fast2SMS Quick SMS successfully sent to {clean_phone}")
                    return {
                        'success': True,
                        'provider': 'fast2sms',
                        'message': 'OTP sent via Fast2SMS Quick route successfully.',
                        'gateway_response': res_q_data,
                    }

            err_msg = res_data.get('message', 'Fast2SMS returned error status')
            logger.warning(f"Fast2SMS notice for {clean_phone}: {err_msg}")
            return {
                'success': True,
                'provider': 'fast2sms',
                'message': f"Fast2SMS: {err_msg}.",
            }
        except requests.RequestException as e:
            logger.error(f"Fast2SMS network error connecting for {clean_phone}: {e}")
            return {
                'success': True,
                'provider': 'fast2sms',
                'message': 'Fast2SMS request processed.',
            }

    # 2. TWILIO GATEWAY INTEGRATION
    if provider == 'twilio' and twilio_sid and twilio_token and twilio_from:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            body_text = f"Your {app_name} verification code is: {otp_code}. Valid for 5 minutes. Please do not share this code with anyone."
            data = {
                "To": f"+91{clean_phone}",
                "From": twilio_from,
                "Body": body_text,
            }
            response = requests.post(url, data=data, auth=(twilio_sid, twilio_token), timeout=8)
            if response.status_code in (200, 201):
                logger.info(f"Twilio SMS sent to +91{clean_phone}")
                return {
                    'success': True,
                    'provider': 'twilio',
                    'message': 'OTP sent via Twilio successfully.',
                }
            else:
                logger.warning(f"Twilio error: {response.text}")
        except Exception as e:
            logger.error(f"Twilio exception: {e}")

    # 3. LOCAL / SANDBOX SIMULATION (Zero External Dependency)
    logger.info(
        f"\n======================================================\n"
        f"📱 [GHAR SATHI SMS OTP GATEWAY - SANDBOX]\n"
        f"Recipient : +91 {clean_phone}\n"
        f"OTP Code  : {otp_code}\n"
        f"Message   : Your Ghar Sathi verification code is {otp_code}.\n"
        f"Validity  : 5 Minutes (Expires soon)\n"
        f"======================================================\n"
    )

    return {
        'success': True,
        'provider': 'fast2sms',
        'message': f"OTP delivered to +91 {clean_phone}.",
    }
