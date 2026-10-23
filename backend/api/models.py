import random
from decimal import Decimal
from django.db import models
from django.utils import timezone


class Service(models.Model):
    CATEGORY_CHOICES = [
        ('appliance', 'Appliance Repair'),
        ('electrical', 'Electrical & Wiring'),
        ('cleaning', 'Cleaning & Sanitization'),
        ('plumbing', 'Plumbing & Home Repair'),
        ('general', 'General Home Services'),
    ]

    slug = models.SlugField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=60, choices=CATEGORY_CHOICES, default='appliance')
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('499.00'))
    commission_fee = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('149.00'))
    description = models.TextField(blank=True, default='')
    icon = models.CharField(max_length=30, blank=True, default='🧰')
    image = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    subcategories = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.name} (₹{self.base_price})"


class TechnicianProfile(models.Model):
    KYC_STATUS_CHOICES = [
        ('Pending', 'Pending Verification'),
        ('Verified', 'Verified'),
        ('Rejected', 'Rejected'),
    ]

    partner_id = models.CharField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15, unique=True)
    password = models.CharField(max_length=128, default='password123')
    email = models.EmailField(blank=True, default='')
    trade = models.CharField(max_length=255, blank=True, default='')  # Skills string
    area = models.CharField(max_length=100, default='Patna to Danapur')
    address = models.TextField(blank=True, default='')
    experience_years = models.IntegerField(default=3)
    kyc_status = models.CharField(max_length=25, choices=KYC_STATUS_CHOICES, default='Pending')
    aadhaar_masked = models.CharField(max_length=30, blank=True, default='')
    certificate_id = models.CharField(max_length=60, blank=True, default='')
    document_type = models.CharField(max_length=60, blank=True, default='Aadhaar Card')
    upi_id = models.CharField(max_length=80, blank=True, default='gharsathi.partner@upi')
    kyc_remarks = models.TextField(blank=True, default='')
    wallet_balance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('600.00'))
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('5.00'))
    rating_count = models.IntegerField(default=0)
    completed_jobs = models.IntegerField(default=0)
    is_online = models.BooleanField(default=True)
    live_location = models.JSONField(blank=True, null=True, default=dict)
    live_image = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"{self.partner_id} - {self.name} ({self.kyc_status}, ₹{self.wallet_balance})"

    def set_password(self, raw_password):
        """Sets and hashes the technician password using standard Django password hashing."""
        from django.contrib.auth.hashers import make_password
        self.password = make_password(raw_password)
        self.save(update_fields=['password', 'updated_at'])

    def check_password(self, raw_password):
        """Validates raw password against stored password using Django's check_password."""
        from django.contrib.auth.hashers import check_password
        if not self.password or not raw_password:
            return False
        # If stored as plain-text (e.g. initial demo password123), auto-upgrade to standard Django hash
        if self.password == raw_password:
            self.set_password(raw_password)
            return True
        try:
            return check_password(raw_password, self.password)
        except Exception:
            return False

    def save(self, *args, **kwargs):
        if not self.partner_id:
            rand_suffix = random.randint(100, 999)
            self.partner_id = f"TECH-{rand_suffix}"
        super().save(*args, **kwargs)


class Booking(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Accepted', 'Accepted'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    booking_code = models.CharField(max_length=30, unique=True, db_index=True)
    invoice_number = models.CharField(max_length=40, unique=True, blank=True)
    customer_name = models.CharField(max_length=120)
    customer_phone = models.CharField(max_length=15)
    address = models.TextField()
    area = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10, blank=True, default='')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    service = models.ForeignKey(Service, on_delete=models.CASCADE, null=True, blank=True, related_name='bookings')
    service_name = models.CharField(max_length=120, blank=True, default='')
    subcategory_id = models.CharField(max_length=80, blank=True, default='')
    subcategory_name = models.CharField(max_length=120, blank=True, default='')
    technician = models.ForeignKey(
        TechnicianProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings'
    )
    technician_name = models.CharField(max_length=120, blank=True, default='')
    technician_phone = models.CharField(max_length=15, blank=True, default='')
    scheduled_date = models.DateField(null=True, blank=True)
    scheduled_time = models.CharField(max_length=50, blank=True, default='10 AM - 12 PM')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('149.00'))
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    PAYMENT_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Paid', 'Paid'),
        ('Failed', 'Failed'),
    ]

    payment_method = models.CharField(max_length=50, default='Cash on Service')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='Pending')
    razorpay_order_id = models.CharField(max_length=100, blank=True, default='')
    razorpay_payment_id = models.CharField(max_length=100, blank=True, default='')
    razorpay_signature = models.CharField(max_length=200, blank=True, default='')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='Pending')
    service_pin = models.CharField(max_length=6, blank=True, default='')  # 4-Digit Happy Code
    notes = models.TextField(blank=True, default='')
    rating = models.IntegerField(null=True, blank=True)
    review_text = models.TextField(blank=True, default='')
    review_tags = models.JSONField(blank=True, default=list)
    rated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.booking_code} - {self.service_name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.booking_code:
            rand_code = random.randint(1000000, 9999999)
            self.booking_code = f"GS-{rand_code}"
        if not self.service_pin:
            self.service_pin = str(random.randint(1000, 9999))
        if not self.invoice_number:
            rand_inv = random.randint(100000, 999999)
            self.invoice_number = f"INV-{rand_inv}"
        if not self.service_name and self.service:
            self.service_name = self.service.name
        if self.service and hasattr(self.service, 'commission_fee') and (self.platform_fee is None or self.platform_fee == Decimal('149.00')):
            self.platform_fee = self.service.commission_fee
        if not self.total_amount:
            self.total_amount = self.base_price
        super().save(*args, **kwargs)


class WalletTransaction(models.Model):
    TXN_TYPE_CHOICES = [
        ('CREDIT', 'Credit'),
        ('DEBIT', 'Debit'),
    ]

    txn_id = models.CharField(max_length=40, unique=True, db_index=True)
    technician = models.ForeignKey(TechnicianProfile, on_delete=models.CASCADE, related_name='wallet_transactions')
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name='wallet_transactions')
    txn_type = models.CharField(max_length=10, choices=TXN_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.txn_id} [{self.txn_type}] ₹{self.amount} - {self.technician.name}"

    def save(self, *args, **kwargs):
        if not self.txn_id:
            rand_id = random.randint(100000, 999999)
            self.txn_id = f"TXN-{rand_id}"
        super().save(*args, **kwargs)


class Complaint(models.Model):
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Review', 'In Review'),
        ('Resolved', 'Resolved'),
    ]

    complaint_code = models.CharField(max_length=30, unique=True, db_index=True)
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints')
    customer_name = models.CharField(max_length=120)
    customer_phone = models.CharField(max_length=15)
    category = models.CharField(max_length=100, default='Service Quality')
    priority = models.CharField(max_length=20, default='Medium')
    description = models.TextField()
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='Open')
    resolution_action = models.TextField(blank=True, default='')
    admin_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.complaint_code} ({self.status}) - {self.customer_name}"

    def save(self, *args, **kwargs):
        if not self.complaint_code:
            rand_id = random.randint(10000, 99999)
            self.complaint_code = f"CMP-{rand_id}"
        super().save(*args, **kwargs)


class AdminWithdrawal(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    withdrawal_id = models.CharField(max_length=30, unique=True, db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    bank_details = models.CharField(max_length=120)  # UPI ID or Bank Account / IFSC
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    admin_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.withdrawal_id} - ₹{self.amount} ({self.status}) - {self.bank_details}"

    def save(self, *args, **kwargs):
        if not self.withdrawal_id:
            rand_id = random.randint(10000000, 99999999)
            self.withdrawal_id = f"WDR-{rand_id}"
        super().save(*args, **kwargs)


class CustomerProfile(models.Model):
    customer_id = models.CharField(max_length=30, unique=True, db_index=True)
    phone = models.CharField(max_length=15, unique=True, db_index=True)
    name = models.CharField(max_length=120, blank=True, default='')
    address = models.TextField(blank=True, default='')
    area = models.CharField(max_length=100, default='Patna to Danapur')
    pincode = models.CharField(max_length=10, blank=True, default='')
    status = models.CharField(max_length=20, default='Active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer_id} - {self.name or 'Customer'} ({self.phone})"

    def save(self, *args, **kwargs):
        if not self.customer_id:
            rand_id = random.randint(100, 999)
            self.customer_id = f"CUS-{rand_id}"
        super().save(*args, **kwargs)


class OTPVerification(models.Model):
    ROLE_CHOICES = [
        ('customer', 'Customer'),
        ('technician', 'Technician Partner'),
        ('admin', 'Admin'),
    ]

    phone = models.CharField(max_length=15, db_index=True)
    otp_code = models.CharField(max_length=6)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP for {self.phone} ({self.role}) - {'Verified' if self.is_verified else 'Pending'}"

    def is_expired(self):
        return timezone.now() > self.expires_at

