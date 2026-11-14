import hashlib
import hmac
from decimal import Decimal
import pytest
from django.conf import settings
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from api.authentication import AuthenticatedPrincipal
from api.models import (
    Service,
    SubService,
    TechnicianProfile,
    CustomerProfile,
    Booking,
    WalletTransaction,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticate_as(api_client, db):
    """Authenticate requests as a real project role without weakening API permissions."""
    def authenticate(role, profile):
        api_client.force_authenticate(user=AuthenticatedPrincipal(role, profile))
    return authenticate


@pytest.fixture
def admin_user(db):
    User = get_user_model()
    return User.objects.create_superuser(
        username="ci-admin",
        email="ci-admin@example.test",
        password="ci-test-password",
    )


@pytest.fixture
def sample_service(db):
    return Service.objects.create(
        name="AC Deep Clean Service",
        slug="ac-deep-clean",
        category="appliance",
        base_price=Decimal("499.00"),
        description="Complete AC cleaning and filter inspection",
        subcategories=[],
    )


@pytest.fixture
def verified_technician(db):
    return TechnicianProfile.objects.create(
        partner_id="GS-TECH-777",
        name="Sunil Sharma",
        phone="9876543210",
        trade="Appliance Repair",
        wallet_balance=Decimal("500.00"),
        kyc_status="Verified",
        rating_avg=Decimal("4.9"),
        rating_count=20,
        completed_jobs=15,
    )


@pytest.fixture
def low_balance_technician(db):
    return TechnicianProfile.objects.create(
        partner_id="GS-TECH-101",
        name="Rohan Verma",
        phone="9876500001",
        trade="Appliance Repair",
        wallet_balance=Decimal("100.00"),  # Below ₹150 guardrail
        kyc_status="Verified",
        rating_avg=Decimal("4.5"),
        rating_count=5,
        completed_jobs=3,
    )


@pytest.fixture
def unverified_technician(db):
    return TechnicianProfile.objects.create(
        partner_id="GS-TECH-202",
        name="Vikram Kumar",
        phone="9876500002",
        trade="Appliance Repair",
        wallet_balance=Decimal("600.00"),
        kyc_status="Pending",  # KYC unverified
        rating_avg=Decimal("5.0"),
        rating_count=0,
        completed_jobs=0,
    )


@pytest.fixture
def active_booking(db, sample_service, verified_technician):
    return Booking.objects.create(
        booking_code="GS-TEST-9001",
        service=sample_service,
        service_name=sample_service.name,
        customer_name="Aarav Singh",
        customer_phone="9811223344",
        address="Flat 402, Bailey Road, Patna",
        area="Bailey Road",
        base_price=Decimal("499.00"),
        total_amount=Decimal("499.00"),
        status="In Progress",
        service_pin="4829",
        technician=verified_technician,
        technician_name=verified_technician.name,
        technician_phone=verified_technician.phone,
    )


@pytest.mark.django_db
class TestFinancialAndOperationalFlows:

    def test_atomic_platform_fee_deduction_on_happy_code(self, api_client, active_booking, verified_technician, authenticate_as):
        """
        Tests atomic deduction of ₹149 platform fee upon submitting valid 4-digit Happy Code.
        Verifies wallet balance updates and ledger DEBIT transaction is recorded.
        """
        authenticate_as('technician', verified_technician)
        initial_balance = verified_technician.wallet_balance  # ₹500.00
        url = f"/api/bookings/{active_booking.id}/complete/"

        response = api_client.post(url, {"service_pin": "4829"}, format="json")
        assert response.status_code == 200
        assert response.data["success"] is True

        # Refresh technician from DB
        verified_technician.refresh_from_db()
        expected_balance = initial_balance - Decimal("149.00")
        assert verified_technician.wallet_balance == expected_balance
        assert verified_technician.completed_jobs == 16

        # Verify ledger audit entry
        txn = WalletTransaction.objects.filter(
            technician=verified_technician,
            booking=active_booking,
            txn_type="DEBIT",
        ).first()
        assert txn is not None
        assert txn.amount == Decimal("149.00")
        assert txn.balance_after == expected_balance

        # Verify booking status
        active_booking.refresh_from_db()
        assert active_booking.status == "Completed"

    def test_dynamic_custom_service_commission_deduction(self, api_client, verified_technician, authenticate_as):
        """
        Tests that when a service has a custom commission fee (e.g. ₹250.00),
        the completion endpoint deducts exactly ₹250.00 from the technician wallet.
        """
        custom_service = Service.objects.create(
            name="Premium Chimney Deep Clean",
            slug="premium-chimney-clean",
            category="cleaning",
            base_price=Decimal("1299.00"),
            commission_fee=Decimal("250.00"),
        )
        custom_booking = Booking.objects.create(
            booking_code="GS-CUSTOM-COMM-01",
            service=custom_service,
            service_name=custom_service.name,
            customer_name="Priya Kumari",
            customer_phone="9876543299",
            address="Kankarbagh, Patna",
            area="Patna",
            base_price=Decimal("1299.00"),
            total_amount=Decimal("1299.00"),
            status="In Progress",
            service_pin="7788",
            technician=verified_technician,
        )

        authenticate_as('technician', verified_technician)
        initial_balance = verified_technician.wallet_balance
        url = f"/api/bookings/{custom_booking.id}/complete/"

        response = api_client.post(url, {"service_pin": "7788"}, format="json")
        assert response.status_code == 200
        assert response.data["success"] is True

        verified_technician.refresh_from_db()
        assert verified_technician.wallet_balance == initial_balance - Decimal("250.00")

        custom_booking.refresh_from_db()
        assert custom_booking.platform_fee == Decimal("250.00")
        assert custom_booking.status == "Completed"

    def test_service_crud_with_dynamic_commission(self, api_client, admin_user, authenticate_as):
        """
        Tests creating and updating a service with a dynamic commission_fee.
        """
        authenticate_as('admin', admin_user)
        create_payload = {
            "name": "Microwave Diagnostic & Repair",
            "category": "appliance",
            "base_price": "599.00",
            "commission_fee": "175.00",
            "description": "Magnetron and board testing",
        }
        res = api_client.post("/api/services/", create_payload, format="json")
        assert res.status_code == 201
        assert Decimal(str(res.data["commission_fee"])) == Decimal("175.00")

        service_id = res.data["id"]

        # Test PATCH updating the commission_fee
        patch_res = api_client.patch(
            f"/api/services/{service_id}/",
            {"commission_fee": "220.00"},
            format="json",
        )
        assert patch_res.status_code == 200
        assert Decimal(str(patch_res.data["commission_fee"])) == Decimal("220.00")

    def test_invalid_happy_code_rejected_without_deduction(self, api_client, active_booking, verified_technician, authenticate_as):
        """
        Submitting an incorrect Happy Code PIN must return 400 Bad Request
        and leave technician wallet balance completely untouched.
        """
        authenticate_as('technician', verified_technician)
        initial_balance = verified_technician.wallet_balance
        url = f"/api/bookings/{active_booking.id}/complete/"

        response = api_client.post(url, {"service_pin": "9999"}, format="json")
        assert response.status_code == 400
        assert "Invalid Happy Code" in response.data.get("error", "")

        verified_technician.refresh_from_db()
        assert verified_technician.wallet_balance == initial_balance

        active_booking.refresh_from_db()
        assert active_booking.status == "In Progress"

    def test_low_balance_guardrail_blocks_job_acceptance(self, api_client, sample_service, low_balance_technician, authenticate_as):
        """
        Technician with wallet balance < ₹150 is blocked with 403 Forbidden
        from accepting new jobs until they recharge.
        """
        pending_booking = Booking.objects.create(
            booking_code="GS-TEST-LOWBAL",
            service=sample_service,
            service_name=sample_service.name,
            customer_name="Pooja Sharma",
            customer_phone="9833445566",
            address="Boring Road, Patna",
            area="Boring Road",
            base_price=Decimal("499.00"),
        total_amount=Decimal("499.00"),
            status="Pending",
        )

        authenticate_as('technician', low_balance_technician)
        url = f"/api/bookings/{pending_booking.id}/accept/"
        response = api_client.post(url, {"partner_id": low_balance_technician.partner_id}, format="json")

        assert response.status_code in (400, 403)
        assert "Low wallet balance" in response.data.get("error", "")

        pending_booking.refresh_from_db()
        assert pending_booking.status == "Pending"
        assert pending_booking.technician is None

    def test_unverified_kyc_blocks_job_acceptance(self, api_client, sample_service, unverified_technician, authenticate_as):
        """
        Technician with pending KYC must not be allowed to accept jobs.
        """
        pending_booking = Booking.objects.create(
            booking_code="GS-TEST-KYC",
            service=sample_service,
            service_name=sample_service.name,
            customer_name="Rahul Verma",
            customer_phone="9844556677",
            address="Kankarbagh, Patna",
            area="Kankarbagh",
            base_price=Decimal("499.00"),
        total_amount=Decimal("499.00"),
            status="Pending",
        )

        authenticate_as('technician', unverified_technician)
        url = f"/api/bookings/{pending_booking.id}/accept/"
        response = api_client.post(url, {"partner_id": unverified_technician.partner_id}, format="json")

        assert response.status_code in (400, 403)
        assert "KYC" in response.data.get("error", "")

    def test_razorpay_signature_verification_success(self, api_client, active_booking, verified_technician, authenticate_as):
        """
        Tests Razorpay payment verification with a valid HMAC-SHA256 signature.
        """
        customer = CustomerProfile.objects.create(phone=active_booking.customer_phone, name=active_booking.customer_name)
        authenticate_as('customer', customer)
        order_id = "order_test_123456"
        payment_id = "pay_test_987654"
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'gharsathi_sandbox_secret_key_12345')

        # Generate valid HMAC-SHA256 signature
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        valid_signature = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

        active_booking.razorpay_order_id = order_id
        active_booking.save(update_fields=["razorpay_order_id"])
        from unittest.mock import patch
        with patch("razorpay.Client") as gateway:
            gateway.return_value.payment.fetch.return_value = {
                "status": "captured",
                "order_id": order_id,
                "currency": "INR",
                "amount": int(active_booking.total_amount * 100),
            }
            url = "/api/payments/razorpay/verify/"
            response = api_client.post(
                url,
                {
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id,
                    "razorpay_signature": valid_signature,
                    "booking_id": active_booking.booking_code,
                },
                format="json",
            )

        assert response.status_code == 200
        assert response.data["success"] is True
        assert response.data["payment_status"] == "Paid"

        active_booking.refresh_from_db()
        assert active_booking.payment_status == "Paid"
        assert active_booking.razorpay_order_id == order_id
        assert active_booking.razorpay_payment_id == payment_id


    def test_booking_payment_pending_until_gateway_capture(self, api_client, active_booking, authenticate_as):
        """Integration: persisted booking -> gateway order -> captured payment -> Paid."""
        from unittest.mock import patch
        customer = CustomerProfile.objects.create(phone=active_booking.customer_phone, name=active_booking.customer_name)
        authenticate_as('customer', customer)
        order_id, payment_id = 'order_integrated_001', 'pay_integrated_001'
        assert active_booking.payment_status != 'Paid'
        with patch('razorpay.Client') as gateway:
            gateway.return_value.order.create.return_value = {'id': order_id}
            created = api_client.post('/api/payments/razorpay/create-order/', {
                'booking_id': active_booking.booking_code,
                'amount': str(active_booking.total_amount),
            }, format='json')
            assert created.status_code == 200
            assert created.data['order_id'] == order_id
            active_booking.refresh_from_db()
            assert active_booking.razorpay_order_id == order_id
            assert active_booking.payment_status != 'Paid'

            gateway.return_value.payment.fetch.return_value = {
                'status': 'captured', 'order_id': order_id, 'currency': 'INR',
                'amount': int(active_booking.total_amount * 100),
            }
            secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
            signature = hmac.new(secret.encode(), f'{order_id}|{payment_id}'.encode(), hashlib.sha256).hexdigest()
            verified = api_client.post('/api/payments/razorpay/verify/', {
                'razorpay_order_id': order_id, 'razorpay_payment_id': payment_id,
                'razorpay_signature': signature, 'booking_id': active_booking.booking_code,
            }, format='json')
            assert verified.status_code == 200
            assert verified.data['payment_status'] == 'Paid'
        active_booking.refresh_from_db()
        assert active_booking.payment_status == 'Paid'
        assert active_booking.razorpay_payment_id == payment_id

    def test_payment_retry_reuses_existing_order(self, api_client, active_booking, authenticate_as):
        from unittest.mock import patch
        customer = CustomerProfile.objects.create(phone=active_booking.customer_phone, name=active_booking.customer_name)
        authenticate_as('customer', customer)
        active_booking.razorpay_order_id = 'order_existing_retry'
        active_booking.save(update_fields=['razorpay_order_id'])
        with patch('razorpay.Client') as gateway:
            response = api_client.post('/api/payments/razorpay/create-order/', {
                'booking_id': active_booking.booking_code,
                'amount': str(active_booking.total_amount),
            }, format='json')
            assert response.status_code == 200
            assert response.data['order_id'] == 'order_existing_retry'
            gateway.assert_not_called()
        active_booking.refresh_from_db()
        assert active_booking.razorpay_order_id == 'order_existing_retry'

    def test_paid_booking_rejects_new_payment_order(self, api_client, active_booking, authenticate_as):
        customer = CustomerProfile.objects.create(phone=active_booking.customer_phone, name=active_booking.customer_name)
        authenticate_as('customer', customer)
        active_booking.payment_status = 'Paid'
        active_booking.save(update_fields=['payment_status'])
        response = api_client.post('/api/payments/razorpay/create-order/', {
            'booking_id': active_booking.booking_code,
            'amount': str(active_booking.total_amount),
        }, format='json')
        assert response.status_code == 409

    def test_payment_order_rejects_other_customer(self, api_client, active_booking, authenticate_as):
        outsider = CustomerProfile.objects.create(phone="9876501234", name="Other Customer")
        authenticate_as('customer', outsider)
        response = api_client.post('/api/payments/razorpay/create-order/', {
            'booking_id': active_booking.booking_code,
            'amount': str(active_booking.total_amount),
        }, format='json')
        assert response.status_code == 403
        assert not active_booking.razorpay_order_id

    def test_payment_order_rejects_technician(self, api_client, active_booking, verified_technician, authenticate_as):
        authenticate_as('technician', verified_technician)
        response = api_client.post('/api/payments/razorpay/create-order/', {
            'booking_id': active_booking.booking_code,
            'amount': str(active_booking.total_amount),
        }, format='json')
        assert response.status_code == 403

    def test_payment_verification_rejects_other_customer(self, api_client, active_booking, authenticate_as):
        outsider = CustomerProfile.objects.create(phone="9876501234", name="Other Customer")
        authenticate_as('customer', outsider)
        active_booking.razorpay_order_id = 'order_owned_by_customer'
        active_booking.save(update_fields=['razorpay_order_id'])
        order_id, payment_id = 'order_owned_by_customer', 'pay_other_customer'
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
        signature = hmac.new(key_secret.encode(), f'{order_id}|{payment_id}'.encode(), hashlib.sha256).hexdigest()
        response = api_client.post('/api/payments/razorpay/verify/', {
            'razorpay_order_id': order_id, 'razorpay_payment_id': payment_id,
            'razorpay_signature': signature, 'booking_id': active_booking.booking_code,
        }, format='json')
        assert response.status_code == 403
        active_booking.refresh_from_db()
        assert active_booking.payment_status != 'Paid'

    def test_razorpay_invalid_signature_rejected(self, api_client, active_booking, verified_technician, authenticate_as):
        """
        Submitting a tampered/invalid signature must return 400 Bad Request.
        """
        authenticate_as('technician', verified_technician)
        url = "/api/payments/razorpay/verify/"
        response = api_client.post(
            url,
            {
                "razorpay_order_id": "order_test_fake",
                "razorpay_payment_id": "pay_test_fake",
                "razorpay_signature": "invalid_forged_signature_hex_value",
                "booking_id": active_booking.booking_code,
            },
            format="json",
        )

        assert response.status_code == 400
        assert "signature" in response.data.get("error", "").lower()

    def test_subservice_custom_commission_crud_and_deduction(self, api_client, verified_technician, sample_service, admin_user, authenticate_as):
        """
        Verify that SubService can be created with custom commission_fee,
        and when a booking for this subservice is completed, the technician's wallet
        is deducted by the specific subservice's custom commission_fee.
        """
        authenticate_as('admin', admin_user)
        # 1. Add SubService with custom price & commission fee
        add_url = f"/api/services/{sample_service.id}/add-subservice/"
        res_add = api_client.post(
            add_url,
            {
                "name": "AC Foam Jet Supreme",
                "price": 899.00,
                "commission_fee": 220.00,
                "time": "60 mins",
                "description": "Premium foam wash",
            },
            format="json",
        )
        assert res_add.status_code == 201

        # Verify SubService model instance created
        sub_obj = SubService.objects.filter(service=sample_service, name="AC Foam Jet Supreme").first()
        assert sub_obj is not None
        assert sub_obj.commission_fee == Decimal("220.00")
        assert sub_obj.price == Decimal("899.00")

        # 2. Update SubService price and commission fee
        update_url = f"/api/services/{sample_service.id}/subservice-price/"
        res_upd = api_client.patch(
            update_url,
            {
                "subservice_id": sub_obj.sub_id,
                "price": 999.00,
                "commission_fee": 250.00,
            },
            format="json",
        )
        assert res_upd.status_code == 200
        sub_obj.refresh_from_db()
        assert sub_obj.price == Decimal("999.00")
        assert sub_obj.commission_fee == Decimal("250.00")

        # 3. Create booking for this subservice and complete with Happy Code
        sample_service.refresh_from_db()
        booking = Booking.objects.create(
            service=sample_service,
            service_name=sample_service.name,
            subcategory_id=sub_obj.sub_id,
            subcategory_name=sub_obj.name,
            customer_name="Ramesh Kumar",
            customer_phone="9876543210",
            address="Kankarbagh, Patna",
            area="Patna Central",
            base_price=sub_obj.price,
            platform_fee=sub_obj.commission_fee,
            total_amount=sub_obj.price,
            technician=verified_technician,
            status="In Progress",
            service_pin="5544",
        )

        authenticate_as('technician', verified_technician)
        initial_balance = verified_technician.wallet_balance  # 500.00
        complete_url = f"/api/bookings/{booking.id}/complete/"
        res_comp = api_client.post(complete_url, {"service_pin": "5544"}, format="json")
        assert res_comp.status_code == 200

        verified_technician.refresh_from_db()
        # Exactly 250.00 deducted (500 - 250 = 250)
        assert verified_technician.wallet_balance == initial_balance - Decimal("250.00")
        assert verified_technician.wallet_balance == Decimal("250.00")

    def test_technician_registration_initial_zero_wallet_balance(self, api_client, admin_user, authenticate_as):
        """
        Tests that all newly registered technicians explicitly start with a ₹0.00 wallet balance.
        Any client-supplied wallet balance in registration payload is ignored.
        """
        authenticate_as('admin', admin_user)
        # 1. Model default creation
        tech_model = TechnicianProfile.objects.create(
            name="New Tech Model",
            phone="9800000001",
            partner_id="GS-TECH-NEW01",
        )
        assert tech_model.wallet_balance == Decimal("0.00")

        # 2. Registration via API endpoint without wallet_balance supplied
        res = api_client.post(
            "/api/technicians/",
            {
                "name": "Amit Kumar",
                "phone": "9800000002",
                "password": "local-fixture-password",
                "trade": "AC Repair",
                "area": "Danapur",
            },
            format="json",
        )
        assert res.status_code == 201
        tech_id = res.data["id"]
        tech = TechnicianProfile.objects.get(pk=tech_id)
        assert tech.wallet_balance == Decimal("0.00")
        assert Decimal(str(res.data["wallet_balance"])) == Decimal("0.00")

        # 3. Registration via API endpoint attempting to inject dummy wallet balance
        res_inject = api_client.post(
            "/api/technicians/",
            {
                "name": "Injection Test",
                "phone": "9800000003",
                "password": "local-fixture-password",
                "trade": "Plumbing",
                "wallet_balance": 600.00,
            },
            format="json",
        )
        assert res_inject.status_code == 201
        tech_inject = TechnicianProfile.objects.get(pk=res_inject.data["id"])
        assert tech_inject.wallet_balance == Decimal("0.00")
        assert Decimal(str(res_inject.data["wallet_balance"])) == Decimal("0.00")


