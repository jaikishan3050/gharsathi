import random
from decimal import Decimal
from django.utils import timezone
from .models import Service, SubService, TechnicianProfile, Booking, WalletTransaction, Complaint, AdminWithdrawal

SERVICES_DATA = [
    {
        'slug': 'ac',
        'name': 'AC Service & Repair',
        'category': 'appliance',
        'base_price': Decimal('499.00'),
        'description': 'Cooling ka full solution - foam jet service, gas refill, and compressor checkup.',
        'icon': '❄️',
        'image': '/images/ac-service.png',
        'subcategories': [
            {'id': 'ac-split-service', 'name': 'Split AC Foam Jet Service', 'price': 499, 'oldPrice': 699, 'time': '45 mins', 'description': 'Deep jet clean of indoor and outdoor coils + filter sanitization'},
            {'id': 'ac-window-service', 'name': 'Window AC Complete Service', 'price': 449, 'oldPrice': 599, 'time': '40 mins', 'description': 'Power jet wash and drainage unclogging for window unit'},
            {'id': 'ac-gas-refill', 'name': 'AC Gas Charging / Refill', 'price': 1499, 'oldPrice': 1899, 'time': '60 mins', 'description': 'Leak test and full gas refill with pressure gauge verification'},
            {'id': 'ac-installation', 'name': 'AC Installation / Uninstallation', 'price': 799, 'oldPrice': 999, 'time': '90 mins', 'description': 'Secure wall mount, piping connection, and electrical check'},
        ],
    },
    {
        'slug': 'washing',
        'name': 'Washing Machine Repair',
        'category': 'appliance',
        'base_price': Decimal('599.00'),
        'description': 'Top load, front load & semi-automatic machine service and drum diagnostics.',
        'icon': '🫧',
        'image': '/images/washing-service.png',
        'subcategories': [
            {'id': 'wm-semi', 'name': 'Semi-Automatic Checkup & Repair', 'price': 399, 'oldPrice': 499, 'time': '45 mins', 'description': 'Spin tub, wash motor, drain pipe repair and vibration fix'},
            {'id': 'wm-top-load', 'name': 'Top Load Fully Automatic Service', 'price': 599, 'oldPrice': 749, 'time': '60 mins', 'description': 'Drum clean, water inlet valve and sensor diagnostics'},
            {'id': 'wm-front-load', 'name': 'Front Load Advanced Repair', 'price': 749, 'oldPrice': 899, 'time': '60 mins', 'description': 'Door lock, suspension, PCB and belt replacement service'},
        ],
    },
    {
        'slug': 'fridge',
        'name': 'Fridge & Refrigerator Repair',
        'category': 'appliance',
        'base_price': Decimal('649.00'),
        'description': 'Single door, double door, gas charging, cooling coil and thermostat fix.',
        'icon': '🧊',
        'image': '/images/fridge-service.png',
        'subcategories': [
            {'id': 'fridge-single', 'name': 'Single Door Cooling Checkup', 'price': 449, 'oldPrice': 599, 'time': '40 mins', 'description': 'Thermostat testing, cooling coil repair & gasket replacement'},
            {'id': 'fridge-double', 'name': 'Double Door Frost-Free Repair', 'price': 649, 'oldPrice': 799, 'time': '50 mins', 'description': 'Defrost heater, fan motor & PCB repair for modern double door units'},
            {'id': 'fridge-gas', 'name': 'Refrigerator Gas Charging', 'price': 1199, 'oldPrice': 1499, 'time': '60 mins', 'description': 'Compressor check, vacuuming, and complete gas charging'},
        ],
    },
    {
        'slug': 'ro',
        'name': 'RO Service & Water Purifier',
        'category': 'plumbing',
        'base_price': Decimal('499.00'),
        'description': 'Filter replacement, membrane check, TDS adjustment, UV/UF tube service.',
        'icon': '💧',
        'image': '/images/ro-service.png',
        'subcategories': [
            {'id': 'ro-routine', 'name': 'Routine Filter Service & TDS Check', 'price': 399, 'oldPrice': 499, 'time': '30 mins', 'description': 'Sediment filter replacement, tank sanitization & water TDS meter test'},
            {'id': 'ro-membrane', 'name': 'Membrane & Carbon Filter Change', 'price': 899, 'oldPrice': 1199, 'time': '45 mins', 'description': 'Original RO membrane change with full taste check'},
            {'id': 'ro-overhaul', 'name': 'Complete RO Overhaul & Booster Pump', 'price': 1299, 'oldPrice': 1699, 'time': '60 mins', 'description': 'Pump motor testing, all-filter replacement, and flow regulation'},
        ],
    },
    {
        'slug': 'cooler',
        'name': 'Air Cooler Repair & Service',
        'category': 'electrical',
        'base_price': Decimal('399.00'),
        'description': 'Motor rewiring, water pump replacement, grass pad change, body cleaning.',
        'icon': '🌀',
        'image': '/images/cooler-service.png',
        'subcategories': [
            {'id': 'cooler-pump', 'name': 'Cooler Water Pump & Motor Repair', 'price': 349, 'oldPrice': 420, 'time': '30 mins', 'description': 'Water pump replacement, motor oiling, and speed switch repair'},
            {'id': 'cooler-pad', 'name': 'Cooler Grass / Honeycomb Pad Fitting', 'price': 399, 'oldPrice': 499, 'time': '40 mins', 'description': 'Complete pad replacement, body cleaning, and water pipe routing'},
        ],
    },
    {
        'slug': 'electrician',
        'name': 'Electrician & Electrical Services',
        'category': 'electrical',
        'base_price': Decimal('199.00'),
        'description': 'Fan repair, short circuit fix, MCB installation, switchboard wiring.',
        'icon': '💡',
        'image': '/images/electrician-service.png',
        'subcategories': [
            {'id': 'elec-switch', 'name': 'Switch / Socket / Light Installation', 'price': 199, 'oldPrice': 249, 'time': '30 mins', 'description': 'Fixing loose connections, replacing faulty switches, holders & LEDs'},
            {'id': 'elec-fan', 'name': 'Ceiling Fan Repair & Installation', 'price': 249, 'oldPrice': 349, 'time': '35 mins', 'description': 'Capacitor replacement, blade balancing, and ceiling fan hanging'},
            {'id': 'elec-mcb', 'name': 'MCB / Fuse Box / Inverter Troubleshooting', 'price': 449, 'oldPrice': 599, 'time': '50 mins', 'description': 'Short circuit isolation, MCB tripping repair, and inverter battery wiring'},
        ],
    },
    {
        'slug': 'cleaning',
        'name': 'Full Home Deep Cleaning',
        'category': 'cleaning',
        'base_price': Decimal('1299.00'),
        'description': 'Deep sanitization, floor scrubbing, bathroom descaling, balcony cleaning.',
        'icon': '🧹',
        'image': '/images/cleaning-service.png',
        'subcategories': [
            {'id': 'clean-1bhk', 'name': '1 BHK Complete Home Deep Clean', 'price': 1299, 'oldPrice': 1499, 'time': '120 mins', 'description': 'Floor scrubbing, bathroom descaling, fan wiping & balcony wash'},
            {'id': 'clean-2bhk', 'name': '2 BHK Complete Home Deep Clean', 'price': 1899, 'oldPrice': 2299, 'time': '180 mins', 'description': 'Full 2-bedroom home scrub, windows, doors, kitchen and bathrooms'},
            {'id': 'clean-bath', 'name': 'Bathroom & Washroom Deep Clean', 'price': 499, 'oldPrice': 649, 'time': '45 mins', 'description': 'Hard water tile stain removal, toilet pot disinfection, fittings shine'},
        ],
    },
    {
        'slug': 'chimney',
        'name': 'Kitchen Chimney Cleaning & Service',
        'category': 'cleaning',
        'base_price': Decimal('749.00'),
        'description': 'Baffle filter degreasing, motor carbon cleaning, exhaust duct wash.',
        'icon': '🍳',
        'image': '/images/chimney-service.png',
        'subcategories': [
            {'id': 'chimney-degrease', 'name': 'Baffle / Mesh Filter Deep Degreasing', 'price': 749, 'oldPrice': 899, 'time': '60 mins', 'description': 'Caustic wash of filters, outer canopy wiping, and duct check'},
            {'id': 'chimney-motor', 'name': 'Complete Chimney Motor Dismantling & Clean', 'price': 1199, 'oldPrice': 1499, 'time': '90 mins', 'description': 'Internal blower wheel cleaning and grease elimination'},
        ],
    },
    {
        'slug': 'geyser',
        'name': 'Water Geyser Repair & Installation',
        'category': 'appliance',
        'base_price': Decimal('449.00'),
        'description': 'Heating element change, thermostat check, tank descaling, pipe fitting.',
        'icon': '🔥',
        'image': '/images/geyser-service.png',
        'subcategories': [
            {'id': 'geyser-descaling', 'name': 'Geyser Descaling & Flushing', 'price': 449, 'oldPrice': 599, 'time': '45 mins', 'description': 'Sediment flush, anode rod inspection, and safety valve check'},
            {'id': 'geyser-element', 'name': 'Heating Element & Thermostat Replacement', 'price': 699, 'oldPrice': 899, 'time': '50 mins', 'description': 'Diagnosis of slow heating, electric shock, and thermostat setting'},
        ],
    },
    {
        'slug': 'other',
        'name': 'Other Daily Home Service / Handyman',
        'category': 'general',
        'base_price': Decimal('99.00'),
        'description': 'Minor carpentry, door locks, curtain rod mount, custom handyman jobs.',
        'icon': '🧰',
        'image': '/images/other-service.png',
        'subcategories': [
            {'id': 'plumb-tap', 'name': 'Tap / Diverter / Flush Tank Repair', 'price': 199, 'oldPrice': 299, 'time': '30 mins', 'description': 'Fixing dripping taps, washbasin siphon, and cistern issues'},
            {'id': 'plumb-leak', 'name': 'Water Pipe Leakage & Blockage Clear', 'price': 399, 'oldPrice': 499, 'time': '45 mins', 'description': 'Concealed pipe leak detection, kitchen sink unclogging'},
        ],
    },
]

TECHNICIANS_DATA = [
    {
        'partner_id': 'TECH-101',
        'name': 'Manoj Kumar',
        'phone': '9876500001',
        'password': 'password123',
        'email': 'manoj.kumar@gharsathi.com',
        'trade': 'AC Service & Repair, Fridge & Refrigerator, Electrician',
        'area': 'Patna to Danapur',
        'address': 'Station Road, Danapur Cantt, Patna - 801503',
        'experience_years': 6,
        'kyc_status': 'Verified',
        'aadhaar_masked': 'XXXX XXXX 2231',
        'certificate_id': 'CERT-AC-2022-89',
        'document_type': 'Aadhaar Card + ITI Electrician',
        'wallet_balance': Decimal('600.00'),
        'rating_avg': Decimal('4.85'),
        'rating_count': 24,
        'completed_jobs': 2,
        'is_online': True,
        'live_location': {'lat': 25.6207, 'lng': 85.0444, 'address': 'Danapur Cantt, Patna'},
    },
    {
        'partner_id': 'TECH-102',
        'name': 'Rajesh Singh',
        'phone': '9876500002',
        'password': 'password123',
        'email': 'rajesh.singh@gharsathi.com',
        'trade': 'Washing Machine Repair, RO Water Purifier, Plumbing',
        'area': 'Bihta',
        'address': 'Near Bus Stand, Bihta, Patna - 801103',
        'experience_years': 4,
        'kyc_status': 'Verified',
        'aadhaar_masked': 'XXXX XXXX 9012',
        'certificate_id': 'CERT-RO-2023-41',
        'document_type': 'Aadhaar Card',
        'wallet_balance': Decimal('250.00'),
        'rating_avg': Decimal('4.90'),
        'rating_count': 18,
        'completed_jobs': 1,
        'is_online': True,
        'live_location': {'lat': 25.5658, 'lng': 84.8631, 'address': 'Bihta Chowk, Patna'},
    },
    {
        'partner_id': 'TECH-103',
        'name': 'Amit Patel',
        'phone': '9876500003',
        'password': 'password123',
        'email': 'amit.patel@gharsathi.com',
        'trade': 'Full Home Deep Cleaning, Kitchen Chimney Cleaning',
        'area': 'Maner',
        'address': 'Bazar Samiti, Maner, Patna - 801103',
        'experience_years': 3,
        'kyc_status': 'Pending',
        'aadhaar_masked': 'XXXX XXXX 7741',
        'certificate_id': 'CERT-CLN-2024-12',
        'document_type': 'Aadhaar Card',
        'wallet_balance': Decimal('600.00'),
        'rating_avg': Decimal('5.00'),
        'rating_count': 0,
        'completed_jobs': 0,
        'is_online': True,
        'live_location': {'lat': 25.6482, 'lng': 84.8778, 'address': 'Maner Market, Patna'},
    },
    {
        'partner_id': 'TECH-104',
        'name': 'Suresh Verma',
        'phone': '9876500004',
        'password': 'password123',
        'email': 'suresh.verma@gharsathi.com',
        'trade': 'Water Geyser Repair, Air Cooler Repair',
        'area': 'Khagaul',
        'address': 'Near Railway Station, Khagaul, Patna - 801503',
        'experience_years': 5,
        'kyc_status': 'Verified',
        'aadhaar_masked': 'XXXX XXXX 6190',
        'certificate_id': 'CERT-GEY-2021-05',
        'document_type': 'Aadhaar Card + Trade Diploma',
        'wallet_balance': Decimal('120.00'),  # Under ₹150 threshold to test guardrail!
        'rating_avg': Decimal('4.70'),
        'rating_count': 15,
        'completed_jobs': 0,
        'is_online': True,
        'live_location': {'lat': 25.5812, 'lng': 85.0441, 'address': 'Khagaul, Patna'},
    },
]


def seed_database():
    """Wipes and re-seeds Ghar Sathi demo database."""
    # Clear existing data
    AdminWithdrawal.objects.all().delete()
    Complaint.objects.all().delete()
    WalletTransaction.objects.all().delete()
    Booking.objects.all().delete()
    TechnicianProfile.objects.all().delete()
    Service.objects.all().delete()

    # 1. Seed Services
    service_map = {}
    for item in SERVICES_DATA:
        svc = Service.objects.create(**item)
        service_map[item['slug']] = svc

    # 2. Seed Technicians
    tech_map = {}
    for t_data in TECHNICIANS_DATA:
        tech = TechnicianProfile.objects.create(**t_data)
        tech_map[t_data['partner_id']] = tech

        # Create starting wallet transaction
        WalletTransaction.objects.create(
            txn_id=f"WTX-INIT-{tech.partner_id}",
            technician=tech,
            txn_type='CREDIT',
            amount=tech.wallet_balance,
            balance_after=tech.wallet_balance,
            description='Initial Partner Wallet Balance',
        )

    # 3. Seed Bookings
    b1 = Booking.objects.create(
        booking_code='GS-8821001',
        invoice_number='INV-8821001',
        customer_name='Ramesh Sharma',
        customer_phone='9876543210',
        address='House No 14, Near Primary School, Maner',
        area='Maner',
        pincode='801103',
        latitude=Decimal('25.648200'),
        longitude=Decimal('84.877800'),
        service=service_map['ac'],
        service_name='AC Service & Repair',
        subcategory_id='ac-split-service',
        subcategory_name='Split AC Foam Jet Service',
        technician=tech_map['TECH-101'],
        technician_name='Manoj Kumar',
        technician_phone='9876500001',
        scheduled_date=timezone.now().date(),
        scheduled_time='10 AM - 12 PM',
        base_price=Decimal('499.00'),
        platform_fee=Decimal('149.00'),
        total_amount=Decimal('499.00'),
        payment_method='Cash on Service',
        status='Completed',
        service_pin='4829',
        rating=5,
        review_text='Bahut badhiya kaam kiya! Time par aaye aur AC ekdum mast thanda kar diya.',
        review_tags=['On-time arrival', 'Professional behavior', 'Clean & tidy'],
        rated_at=timezone.now(),
        completed_at=timezone.now(),
    )

    # Wallet fee deduction transaction for booking 1
    WalletTransaction.objects.create(
        txn_id='WTX-FEE-8821001',
        technician=tech_map['TECH-101'],
        booking=b1,
        txn_type='DEBIT',
        amount=Decimal('149.00'),
        balance_after=tech_map['TECH-101'].wallet_balance,
        description='Fixed platform fee for GS-8821001 (AC Service)',
    )

    b2 = Booking.objects.create(
        booking_code='GS-8821002',
        invoice_number='INV-8821002',
        customer_name='Anita Verma',
        customer_phone='9811223344',
        address='Flat 4B, Shanti Enclave, Saguna More, Danapur',
        area='Patna to Danapur',
        pincode='801503',
        latitude=Decimal('25.621200'),
        longitude=Decimal('85.044100'),
        service=service_map['washing'],
        service_name='Washing Machine Repair',
        subcategory_id='wm-top-load',
        subcategory_name='Top Load Fully Automatic Service',
        technician=tech_map['TECH-101'],
        technician_name='Manoj Kumar',
        technician_phone='9876500001',
        scheduled_date=timezone.now().date(),
        scheduled_time='12 PM - 2 PM',
        base_price=Decimal('599.00'),
        platform_fee=Decimal('149.00'),
        total_amount=Decimal('599.00'),
        payment_method='UPI / Online on Completion',
        status='Accepted',
        service_pin='7391',
        notes='Spin tub se aawaaz aa rahi hai',
    )

    b3 = Booking.objects.create(
        booking_code='GS-8821003',
        invoice_number='INV-8821003',
        customer_name='Sanjay Gupta',
        customer_phone='9798001122',
        address='Main Market Road, Near SBI ATM, Bihta',
        area='Bihta',
        pincode='801103',
        latitude=Decimal('25.566100'),
        longitude=Decimal('84.864300'),
        service=service_map['ro'],
        service_name='RO Service & Water Purifier',
        subcategory_id='ro-routine',
        subcategory_name='Routine Filter Service & TDS Check',
        technician=None,
        technician_name='',
        technician_phone='',
        scheduled_date=timezone.now().date(),
        scheduled_time='2 PM - 4 PM',
        base_price=Decimal('499.00'),
        platform_fee=Decimal('149.00'),
        total_amount=Decimal('499.00'),
        payment_method='Cash on Service',
        status='Pending',
        service_pin='5164',
        notes='Water taste thoda change ho gaya hai',
    )

    b4 = Booking.objects.create(
        booking_code='GS-8821004',
        invoice_number='INV-8821004',
        customer_name='Priya Kumari',
        customer_phone='9934112233',
        address='Near Railway Station, Khagaul, Patna',
        area='Khagaul',
        pincode='801503',
        latitude=Decimal('25.581200'),
        longitude=Decimal('85.044100'),
        service=service_map['electrician'],
        service_name='Electrician & Electrical Services',
        subcategory_id='elec-fan',
        subcategory_name='Ceiling Fan Repair & Wiring',
        technician=tech_map['TECH-101'],
        technician_name='Manoj Kumar',
        technician_phone='9876500001',
        scheduled_date=timezone.now().date(),
        scheduled_time='4 PM - 6 PM',
        base_price=Decimal('249.00'),
        platform_fee=Decimal('149.00'),
        total_amount=Decimal('249.00'),
        payment_method='Cash on Service',
        status='Completed',
        service_pin='6248',
        rating=4,
        review_text='Quick wiring fix and fan capacitor change. Good service.',
        review_tags=['Expert & fast work', 'Polite behavior'],
        rated_at=timezone.now(),
        completed_at=timezone.now(),
    )

    # 4. Seed Complaints
    Complaint.objects.create(
        complaint_code='CMP-1001',
        booking=b4,
        customer_name='Priya Kumari',
        customer_phone='9934112233',
        category='Service Quality',
        priority='Medium',
        description='Fan switch making slight buzzing sound after 3 days of service.',
        status='Open',
        resolution_action='',
        admin_notes='Assigned inspection scheduled for tomorrow morning.',
    )

    Complaint.objects.create(
        complaint_code='CMP-1002',
        booking=b1,
        customer_name='Ramesh Sharma',
        customer_phone='9876543210',
        category='30-Day Warranty Claim',
        priority='Low',
        description='AC water drain pipe alignment check requested under warranty.',
        status='Resolved',
        resolution_action='Technician Manoj Kumar revisited and secured pipe clamp free of cost.',
        admin_notes='Customer satisfied. Closed within 2 hours.',
        resolved_at=timezone.now(),
    )

    # 5. Seed Sample Admin Withdrawals
    AdminWithdrawal.objects.create(
        withdrawal_id='WDR-8821001',
        amount=Decimal('149.00'),
        bank_details='ghar.sathi@okhdfcbank',
        status='Approved',
        admin_notes='Platform commission payout for Order GS-8821001',
        processed_at=timezone.now(),
    )

    # 6. Provision Production Superusers for Django Admin
    ensure_production_superuser()

    return {
        'services': Service.objects.count(),
        'technicians': TechnicianProfile.objects.count(),
        'bookings': Booking.objects.count(),
        'transactions': WalletTransaction.objects.count(),
        'complaints': Complaint.objects.count(),
        'withdrawals': AdminWithdrawal.objects.count(),
    }


def ensure_production_superuser():
    """Provisions or updates production superuser prabhat@gharsathi.in / Gharsathi@2026."""
    from django.contrib.auth.models import User
    prabhat = User.objects.filter(username='prabhat').first() or User.objects.filter(email='prabhat@gharsathi.in').first()
    if not prabhat:
        prabhat = User.objects.create_superuser(
            username='prabhat',
            email='prabhat@gharsathi.in',
            password='Gharsathi@2026'
        )
    else:
        prabhat.username = 'prabhat'
        prabhat.email = 'prabhat@gharsathi.in'
        prabhat.set_password('Gharsathi@2026')
        prabhat.is_staff = True
        prabhat.is_superuser = True
        prabhat.is_active = True
        prabhat.save()

    admin_user = User.objects.filter(username='admin').first()
    if not admin_user:
        User.objects.create_superuser(
            username='admin',
            email='admin@gharsathi.in',
            password='Gharsathi@2026'
        )
    else:
        admin_user.set_password('Gharsathi@2026')
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        admin_user.save()


def purge_database():
    """
    Completely purges and wipes all demo/seeded bookings, dummy technicians,
    mock complaints, demo transactions, and test withdrawals.
    Preserves official services and provisions production superusers.
    """
    from .models import (
        Service, SubService, TechnicianProfile, Booking, WalletTransaction,
        Complaint, AdminWithdrawal, CustomerProfile, OTPVerification
    )

    # 1. Purge all transactional, dummy partner, and mock records
    Complaint.objects.all().delete()
    Booking.objects.all().delete()
    AdminWithdrawal.objects.all().delete()
    WalletTransaction.objects.all().delete()
    TechnicianProfile.objects.all().delete()
    CustomerProfile.objects.all().delete()
    OTPVerification.objects.all().delete()

    # 2. Ensure official base services catalog exists
    if Service.objects.count() == 0:
        for s_data in SERVICES_DATA:
            Service.objects.create(
                slug=s_data['slug'],
                name=s_data['name'],
                category=s_data['category'],
                base_price=s_data['base_price'],
                commission_fee=s_data.get('commission_fee', Decimal('149.00')),
                description=s_data['description'],
                icon=s_data['icon'],
                image=s_data['image'],
                subcategories=s_data['subcategories'],
                is_active=True,
            )

    # 3. Synchronize SubService table for all services with commission fees
    for svc in Service.objects.all():
        subs = svc.subcategories or []
        updated_subs = []
        for idx, sub in enumerate(subs):
            comm = sub.get('commission_fee')
            if comm is None:
                comm = float(getattr(svc, 'commission_fee', 149.00))
                sub['commission_fee'] = comm
            updated_subs.append(sub)
            sub_id = sub.get('id') or f"{svc.slug}-{idx + 1}"
            sub_price = Decimal(str(sub.get('price', svc.base_price)))
            sub_old_price = Decimal(str(sub.get('oldPrice', round(float(sub_price) * 1.25))))
            SubService.objects.update_or_create(
                service=svc,
                sub_id=sub_id,
                defaults={
                    'name': sub.get('name', f"Package {idx + 1}"),
                    'price': sub_price,
                    'old_price': sub_old_price,
                    'commission_fee': Decimal(str(comm)),
                    'time': sub.get('time', '45 mins'),
                    'description': sub.get('description', ''),
                }
            )
        svc.subcategories = updated_subs
        svc.save()

    # 4. Ensure production superusers
    ensure_production_superuser()

    return {
        'services': Service.objects.count(),
        'subservices': SubService.objects.count(),
        'technicians': TechnicianProfile.objects.count(),
        'bookings': Booking.objects.count(),
        'transactions': WalletTransaction.objects.count(),
        'complaints': Complaint.objects.count(),
        'withdrawals': AdminWithdrawal.objects.count(),
        'customers': CustomerProfile.objects.count(),
    }
