import hashlib
import hmac
from decimal import Decimal
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import (
    Service,
    TechnicianProfile,
    CustomerProfile,
    Booking,
    WalletTransaction,
    Complaint,
    AdminWithdrawal,
    OTPVerification,
)


class Command(BaseCommand):
    help = 'Executes the 8-point End-to-End (E2E) diagnostic test suite against live PostgreSQL database.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('=' * 80))
        self.stdout.write(self.style.NOTICE('   GHAR SATHI - PRODUCTION E2E AUTOMATED DIAGNOSTIC SUITE'))
        self.stdout.write(self.style.NOTICE('=' * 80))
        self.stdout.write(f"Target Database : {settings.DATABASES['default']['NAME']} (PostgreSQL)")
        self.stdout.write(f"Database Host   : {settings.DATABASES['default']['HOST']}:{settings.DATABASES['default']['PORT']}")
        self.stdout.write(f"Timestamp       : {timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        self.stdout.write('-' * 80)

        client = APIClient()
        test_results = []
        all_passed = True

        # Tracking variables for isolated cleanup
        created_tech = None
        created_booking = None
        created_complaint = None
        created_withdrawal = None
        test_phone = '9876543210'

        try:
            # =========================================================================
            # TEST 1: Catalog & Seed Data Check
            # =========================================================================
            self.stdout.write("\n[1/8] Testing Catalog & Seed Data Check (Services & Technicians)...")
            res_services = client.get('/api/services/')
            res_techs = client.get('/api/technicians/')

            assert res_services.status_code == 200, f"Expected 200 for /api/services/, got {res_services.status_code}"
            assert len(res_services.data) > 0, "No services found in database catalog"
            assert res_techs.status_code == 200, f"Expected 200 for /api/technicians/, got {res_techs.status_code}"
            assert len(res_techs.data) > 0, "No technicians found in database seed"

            services_count = len(res_services.data)
            techs_count = len(res_techs.data)
            test_results.append({
                'num': 1,
                'name': 'Catalog & Seed Check',
                'route': 'GET /api/services/, /api/technicians/',
                'status': 'PASS',
                'details': f"{services_count} Services, {techs_count} Technicians verified in PostgreSQL"
            })
            self.stdout.write(self.style.SUCCESS(f"  ? PASS: {services_count} services & {techs_count} technicians verified."))

            # =========================================================================
            # TEST 2: SMS OTP Auth Flow
            # =========================================================================
            self.stdout.write("\n[2/8] Testing SMS OTP Authentication Flow...")
            # Clean old records for clean rate-limiting state
            OTPVerification.objects.filter(phone=test_phone).delete()

            send_res = client.post(
                '/api/auth/send-otp/',
                {'phone_number': test_phone, 'role': 'customer'},
                format='json'
            )
            assert send_res.status_code == 200, f"Send OTP failed with status {send_res.status_code}: {send_res.data}"
            assert send_res.data.get('success') is True, "Send OTP response success was not True"

            # Retrieve generated OTP from database
            otp_record = OTPVerification.objects.filter(phone=test_phone, is_verified=False).latest('created_at')
            captured_otp = otp_record.otp_code
            assert len(captured_otp) == 6 and captured_otp.isdigit(), f"Invalid OTP format: {captured_otp}"

            # Verify OTP
            verify_res = client.post(
                '/api/auth/verify-otp/',
                {
                    'phone_number': test_phone,
                    'otp_code': captured_otp,
                    'role': 'customer',
                    'name': 'E2E Diagnostic User',
                    'area': 'Patna to Danapur'
                },
                format='json'
            )
            assert verify_res.status_code == 200, f"Verify OTP failed: {verify_res.data}"
            jwt_token = verify_res.data.get('token')
            assert jwt_token and len(jwt_token) > 20, "Valid JWT token was not returned"

            test_results.append({
                'num': 2,
                'name': 'SMS OTP Auth Flow',
                'route': 'POST /api/auth/send-otp/, verify-otp/',
                'status': 'PASS',
                'details': f"OTP {captured_otp} generated & verified; JWT token issued"
            })
            self.stdout.write(self.style.SUCCESS("  ? PASS: 6-digit OTP verified and JWT token issued."))

            # =========================================================================
            # TEST 3: Customer Booking + GPS Coordinates (Happy Code generation)
            # =========================================================================
            self.stdout.write("\n[3/8] Testing Customer Booking Creation with GPS Coordinates...")
            sample_service = Service.objects.first()
            booking_payload = {
                'customer_name': 'E2E Test Customer',
                'customer_phone': test_phone,
                'address': 'Flat 304, Bailey Road, Patna',
                'area': 'Bailey Road',
                'pincode': '800001',
                'latitude': 28.6139,
                'longitude': 77.2090,
                'service': sample_service.id,
                'service_name': sample_service.name,
                'base_price': float(sample_service.base_price),
                'total_amount': float(sample_service.base_price),
                'status': 'Pending',
                'payment_method': 'Online / Razorpay UPI',
                'payment_status': 'Pending',
                'scheduled_date': '2026-10-25',
                'scheduled_time': '11:00 AM',
            }

            booking_res = client.post('/api/bookings/', booking_payload, format='json')
            assert booking_res.status_code in (200, 201), f"Create booking failed: {booking_res.data}"
            booking_data = booking_res.data
            service_pin = str(booking_data.get('service_pin', '')).strip()
            assert len(service_pin) == 4 and service_pin.isdigit(), f"Invalid service PIN (Happy Code): {service_pin}"
            assert float(booking_data.get('latitude')) == 28.6139, "Latitude mismatch"
            assert float(booking_data.get('longitude')) == 77.2090, "Longitude mismatch"

            created_booking = Booking.objects.get(id=booking_data['id'])
            test_results.append({
                'num': 3,
                'name': 'Customer Booking + GPS',
                'route': 'POST /api/bookings/',
                'status': 'PASS',
                'details': f"Booking {created_booking.booking_code} created (PIN: {service_pin}, GPS: 28.6139, 77.2090)"
            })
            self.stdout.write(self.style.SUCCESS(f"  ? PASS: Booking {created_booking.booking_code} created with Happy Code '{service_pin}'."))

            # =========================================================================
            # TEST 4: Razorpay Sandbox Checkout & HMAC-SHA256 Verification
            # =========================================================================
            self.stdout.write("\n[4/8] Testing Razorpay Sandbox Payment Verification...")
            order_res = client.post(
                '/api/payments/create-order/',
                {'amount': float(sample_service.base_price), 'booking_id': created_booking.id},
                format='json'
            )
            assert order_res.status_code == 200, f"Create order failed: {order_res.data}"
            order_id = order_res.data.get('order_id')
            assert order_id, "Order ID missing from response"

            # Compute HMAC-SHA256 signature
            payment_id = f"pay_e2e_{int(timezone.now().timestamp())}"
            key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'gharsathi_sandbox_secret_key_12345')
            message = f"{order_id}|{payment_id}".encode('utf-8')
            signature = hmac.new(key_secret.encode('utf-8'), message, hashlib.sha256).hexdigest()

            verify_pay_res = client.post(
                '/api/payments/verify/',
                {
                    'razorpay_order_id': order_id,
                    'razorpay_payment_id': payment_id,
                    'razorpay_signature': signature,
                    'booking_id': created_booking.id,
                },
                format='json'
            )
            assert verify_pay_res.status_code == 200, f"Verify payment failed: {verify_pay_res.data}"

            created_booking.refresh_from_db()
            assert created_booking.payment_status == 'Paid', f"Expected Paid, got {created_booking.payment_status}"
            assert created_booking.razorpay_order_id == order_id
            assert created_booking.razorpay_payment_id == payment_id

            test_results.append({
                'num': 4,
                'name': 'Razorpay Sandbox Payment',
                'route': 'POST /api/payments/create-order/, verify/',
                'status': 'PASS',
                'details': f"Order {order_id} verified via HMAC-SHA256, status -> Paid"
            })
            self.stdout.write(self.style.SUCCESS(f"  ? PASS: HMAC-SHA256 verified; booking payment status set to 'Paid'."))

            # =========================================================================
            # TEST 5: Technician Low-Balance Guardrail (< ?150)
            # =========================================================================
            self.stdout.write("\n[5/8] Testing Technician Low-Balance Guardrail (< ?150)...")
            created_tech = TechnicianProfile.objects.create(
                partner_id=f"TECH-E2E-{int(timezone.now().timestamp()) % 10000}",
                name="E2E Diagnostic Partner",
                phone="9876509999",
                trade="Appliance Repair",
                wallet_balance=Decimal("100.00"),  # Below ?150 minimum threshold
                kyc_status="Verified",
                rating_avg=Decimal("5.0"),
                rating_count=1,
            )

            guardrail_res = client.post(
                f'/api/bookings/{created_booking.id}/accept/',
                {'technician_id': created_tech.id, 'partner_id': created_tech.partner_id},
                format='json'
            )
            assert guardrail_res.status_code in (400, 403), f"Expected 400/403 guardrail error, got {guardrail_res.status_code}"
            assert "Low wallet balance" in guardrail_res.data.get('error', ''), f"Unexpected error message: {guardrail_res.data}"

            created_booking.refresh_from_db()
            assert created_booking.status == 'Pending', "Booking status should remain Pending after low-balance block"
            assert created_booking.technician is None, "Technician should not be assigned"

            test_results.append({
                'num': 5,
                'name': 'Low-Balance Guardrail',
                'route': f'POST /api/bookings/{created_booking.id}/accept/',
                'status': 'PASS',
                'details': f"Wallet ?100.00 (< ?150) strictly blocked with HTTP {guardrail_res.status_code}"
            })
            self.stdout.write(self.style.SUCCESS("  ? PASS: Low wallet balance guardrail successfully prevented job acceptance."))

            # =========================================================================
            # TEST 6: Demo UPI Wallet Instant Recharge (?500)
            # =========================================================================
            self.stdout.write("\n[6/8] Testing Demo UPI Wallet Recharge (?500)...")
            recharge_res = client.post(
                f'/api/technicians/{created_tech.id}/recharge/',
                {'amount': 500, 'description': 'E2E UPI Wallet Instant Recharge'},
                format='json'
            )
            assert recharge_res.status_code == 200, f"Recharge failed: {recharge_res.data}"

            created_tech.refresh_from_db()
            assert created_tech.wallet_balance == Decimal("600.00"), f"Expected ?600, got {created_tech.wallet_balance}"

            credit_txn = WalletTransaction.objects.filter(
                technician=created_tech,
                txn_type='CREDIT',
                amount=Decimal('500.00')
            ).first()
            assert credit_txn is not None, "CREDIT ledger audit entry was not recorded"
            assert credit_txn.balance_after == Decimal("600.00")

            test_results.append({
                'num': 6,
                'name': 'Demo UPI Wallet Recharge',
                'route': f'POST /api/technicians/{created_tech.id}/recharge/',
                'status': 'PASS',
                'details': f"?500 credited (?100 -> ?600); CREDIT ledger transaction {credit_txn.txn_id} recorded"
            })
            self.stdout.write(self.style.SUCCESS("  ? PASS: ?500 recharge credited; wallet updated to ?600."))

            # =========================================================================
            # TEST 7: Job Acceptance & 4-Digit Happy Code Completion (?149 platform fee)
            # =========================================================================
            self.stdout.write("\n[7/8] Testing Job Acceptance & 4-Digit Happy Code Completion...")
            # Step A: Accept booking with now-recharged technician
            accept_res = client.post(
                f'/api/bookings/{created_booking.id}/accept/',
                {'technician_id': created_tech.id, 'partner_id': created_tech.partner_id},
                format='json'
            )
            assert accept_res.status_code == 200, f"Job acceptance failed: {accept_res.data}"
            created_booking.refresh_from_db()
            assert created_booking.status == 'Accepted'
            assert created_booking.technician == created_tech

            # Step B: Wrong PIN verification must be blocked
            wrong_pin_res = client.post(
                f'/api/bookings/{created_booking.id}/complete/',
                {'service_pin': '0000'},
                format='json'
            )
            assert wrong_pin_res.status_code == 400, f"Expected 400 for wrong PIN, got {wrong_pin_res.status_code}"
            assert "Invalid Happy Code" in wrong_pin_res.data.get('error', '')

            # Step C: Valid PIN completion with atomic ?149 deduction
            complete_res = client.post(
                f'/api/bookings/{created_booking.id}/complete/',
                {'service_pin': service_pin},
                format='json'
            )
            assert complete_res.status_code == 200, f"Job completion failed: {complete_res.data}"

            created_booking.refresh_from_db()
            created_tech.refresh_from_db()
            assert created_booking.status == 'Completed'
            assert created_booking.platform_fee == Decimal('149.00')
            assert created_tech.wallet_balance == Decimal('451.00'), f"Expected ?451.00 (?600 - ?149), got {created_tech.wallet_balance}"

            debit_txn = WalletTransaction.objects.filter(
                technician=created_tech,
                booking=created_booking,
                txn_type='DEBIT',
                amount=Decimal('149.00')
            ).first()
            assert debit_txn is not None, "DEBIT platform fee audit transaction not found"
            assert debit_txn.balance_after == Decimal('451.00')

            test_results.append({
                'num': 7,
                'name': 'Happy Code & Platform Fee',
                'route': f'POST /api/bookings/{created_booking.id}/complete/',
                'status': 'PASS',
                'details': f"PIN '{service_pin}' verified; Booking Completed; ?149 platform fee atomically deducted (?600 -> ?451)"
            })
            self.stdout.write(self.style.SUCCESS("  ? PASS: Happy Code verified, Completed status set, ?149 platform fee deducted."))

            # =========================================================================
            # TEST 8: Warranty Claim Resolution & Admin Payout
            # =========================================================================
            self.stdout.write("\n[8/8] Testing Warranty Claim & Admin Payout Flow...")
            # Step A: Create warranty claim
            comp_res = client.post(
                '/api/complaints/',
                {
                    'booking': created_booking.id,
                    'customer_name': 'E2E Test Customer',
                    'customer_phone': test_phone,
                    'category': 'Warranty Claim',
                    'priority': 'High',
                    'description': 'Customer claims cooling issue within 30-day warranty period.',
                },
                format='json'
            )
            assert comp_res.status_code in (200, 201), f"Create complaint failed: {comp_res.data}"
            created_complaint = Complaint.objects.get(id=comp_res.data['id'])

            # Step B: Resolve claim via PATCH
            resolve_res = client.patch(
                f'/api/complaints/{created_complaint.id}/resolve/',
                {
                    'resolution_action': 'Technician dispatched for free warranty inspection',
                    'admin_notes': 'Claim verified & covered under 30-day Ghar Sathi warranty.'
                },
                format='json'
            )
            assert resolve_res.status_code == 200, f"Resolve complaint failed: {resolve_res.data}"
            created_complaint.refresh_from_db()
            assert created_complaint.status == 'Resolved'

            # Step C: Admin Analytics Verification
            analytics_res = client.get('/api/admin/analytics/')
            assert analytics_res.status_code == 200, f"Analytics failed: {analytics_res.data}"
            available_balance_before = Decimal(str(analytics_res.data.get('available_withdrawal_balance', 0)))
            assert available_balance_before >= Decimal('10.00'), f"Insufficient balance for withdrawal test: {available_balance_before}"

            # Step D: Request Admin Payout
            payout_amount = Decimal('50.00')
            if available_balance_before < payout_amount:
                payout_amount = available_balance_before

            withdrawal_res = client.post(
                '/api/admin/withdrawals/',
                {
                    'amount': float(payout_amount),
                    'bank_details': 'admin@okaxis',
                    'admin_notes': 'E2E diagnostic admin payout test'
                },
                format='json'
            )
            assert withdrawal_res.status_code == 201, f"Withdrawal request failed: {withdrawal_res.data}"
            created_withdrawal = AdminWithdrawal.objects.get(id=withdrawal_res.data['withdrawal']['id'])
            available_balance_after = Decimal(str(withdrawal_res.data.get('available_balance', 0)))
            expected_remaining = available_balance_before - payout_amount
            assert available_balance_after == expected_remaining, f"Expected {expected_remaining}, got {available_balance_after}"

            test_results.append({
                'num': 8,
                'name': 'Warranty & Admin Payout',
                'route': 'POST /api/complaints/, resolve, withdrawals/',
                'status': 'PASS',
                'details': f"Claim {created_complaint.complaint_code} Resolved; ?{payout_amount} payout requested (remaining: ?{available_balance_after})"
            })
            self.stdout.write(self.style.SUCCESS(f"  ? PASS: Warranty claim resolved and ?{payout_amount} admin withdrawal processed."))

        except AssertionError as ae:
            all_passed = False
            failed_num = len(test_results) + 1
            test_results.append({
                'num': failed_num,
                'name': f"Flow Step {failed_num}",
                'route': 'API Endpoint',
                'status': 'FAIL',
                'details': str(ae)
            })
            self.stdout.write(self.style.ERROR(f"\n  ? FAIL on Flow {failed_num}: {ae}"))
        except Exception as ex:
            all_passed = False
            failed_num = len(test_results) + 1
            test_results.append({
                'num': failed_num,
                'name': f"Flow Step {failed_num}",
                'route': 'API Endpoint',
                'status': 'FAIL',
                'details': f"Unexpected Exception: {ex}"
            })
            self.stdout.write(self.style.ERROR(f"\n  ? FAIL on Flow {failed_num}: {ex}"))
        finally:
            # =========================================================================
            # CLEANUP: Remove temporary test records to keep DB pristine
            # =========================================================================
            self.stdout.write("\nCleaning up temporary test records from PostgreSQL...")
            try:
                if created_withdrawal:
                    created_withdrawal.delete()
                if created_complaint:
                    created_complaint.delete()
                if created_tech:
                    WalletTransaction.objects.filter(technician=created_tech).delete()
                if created_booking:
                    created_booking.delete()
                if created_tech:
                    created_tech.delete()
                OTPVerification.objects.filter(phone=test_phone).delete()
                CustomerProfile.objects.filter(phone=test_phone).delete()
                self.stdout.write(self.style.SUCCESS("  ? PostgreSQL database cleanup completed successfully."))
            except Exception as clean_ex:
                self.stdout.write(self.style.WARNING(f"  Cleanup notice: {clean_ex}"))

        # =========================================================================
        # SUMMARY TABLE FORMATTING
        # =========================================================================
        self.stdout.write("\n" + "=" * 132)
        self.stdout.write("                                     E2E TEST EXECUTION SUMMARY TABLE")
        self.stdout.write("=" * 132)
        header = f"| {'#':^3} | {'User Journey Flow':<28} | {'Status':^8} | {'Route / Endpoints':<34} | {'Verification Details':<48} |"
        sep_line = "+" + "-" * 5 + "+" + "-" * 30 + "+" + "-" * 10 + "+" + "-" * 36 + "+" + "-" * 50 + "+"
        self.stdout.write(sep_line)
        self.stdout.write(header)
        self.stdout.write(sep_line)

        for res in test_results:
            st = self.style.SUCCESS(f"{res['status']:^8}") if res['status'] == 'PASS' else self.style.ERROR(f"{res['status']:^8}")
            flow_name = res['name'][:28]
            route = res['route'][:34]
            det = res['details'][:48]
            row = f"| {res['num']:^3} | {flow_name:<28} | {st} | {route:<34} | {det:<48} |"
            self.stdout.write(row)

        self.stdout.write(sep_line)
        if all_passed and len(test_results) == 8:
            self.stdout.write(self.style.SUCCESS("\n? ALL 8/8 END-TO-END FLOWS PASSED SUCCESSFULLY! ZERO BUGS DETECTED."))
            self.stdout.write(self.style.SUCCESS("  Ready for Google Cloud Deployment!\n"))
        else:
            self.stdout.write(self.style.ERROR("\n? SOME E2E FLOWS FAILED! Please inspect the logs above.\n"))
