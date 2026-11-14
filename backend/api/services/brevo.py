"""Brevo transactional email transport for OTP and booking Happy Codes.

Configure BREVO_API_KEY and a verified BREVO_SENDER_EMAIL on the server.
Never include credentials or verification codes in application logs.
"""
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)
BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"


class EmailDeliveryError(Exception):
    """The provider did not accept a transactional email."""


def send_transactional_email(*, recipient, subject, body):
    api_key = getattr(settings, "BREVO_API_KEY", "")
    sender = getattr(settings, "BREVO_SENDER_EMAIL", "")
    if not api_key or not sender:
        raise EmailDeliveryError("Transactional email is not configured.")

    payload = {
        "sender": {"email": sender, "name": "GharSathi"},
        "to": [{"email": recipient}],
        "subject": subject,
        "textContent": body,
    }
    req = Request(
        BREVO_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as response:
            if response.status not in (200, 201, 202):
                raise EmailDeliveryError("Email provider rejected the request.")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        logger.warning("Transactional email delivery failed: %s", type(exc).__name__)
        raise EmailDeliveryError("Email delivery is temporarily unavailable.") from exc


def send_login_otp(email, code, expiry_minutes=5):
    send_transactional_email(
        recipient=email,
        subject="Your GharSathi login code",
        body=(
            f"Your GharSathi login code is {code}. "
            f"It expires in {expiry_minutes} minutes. "
            "Do not share this code with anyone."
        ),
    )


def send_happy_code(email, booking_code, code):
    send_transactional_email(
        recipient=email,
        subject=f"GharSathi service verification for {booking_code}",
        body=(
            f"Your service verification code for booking {booking_code} is {code}. "
            "Only share it with your assigned technician when the service is completed."
        ),
    )
