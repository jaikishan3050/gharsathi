from decimal import Decimal
from rest_framework import serializers
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import Service, SubService, TechnicianProfile, Booking, WalletTransaction, Complaint, AdminWithdrawal, CustomerProfile, OTPVerification


class SubServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubService
        fields = [
            'id', 'sub_id', 'service', 'name', 'price', 'old_price',
            'commission_fee', 'time', 'description', 'is_active',
            'created_at', 'updated_at'
        ]


class ServiceSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False)

    class Meta:
        model = Service
        fields = [
            'id', 'slug', 'name', 'category', 'base_price', 'commission_fee',
            'description', 'icon', 'image', 'is_active',
            'subcategories',
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        if not validated_data.get('slug'):
            from django.utils.text import slugify
            base_slug = slugify(validated_data.get('name', 'service')) or 'service'
            slug = base_slug
            counter = 1
            while Service.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        return super().create(validated_data)


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'txn_id', 'technician', 'booking', 'txn_type',
            'amount', 'balance_after', 'description', 'created_at'
        ]


class TechnicianProfileSerializer(serializers.ModelSerializer):
    wallet_transactions = WalletTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = TechnicianProfile
        fields = [
            'id', 'partner_id', 'name', 'phone', 'password', 'email',
            'trade', 'area', 'address', 'experience_years', 'kyc_status',
            'aadhaar_masked', 'certificate_id', 'document_type', 'upi_id',
            'kyc_remarks', 'wallet_balance', 'rating_avg', 'rating_count',
            'completed_jobs', 'is_online', 'live_location', 'live_image',
            'created_at', 'updated_at', 'wallet_transactions'
        ]
        read_only_fields = ['wallet_balance', 'rating_avg', 'rating_count', 'completed_jobs']
        extra_kwargs = {
            'partner_id': {'required': False},
            'password': {'write_only': True, 'required': False}
        }

    def validate_password(self, value):
        if len(value) < 12:
            raise serializers.ValidationError('Password must contain at least 12 characters.')
        try:
            validate_password(value)
        except ValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value

    def create(self, validated_data):
        # Explicitly ensure newly registered technicians start with 0.00 wallet balance
        validated_data['wallet_balance'] = Decimal('0.00')
        raw_password = validated_data.pop('password', None)
        if not raw_password:
            raise serializers.ValidationError({'password': 'A password is required.'})
        instance = super().create(validated_data)
        if raw_password:
            instance.set_password(raw_password)
            instance.save(update_fields=['password'])
        return instance

    def update(self, instance, validated_data):
        raw_password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if raw_password:
            instance.set_password(raw_password)
        return instance


class BookingSerializer(serializers.ModelSerializer):
    # The screen fallback must never disclose the Happy Code to technicians.
    service_pin = serializers.CharField(read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        allowed = (request is not None
                   and getattr(request.user, 'role', None) == 'customer'
                   and getattr(settings, 'HAPPY_CODE_CHANNEL', 'screen') == 'screen'
                   and instance.status == 'In Progress'
                   and (
                       (instance.customer_id is not None and
                        instance.customer_id == getattr(request.user.profile, 'pk', None))
                       or
                       (instance.customer_id is None and
                        len(''.join(filter(str.isdigit, str(getattr(request.user, 'phone', ''))))[-10:]) == 10 and
                        ''.join(filter(str.isdigit, str(request.user.phone)))[-10:]
                        == ''.join(filter(str.isdigit, str(instance.customer_phone)))[-10:])
                   ))
        if not allowed:
            data.pop('service_pin', None)
        return data

    service_details = ServiceSerializer(source='service', read_only=True)
    technician_details = TechnicianProfileSerializer(source='technician', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'booking_code', 'invoice_number', 'customer', 'customer_name',
            'customer_phone', 'address', 'area', 'pincode',
            'latitude', 'longitude', 'service', 'service_name',
            'subcategory_id', 'subcategory_name',
            'technician', 'technician_name', 'technician_phone',
            'scheduled_date', 'scheduled_time', 'base_price',
            'platform_fee', 'total_amount', 'payment_method', 'payment_status',
            'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature',
            'status', 'service_pin', 'notes', 'rating',
            'review_text', 'review_tags', 'rated_at',
            'created_at', 'completed_at',
            'service_details', 'technician_details'
        ]
        read_only_fields = [
            'customer', 'invoice_number', 'platform_fee', 'created_at', 'completed_at',
            'payment_status', 'razorpay_order_id', 'razorpay_payment_id',
            'razorpay_signature',
        ]
        extra_kwargs = {
            'booking_code': {'required': False},
        }


class ComplaintSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id', 'complaint_code', 'booking', 'booking_code',
            'customer_name', 'customer_phone', 'category', 'priority',
            'description', 'status', 'resolution_action', 'admin_notes',
            'created_at', 'resolved_at'
        ]
        read_only_fields = ['complaint_code', 'created_at', 'resolved_at']


class AdminWithdrawalSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminWithdrawal
        fields = [
            'id', 'withdrawal_id', 'amount', 'bank_details',
            'status', 'admin_notes', 'created_at', 'processed_at'
        ]
        read_only_fields = ['withdrawal_id', 'created_at']
        extra_kwargs = {
            'withdrawal_id': {'required': False},
        }


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = [
            'id', 'customer_id', 'phone', 'email', 'email_verified', 'name', 'address',
            'area', 'pincode', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['customer_id', 'email_verified', 'created_at', 'updated_at']


