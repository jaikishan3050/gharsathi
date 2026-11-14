"""GS-05: API-level booking-to-completion integration regression tests."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from api.authentication import AuthenticatedPrincipal
from api.models import Booking, CustomerProfile, Service, TechnicianProfile, WalletTransaction


@pytest.mark.django_db
def test_customer_booking_through_technician_completion_and_rating():
    service = Service.objects.create(
        name="GS05 Electrical Repair",
        slug="gs05-electrical-repair",
        category="electrical",
        base_price=Decimal("499.00"),
        commission_fee=Decimal("149.00"),
    )
    customer = CustomerProfile.objects.create(
        name="GS05 Customer", phone="9876500101",
    )
    technician = TechnicianProfile.objects.create(
        name="GS05 Technician", phone="9876500102",
        trade="Electrician", kyc_status="Verified",
        wallet_balance=Decimal("500.00"),
    )
    client = APIClient()
    client.force_authenticate(user=AuthenticatedPrincipal("customer", customer))
    create_response = client.post(
        "/api/bookings/",
        {
            "service": service.pk,
            "service_name": service.name,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "address": "GS05 test address",
            "area": "Test area",
            "base_price": "499.00",
            "total_amount": "499.00",
            "payment_method": "Cash on Service",
        },
        format="json",
    )
    assert create_response.status_code == 201, create_response.data
    booking = Booking.objects.get(pk=create_response.data["id"])
    assert booking.customer_phone == customer.phone
    assert booking.technician_id is None
    assert booking.status == "Pending"

    # The customer must not be able to accept a technician-only job.
    forbidden = client.post(f"/api/bookings/{booking.pk}/accept/", format="json")
    assert forbidden.status_code == 403

    client.force_authenticate(user=AuthenticatedPrincipal("technician", technician))
    accepted = client.post(f"/api/bookings/{booking.pk}/accept/", format="json")
    assert accepted.status_code == 200, accepted.data
    booking.refresh_from_db()
    assert booking.status == "Accepted"
    assert booking.technician_id == technician.pk

    started = client.post(f"/api/bookings/{booking.pk}/start/", format="json")
    assert started.status_code == 200, started.data
    booking.refresh_from_db()
    assert booking.status == "In Progress"

    wrong_code = client.post(
        f"/api/bookings/{booking.pk}/complete/",
        {"service_pin": "wrong"}, format="json",
    )
    assert wrong_code.status_code == 400
    technician.refresh_from_db()
    assert technician.wallet_balance == Decimal("500.00")

    assert booking.service_pin, "Booking must have a Happy Code before completion"
    completed = client.post(
        f"/api/bookings/{booking.pk}/complete/",
        {"service_pin": booking.service_pin}, format="json",
    )
    assert completed.status_code == 200, completed.data
    booking.refresh_from_db()
    technician.refresh_from_db()
    assert booking.status == "Completed"
    assert technician.wallet_balance == Decimal("351.00")
    assert WalletTransaction.objects.filter(
        booking=booking, technician=technician, txn_type="DEBIT",
        amount=Decimal("149.00"),
    ).count() == 1

    repeated = client.post(
        f"/api/bookings/{booking.pk}/complete/",
        {"service_pin": booking.service_pin}, format="json",
    )
    assert repeated.status_code == 400
    assert WalletTransaction.objects.filter(
        booking=booking, txn_type="DEBIT",
    ).count() == 1

    client.force_authenticate(user=AuthenticatedPrincipal("customer", customer))
    rated = client.post(
        f"/api/bookings/{booking.pk}/rate/",
        {"rating": 5, "review_text": "Good service"}, format="json",
    )
    assert rated.status_code == 200, rated.data
    booking.refresh_from_db()
    technician.refresh_from_db()
    assert booking.rating == 5
    assert technician.rating_count == 1
