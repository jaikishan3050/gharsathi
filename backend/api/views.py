import hashlib
import hmac
import logging
import random
import secrets
from datetime import timedelta
from decimal import Decimal
import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.crypto import salted_hmac
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .models import (
    Service,
    SubService,
    TechnicianProfile,
    Booking,
    WalletTransaction,
    Complaint,
    AdminWithdrawal,
    CustomerProfile,
    OTPVerification,
)
from .services.sms import deliver_otp
from .services.brevo import send_login_otp, send_happy_code, EmailDeliveryError
from .serializers import (
    ServiceSerializer,
    SubServiceSerializer,
    TechnicianProfileSerializer,
    BookingSerializer,
    WalletTransactionSerializer,
    ComplaintSerializer,
    AdminWithdrawalSerializer,
    CustomerProfileSerializer,
)
from .seed_data import purge_database, ensure_production_superuser
from .authentication import (
    IsGharSathiAdmin,
    credential_version,
    IsGharSathiAuthenticated,
    IsGharSathiCustomer,
    IsGharSathiAdminOrCustomer,
    IsGharSathiTechnician,
    IsGharSathiTechnicianOrAdmin,
)

logger = logging.getLogger(__name__)


def email_otp_digest(phone, email, code):
    return salted_hmac('gharsathi.email.otp.v1', f'{phone}:{email}:{code}', algorithm='sha256').hexdigest()


FIXED_PLATFORM_FEE = Decimal('149.00')
MIN_WALLET_BALANCE = Decimal('150.00')


def broadcast_booking_event(booking, event_type='NEW_JOB'):
    """
    Broadcasts booking events (NEW_JOB, JOB_ACCEPTED, JOB_STARTED, JOB_COMPLETED)
    via Django Channels WebSocket layer to online technicians and customers.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from .consumers import sanitize_group_name

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        booking_data = BookingSerializer(booking).data
        payload = {
            'event': event_type,
            'booking': booking_data,
            'booking_code': booking.booking_code,
            'service_name': booking.service_name,
            'customer_name': booking.customer_name,
            'customer_area': booking.area,
            'total_amount': float(booking.total_amount),
            'status': booking.status,
            'message': (
                f"New {booking.service_name} job in {booking.area} (₹{booking.total_amount})!"
                if event_type == 'NEW_JOB'
                else f"Job {booking.booking_code} status updated to {booking.status}"
            ),
        }

        # 1. Broadcast to global broadcast group
        async_to_sync(channel_layer.group_send)(
            'jobs_broadcast',
            {
                'type': 'job_broadcast',
                'data': payload,
            }
        )

        # 2. Broadcast to area-specific group (e.g. jobs_danapur)
        if booking.area:
            area_group = f"jobs_{sanitize_group_name(booking.area)}"
            async_to_sync(channel_layer.group_send)(
                area_group,
                {
                    'type': 'job_broadcast',
                    'data': payload,
                }
            )
    except Exception as e:
        logger.warning(f"Error broadcasting booking event via WebSocket: {e}")


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsGharSathiAdmin()]

    def get_object(self):
        pk = self.kwargs.get('pk')
        if str(pk).isdigit():
            obj = self.get_queryset().filter(pk=pk).first()
        else:
            obj = self.get_queryset().filter(slug=pk).first()
        if not obj:
            raise NotFound('Service not found')
        return obj

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

    @action(detail=True, methods=['patch', 'post'], url_path='subservice-price')
    def update_subservice_price(self, request, pk=None):
        service = self.get_object()
        sub_id = request.data.get('subservice_id') or request.data.get('subcategoryId') or request.data.get('id')
        new_price = request.data.get('price')
        new_commission = request.data.get('commission_fee') or request.data.get('commission')
        if not sub_id or (new_price is None and new_commission is None):
            return Response({'error': 'subservice_id and price or commission_fee are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        subs = list(service.subcategories or [])
        found = False
        for sub in subs:
            if str(sub.get('id')) == str(sub_id) or sub.get('name') == str(sub_id):
                if new_price is not None:
                    sub['price'] = float(new_price)
                if new_commission is not None:
                    sub['commission_fee'] = float(new_commission)
                found = True
                break
        
        if found:
            service.subcategories = subs
            service.save()

            # Synchronize with SubService model
            update_kwargs = {}
            if new_price is not None:
                update_kwargs['price'] = Decimal(str(new_price))
            if new_commission is not None:
                update_kwargs['commission_fee'] = Decimal(str(new_commission))

            SubService.objects.filter(service=service).filter(
                Q(sub_id=sub_id) | Q(name=sub_id)
            ).update(**update_kwargs)

            return Response(ServiceSerializer(service).data)
        return Response({'error': f'Subservice {sub_id} not found in {service.name}'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='add-subservice')
    def add_subservice(self, request, pk=None):
        service = self.get_object()
        sub_name = request.data.get('name')
        sub_price = request.data.get('price', float(service.base_price))
        sub_comm = (
            request.data.get('commission_fee')
            or request.data.get('commission')
            or float(getattr(service, 'commission_fee', 149.00))
        )
        sub_time = request.data.get('time', '45 mins')
        sub_desc = request.data.get('description', '')
        if not sub_name:
            return Response({'error': 'Subservice name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        subs = list(service.subcategories or [])
        sub_id = request.data.get('id') or f"{service.slug}-{len(subs) + 1}"
        new_sub = {
            'id': sub_id,
            'name': sub_name,
            'price': float(sub_price),
            'oldPrice': round(float(sub_price) * 1.25),
            'commission_fee': float(sub_comm),
            'time': sub_time,
            'description': sub_desc,
        }
        subs.append(new_sub)
        service.subcategories = subs
        service.save()

        # Synchronize with SubService model
        SubService.objects.update_or_create(
            service=service,
            sub_id=sub_id,
            defaults={
                'name': sub_name,
                'price': Decimal(str(sub_price)),
                'old_price': Decimal(str(round(float(sub_price) * 1.25))),
                'commission_fee': Decimal(str(sub_comm)),
                'time': sub_time,
                'description': sub_desc,
            }
        )
        return Response(ServiceSerializer(service).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        service = self.get_object()
        service_name = service.name
        service.delete()
        return Response({
            'success': True,
            'message': f"Service '{service_name}' and all associated subservices deleted successfully."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete', 'post'], url_path='delete-subservice')
    def delete_subservice(self, request, pk=None):
        service = self.get_object()
        sub_id = (
            request.data.get('subservice_id')
            or request.data.get('subcategoryId')
            or request.data.get('id')
            or request.query_params.get('subservice_id')
            or request.query_params.get('id')
        )
        if not sub_id:
            return Response({'error': 'subservice_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        subs = list(service.subcategories or [])
        initial_len = len(subs)
        subs = [s for s in subs if str(s.get('id')) != str(sub_id) and s.get('name') != str(sub_id)]

        if len(subs) < initial_len:
            service.subcategories = subs
            service.save()

            # Synchronize with SubService model
            SubService.objects.filter(service=service).filter(
                Q(sub_id=sub_id) | Q(name=sub_id)
            ).delete()

            return Response({
                'success': True,
                'message': f"Subservice '{sub_id}' deleted successfully from '{service.name}'.",
                'service': ServiceSerializer(service).data
            }, status=status.HTTP_200_OK)
        return Response({'error': f"Subservice '{sub_id}' not found in '{service.name}'"}, status=status.HTTP_404_NOT_FOUND)


class SubServiceViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for individual Sub-Services with custom price & commission fee.
    """
    queryset = SubService.objects.all()
    serializer_class = SubServiceSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsGharSathiAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get('service_id') or self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs



class TechnicianProfileViewSet(viewsets.ModelViewSet):
    queryset = TechnicianProfile.objects.all()
    serializer_class = TechnicianProfileSerializer

    permission_classes = [IsGharSathiAdmin]

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [IsGharSathiTechnicianOrAdmin()]
        return [IsGharSathiAdmin()]

    def get_object(self):
        if getattr(self.request.user, 'role', None) == 'technician':
            return self.request.user.profile
        pk = self.kwargs.get('pk')
        if str(pk).isdigit():
            obj = self.get_queryset().filter(pk=pk).first()
        else:
            obj = self.get_queryset().filter(partner_id=pk).first()
        if not obj:
            raise NotFound('Technician not found')
        return obj

    def get_queryset(self):
        qs = super().get_queryset()
        phone = self.request.query_params.get('phone')
        kyc_status = self.request.query_params.get('kyc_status')
        partner_id = self.request.query_params.get('partner_id')
        if phone:
            clean_phone = phone.replace(' ', '')[-10:]
            qs = qs.filter(phone__endswith=clean_phone)
        if kyc_status:
            qs = qs.filter(kyc_status=kyc_status)
        if partner_id:
            qs = qs.filter(partner_id=partner_id)
        return qs

    def perform_create(self, serializer):
        # Explicitly enforce 0.00 wallet balance upon technician registration
        serializer.save(wallet_balance=Decimal('0.00'))

    def perform_update(self, serializer):
        if getattr(self.request.user, 'role', None) == 'technician':
            allowed_self_service_fields = {
                'name', 'email', 'trade', 'area', 'address', 'is_online',
                'live_location', 'live_image', 'upi_id',
            }
            for field in list(serializer.validated_data):
                if field not in allowed_self_service_fields:
                    serializer.validated_data.pop(field)
        serializer.save()

    @action(detail=True, methods=['post'])
    def recharge(self, request, pk=None):
        """
        Securely credits technician wallet upon cryptographic verification of Razorpay payment.
        Requires razorpay_payment_id, razorpay_order_id, and razorpay_signature.
        Directly checks Razorpay Live API and HMAC-SHA256 signature to guarantee payment was collected.
        """
        amount_raw = request.data.get('amount')
        try:
            amount = Decimal(str(amount_raw))
            if amount <= 0:
                raise ValueError()
        except Exception:
            return Response(
                {'error': 'Kripya valid recharge amount enter karein (minimum ₹1).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        razorpay_payment_id = (request.data.get('razorpay_payment_id') or request.data.get('payment_id') or '').strip()
        razorpay_order_id = (request.data.get('razorpay_order_id') or request.data.get('order_id') or '').strip()
        razorpay_signature = (request.data.get('razorpay_signature') or request.data.get('signature') or '').strip()

        is_admin_override = bool(request.user and request.user.is_authenticated and request.user.is_staff and request.data.get('admin_override'))

        if not is_admin_override:
            if not razorpay_payment_id or not razorpay_order_id:
                return Response(
                    {'error': 'Razorpay payment verification zaroori hai. Payment ID aur Order ID missing hain.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevent duplicate credit / replay attack
            if WalletTransaction.objects.filter(description__icontains=razorpay_payment_id).exists():
                return Response(
                    {'error': f'Payment ID {razorpay_payment_id} pehle hi process ho chuki hai.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            key_id = getattr(settings, 'RAZORPAY_KEY_ID', '')
            key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')

            is_verified = False

            # 1. Cryptographic HMAC-SHA256 Signature verification
            if razorpay_signature:
                message = f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8')
                expected_sig = hmac.new(key_secret.encode('utf-8'), message, hashlib.sha256).hexdigest()
                if hmac.compare_digest(expected_sig, razorpay_signature):
                    is_verified = True

            # 2. Razorpay Python Client signature verification
            if not is_verified and razorpay_signature:
                try:
                    import razorpay
                    client = razorpay.Client(auth=(key_id, key_secret))
                    client.utility.verify_payment_signature({
                        'razorpay_order_id': razorpay_order_id,
                        'razorpay_payment_id': razorpay_payment_id,
                        'razorpay_signature': razorpay_signature,
                    })
                    is_verified = True
                except Exception as ex:
                    logger.warning(f"Razorpay SDK signature verification failed: {ex}")

            # 3. Direct verification via Razorpay Payment Fetch API (validates real money in live account)
            try:
                import razorpay
                client = razorpay.Client(auth=(key_id, key_secret))
                payment_record = client.payment.fetch(razorpay_payment_id)
                if payment_record and payment_record.get('status') in ['captured', 'authorized']:
                    paid_paise = int(payment_record.get('amount', 0))
                    expected_paise = int(round(float(amount) * 100))
                    if abs(paid_paise - expected_paise) <= 100:  # Allow max 1 rupee variance
                        is_verified = True
                    else:
                        return Response(
                            {'error': f'Payment amount mismatch: Received {paid_paise/100} INR, expected {amount} INR.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
            except Exception as ex:
                logger.warning(f"Razorpay live payment fetch check: {ex}")

            if not is_verified:
                return Response(
                    {'error': 'Razorpay payment verification fail ho gaya. Payment account mein confirm nahi hua.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        description = (
            f"Admin Manual Balance Adjustment ({request.data.get('description', '')})"
            if is_admin_override
            else f"Razorpay Live Top-up (PayID: {razorpay_payment_id}, OrderID: {razorpay_order_id})"
        )

        with transaction.atomic():
            tech_obj = self.get_object()
            technician = TechnicianProfile.objects.select_for_update().get(pk=tech_obj.pk)
            new_balance = technician.wallet_balance + amount
            technician.wallet_balance = new_balance
            technician.save(update_fields=['wallet_balance', 'updated_at'])

            txn = WalletTransaction.objects.create(
                technician=technician,
                txn_type='CREDIT',
                amount=amount,
                balance_after=new_balance,
                description=description,
            )

        return Response({
            'success': True,
            'message': f'₹{amount} credited successfully! New balance: ₹{new_balance}',
            'technician': TechnicianProfileSerializer(technician).data,
            'transaction': WalletTransactionSerializer(txn).data,
        })

    @action(detail=True, methods=['post'], url_path='verify-kyc')
    def verify_kyc(self, request, pk=None):
        """Admin endpoint to approve or reject technician KYC verification."""
        kyc_status_input = request.data.get('kyc_status')
        remarks = request.data.get('kyc_remarks', '')

        if kyc_status_input not in ['Verified', 'Rejected', 'Pending']:
            return Response(
                {'error': "kyc_status must be 'Verified', 'Rejected', or 'Pending'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            tech_obj = self.get_object()
            technician = TechnicianProfile.objects.select_for_update().get(pk=tech_obj.pk)
            technician.kyc_status = kyc_status_input
            if remarks:
                technician.kyc_remarks = remarks
            technician.save(update_fields=['kyc_status', 'kyc_remarks', 'updated_at'])

        return Response({
            'success': True,
            'message': f'Technician {technician.name} KYC status updated to {kyc_status_input}.',
            'technician': TechnicianProfileSerializer(technician).data,
        })

    @action(detail=False, methods=['post'], url_path='forgot-password')
    def forgot_password_action(self, request):
        return TechnicianForgotPasswordView().post(request)

    @action(detail=False, methods=['post'], url_path='reset-password-otp')
    def reset_password_otp_action(self, request):
        return TechnicianResetPasswordView().post(request)


class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all().select_related('service', 'technician')
    serializer_class = BookingSerializer

    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action in ('accept', 'start', 'complete'):
            return [IsGharSathiTechnician()]
        if action in ('rate', 'create'):
            return [IsGharSathiCustomer()]
        if action in ('update', 'partial_update', 'destroy'):
            return [IsGharSathiAdmin()]
        return [IsGharSathiAuthenticated()]

    def get_object(self):
        pk = self.kwargs.get('pk')
        if str(pk).isdigit():
            obj = self.get_queryset().filter(pk=pk).first()
        else:
            obj = self.get_queryset().filter(booking_code=pk).first()
        if not obj:
            raise NotFound('Booking not found')
        return obj

    def get_queryset(self):
        qs = super().get_queryset()
        role = getattr(self.request.user, 'role', None)
        if role == 'customer':
            phone = ''.join(filter(str.isdigit, str(self.request.user.phone)))[-10:]
            qs = qs.filter(customer_phone__endswith=phone)
        elif role == 'technician':
            qs = qs.filter(Q(technician_id=self.request.user.profile.pk) | Q(technician__isnull=True, status='Pending'))
        phone = self.request.query_params.get('phone')
        technician_id = self.request.query_params.get('technician_id')
        partner_id = self.request.query_params.get('partner_id')
        status_filter = self.request.query_params.get('status')
        unassigned = self.request.query_params.get('unassigned')
        category = self.request.query_params.get('category')

        if phone:
            clean_phone = phone.replace(' ', '')[-10:]
            qs = qs.filter(customer_phone__endswith=clean_phone)
        if technician_id:
            qs = qs.filter(technician_id=technician_id)
        if partner_id:
            qs = qs.filter(technician__partner_id=partner_id)
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)
        if unassigned == 'true':
            qs = qs.filter(technician__isnull=True, status='Pending')
        if category:
            qs = qs.filter(Q(service__category=category) | Q(service_name__icontains=category))

        return qs

    def perform_create(self, serializer):
        profile = self.request.user.profile
        # When a customer places a booking, it remains unassigned (technician=None, status='Pending')
        # and is automatically broadcasted in the queryset to all active and online technicians matching the service category.
        booking = serializer.save(
            customer_name=profile.name,
            customer_phone=profile.phone,
            technician=None,
            technician_name='',
            technician_phone='',
            status='Pending'
        )
        broadcast_booking_event(booking, event_type='NEW_JOB')
        logger.info(f"Broadcasted new unassigned booking {booking.booking_code} for service '{booking.service_name}' to active technicians")

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Assigns technician to booking ONLY IF KYC is Verified and wallet >= 150."""
        technician_profile = request.user.profile

        with transaction.atomic():
            booking_obj = self.get_object()
            booking = Booking.objects.select_for_update().get(pk=booking_obj.pk)

            if booking.status not in ['Pending', 'Accepted']:
                return Response(
                    {'error': f'Booking is in {booking.status} status and cannot be accepted.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # The authenticated technician identity comes from the JWT, never client input.
            technician = TechnicianProfile.objects.select_for_update().get(pk=technician_profile.pk)
            if booking.technician_id not in (None, technician.pk):
                return Response({'error': 'This job is assigned to another technician.'}, status=status.HTTP_403_FORBIDDEN)

            # STRICT GUARDRAIL 1: KYC Verification
            if technician.kyc_status != 'Verified':
                return Response(
                    {'error': 'Profile verification pending. Only KYC verified technicians can accept jobs.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # STRICT GUARDRAIL 2: Low-Balance Guardrail (₹150 minimum)
            if technician.wallet_balance < MIN_WALLET_BALANCE:
                return Response(
                    {
                        'error': (
                            f'Low wallet balance (₹{technician.wallet_balance})! '
                            f'Minimum ₹{MIN_WALLET_BALANCE} required to accept new bookings. Please recharge.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Assign technician and mark Accepted
            booking.technician = technician
            booking.technician_name = technician.name
            booking.technician_phone = technician.phone
            booking.status = 'Accepted'
            booking.save()

        broadcast_booking_event(booking, event_type='JOB_ACCEPTED')

        return Response({
            'success': True,
            'message': f'Job {booking.booking_code} accepted by {technician.name}.',
            'booking': BookingSerializer(booking).data,
        })

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Transitions booking from Accepted to In Progress."""
        with transaction.atomic():
            booking_obj = self.get_object()
            booking = Booking.objects.select_for_update().get(pk=booking_obj.pk)
            if booking.technician_id != request.user.profile.pk:
                return Response({'error': 'This job is not assigned to your technician account.'}, status=status.HTTP_403_FORBIDDEN)
            if booking.status != 'Accepted':
                return Response(
                    {'error': f"Only 'Accepted' bookings can be moved to 'In Progress'. Current status: {booking.status}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Fail closed: never mark a job started when its required email cannot be sent.
            if getattr(settings, 'HAPPY_CODE_CHANNEL', 'screen') == 'email':
                customer = CustomerProfile.objects.filter(phone=booking.customer_phone).first()
                if not customer or not customer.email:
                    return Response({'error': 'Customer email is unavailable for Happy Code delivery.'}, status=503)
                try:
                    send_happy_code(customer.email, booking.booking_code, booking.service_pin)
                except EmailDeliveryError:
                    return Response({'error': 'Happy Code email could not be delivered. Contact support.'}, status=503)
            booking.status = 'In Progress'
            booking.save(update_fields=['status'])

        broadcast_booking_event(booking, event_type='JOB_STARTED')

        return Response({
            'success': True,
            'message': f'Booking {booking.booking_code} is now In Progress.',
            'booking': BookingSerializer(booking).data,
        })

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Verifies 4-digit Happy Code, marks job Completed, and deducts flat ₹149 from wallet."""
        submitted_pin = str(request.data.get('service_pin', '')).strip()

        with transaction.atomic():
            booking_obj = self.get_object()
            booking = Booking.objects.select_for_update().get(pk=booking_obj.pk)

            if booking.technician_id != request.user.profile.pk:
                return Response({'error': 'This job is not assigned to your technician account.'}, status=status.HTTP_403_FORBIDDEN)

            if booking.status != 'In Progress':
                return Response({'error': 'Only an In Progress booking can be completed.'}, status=status.HTTP_400_BAD_REQUEST)

            # Limit online guessing even across worker restarts.
            if booking.happy_code_attempts >= 5:
                return Response({'error': 'Happy Code locked. Contact support.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

            # 4-Digit Happy Code Verification
            expected_pin = str(booking.service_pin or '').strip()
            if not expected_pin or not hmac.compare_digest(submitted_pin, expected_pin):
                booking.happy_code_attempts += 1
                booking.save(update_fields=['happy_code_attempts'])
                return Response(
                    {
                        'error': 'Invalid Happy Code. Ask the customer for the service verification code.'
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Subservice Custom Commission -> Service Commission -> Default 149.00
            sub_fee = None
            if booking.service and (booking.subcategory_id or booking.subcategory_name):
                for sub in (booking.service.subcategories or []):
                    if str(sub.get('id')) == str(booking.subcategory_id) or sub.get('name') == str(booking.subcategory_name):
                        if sub.get('commission_fee') is not None:
                            try:
                                sub_fee = Decimal(str(sub.get('commission_fee')))
                            except Exception:
                                pass
                        break
                if sub_fee is None:
                    matched_sub = SubService.objects.filter(service=booking.service).filter(
                        Q(sub_id=booking.subcategory_id) | Q(name=booking.subcategory_name)
                    ).first()
                    if matched_sub and matched_sub.commission_fee is not None:
                        sub_fee = matched_sub.commission_fee

            platform_fee = sub_fee if sub_fee is not None else (
                booking.service.commission_fee
                if booking.service and hasattr(booking.service, 'commission_fee')
                else (booking.platform_fee or FIXED_PLATFORM_FEE)
            )

            booking.status = 'Completed'
            booking.completed_at = timezone.now()
            booking.platform_fee = platform_fee
            booking.save()

            txn = None
            if booking.technician:
                tech = TechnicianProfile.objects.select_for_update().get(pk=booking.technician.id)
                new_balance = tech.wallet_balance - platform_fee
                tech.wallet_balance = new_balance
                tech.completed_jobs += 1
                tech.save(update_fields=['wallet_balance', 'completed_jobs', 'updated_at'])

                txn = WalletTransaction.objects.create(
                    technician=tech,
                    booking=booking,
                    txn_type='DEBIT',
                    amount=platform_fee,
                    balance_after=new_balance,
                    description=f'Platform commission fee for {booking.booking_code} ({booking.service_name})',
                )

        broadcast_booking_event(booking, event_type='JOB_COMPLETED')

        return Response({
            'success': True,
            'message': f'Happy Code verified! Booking {booking.booking_code} completed. ₹{platform_fee} platform fee deducted.',
            'booking': BookingSerializer(booking).data,
            'transaction': WalletTransactionSerializer(txn).data if txn else None,
        })

    @action(detail=True, methods=['post'])
    def rate(self, request, pk=None):
        """Saves customer 1-5 star rating and recalculates technician average."""
        rating_val = request.data.get('rating')
        review_text = request.data.get('review_text', '').strip()
        review_tags = request.data.get('review_tags', [])

        try:
            rating_int = int(rating_val)
            if not (1 <= rating_int <= 5):
                raise ValueError()
        except Exception:
            return Response({'error': 'Rating must be an integer between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            booking_obj = self.get_object()
            booking = Booking.objects.select_for_update().get(pk=booking_obj.pk)
            booking.rating = rating_int
            booking.review_text = review_text
            booking.review_tags = review_tags
            booking.rated_at = timezone.now()
            booking.save(update_fields=['rating', 'review_text', 'review_tags', 'rated_at'])

            # Recalculate technician rating average
            if booking.technician:
                tech = TechnicianProfile.objects.select_for_update().get(pk=booking.technician.id)
                rated_bookings = Booking.objects.filter(technician=tech, rating__isnull=False)
                total_ratings = sum(b.rating for b in rated_bookings)
                count = rated_bookings.count()
                avg = Decimal(str(round(total_ratings / count, 2))) if count > 0 else Decimal('5.00')

                tech.rating_avg = avg
                tech.rating_count = count
                tech.save(update_fields=['rating_avg', 'rating_count', 'updated_at'])

        return Response({
            'success': True,
            'message': f'Thank you! Rated {rating_int} stars successfully.',
            'booking': BookingSerializer(booking).data,
        })


class ComplaintViewSet(viewsets.ModelViewSet):
    queryset = Complaint.objects.all().select_related('booking')
    serializer_class = ComplaintSerializer

    def get_permissions(self):
        if self.action == 'resolve':
            return [IsGharSathiAdmin()]
        if self.action == 'create':
            return [IsGharSathiCustomer()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsGharSathiAdmin()]
        return [IsGharSathiAuthenticated()]

    def get_object(self):
        pk = self.kwargs.get('pk')
        if str(pk).isdigit():
            obj = self.get_queryset().filter(pk=pk).first()
        else:
            obj = self.get_queryset().filter(complaint_code=pk).first()
        if not obj:
            raise NotFound('Complaint not found')
        return obj

    def get_queryset(self):
        qs = super().get_queryset()
        role = getattr(self.request.user, 'role', None)
        if role == 'customer':
            phone = ''.join(filter(str.isdigit, str(self.request.user.phone)))[-10:]
            qs = qs.filter(customer_phone__endswith=phone)
        elif role == 'technician':
            return qs.none()
        phone = self.request.query_params.get('phone')
        status_filter = self.request.query_params.get('status')
        if phone:
            clean_phone = phone.replace(' ', '')[-10:]
            qs = qs.filter(customer_phone__endswith=clean_phone)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        profile = self.request.user.profile
        booking = serializer.validated_data.get('booking')
        if booking and booking.customer_phone[-10:] != profile.phone[-10:]:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only file a complaint for your own booking.')
        serializer.save(customer_name=profile.name, customer_phone=profile.phone)

    @action(detail=True, methods=['post', 'patch'])
    def resolve(self, request, pk=None):
        """Admin resolves customer complaint / warranty claim."""
        action_text = request.data.get('resolution_action', 'Resolved after review')
        notes = request.data.get('admin_notes', '')

        with transaction.atomic():
            comp_obj = self.get_object()
            complaint = Complaint.objects.select_for_update().get(pk=comp_obj.pk)
            complaint.status = 'Resolved'
            complaint.resolution_action = action_text
            complaint.admin_notes = notes
            complaint.resolved_at = timezone.now()
            complaint.save()

        return Response({
            'success': True,
            'message': f'Complaint {complaint.complaint_code} marked as Resolved.',
            'complaint': ComplaintSerializer(complaint).data,
        })


class AdminWithdrawalViewSet(viewsets.ModelViewSet):
    queryset = AdminWithdrawal.objects.all()
    serializer_class = AdminWithdrawalSerializer
    permission_classes = [IsGharSathiAdmin]

    def get_object(self):
        pk = self.kwargs.get('pk')
        if str(pk).isdigit():
            obj = self.get_queryset().filter(pk=pk).first()
        else:
            obj = self.get_queryset().filter(withdrawal_id=pk).first()
        if not obj:
            raise NotFound('Withdrawal not found')
        return obj

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        """Admin requests money payout with available balance guardrail."""
        amount_raw = request.data.get('amount')
        bank_details = str(request.data.get('bank_details', '')).strip()
        admin_notes = str(request.data.get('admin_notes', '')).strip()

        if not bank_details:
            return Response(
                {'error': 'UPI ID ya Bank Account / IFSC details required hain.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = Decimal(str(amount_raw))
            if amount <= 0:
                raise ValueError()
        except Exception:
            return Response(
                {'error': 'Valid withdrawal amount enter karein (minimum ₹1).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            completed_bookings = Booking.objects.filter(status='Completed')
            total_platform_earnings = completed_bookings.aggregate(total=Sum('platform_fee'))['total'] or Decimal('0.00')
            total_approved = (
                AdminWithdrawal.objects.filter(status='Approved').aggregate(total=Sum('amount'))['total']
                or Decimal('0.00')
            )
            total_pending = (
                AdminWithdrawal.objects.filter(status='Pending').aggregate(total=Sum('amount'))['total']
                or Decimal('0.00')
            )
            # Available balance = Total Platform Earnings minus Total Approved Withdrawals
            base_available = total_platform_earnings - total_approved
            effective_available = max(Decimal('0.00'), base_available - total_pending)

            if amount > base_available or amount > effective_available:
                return Response(
                    {'error': 'Insufficient balance available for withdrawal.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            withdrawal = AdminWithdrawal.objects.create(
                amount=amount,
                bank_details=bank_details,
                admin_notes=admin_notes,
                status='Pending',
            )

        return Response(
            {
                'success': True,
                'message': f'Withdrawal request {withdrawal.withdrawal_id} for ₹{amount} submitted successfully.',
                'withdrawal': AdminWithdrawalSerializer(withdrawal).data,
                'available_balance': float(effective_available - amount),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approves payout request and records timestamp."""
        with transaction.atomic():
            w_obj = self.get_object()
            withdrawal = AdminWithdrawal.objects.select_for_update().get(pk=w_obj.pk)
            withdrawal.status = 'Approved'
            withdrawal.processed_at = timezone.now()
            withdrawal.save(update_fields=['status', 'processed_at'])

        return Response({
            'success': True,
            'message': f'Withdrawal {withdrawal.withdrawal_id} marked as Approved.',
            'withdrawal': AdminWithdrawalSerializer(withdrawal).data,
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Rejects payout request."""
        notes = request.data.get('admin_notes', '')
        with transaction.atomic():
            w_obj = self.get_object()
            withdrawal = AdminWithdrawal.objects.select_for_update().get(pk=w_obj.pk)
            withdrawal.status = 'Rejected'
            withdrawal.processed_at = timezone.now()
            if notes:
                withdrawal.admin_notes = notes
            withdrawal.save(update_fields=['status', 'processed_at', 'admin_notes'])

        return Response({
            'success': True,
            'message': f'Withdrawal {withdrawal.withdrawal_id} marked as Rejected.',
            'withdrawal': AdminWithdrawalSerializer(withdrawal).data,
        })


class AdminAnalyticsView(APIView):
    permission_classes = [IsGharSathiAdmin]
    """Calculates GBV, platform earnings, technician payouts, and status health ratios."""

    def get(self, request):
        completed_bookings = Booking.objects.filter(status='Completed')
        completed_count = completed_bookings.count()

        gross_booking_value = completed_bookings.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        net_platform_earnings = completed_bookings.aggregate(total=Sum('platform_fee'))['total'] or Decimal('0.00')
        technician_payouts = max(Decimal('0.00'), gross_booking_value - net_platform_earnings)

        # Withdrawals Breakdown
        total_withdrawn = (
            AdminWithdrawal.objects.filter(status='Approved').aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )
        pending_withdrawn = (
            AdminWithdrawal.objects.filter(status='Pending').aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )
        available_withdrawal_balance = max(Decimal('0.00'), net_platform_earnings - total_withdrawn - pending_withdrawn)

        # Order Counts
        status_counts = Booking.objects.aggregate(
            total=Count('id'),
            completed=Count('id', filter=Q(status='Completed')),
            accepted=Count('id', filter=Q(status='Accepted')),
            in_progress=Count('id', filter=Q(status='In Progress')),
            pending=Count('id', filter=Q(status='Pending')),
            cancelled=Count('id', filter=Q(status='Cancelled')),
        )
        active_count = status_counts['accepted'] + status_counts['in_progress']

        # Top Services Breakdown
        top_services = (
            Booking.objects.values('service_name')
            .annotate(
                count=Count('id'),
                revenue=Sum('total_amount', filter=Q(status='Completed')),
            )
            .order_by('-count')[:5]
        )

        top_services_formatted = [
            {
                'name': s['service_name'] or 'Service',
                'count': s['count'],
                'revenue': float(s['revenue'] or 0.0),
            }
            for s in top_services
        ]

        return Response({
            'gross_booking_value': float(gross_booking_value),
            'net_platform_earnings': float(net_platform_earnings),
            'technician_payouts': float(technician_payouts),
            'total_withdrawn': float(total_withdrawn),
            'pending_withdrawn': float(pending_withdrawn),
            'available_withdrawal_balance': float(available_withdrawal_balance),
            'fixed_commission_per_job': float(FIXED_PLATFORM_FEE),
            'orders': {
                'total': status_counts['total'],
                'completed': status_counts['completed'],
                'active': active_count,
                'pending': status_counts['pending'],
                'cancelled': status_counts['cancelled'],
            },
            'top_services': top_services_formatted,
            'technicians': {
                'total': TechnicianProfile.objects.count(),
                'verified': TechnicianProfile.objects.filter(kyc_status='Verified').count(),
                'pending_kyc': TechnicianProfile.objects.filter(kyc_status='Pending').count(),
            },
            'complaints': {
                'total': Complaint.objects.count(),
                'open': Complaint.objects.filter(status='Open').count(),
                'resolved': Complaint.objects.filter(status='Resolved').count(),
            },
        })


class SetupSuperuserView(APIView):
    """Deprecated endpoint; admin bootstrap credentials must be configured out of band."""
    permission_classes = [IsGharSathiAdmin]

    def post(self, request):
        return Response(
            {'error': 'Admin bootstrap is managed through ADMIN_BOOTSTRAP_* server environment variables.'},
            status=status.HTTP_410_GONE,
        )


class AdminPasswordResetRequestView(APIView):
    """Email a one-time password-reset link to an active administrator."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'admin_password_reset'

    def post(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        if not email or '@' not in email:
            return Response({'error': 'Valid admin email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        user = User.objects.filter(
            email__iexact=email, is_active=True, is_staff=True, is_superuser=True
        ).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            base_url = getattr(settings, 'FRONTEND_BASE_URL', 'https://gharsathi-in.web.app').rstrip('/')
            reset_url = f'{base_url}/admin/password-reset/{uid}/{token}'
            try:
                send_mail(
                    subject='Reset your Ghar Sathi admin password',
                    message=(
                        f'Hello {user.get_username()},\n\n'
                        f'Use this secure link to reset your Ghar Sathi admin password:\n{reset_url}\n\n'
                        'This link is temporary and expires automatically. If you did not request this, ignore this email.'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                logger.exception('Admin password recovery email could not be sent.')
                return Response(
                    {'error': 'Password reset email is unavailable right now. Please contact platform support.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        # Same response for unknown and known addresses avoids account enumeration.
        return Response({
            'success': True,
            'message': 'If an active admin account uses that email, a password reset link has been sent.',
        })


class AdminPasswordResetConfirmView(APIView):
    """Validate a one-time email token and update the admin password."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'admin_password_reset'

    def post(self, request):
        uid = str(request.data.get('uid') or '').strip()
        token = str(request.data.get('token') or '').strip()
        new_password = str(request.data.get('new_password') or '')
        if not uid or not token or not new_password:
            return Response({'error': 'Reset link and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 12:
            return Response({'error': 'Password must be at least 12 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(
                pk=user_id, is_active=True, is_staff=True, is_superuser=True
            )
        except (TypeError, ValueError, OverflowError, DjangoValidationError, User.DoesNotExist):
            user = None

        if not user or not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'This reset link is invalid or expired. Request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.last_login = timezone.now()
        user.save(update_fields=['password', 'last_login'])
        return Response({'success': True, 'message': 'Admin password updated. You can sign in now.'})


class PurgeProductionDataView(APIView):
    """
    Completely flushes and wipes all mock/seeded test data (dummy technicians,
    test bookings, mock complaints, and mock transactions.
    """
    permission_classes = [IsGharSathiAdmin]

    def post(self, request):
        counts = purge_database()
        return Response({
            'success': True,
            'message': 'Ghar Sathi production database completely purged and wiped of all mock/test records.',
            'remaining_records': counts,
        })


def payment_booking_access_allowed(request, booking):
    """Only the booking customer or an administrator can initiate/verify its payment."""
    role = getattr(request.user, 'role', None)
    if role == 'admin':
        return True
    if role != 'customer':
        return False
    phone = ''.join(filter(str.isdigit, str(getattr(request.user, 'phone', ''))))[-10:]
    booking_phone = ''.join(filter(str.isdigit, str(booking.customer_phone)))[-10:]
    return len(phone) == 10 and phone == booking_phone


class RazorpayCreateOrderView(APIView):
    """Create a real Razorpay order; never simulate payment orders on API failure."""

    def post(self, request):
        from decimal import Decimal, InvalidOperation

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', '')
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
        if not key_id or not key_secret:
            return Response({'error': 'Payment gateway is not configured.'}, status=503)

        try:
            amount = Decimal(str(request.data.get('amount', '')))
            if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
                raise InvalidOperation
            amount_paise = int(amount * 100)
        except (InvalidOperation, ValueError, TypeError):
            return Response({'error': 'Invalid amount'}, status=400)

        if request.data.get('currency', 'INR') != 'INR':
            return Response({'error': 'Only INR is supported.'}, status=400)

        booking_ref = request.data.get('booking_id', '')
        booking = Booking.objects.filter(booking_code=booking_ref).first() if booking_ref else None
        if not booking:
            return Response({'error': 'A persisted booking is required for payment.'}, status=400)
        if not payment_booking_access_allowed(request, booking):
            return Response({'error': 'Not authorized for this booking.'}, status=403)
        if amount_paise != int(booking.total_amount * 100):
            return Response({'error': 'Payment amount does not match booking.'}, status=400)
        if booking.payment_status == 'Paid' or booking.razorpay_payment_id:
            return Response({'error': 'This booking already has a recorded payment.'}, status=409)
        # Reuse the existing order on retry. Replacing it would orphan a payment
        # that was captured by Razorpay but not yet verified by our server.
        if booking.razorpay_order_id:
            return Response({
                'order_id': booking.razorpay_order_id, 'amount': amount_paise,
                'amount_in_rupees': str(amount), 'currency': 'INR',
                'key_id': key_id, 'booking_id': booking.booking_code,
                'platform_fee': float(FIXED_PLATFORM_FEE),
            })

        try:
            import razorpay
            client = razorpay.Client(auth=(key_id, key_secret))
            order_data = client.order.create({
                'amount': amount_paise, 'currency': 'INR',
                'receipt': f"booking_{booking.pk}_{int(timezone.now().timestamp())}",
                'notes': {'booking_id': str(booking.booking_code)},
            })
        except Exception:
            logger.exception('Razorpay order creation failed')
            return Response({'error': 'Payment gateway unavailable. Please retry.'}, status=502)

        booking.razorpay_order_id = order_data['id']
        booking.save(update_fields=['razorpay_order_id'])
        return Response({
            'order_id': order_data['id'], 'amount': amount_paise,
            'amount_in_rupees': str(amount), 'currency': 'INR',
            'key_id': key_id, 'booking_id': booking.booking_code,
            'platform_fee': float(FIXED_PLATFORM_FEE),
        })


class RazorpayVerifyPaymentView(APIView):
    """Verify signature, order association and captured payment before marking paid."""

    def post(self, request):
        order_id = request.data.get('razorpay_order_id') or request.data.get('order_id')
        payment_id = request.data.get('razorpay_payment_id') or request.data.get('payment_id')
        signature = request.data.get('razorpay_signature') or request.data.get('signature')
        if not all((order_id, payment_id, signature)):
            return Response({'error': 'Order, payment and signature are required.'}, status=400)

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', '')
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
        if not key_id or not key_secret:
            return Response({'error': 'Payment gateway is not configured.'}, status=503)

        expected_sig = hmac.new(
            key_secret.encode('utf-8'), f"{order_id}|{payment_id}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, str(signature)):
            return Response({'error': 'Invalid payment signature.'}, status=400)

        booking = Booking.objects.filter(razorpay_order_id=order_id).first()
        if not booking:
            return Response({'error': 'Payment order does not match a booking.'}, status=404)
        if not payment_booking_access_allowed(request, booking):
            return Response({'error': 'Not authorized for this booking.'}, status=403)
        booking_ref = request.data.get('booking_id') or request.data.get('booking_code')
        if booking_ref and str(booking_ref) not in (str(booking.pk), str(booking.booking_code)):
            return Response({'error': 'Booking reference mismatch.'}, status=400)
        if booking.razorpay_payment_id and booking.razorpay_payment_id != payment_id:
            return Response({'error': 'Booking already has a different payment.'}, status=409)
        if Booking.objects.filter(razorpay_payment_id=payment_id).exclude(pk=booking.pk).exists():
            return Response({'error': 'Payment already belongs to another booking.'}, status=409)

        try:
            import razorpay
            client = razorpay.Client(auth=(key_id, key_secret))
            payment = client.payment.fetch(payment_id)
            if (payment.get('status') != 'captured'
                    or payment.get('order_id') != order_id
                    or payment.get('currency') != 'INR'
                    or int(payment.get('amount', 0)) != int(booking.total_amount * 100)):
                return Response({'error': 'Payment details do not match the booking.'}, status=400)
        except Exception:
            logger.exception('Razorpay payment fetch failed')
            return Response({'error': 'Unable to verify captured payment.'}, status=502)

        if booking.payment_status != 'Paid':
            booking.payment_status = 'Paid'
            booking.payment_method = 'Online / Razorpay UPI'
            booking.razorpay_payment_id = payment_id
            booking.razorpay_signature = signature
            booking.save(update_fields=[
                'payment_status', 'payment_method', 'razorpay_payment_id', 'razorpay_signature'
            ])

        return Response({
            'success': True, 'message': 'Payment verified and recorded.',
            'payment_status': 'Paid', 'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id, 'booking_code': booking.booking_code,
        })


class CustomerProfileViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for registered customer profiles.
    """
    queryset = CustomerProfile.objects.all()
    serializer_class = CustomerProfileSerializer
    permission_classes = [IsGharSathiAdmin]

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [IsGharSathiAdminOrCustomer()]
        return [IsGharSathiAdmin()]

    def get_object(self):
        if getattr(self.request.user, 'role', None) == 'customer':
            return self.request.user.profile
        pk = self.kwargs.get('pk')
        if str(pk).isdigit():
            obj = self.get_queryset().filter(pk=pk).first()
        else:
            obj = self.get_queryset().filter(Q(customer_id=pk) | Q(phone=pk)).first()
        if not obj:
            raise NotFound('Customer profile not found')
        return obj

    def perform_update(self, serializer):
        if getattr(self.request.user, 'role', None) == 'customer':
            serializer.validated_data.pop('phone', None)
            serializer.validated_data.pop('email', None)
            serializer.validated_data.pop('status', None)
        serializer.save()



class CustomerEmailLinkView(APIView):
    """Link email only from an existing authenticated customer session."""
    permission_classes = [IsGharSathiCustomer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    def post(self, request):
        customer = request.user.profile
        email = str(request.data.get('email') or '').strip().lower()
        code = str(request.data.get('otp_code') or '').strip()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'error': 'Valid email required.'}, status=400)
        if CustomerProfile.objects.filter(email__iexact=email).exclude(pk=customer.pk).exists():
            return Response({'error': 'Email is already linked to another account.'}, status=409)
        if not code:
            if OTPVerification.objects.filter(phone=customer.phone, created_at__gte=timezone.now() - timedelta(seconds=60)).exists():
                return Response({'error': 'Wait 60 seconds before requesting another code.'}, status=429)
            if OTPVerification.objects.filter(phone=customer.phone, created_at__gte=timezone.now() - timedelta(hours=1)).count() >= 10:
                return Response({'error': 'Too many verification requests.'}, status=429)
            generated = str(secrets.randbelow(900000) + 100000)
            otp = OTPVerification.objects.create(
                phone=customer.phone, email=email, role='customer',
                otp_code=email_otp_digest(customer.phone, email, generated),
                expires_at=timezone.now() + timedelta(minutes=5),
            )
            try:
                send_login_otp(email, generated, 5)
            except EmailDeliveryError:
                otp.delete()
                return Response({'error': 'Email delivery unavailable.'}, status=503)
            return Response({'success': True, 'message': 'Email verification code sent.'})

        with transaction.atomic():
            otp = (OTPVerification.objects.select_for_update()
                   .filter(phone=customer.phone, email__iexact=email, role='customer',
                           is_verified=False).order_by('-created_at').first())
            if not otp or otp.is_expired():
                return Response({'error': 'No active email verification code.'}, status=400)
            if otp.attempts >= 5:
                return Response({'error': 'Too many verification attempts.'}, status=429)
            otp.attempts += 1
            otp.save(update_fields=['attempts'])
            if not hmac.compare_digest(otp.otp_code, email_otp_digest(customer.phone, email, code)):
                return Response({'error': 'Invalid verification code.'}, status=400)
            if CustomerProfile.objects.filter(email__iexact=email).exclude(pk=customer.pk).exists():
                return Response({'error': 'Email is already linked to another account.'}, status=409)
            customer.email = email
            customer.email_verified = True
            customer.save(update_fields=['email', 'email_verified'])
            otp.is_verified = True
            otp.save(update_fields=['is_verified'])
        return Response({'success': True, 'message': 'Email linked successfully.'})


class SendOTPView(APIView):
    """
    POST /api/auth/send-otp/
    Accepts: { "phone_number": "9876543210", "role": "customer" }
    Generates secure 6-digit numeric OTP, saves to DB with 5-minute expiry,
    sends it through the configured SMS provider; codes are returned only in explicit development mode.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_send'

    def post(self, request):
        phone_input = request.data.get('phone_number') or request.data.get('phone')
        technician_registration = request.path.endswith('/technicians/send-otp/')
        role = 'technician' if technician_registration else request.data.get('role', 'customer')

        if not phone_input:
            return Response({'error': 'Phone number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        clean_phone = ''.join(filter(str.isdigit, str(phone_input)))[-10:]
        if len(clean_phone) != 10 or clean_phone[0] not in '6789':
            return Response(
                {'error': 'Please provide a valid 10-digit Indian mobile number.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if role not in ('customer', 'technician'):
            return Response({'error': 'Unsupported authentication role.'}, status=status.HTTP_400_BAD_REQUEST)

        if role == 'technician' and not technician_registration:
            return Response(
                {'error': 'Technician sign-in uses the registered mobile number and password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tech = None
        if technician_registration:
            tech = TechnicianProfile.objects.filter(phone__endswith=clean_phone).first()
            if tech:
                return Response(
                    {'error': 'This technician is already registered. Sign in with mobile number and password.'},
                    status=status.HTTP_409_CONFLICT,
                )

        recent_requests = OTPVerification.objects.filter(
            phone=clean_phone,
            created_at__gte=timezone.now() - timedelta(hours=1),
        ).count()
        if recent_requests >= 10:
            return Response({'error': 'Too many OTP requests. Please try again later.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        if OTPVerification.objects.filter(phone=clean_phone, created_at__gte=timezone.now()-timedelta(seconds=60)).exists():
            return Response({'error': 'Wait 60 seconds before requesting another code.'}, status=429)

        if role == 'customer' and getattr(settings, 'CUSTOMER_OTP_CHANNEL', 'sms') == 'email':
            email = str(request.data.get('email') or '').strip().lower()
            try:
                validate_email(email)
            except DjangoValidationError:
                return Response({'error': 'Valid email is required for email OTP.'}, status=400)
            # Email verification alone cannot establish ownership of an arbitrary phone.
            # Require a pre-existing, already-linked phone/email pair; onboarding needs
            # a separately authenticated email-linking or phone-verification flow.
            if not CustomerProfile.objects.filter(phone=clean_phone, email__iexact=email, email_verified=True, status='Active').exists():
                return Response({'error': 'Email login is available only for existing verified email-linked accounts.'}, status=409)

        # Generate secure 6-digit random numeric OTP
        otp_code = str(secrets.randbelow(900000) + 100000)
        expiry_minutes = getattr(settings, 'OTP_EXPIRATION_MINUTES', 5)
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)

        # Invalidate old unverified OTPs for this phone
        OTPVerification.objects.filter(phone=clean_phone, is_verified=False).update(is_verified=True)

        # Create new OTP verification record
        otp_record = OTPVerification.objects.create(
            phone=clean_phone,
            otp_code=(email_otp_digest(clean_phone, email, otp_code) if role == 'customer' and getattr(settings, 'CUSTOMER_OTP_CHANNEL', 'sms') == 'email' else otp_code),
            role=role,
            expires_at=expires_at,
        )

        if role == 'customer' and getattr(settings, 'CUSTOMER_OTP_CHANNEL', 'sms') == 'email':
            email = str(request.data.get('email') or '').strip().lower()
            if not email or '@' not in email:
                otp_record.delete()
                return Response({'error': 'Email is required for email OTP.'}, status=400)
            otp_record.email = email
            otp_record.save(update_fields=['email'])
            try:
                send_login_otp(email, otp_code, expiry_minutes)
                delivery = {'success': True, 'message': 'Verification code sent to email.'}
            except EmailDeliveryError:
                otp_record.delete()
                return Response({'error': 'Email delivery unavailable. Please retry.'}, status=503)
        else:
            delivery = deliver_otp(clean_phone, otp_code)
        if not delivery['success']:
            otp_record.delete()
            return Response({'error': delivery['error']}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            **delivery, 'status': 'success', 'phone': clean_phone,
            'expires_in_seconds': expiry_minutes * 60,
        }, status=status.HTTP_200_OK)



class VerifyOTPView(APIView):
    """
    POST /api/auth/verify-otp/
    Accepts: { "phone_number": "9876543210", "otp_code": "123456", "role": "customer", "name": "...", "area": "..." }
    Validates OTP, checks expiration, handles customer/technician authentication,
    and returns a JWT token.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    def post(self, request):
        phone_input = request.data.get('phone_number') or request.data.get('phone')
        otp_input = str(request.data.get('otp_code') or '').strip()
        role = request.data.get('role', 'customer')
        technician_registration = request.path.endswith('/technicians/verify-otp/')

        if not phone_input or not otp_input:
            return Response({'error': 'Phone number and OTP code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if role not in ('customer', 'technician'):
            return Response({'error': 'Unsupported authentication role.'}, status=status.HTTP_400_BAD_REQUEST)

        if (role == 'technician') != technician_registration:
            return Response(
                {'error': 'Technicians must register with OTP and sign in with their mobile number and password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clean_phone = ''.join(filter(str.isdigit, str(phone_input)))[-10:]

        if technician_registration:
            registration_name = str(request.data.get('name') or '').strip()
            registration_password = str(request.data.get('password') or '')
            registration_email = str(request.data.get('email') or '').strip()
            aadhaar_digits = ''.join(filter(str.isdigit, str(request.data.get('aadhaar') or '')))
            if not registration_name or len(registration_password) < 12 or '@' not in registration_email:
                return Response(
                    {'error': 'Name, valid email, and a password of at least 12 characters are required.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(aadhaar_digits) != 12:
                return Response({'error': 'A valid 12-digit Aadhaar number is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if TechnicianProfile.objects.filter(phone__endswith=clean_phone).exists():
                return Response(
                    {'error': 'This technician is already registered. Sign in with mobile number and password.'},
                    status=status.HTTP_409_CONFLICT,
                )

        # Find latest active OTP record for this phone
        otp_record = (
            OTPVerification.objects.filter(phone=clean_phone, is_verified=False)
            .order_by('-created_at')
            .first()
        )

        if not otp_record:
            return Response(
                {'error': 'No active OTP request found for this phone number. Please request a new OTP.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if role == 'customer' and getattr(settings, 'CUSTOMER_OTP_CHANNEL', 'sms') == 'email':
            submitted_email = str(request.data.get('email') or '').strip().lower()
            if not submitted_email or submitted_email != otp_record.email:
                return Response({'error': 'Email does not match OTP request.'}, status=400)
            existing_email_owner = CustomerProfile.objects.filter(email__iexact=submitted_email).exclude(phone=clean_phone).exists()
            existing_phone_owner = CustomerProfile.objects.filter(phone=clean_phone).exclude(email__iexact=submitted_email).exists()
            if existing_email_owner or existing_phone_owner:
                return Response({'error': 'This account requires an existing-account verification or migration flow.'}, status=409)

        if otp_record.role != role:
            return Response({'error': 'This OTP was requested for a different account type.'}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.attempts >= 5:
            return Response(
                {'error': 'Maximum verification attempts exceeded. Please request a new OTP.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        otp_record.attempts += 1
        otp_record.save(update_fields=['attempts'])

        if otp_record.is_expired():
            return Response(
                {'error': 'This OTP has expired. Please click Resend OTP to get a new code.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        expected_otp = (email_otp_digest(clean_phone, otp_record.email, otp_input)
                        if role == 'customer' and getattr(settings, 'CUSTOMER_OTP_CHANNEL', 'sms') == 'email'
                        else otp_input)
        if not hmac.compare_digest(otp_record.otp_code, expected_otp):
            return Response(
                {'error': 'Invalid OTP code. Please enter the correct 6-digit verification code.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # User Authentication & Profile Resolution
        with transaction.atomic():
            user_profile_data = {}
            if role == 'technician':
                tech = TechnicianProfile.objects.create(
                    name=registration_name,
                    phone=clean_phone,
                    email=registration_email,
                    area=request.data.get('area') or 'Patna to Danapur',
                    trade=request.data.get('skills') or 'Home Services',
                    address=request.data.get('address') or '',
                    aadhaar_masked=f'XXXX XXXX {aadhaar_digits[-4:]}',
                    live_location=request.data.get('live_location') or {},
                    live_image=request.data.get('live_image') or '',
                    wallet_balance=Decimal('0.00'),
                    otp_code='',
                    otp_expires_at=None,
                    otp_attempts=0,
                )
                tech.set_password(registration_password)

                user_profile_data = TechnicianProfileSerializer(tech).data
                user_profile_data['userType'] = 'technician'
            else:
                # Customer role
                customer, created = CustomerProfile.objects.get_or_create(
                    phone=clean_phone,
                    defaults={
                        'name': request.data.get('name', f"Customer {clean_phone[-4:]}"),
                        'area': request.data.get('area', 'Patna to Danapur'),
                        'address': request.data.get('address', ''),
                        'pincode': request.data.get('pincode', '801103'),
                    }
                )
                if not created:
                    updated = False
                    if request.data.get('name'):
                        customer.name = request.data.get('name')
                        updated = True
                    if request.data.get('address'):
                        customer.address = request.data.get('address')
                        updated = True
                    if request.data.get('pincode'):
                        customer.pincode = request.data.get('pincode')
                        updated = True
                    if request.data.get('area'):
                        customer.area = request.data.get('area')
                        updated = True
                    if updated:
                        customer.save()

                if role == 'customer' and getattr(settings, 'CUSTOMER_OTP_CHANNEL', 'sms') == 'email':
                    customer.email = submitted_email
                    customer.save(update_fields=['email'])
                user_profile_data = CustomerProfileSerializer(customer).data
                user_profile_data['userType'] = 'customer'

            otp_record.is_verified = True
            otp_record.save(update_fields=['is_verified'])

        # Generate standard JWT Token (valid 7 days)
        payload = {
            'id': tech.id if role == 'technician' else customer.id,
            'phone': clean_phone,
            'role': role,
            **({'credential_version': credential_version(tech)} if role == 'technician' else {}),
            'exp': timezone.now() + timedelta(days=7),
            'iat': timezone.now(),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

        return Response({
            'status': 'success',
            'success': True,
            'message': 'Mobile number verified successfully.',
            'token': token,
            'role': role,
            'user': user_profile_data,
            'technician': user_profile_data if role == 'technician' else None,
        }, status=status.HTTP_200_OK)


class LoginView(APIView):
    """
    POST /api/auth/login/ & /api/technicians/login/
    Accepts: { "phone": "9876500001", "password": "...", "role": "technician" }
    or { "username": "...", "password": "..." }
    Validates passwords using Django password hashing (check_password / authenticate)
    and returns valid tokens/JWT and profile data.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        phone_input = request.data.get('phone') or request.data.get('username') or request.data.get('phone_number')
        password = request.data.get('password')
        role = request.data.get('role', 'technician')

        if not phone_input or not password:
            return Response(
                {'error': 'Mobile number (ya username) aur password zaroori hain.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        clean_phone = ''.join(filter(str.isdigit, str(phone_input)))[-10:]

        # 1. Admin login handling
        if role == 'admin' or '@' in str(phone_input) or str(phone_input).strip().lower() in ('prabhat', 'admin'):
            from django.contrib.auth import authenticate
            username = str(phone_input).strip()
            auth_user = (
                authenticate(username=username, password=password)
                or authenticate(username=username.lower(), password=password)
            )
            if not auth_user and '@' in username:
                from django.contrib.auth.models import User
                u = User.objects.filter(email__iexact=username).first()
                if u and u.check_password(password):
                    auth_user = u

            if auth_user and (auth_user.is_staff or auth_user.is_superuser):
                auth_user.last_login = timezone.now()
                auth_user.save(update_fields=['last_login'])
                payload = {
                    'user_id': auth_user.id,
                    'username': auth_user.username,
                    'email': auth_user.email,
                    'role': 'admin',
                    'is_staff': True,
                    'exp': timezone.now() + timedelta(days=7),
                    'iat': timezone.now(),
                }
                token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
                return Response({
                    'success': True,
                    'message': 'Admin login successful.',
                    'token': token,
                    'role': 'admin',
                    'user': {
                        'id': auth_user.id,
                        'username': auth_user.username,
                        'email': auth_user.email,
                        'is_staff': auth_user.is_staff,
                    }
                })

        if role == 'customer':
            return Response(
                {'error': 'Customer sign-in requires a verified mobile OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role != 'technician':
            return Response({'error': 'Unsupported authentication role.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Technician login
        tech = None
        if len(clean_phone) == 10:
            tech = TechnicianProfile.objects.filter(phone__endswith=clean_phone).first()
        if not tech:
            tech = TechnicianProfile.objects.filter(partner_id=str(phone_input).strip()).first()

        if tech:
            # Check password using TechnicianProfile.check_password (supports Django hashing)
            if not tech.check_password(password):
                return Response(
                    {'error': 'Galat password! Kripya apna sahi password daalein.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            payload = {
                'id': tech.id,
                'partner_id': tech.partner_id,
                'phone': tech.phone,
                'role': 'technician',
                'credential_version': credential_version(tech),
                'name': tech.name,
                'exp': timezone.now() + timedelta(days=7),
                'iat': timezone.now(),
            }
            token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

            tech_data = TechnicianProfileSerializer(tech).data
            tech_data['userType'] = 'technician'

            return Response({
                'success': True,
                'message': f'Namaste {tech.name}, login successful!',
                'token': token,
                'role': 'technician',
                'technician': tech_data,
                'user': tech_data,
            })

        return Response(
            {'error': 'Is mobile number ya username se koi account nahi mila.'},
            status=status.HTTP_404_NOT_FOUND
        )


class AuthMeView(APIView):
    """Use the same Bearer JWT validation and revocation rules as every protected API."""
    permission_classes = [IsGharSathiAuthenticated]

    def get(self, request):
        role = request.user.role
        profile = request.user.profile
        if role == 'admin':
            data = {'id': profile.pk, 'username': profile.username,
                    'email': profile.email, 'is_staff': profile.is_staff}
        elif role == 'technician':
            data = dict(TechnicianProfileSerializer(profile).data)
        else:
            data = dict(CustomerProfileSerializer(profile).data)
        data['userType'] = role
        return Response({'success': True, 'role': role, 'user': data,
                         **({'technician': data} if role == 'technician' else {})})


def normalize_phone_number(phone_input):
    """
    Normalizes phone numbers by stripping non-digit characters, leading +91, 91, or 0,
    and returning the clean 10-digit Indian mobile number.
    Handles inputs like '+91 98765-43210', '919876543210', '09876543210', '9876543210'.
    """
    if not phone_input:
        return ''
    raw_str = str(phone_input).strip()
    digits = ''.join(ch for ch in raw_str if ch.isdigit())
    if len(digits) == 12 and digits.startswith('91'):
        return digits[2:]
    if len(digits) == 11 and digits.startswith('0'):
        return digits[1:]
    if len(digits) > 10:
        return digits[-10:]
    return digits


class TechnicianForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_send'
    """
    POST /api/technicians/forgot-password/
    Accepts: { "phone": "9876500001" }
    Normalizes phone number, generates 6-digit OTP, saves to TechnicianProfile with 5-minute expiry,
    and sends it through the configured SMS provider.
    """

    def post(self, request):
        phone_input = request.data.get('phone') or request.data.get('phone_number')
        if not phone_input:
            return Response({'error': 'Mobile number zaroori hai.'}, status=status.HTTP_400_BAD_REQUEST)

        clean_phone = normalize_phone_number(phone_input)
        if len(clean_phone) != 10 or clean_phone[0] not in '6789':
            return Response(
                {'error': 'Kripya valid 10-digit Indian mobile number enter karein.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tech = TechnicianProfile.objects.filter(
            Q(phone=clean_phone) |
            Q(phone=f'+91{clean_phone}') |
            Q(phone=f'91{clean_phone}') |
            Q(phone__endswith=clean_phone)
        ).first()

        if not tech:
            return Response(
                {'error': f'Mobile number +91 {clean_phone} se koi registered technician account nahi mila.'},
                status=status.HTTP_404_NOT_FOUND
            )

        recent = OTPVerification.objects.filter(phone=clean_phone, created_at__gte=timezone.now()-timedelta(hours=1))
        if recent.count() >= 10 or recent.filter(created_at__gte=timezone.now()-timedelta(seconds=60)).exists():
            return Response({'error': 'Too many OTP requests. Please try again later.'}, status=429)

        # Generate a cryptographically secure 6-digit numeric OTP
        otp_code = str(secrets.randbelow(900000) + 100000)
        expiry_minutes = getattr(settings, 'OTP_EXPIRATION_MINUTES', 5)
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)

        # Save OTP against TechnicianProfile
        tech.otp_code = otp_code
        tech.otp_expires_at = expires_at
        tech.otp_attempts = 0
        tech.save(update_fields=['otp_code', 'otp_expires_at', 'otp_attempts', 'updated_at'])

        # Invalidate previous unverified OTPs and save unified record
        OTPVerification.objects.filter(phone=clean_phone, is_verified=False).update(is_verified=True)
        OTPVerification.objects.create(
            phone=clean_phone,
            otp_code=otp_code,
            role='technician',
            expires_at=expires_at,
        )

        delivery = deliver_otp(clean_phone, otp_code)
        if not delivery['success']:
            tech.otp_code = ''
            tech.otp_expires_at = None
            tech.save(update_fields=['otp_code', 'otp_expires_at', 'updated_at'])
            OTPVerification.objects.filter(phone=clean_phone, is_verified=False).delete()
            return Response({'error': delivery['error']}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            **delivery, 'status': 'success', 'phone': clean_phone,
            'expires_in_seconds': expiry_minutes * 60,
        }, status=status.HTTP_200_OK)



class TechnicianResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'
    """
    POST /api/technicians/reset-password-otp/
    Accepts: { "phone": "9876500001", "otp_code": "123456", "new_password": "..." }
    Verifies the OTP matches, has not expired, checks max attempts,
    updates the password using user.set_password(), and clears OTP fields upon successful reset.
    """

    def post(self, request):
        phone_input = request.data.get('phone') or request.data.get('phone_number')
        otp_input = str(request.data.get('otp_code') or '').strip()
        new_password = str(request.data.get('new_password') or '').strip()

        if not phone_input or not otp_input or not new_password:
            return Response(
                {'error': 'Phone number, OTP code, aur naya password sabhi zaroori hain.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 12:
            return Response(
                {'error': 'Naya password kam se kam 12 characters ka hona chahiye.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        clean_phone = normalize_phone_number(phone_input)

        tech = TechnicianProfile.objects.filter(
            Q(phone=clean_phone) |
            Q(phone=f'+91{clean_phone}') |
            Q(phone=f'91{clean_phone}') |
            Q(phone__endswith=clean_phone)
        ).first()

        if not tech:
            return Response(
                {'error': 'Technician profile not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check max attempts guardrail
        if tech.otp_attempts >= 5:
            return Response(
                {'error': 'Maximum attempts exceed ho gaye hain. Naya OTP request karein.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tech.otp_attempts += 1
        tech.save(update_fields=['otp_attempts', 'updated_at'])

        now = timezone.now()
        otp_matched = False

        # 1. Check TechnicianProfile OTP
        if tech.otp_code:
            if tech.otp_expires_at and tech.otp_expires_at < now:
                return Response(
                    {'error': 'OTP expire ho chuka hai. Kripya Resend OTP karein.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if tech.otp_code == otp_input:
                otp_matched = True

        # 2. Fallback check against OTPVerification table
        if not otp_matched:
            otp_record = (
                OTPVerification.objects.filter(phone=clean_phone, role='technician', is_verified=False)
                .order_by('-created_at')
                .first()
            )
            if otp_record:
                if otp_record.is_expired():
                    return Response(
                        {'error': 'OTP expire ho chuka hai. Kripya Resend OTP karein.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if otp_record.otp_code == otp_input:
                    otp_matched = True
                    otp_record.is_verified = True
                    otp_record.save(update_fields=['is_verified'])

        if not otp_matched:
            return Response(
                {'error': 'Galat OTP code! Kripya 6-digit SMS OTP check karein.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Secure password update & clear OTP fields upon successful reset
        tech.otp_code = ''
        tech.otp_expires_at = None
        tech.otp_attempts = 0
        tech.set_password(new_password)
        tech.save(update_fields=['otp_code', 'otp_expires_at', 'otp_attempts', 'password', 'updated_at'])

        # Also update linked Django User account if exists
        from django.contrib.auth.models import User
        user = User.objects.filter(username=clean_phone).first() or User.objects.filter(username=tech.partner_id).first()
        if user:
            user.set_password(new_password)
            user.save()

        # Mark historical OTP records as verified
        OTPVerification.objects.filter(phone=clean_phone).update(is_verified=True)

        logger.info(f"Technician {tech.partner_id} ({clean_phone}) password reset successfully via OTP.")

        return Response({
            'success': True,
            'message': 'Password successfully update ho gaya hai! Aap ab naye password se login kar sakte hain.',
            'partner_id': tech.partner_id,
        }, status=status.HTTP_200_OK)
