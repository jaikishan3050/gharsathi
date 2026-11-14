"""GS-01 regression coverage for admin-only endpoints and technician self-service fields."""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from api.authentication import AuthenticatedPrincipal
from api.models import CustomerProfile, TechnicianProfile


@pytest.fixture
def admin_account(db):
    return get_user_model().objects.create_superuser(
        username="role-admin", email="role-admin@example.test", password="test-password"
    )


@pytest.fixture
def customer_account(db):
    return CustomerProfile.objects.create(name="Customer", phone="9876543201")


@pytest.fixture
def technician_account(db):
    return TechnicianProfile.objects.create(
        name="Technician", phone="9876543202", trade="Electrician",
        wallet_balance=Decimal("200.00"), kyc_status="Pending",
    )


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", [
    "/api/admin/analytics/",
    "/api/admin/withdrawals/",
    "/api/technicians/",
    "/api/customers/",
])
def test_admin_resources_reject_anonymous_and_non_admin(endpoint, customer_account, technician_account):
    client = APIClient()
    assert client.get(endpoint).status_code in (401, 403)

    for role, account in (("customer", customer_account), ("technician", technician_account)):
        client.force_authenticate(user=AuthenticatedPrincipal(role, account))
        assert client.get(endpoint).status_code == 403, (role, endpoint)


@pytest.mark.django_db
def test_admin_can_access_analytics(admin_account):
    client = APIClient()
    client.force_authenticate(user=AuthenticatedPrincipal("admin", admin_account))
    assert client.get("/api/admin/analytics/").status_code == 200


@pytest.mark.django_db
def test_technician_cannot_update_privileged_fields(technician_account):
    client = APIClient()
    client.force_authenticate(user=AuthenticatedPrincipal("technician", technician_account))
    response = client.patch(
        f"/api/technicians/{technician_account.pk}/",
        {
            "name": "Updated Technician",
            "wallet_balance": "999999.00",
            "kyc_status": "Verified",
            "rating_avg": "5.0",
            "password": "attacker-chosen-password",
            "phone": "9876543299",
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    technician_account.refresh_from_db()
    assert technician_account.name == "Updated Technician"
    assert technician_account.wallet_balance == Decimal("200.00")
    assert technician_account.kyc_status == "Pending"
    assert technician_account.phone == "9876543202"
    assert not technician_account.check_password("attacker-chosen-password")


@pytest.mark.django_db
def test_technician_cannot_edit_other_technician(technician_account):
    other = TechnicianProfile.objects.create(name="Other", phone="9876543203")
    client = APIClient()
    client.force_authenticate(user=AuthenticatedPrincipal("technician", technician_account))
    response = client.patch(
        f"/api/technicians/{other.pk}/", {"name": "Tampered"}, format="json"
    )
    # Viewset resolves a technician's own profile even if another ID is supplied.
    assert response.status_code in (200, 403, 404)
    other.refresh_from_db()
    assert other.name == "Other"
