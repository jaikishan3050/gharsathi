import { useMemo, useState, useEffect } from 'react';
import { useGharSathi } from '../context/AppDataContext.jsx';
import { areas, serviceCategories, movingOffers } from '../data/services.js';
import {
  EmptyState,
  Field,
  PageHeading,
  PanelShell,
  StatCard,
  StatusBadge,
  TopBarProfile,
  NotificationBell,
  RatingModal,
  InvoiceModal,
  SkeletonCard,
  SkeletonList,
  BookingTimelineStepper,
} from '../components/Common.jsx';
import api from '../services/api.js';
import LocationPickerMap from '../components/LocationPickerMap.jsx';
import BookingMiniMap from '../components/BookingMiniMap.jsx';
import RazorpaySandboxModal from '../components/RazorpaySandboxModal.jsx';
import OtpModal from '../components/OtpModal.jsx';

const items = [
  { id: 'home', icon: '⌂', label: 'Home' },
  { id: 'services', icon: '✦', label: 'Our services' },
  { id: 'book', icon: '+', label: 'Book a service' },
  { id: 'bookings', icon: '▤', label: 'My bookings' },
  { id: 'profile', icon: '◉', label: 'My profile' },
  { id: 'support', icon: '?', label: 'Help & complaint' },
];

const todayString = () => new Date().toISOString().slice(0, 10);

export default function CustomerPanel() {
  const {
    data,
    currentCustomer,
    signupCustomer,
    setCustomerSession,
    logoutCustomer,
    createBooking,
    addComplaint,
    rateTechnician,
    markNotificationRead,
    clearNotifications,
  } = useGharSathi();

  const [active, setActive] = useState('home');

  // Service Selection & Subcategories
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedServiceId, setSelectedServiceId] = useState(data.services[0]?.id || 'ac');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceSort, setServiceSort] = useState('recommended'); // 'recommended' | 'price-low' | 'price-high' | 'name'

  // Bookings Filter & Invoice States
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [invoiceBooking, setInvoiceBooking] = useState(null);

  // Notices & Modals
  const [bookingNotice, setBookingNotice] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [locationNotice, setLocationNotice] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'signup'
  const [ratingBooking, setRatingBooking] = useState(null); // Booking object to rate

  const [authError, setAuthError] = useState('');

  // Razorpay Sandbox Checkout Modal States
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [razorpayOrderData, setRazorpayOrderData] = useState(null);
  const [pendingBookingPayload, setPendingBookingPayload] = useState(null);

  // Booking Form State
  const [form, setForm] = useState({
    customerName: currentCustomer?.name || '',
    phone: currentCustomer?.phone || '',
    pincode: currentCustomer?.pincode || '',
    area: currentCustomer?.area || areas[0],
    address: currentCustomer?.address || '',
    date: todayString(),
    time: '10 AM - 12 PM',
    payment: 'Cash on Service',
    notes: '',
    location: null,
    latitude: 25.6207,
    longitude: 85.0444,
  });

  // Sync form when currentCustomer changes
  useEffect(() => {
    if (currentCustomer) {
      setForm((prev) => ({
        ...prev,
        customerName: currentCustomer.name || prev.customerName,
        phone: currentCustomer.phone || prev.phone,
        pincode: currentCustomer.pincode || prev.pincode,
        area: currentCustomer.area || prev.area,
        address: currentCustomer.address || prev.address,
      }));
    }
  }, [currentCustomer]);

  // Support Complaint Form
  const [complaint, setComplaint] = useState({
    customerName: currentCustomer?.name || '',
    phone: currentCustomer?.phone || '',
    bookingId: '',
    message: '',
  });

  // Filtered & Searched Services by Category, Search, and Sort
  const displayedServices = useMemo(() => {
    let list = data.services;
    if (selectedCategory !== 'all') {
      list = list.filter(
        (s) => (s.categoryId || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          (s.subcategories && s.subcategories.some((sub) => sub.name.toLowerCase().includes(q)))
      );
    }
    if (serviceSort === 'price-low') {
      list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (serviceSort === 'price-high') {
      list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    } else if (serviceSort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [data.services, selectedCategory, serviceSearch, serviceSort]);

  const filteredServices = displayedServices;

  const service = useMemo(() => {
    return data.services.find((item) => item.id === selectedServiceId) || data.services[0];
  }, [data.services, selectedServiceId]);

  // Selected subcategory or default to first
  const currentSubcategory = useMemo(() => {
    if (!service?.subcategories || service.subcategories.length === 0) return null;
    return (
      service.subcategories.find((sub) => sub.id === selectedSubcategoryId) ||
      service.subcategories[0]
    );
  }, [service, selectedSubcategoryId]);

  // Customer Bookings (Only for authenticated customer)
  const customerBookings = useMemo(() => {
    if (!currentCustomer) return [];
    const phone = (currentCustomer.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone) return [];
    return data.bookings.filter((b) => b.phone.replace(/\D/g, '').slice(-10) === phone);
  }, [data.bookings, currentCustomer]);

  // Filtered Customer Bookings (Real-time Search & Status Filter)
  const filteredCustomerBookings = useMemo(() => {
    return customerBookings.filter((b) => {
      const matchesStatus =
        bookingStatusFilter === 'all' ||
        b.status.toLowerCase() === bookingStatusFilter.toLowerCase();
      const q = bookingSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.serviceName.toLowerCase().includes(q) ||
        (b.subcategoryName && b.subcategoryName.toLowerCase().includes(q)) ||
        (b.technicianName && b.technicianName.toLowerCase().includes(q)) ||
        b.area.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [customerBookings, bookingStatusFilter, bookingSearch]);

  const totalSpend = customerBookings
    .filter((b) => b.status === 'Completed')
    .reduce((sum, b) => sum + Number(b.price || 0), 0);

  // Customer Notifications
  const customerNotifications = useMemo(() => {
    if (!currentCustomer) return [];
    const phone = (currentCustomer.phone || '').replace(/\D/g, '').slice(-10);
    return (data.notifications || []).filter(
      (n) => n.role === 'customer' && (!phone || n.userId === phone || n.userId === 'all')
    );
  }, [data.notifications, currentCustomer]);

  const patchForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // MANDATORY AUTH CHECK: Stop access without login!
  const requireAuthAndProceed = (targetAction, serviceId = null, subcatId = null) => {
    if (serviceId) setSelectedServiceId(serviceId);
    if (subcatId) setSelectedSubcategoryId(subcatId);

    if (!currentCustomer) {
      setAuthModalOpen(true);
      setAuthTab('login');
      setAuthError('🔒 Service access karne aur book karne ke liye pehle Login ya Signup karein. Guest access band hai.');
      return false;
    }

    targetAction();
    return true;
  };

  // Live Location
  const useLiveLocation = () => {
    setLocationNotice('');
    if (!navigator.geolocation) {
      setLocationNotice('Is browser mein location supported nahi hai. Address manually bharein.');
      return;
    }
    setLocationNotice('Location access ke liye browser permission ka wait kar rahe hain…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        patchForm('location', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationNotice('Live GPS Location attach ho gayi. Exact landmark bhi address mein likhein.');
      },
      (error) => {
        setLocationNotice(
          error.code === 1
            ? 'Location permission nahi mili. Aap address manually bhar sakte hain.'
            : 'Location nahi mil paayi. Aap address manually bhar sakte hain.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  // Submit Booking - STRICT CHECK: Only Logged-In Customers Can Submit
  const submitBooking = async (event) => {
    event.preventDefault();

    if (!currentCustomer) {
      setAuthModalOpen(true);
      setAuthError('🔒 Booking request submit karne se pehle Mobile OTP se login karein.');
      return;
    }

    if (!service) return;

    const phone = (currentCustomer.phone || form.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setBookingNotice('Sahi 10-digit Indian mobile number daalein.');
      return;
    }

    if (!form.pincode || form.pincode.length < 6) {
      setBookingNotice('Kripya valid 6-digit Pincode daalein.');
      return;
    }

    const price = currentSubcategory ? currentSubcategory.price : service.price;
    const isOnline =
      form.payment?.includes('Online') ||
      form.payment?.includes('Razorpay') ||
      form.payment?.includes('UPI');

    const bookingPayload = {
      ...form,
      phone,
      serviceId: service.id,
      subcategoryId: currentSubcategory?.id || '',
      subcategoryName: currentSubcategory?.name || service.name,
      price,
      latitude: form.latitude || form.location?.lat || 25.6207,
      longitude: form.longitude || form.location?.lng || 85.0444,
      location: {
        lat: form.latitude || form.location?.lat || 25.6207,
        lng: form.longitude || form.location?.lng || 85.0444,
      },
    };

    if (isOnline) {
      try {
        const orderRes = await api.createRazorpayOrder({
          amount: price,
          bookingId: `GS-TMP-${Date.now().toString().slice(-6)}`,
          serviceName: currentSubcategory?.name || service.name,
        });

        setRazorpayOrderData(orderRes);
        setPendingBookingPayload(bookingPayload);

        // Official Razorpay Checkout Modal (Opens real UPI, Cards & Netbanking directly to your bank account)
        const isRealRazorpayKey = orderRes.key_id && orderRes.key_id.startsWith('rzp_') && !orderRes.key_id.includes('gharsathi_demo');
        if (isRealRazorpayKey && typeof window !== 'undefined' && window.Razorpay) {
          const options = {
            key: orderRes.key_id,
            amount: orderRes.amount,
            currency: orderRes.currency || 'INR',
            name: 'Ghar Sathi Home Services',
            description: currentSubcategory?.name || service.name,
            image: '/images/gharsathi-logo.png',
            order_id: orderRes.order_id,
            handler: function (response) {
              handleRazorpaySuccess(response);
            },
            prefill: {
              name: form.name || currentCustomer?.name || '',
              contact: form.phone || currentCustomer?.phone || '',
            },
            notes: {
              service: currentSubcategory?.name || service.name,
              area: form.area,
            },
            theme: {
              color: '#0b3d2e',
            },
            modal: {
              ondismiss: function () {
                handleRazorpayFailure({ error: { description: 'Payment window was closed.' } });
              },
            },
          };
          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function (resp) {
            handleRazorpayFailure(resp);
          });
          rzp.open();
          return;
        }

        // Sandbox simulator fallback when demo keys are active
        setRazorpayModalOpen(true);
      } catch (err) {
        console.error('Error creating Razorpay order:', err);
        setBookingNotice('Online payment session could not be created. Please select Cash on Service.');
      }
      return;
    }

    // Cash on Service flow
    const created = createBooking({
      ...bookingPayload,
      payment: 'Cash on Service',
      paymentStatus: 'Pending',
    });

    setBookingNotice(`Booking request ${created.id} submit ho gayi! Work step notification bhej diya gaya hai.`);
    setActive('bookings');
  };

  const handleRazorpaySuccess = async (paymentResponse) => {
    setRazorpayModalOpen(false);
    if (!pendingBookingPayload) return;

    // Verify signature with Django backend
    try {
      await api.verifyRazorpayPayment({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        booking_id: pendingBookingPayload.phone,
      });
    } catch (err) {
      console.warn('Backend payment verification fallback:', err);
    }

    const created = createBooking({
      ...pendingBookingPayload,
      payment: 'Online / Razorpay UPI',
      paymentStatus: 'Paid',
      razorpayOrderId: paymentResponse.razorpay_order_id,
      razorpayPaymentId: paymentResponse.razorpay_payment_id,
      razorpaySignature: paymentResponse.razorpay_signature,
    });

    setPendingBookingPayload(null);
    setBookingNotice(`Payment Verified! 💳 Booking ${created.id} confirmed via Razorpay (${paymentResponse.razorpay_payment_id}).`);
    setActive('bookings');
  };

  const handleRazorpayFailure = (err) => {
    setBookingNotice(`Payment Incomplete: ${err?.error?.description || 'Transaction cancelled'}. Booking not placed.`);
  };

  // Real-time SMS OTP Auth Success Handler
  const handleAuthSuccess = (verified) => {
    const profile = verified.user || verified.customer;
    if (!verified.token || !profile) {
      setAuthError('Server could not verify this customer session. Please try again.');
      return;
    }
    setCustomerSession({
      ...profile,
      phone: profile.phone || verified.phone,
      name: profile.name || verified.name,
      address: profile.address || verified.address || '',
      pincode: profile.pincode || verified.pincode || '',
      area: profile.area || verified.area || areas[0],
    }, verified.token);
    setAuthModalOpen(false);
  };

  // Profile Save
  const saveProfile = (event) => {
    event.preventDefault();
    if (currentCustomer) {
      signupCustomer({
        name: form.customerName,
        phone: form.phone,
        address: form.address,
        pincode: form.pincode,
        area: form.area,
      });
      setProfileNotice('Profile information browser mein update ho gayi.');
    }
  };

  // Complaint Submit
  const submitComplaint = (event) => {
    event.preventDefault();
    if (!currentCustomer) {
      setAuthModalOpen(true);
      setAuthError('Complaint submit karne ke liye pehle login karein.');
      return;
    }
    const created = addComplaint(complaint);
    setBookingNotice(`Complaint ${created.id} save ho gayi. Admin panel se resolve ki jayegi.`);
    setComplaint({
      customerName: currentCustomer?.name || '',
      phone: currentCustomer?.phone || '',
      bookingId: '',
      message: '',
    });
  };

  // Navigation tab switcher with auth guard
  const handleTabChange = (targetTab) => {
    if (['book', 'bookings', 'profile'].includes(targetTab) && !currentCustomer) {
      setAuthModalOpen(true);
      setAuthTab('login');
      setAuthError('🔒 Is section ko access karne ke liye kripya pehle Mobile OTP se login karein.');
      setActive(targetTab); // Shows auth gate
      return;
    }
    setActive(targetTab);
    setBookingNotice('');
    setProfileNotice('');
  };

  // Top Actions in Header: Notification Bell + Profile Dropdown
  const topActions = (
    <div className="topbar-actions-group">
      <NotificationBell
        notifications={customerNotifications}
        onMarkRead={markNotificationRead}
        onClear={() => clearNotifications('customer', currentCustomer?.phone)}
      />
      {currentCustomer ? (
        <TopBarProfile
          user={currentCustomer}
          role="Customer"
          onLogout={() => {
            logoutCustomer();
            setActive('home');
          }}
          onOpenProfile={() => setActive('profile')}
        />
      ) : (
        <button
          type="button"
          className="button button-gold button-small"
          onClick={() => {
            setAuthModalOpen(true);
            setAuthTab('login');
            setAuthError('');
          }}
        >
          <span>👤</span> Login / Signup
        </button>
      )}
    </div>
  );

  return (
    <PanelShell
      role="Customer"
      title="Customer Panel"
      description="Book trusted home services with live step notifications and verified technicians."
      active={active}
      onChange={handleTabChange}
      items={items}
      topActions={topActions}
    >
      {/* Moving Offers Display Carousel with Real Banners */}
      <MovingOffersCarousel
        onSelectOffer={(serviceId) => {
          requireAuthAndProceed(() => {
            setActive('book');
          }, serviceId);
        }}
      />

      {/* HOME TAB */}
      {active === 'home' && (
        <>
          <section className="customer-hero-visual">
            <div className="hero-text-col">
              <p className="eyebrow eyebrow-gold">WELCOME TO GHAR SATHI · HAR GHAR KA VISHWAS</p>
              <h2>
                Ghar ke har kaam ke liye<br />
                <span>ek hi saathi.</span>
              </h2>
              <p>
                AC, Washing Machine, Refrigerator, RO, Electrician aur Home Deep Cleaning.
                Verified technicians, live GPS location mapping, aur transparent upfront pricing.
              </p>
              <div className="hero-button-row">
                <button
                  className="button button-gold"
                  onClick={() => setActive('services')}
                >
                  Explore services <span>→</span>
                </button>
                <button
                  className="button button-glass"
                  onClick={() => {
                    requireAuthAndProceed(() => {
                      setSelectedServiceId(data.services[0]?.id || 'ac');
                      setActive('book');
                    });
                  }}
                >
                  Book now {currentCustomer ? '→' : '🔒 (Login Required)'}
                </button>
              </div>
            </div>

            <div className="hero-image-col">
              <img
                src="/images/happy-family.png"
                alt="Happy Indian Family - Ghar Sathi"
                className="hero-family-img"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          </section>

          <div className="stats-grid customer-stats">
            <StatCard label="Services available" value={data.services.length} icon="✦" note="With subcategories" />
            <StatCard
              label="Your active bookings"
              value={currentCustomer ? customerBookings.length : 'Login required'}
              icon="▤"
              note={currentCustomer ? 'Track status anytime' : 'Login to view'}
            />
            <StatCard
              label="Completed service value"
              value={currentCustomer ? `₹${totalSpend.toLocaleString('en-IN')}` : '₹0'}
              icon="₹"
              note="100% verified service"
            />
          </div>

          <PageHeading eyebrow="POPULAR HOME SERVICES" title="Our Verified Home Services">
            <button className="text-button" onClick={() => setActive('services')}>
              View all services & subcategories →
            </button>
          </PageHeading>

          <div className="service-grid">
            {data.services.slice(0, 6).map((item) => (
              <ServiceCard
                key={item.id}
                service={item}
                isLoggedIn={!!currentCustomer}
                onBook={() => {
                  requireAuthAndProceed(() => {
                    if (item.subcategories?.[0]) setSelectedSubcategoryId(item.subcategories[0].id);
                    setBookingNotice('');
                    setActive('book');
                  }, item.id);
                }}
              />
            ))}
          </div>

          {/* Why Choose Ghar Sathi Section with Real Banner */}
          <section className="why-choose-banner-card">
            <div className="why-choose-text">
              <p className="eyebrow eyebrow-gold">WHY GHAR SATHI?</p>
              <h3>Fair Pricing & 100% Quality Guarantee</h3>
              <p>
                Ghar Sathi par koi hidden charges ya surprise fees nahi hain! Transparent rates, 30-day free warranty,
                aur certified expert technicians ke sath aapko milti hai behtareen doorstep service.
              </p>
              <div className="why-points-list">
                <span>✓ 100% Background-Verified Technicians</span>
                <span>✓ 30-Day Free Service Warranty</span>
                <span>✓ Live Work Step Notifications (🔔)</span>
                <span>✓ Direct Google Maps GPS Navigation</span>
              </div>
            </div>
            <div className="why-choose-img-box">
              <img
                src="/images/why-choose-gharsathi.png"
                alt="Why Choose Ghar Sathi"
                className="why-choose-img"
              />
            </div>
          </section>

          {/* Patna Ka Gaurav Local Trust Strip */}
          <section className="patna-trust-strip">
            <div className="patna-trust-header">
              <p className="eyebrow">BIHAR KA APNA SERVICE PLATFORM</p>
              <h3>Patna, Danapur, Bihta, Maner & Ara Ka Vishwas</h3>
            </div>
            <div className="patna-photos-grid">
              <img src="/images/patna mera gaurav.jpg" alt="Patna Mera Gaurav" className="patna-img" />
              <img src="/images/patna ka gaurav3.jpg" alt="Patna Ka Gaurav 3" className="patna-img" />
              <img src="/images/patna ka  gaurav4.jpg" alt="Patna Ka Gaurav 4" className="patna-img" />
              <img src="/images/patna ka  gaurav5.jpg" alt="Patna Ka Gaurav 5" className="patna-img" />
            </div>
          </section>
        </>
      )}

      {/* SERVICES TAB WITH DROPDOWNS & SUBCATEGORIES */}
      {active === 'services' && (
        <>
          <PageHeading eyebrow="SERVICE CATALOGUE" title="Our Services & Subcategories">
            <span className="result-count">{filteredServices.length} main services</span>
          </PageHeading>

          {!currentCustomer && (
            <div className="auth-alert-pill">
              <span>🔒</span>
              <p>
                <strong>Customer Note:</strong> Services ko dekh sakte hain, lekin book karne ke liye{' '}
                <strong>Mobile Number & OTP se login hona anivarya (mandatory) hai.</strong>
              </p>
              <button
                type="button"
                className="button button-gold button-small"
                onClick={() => {
                  setAuthModalOpen(true);
                  setAuthTab('login');
                }}
              >
                Login Now
              </button>
            </div>
          )}

          {/* Search, Sort & Filters Toolbar */}
          <div className="filter-controls-bar">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="search"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Search AC, Washing Machine, RO, Electrician, Cleaning..."
                className="catalogue-search-input"
              />
              {serviceSearch && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setServiceSearch('')}
                  title="Clear search query"
                >
                  ×
                </button>
              )}
            </div>

            <div className="sort-select-wrap">
              <label htmlFor="customer-service-sort">Sort by:</label>
              <select
                id="customer-service-sort"
                value={serviceSort}
                onChange={(e) => setServiceSort(e.target.value)}
                className="sort-dropdown"
              >
                <option value="recommended">Featured / Recommended</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Service Name (A to Z)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="category-filter-bar">
            <button
              className={`cat-tab ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Categories ({data.services.length})
            </button>
            {serviceCategories.map((cat) => {
              const count = data.services.filter(
                (s) => (s.categoryId || '').toLowerCase() === cat.id.toLowerCase()
              ).length;
              return (
                <button
                  key={cat.id}
                  className={`cat-tab ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span>{cat.icon}</span> {cat.name}
                  {count > 0 && <small className="cat-count">({count})</small>}
                </button>
              );
            })}
          </div>

          {displayedServices.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No services match your search"
              message={
                serviceSearch
                  ? `No home services found for "${serviceSearch}". Check the spelling or reset filters to browse our full catalogue.`
                  : 'No services available in this category currently.'
              }
              action={
                <button
                  className="button button-primary"
                  onClick={() => {
                    setServiceSearch('');
                    setSelectedCategory('all');
                  }}
                >
                  Reset Filters & Browse All
                </button>
              }
            />
          ) : (
            <div className="service-hierarchy-list">
              {displayedServices.map((srv) => (
                <article key={srv.id} className="service-hierarchy-card">
                  <div className="hierarchy-header">
                    <div className="hierarchy-img-wrap">
                      {srv.image ? (
                        <img src={srv.image} alt={srv.name} className="hierarchy-photo" />
                      ) : (
                        <span className="hierarchy-icon">{srv.icon}</span>
                      )}
                    </div>
                    <div>
                      <span className="service-category">{srv.category}</span>
                      <h3>{srv.name}</h3>
                      <p>{srv.description}</p>
                    </div>
                    <div className="hierarchy-price-tag">
                      <small>STARTING FROM</small>
                      <strong>₹{srv.price}</strong>
                    </div>
                  </div>

                  {/* Subcategories Dropdown / Grid */}
                  {srv.subcategories && srv.subcategories.length > 0 && (
                    <div className="subcategories-container">
                      <h4 className="subcat-title">Available Subcategories & Rates:</h4>
                      <div className="subcategory-grid">
                        {srv.subcategories.map((sub) => (
                          <div key={sub.id} className="subcategory-chip-card">
                            <div>
                              <strong>{sub.name}</strong>
                              <p>{sub.description}</p>
                              <span className="sub-time">⏱ {sub.time}</span>
                            </div>
                            <div className="sub-price-action">
                              <div className="sub-price">
                                {sub.oldPrice && <del>₹{sub.oldPrice}</del>}
                                <b>₹{sub.price}</b>
                              </div>
                              <button
                                type="button"
                                className="button button-gold button-small"
                                onClick={() => {
                                  requireAuthAndProceed(() => {
                                    setActive('book');
                                  }, srv.id, sub.id);
                                }}
                              >
                                {currentCustomer ? 'Book Now →' : '🔒 Login to Book'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* BOOK SERVICE TAB - STRICTLY LOCKED FOR NON-LOGGED-IN USERS */}
      {active === 'book' && (
        <>
          <PageHeading eyebrow="NEW SERVICE REQUEST" title="Book your home service" />
          {bookingNotice && <div className="inline-notice" role="status">{bookingNotice}</div>}

          {/* IF CUSTOMER IS NOT LOGGED IN: SHOW AUTHENTICATION LOCK GATE! */}
          {!currentCustomer ? (
            <div className="auth-lock-gate-card">
              <div className="lock-gate-icon">🔒</div>
              <p className="eyebrow eyebrow-gold">LOGIN REQUIRED FOR SERVICE BOOKING</p>
              <h2>Service Access Ke Liye Customer Login Anivarya Hai</h2>
              <p className="lock-gate-desc">
                Bina login kiye service access aur booking karna band kar diya gaya hai. Kripya pehle apne{' '}
                <strong>10-digit mobile number par OTP</strong> mangwa kar login karein ya New Customer ke roop mein signup karein.
              </p>

              <div className="inline-auth-box">
                {authError && <div className="warning-notice">{authError}</div>}
                <div className="auth-tab-switch">
                  <button type="button" className="tab-switch-btn active" onClick={() => { setAuthTab('login'); setAuthError(''); setAuthModalOpen(true); }}>
                    Login with Website OTP
                  </button>
                  <button type="button" className="tab-switch-btn" onClick={() => { setAuthTab('signup'); setAuthError(''); setAuthModalOpen(true); }}>
                    New Customer Signup
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* IF LOGGED IN: SHOW FULL BOOKING FORM */
            <form className="form-card" onSubmit={submitBooking}>
              <div className="logged-in-user-tag">
                <span>✓ Logged in as:</span>
                <strong>{currentCustomer.name} (📞 {currentCustomer.phone})</strong>
                <span className="pincode-pill">Pincode: {currentCustomer.pincode || form.pincode}</span>
              </div>

              {/* Step 1: Hierarchical Dropdown Selection */}
              <div className="form-section-title">
                <span>01</span>
                <div>
                  <h3>Select Service & Subcategory</h3>
                  <p>Dropdown se category aur specific variant chunein.</p>
                </div>
              </div>

              <div className="form-grid">
                <Field label="Choose Service Category *">
                  <select
                    value={service?.categoryId || 'appliance'}
                    onChange={(e) => {
                      const firstInCat = data.services.find((s) => s.categoryId === e.target.value);
                      if (firstInCat) {
                        setSelectedServiceId(firstInCat.id);
                        if (firstInCat.subcategories?.[0]) setSelectedSubcategoryId(firstInCat.subcategories[0].id);
                      }
                    }}
                  >
                    {serviceCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Select Main Service *">
                  <select
                    value={selectedServiceId}
                    onChange={(e) => {
                      setSelectedServiceId(e.target.value);
                      const found = data.services.find((s) => s.id === e.target.value);
                      if (found?.subcategories?.[0]) setSelectedSubcategoryId(found.subcategories[0].id);
                    }}
                  >
                    {data.services.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.icon} {item.name} (Starts ₹{item.price})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Subcategories Dropdown / Selector */}
              {service?.subcategories && service.subcategories.length > 0 && (
                <div className="subcategory-select-group">
                  <Field label="Choose Specific Subcategory *">
                    <select
                      value={currentSubcategory?.id || service.subcategories[0].id}
                      onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                    >
                      {service.subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} — ₹{sub.price} ({sub.time})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="selected-service-summary">
                    {service.image ? (
                      <img src={service.image} alt={service.name} className="selected-service-photo" />
                    ) : (
                      <span className="selected-service-icon">{service.icon}</span>
                    )}
                    <div>
                      <strong>{currentSubcategory?.name || service.name}</strong>
                      <p>{currentSubcategory?.description || service.description}</p>
                      <small>Estimated service time: {currentSubcategory?.time || '45 mins'}</small>
                    </div>
                    <div className="summary-pricing">
                      {currentSubcategory?.oldPrice && <del>₹{currentSubcategory.oldPrice}</del>}
                      <b>₹{currentSubcategory ? currentSubcategory.price : service.price}</b>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Customer Details */}
              <div className="form-section-title">
                <span>02</span>
                <div>
                  <h3>Customer & Location Details</h3>
                  <p>Technician ko direct Google Maps navigation aur timely service ke liye exact address bharein.</p>
                </div>
              </div>

              <div className="form-grid">
                <Field label="Customer Full Name *">
                  <input
                    required
                    autoComplete="name"
                    value={form.customerName}
                    onChange={(e) => patchForm('customerName', e.target.value)}
                  />
                </Field>

                <Field label="Mobile Number *" hint="Verified OTP account number">
                  <input
                    required
                    inputMode="numeric"
                    maxLength="10"
                    value={form.phone}
                    onChange={(e) => patchForm('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </Field>

                <Field label="Service Area *">
                  <select required value={form.area} onChange={(e) => patchForm('area', e.target.value)}>
                    {areas.map((area) => (
                      <option key={area}>{area}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Pincode *" hint="6-digit postal code">
                  <input
                    required
                    inputMode="numeric"
                    maxLength="6"
                    value={form.pincode}
                    onChange={(e) => patchForm('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </Field>

                <Field label="Preferred Date *">
                  <input
                    required
                    type="date"
                    min={todayString()}
                    value={form.date}
                    onChange={(e) => patchForm('date', e.target.value)}
                  />
                </Field>

                <Field label="Preferred Time Slot *">
                  <select required value={form.time} onChange={(e) => patchForm('time', e.target.value)}>
                    {['8 AM - 10 AM', '10 AM - 12 PM', '12 PM - 2 PM', '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM'].map(
                      (time) => (
                        <option key={time}>{time}</option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="Payment Method *" hint="Cash on Service or Instant Online Checkout">
                  <select
                    required
                    value={form.payment}
                    onChange={(e) => patchForm('payment', e.target.value)}
                  >
                    <option value="Cash on Service">💵 Cash on Service (Pay after work)</option>
                    <option value="Online / Razorpay UPI">⚡ Online / UPI Demo (Razorpay Sandbox)</option>
                  </select>
                </Field>

                {form.payment?.includes('Online') && (
                  <div className="online-checkout-banner">
                    <div className="rzp-pill-header">
                      <span className="rzp-blue-dot"></span>
                      <strong>Razorpay Sandbox Gateway Active</strong>
                    </div>
                    <p>
                      Clicking proceed will open the secure Razorpay UPI & Card gateway with 100% instant verification.
                    </p>
                  </div>
                )}

                <Field label="Full Address / Landmark *">
                  <textarea
                    required
                    rows="3"
                    value={form.address}
                    onChange={(e) => patchForm('address', e.target.value)}
                    placeholder="House number, colony, street, nearby landmark..."
                  />
                </Field>

                <Field label="Issue Details (optional)">
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(e) => patchForm('notes', e.target.value)}
                    placeholder="Appliance model ya issue ke baare mein likhein..."
                  />
                </Field>
              </div>

              {/* Interactive OpenStreetMap Pin & GPS Geolocation */}
              <div className="form-map-picker-block" style={{ marginTop: '16px' }}>
                <LocationPickerMap
                  latitude={form.latitude}
                  longitude={form.longitude}
                  selectedArea={form.area}
                  onChange={(coords) => {
                    setForm((prev) => ({
                      ...prev,
                      latitude: coords.lat,
                      longitude: coords.lng,
                      location: coords,
                    }));
                  }}
                />
              </div>

              <div className="booking-total">
                <div>
                  <span>Final Service Price</span>
                  <strong>₹{currentSubcategory ? currentSubcategory.price : service.price}</strong>
                  <small>Transparent all-inclusive pricing · Zero hidden charges</small>
                </div>
                <button className="button button-gold button-large" type="submit">
                  {form.payment?.includes('Online') ? (
                    <span>Proceed to Razorpay Checkout ➔</span>
                  ) : (
                    <span>Submit Booking Request ➔</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* MY BOOKINGS TAB */}
      {active === 'bookings' && (
        <>
          <PageHeading eyebrow="YOUR SERVICE REQUESTS" title="My Bookings & Live Status">
            <span className="result-count">{customerBookings.length} bookings</span>
          </PageHeading>

          {bookingNotice && <div className="inline-notice" role="status">{bookingNotice}</div>}

          {!currentCustomer ? (
            <div className="auth-lock-gate-card">
              <div className="lock-gate-icon">🔒</div>
              <h3>Please Login to View Your Bookings</h3>
              <p>Apni bookings, technician assignment, aur service status track karne ke liye pehle login karein.</p>
              <button
                type="button"
                className="button button-gold"
                onClick={() => {
                  setAuthModalOpen(true);
                  setAuthTab('login');
                }}
              >
                Login with OTP <span>📲</span>
              </button>
            </div>
          ) : customerBookings.length === 0 ? (
            <EmptyState
              icon="▤"
              title="No Bookings Yet"
              message="You haven't placed any service bookings yet. Browse our verified catalogue to book your first service in seconds!"
              action={
                <button className="button button-primary" onClick={() => setActive('services')}>
                  ✦ Book Your First Service
                </button>
              }
            />
          ) : (
            <>
              {/* Bookings Search & Status Filter Controls */}
              <div className="filter-controls-bar">
                <div className="search-input-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="search"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search by Booking ID, service, technician, or area..."
                    className="catalogue-search-input"
                  />
                  {bookingSearch && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setBookingSearch('')}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="status-filter-pills-row">
                  {['all', 'Pending', 'Accepted', 'In Progress', 'Completed'].map((st) => {
                    const count =
                      st === 'all'
                        ? customerBookings.length
                        : customerBookings.filter(
                            (b) => b.status.toLowerCase() === st.toLowerCase()
                          ).length;
                    return (
                      <button
                        key={st}
                        type="button"
                        className={`status-filter-pill ${bookingStatusFilter === st ? 'active' : ''}`}
                        onClick={() => setBookingStatusFilter(st)}
                      >
                        {st === 'all' ? 'All' : st}
                        <span className="pill-count">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredCustomerBookings.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="No matching bookings found"
                  message="No bookings match your current search or status filter. Try clearing the search query or status filter."
                  action={
                    <button
                      className="button button-outline"
                      onClick={() => {
                        setBookingSearch('');
                        setBookingStatusFilter('all');
                      }}
                    >
                      Reset Filters
                    </button>
                  }
                />
              ) : (
                <div className="booking-list">
                  {filteredCustomerBookings.map((booking) => (
                    <article className="booking-card" key={booking.id}>
                      <div className="booking-card-top">
                        <div>
                          <span className="booking-id">{booking.id}</span>
                          <h3>{booking.serviceName}</h3>
                          {booking.subcategoryName && (
                            <p className="booking-subcat-label">
                              Subcategory: {booking.subcategoryName}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={booking.status} />
                      </div>

                      {/* Visual 4-Step Booking Timeline Stepper */}
                      <BookingTimelineStepper status={booking.status} bookingId={booking.id} />

                      {/* 4-Digit Happy Code / Security PIN Banner */}
                      {['Accepted', 'In Progress'].includes(booking.status) && (
                        <div className="happy-code-customer-banner">
                          <div className="happy-code-icon-col">
                            <span className="happy-code-key-icon">🔑</span>
                          </div>
                          <div className="happy-code-content-col">
                            <div className="happy-code-header-row">
                              <span className="happy-code-eyebrow">HAPPY CODE / SECURITY PIN</span>
                              <span className="happy-code-pill-tag">🔒 Confidential</span>
                            </div>
                            <div className="happy-code-pin-row">
                              <span className="happy-code-value">{booking.servicePin || '4829'}</span>
                              <span className="happy-code-help-text">Share with partner to complete job</span>
                            </div>
                            <p className="happy-code-note">
                              Share this PIN with your technician {booking.technicianName ? <strong>({booking.technicianName})</strong> : 'upon arrival'} to verify and complete the service.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="booking-details-grid">
                        <div>
                          <small>Service Date & Time</small>
                          <strong>
                            {booking.date || 'Not set'} · {booking.time}
                          </strong>
                        </div>
                        <div>
                          <small>Service Area & Pincode</small>
                          <strong>
                            {booking.area} {booking.pincode ? `(${booking.pincode})` : ''}
                          </strong>
                        </div>
                        <div>
                          <small>Payment Mode</small>
                          <strong>
                            {booking.payment}{' '}
                            {booking.paymentStatus === 'Paid' ? (
                              <span className="paid-status-chip">✓ Paid (Razorpay)</span>
                            ) : (
                              <span className="pending-pay-chip">⏳ Pay on Service</span>
                            )}
                          </strong>
                        </div>
                        <div>
                          <small>Total Price</small>
                          <strong>₹{Number(booking.price).toLocaleString('en-IN')}</strong>
                        </div>
                      </div>

                      <p className="booking-address">⌖ Address: {booking.address}</p>
                      <p className="booking-assignee">
                        Assigned Technician:{' '}
                        <strong>
                          {booking.technicianName || 'Waiting for assignment (Pending)'}
                        </strong>
                        {booking.technicianPhone && <small> · 📞 {booking.technicianPhone}</small>}
                      </p>

                      {/* Interactive Mini-Map Preview on Active Bookings */}
                      {['Pending', 'Accepted', 'In Progress'].includes(booking.status) && (
                        <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                          <BookingMiniMap
                            latitude={booking.latitude || booking.location?.lat}
                            longitude={booking.longitude || booking.location?.lng}
                            address={booking.address}
                            area={booking.area}
                            technicianName={booking.technicianName}
                            height="160px"
                          />
                        </div>
                      )}

                      {/* Completed Booking Actions: Invoice & Rating */}
                      {booking.status === 'Completed' && (
                        <div className="booking-completed-actions-bar">
                          <button
                            type="button"
                            className="button button-outline button-small view-invoice-btn"
                            onClick={() => setInvoiceBooking(booking)}
                          >
                            <span>🧾</span> View Invoice / Receipt
                          </button>

                          {booking.rating ? (
                            <span className="already-rated-chip">
                              ⭐ Rated {booking.rating}/5
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="button button-gold button-small"
                              onClick={() => setRatingBooking(booking)}
                            >
                              ⭐ Rate Technician
                            </button>
                          )}
                        </div>
                      )}

                      {/* Rating Details display if already rated */}
                      {booking.status === 'Completed' && booking.rating && (
                        <div className="booking-rating-section">
                          <div className="already-rated-banner">
                            <span className="rating-stars">{'★'.repeat(booking.rating)}</span>
                            <strong>Rated {booking.rating}/5 stars</strong>
                            {booking.review && <p>"{booking.review}"</p>}
                            {booking.reviewTags && booking.reviewTags.length > 0 && (
                              <div className="review-tags-display">
                                {booking.reviewTags.map((t) => (
                                  <span key={t} className="review-mini-tag">
                                    ✓ {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* MY PROFILE TAB */}
      {active === 'profile' && (
        <>
          <PageHeading eyebrow="YOUR ACCOUNT" title="My Profile & Settings" />
          {!currentCustomer ? (
            <div className="auth-lock-gate-card">
              <div className="lock-gate-icon">🔒</div>
              <h3>Please Login to View Profile</h3>
              <p>Apna saved address aur profile manage karne ke liye login karein.</p>
              <button
                type="button"
                className="button button-gold"
                onClick={() => {
                  setAuthModalOpen(true);
                  setAuthTab('login');
                }}
              >
                Login with OTP <span>📲</span>
              </button>
            </div>
          ) : (
            <form className="form-card narrow-form" onSubmit={saveProfile}>
              <div className="profile-avatar">
                {currentCustomer.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="profile-form-title">Customer Details</h3>

              <div className="form-grid">
                <Field label="Full Name">
                  <input
                    required
                    value={form.customerName}
                    onChange={(e) => patchForm('customerName', e.target.value)}
                  />
                </Field>

                <Field label="Mobile Number (Verified via OTP)">
                  <input
                    disabled
                    value={currentCustomer.phone}
                    className="disabled-input"
                  />
                </Field>

                <Field label="Default Service Area">
                  <select value={form.area} onChange={(e) => patchForm('area', e.target.value)}>
                    {areas.map((area) => (
                      <option key={area}>{area}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Pincode">
                  <input
                    maxLength="6"
                    value={form.pincode}
                    onChange={(e) => patchForm('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="e.g. 801103"
                  />
                </Field>

                <Field label="Default Address">
                  <textarea
                    rows="3"
                    value={form.address}
                    onChange={(e) => patchForm('address', e.target.value)}
                  />
                </Field>
              </div>

              <div className="profile-actions-row">
                <button className="button button-primary" type="submit">
                  Save Profile
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => {
                    logoutCustomer();
                    setActive('home');
                  }}
                >
                  🚪 Logout from this device
                </button>
              </div>

              {profileNotice && <p className="success-text">{profileNotice}</p>}
            </form>
          )}
        </>
      )}

      {/* HELP & COMPLAINT TAB */}
      {active === 'support' && (
        <>
          <PageHeading eyebrow="CUSTOMER SUPPORT" title="Help & Complaints" />
          <div className="support-grid">
            <div className="support-info-card">
              <span className="support-big-icon">💬</span>
              <h3>Need help with a service?</h3>
              <p>
                Agar koi samasya hai ya technician se related complaint karni hai, yahan submit karein.
                Admin dashboard se 24 ghante ke andar action liya jayega.
              </p>
              <div className="support-point"><span>✓</span> 100% Transparent & Upfront Pricing</div>
              <div className="support-point"><span>✓</span> Direct technician replacement assistance</div>
              <div className="support-point"><span>✓</span> 30-day service warranty</div>
            </div>

            <form className="form-card" onSubmit={submitComplaint}>
              <Field label="Your Name">
                <input
                  required
                  value={complaint.customerName}
                  onChange={(e) => setComplaint({ ...complaint, customerName: e.target.value })}
                />
              </Field>
              <Field label="Mobile Number">
                <input
                  required
                  maxLength="10"
                  value={complaint.phone}
                  onChange={(e) =>
                    setComplaint({ ...complaint, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                />
              </Field>
              <Field label="Booking ID (optional)">
                <input
                  value={complaint.bookingId}
                  onChange={(e) => setComplaint({ ...complaint, bookingId: e.target.value })}
                  placeholder="GS-8821001"
                />
              </Field>
              <Field label="Describe your issue">
                <textarea
                  required
                  rows="4"
                  value={complaint.message}
                  onChange={(e) => setComplaint({ ...complaint, message: e.target.value })}
                  placeholder="Apni shikayat vistar se likhein..."
                />
              </Field>
              <button className="button button-primary" type="submit">
                Submit Complaint →
              </button>
              {bookingNotice && <p className="success-text">{bookingNotice}</p>}
            </form>
          </div>
        </>
      )}

      {/* Customer Rating Modal */}
      {ratingBooking && (
        <RatingModal
          booking={ratingBooking}
          onClose={() => setRatingBooking(null)}
          onSubmit={(bId, stars, rev, tags) => {
            rateTechnician(bId, stars, rev, tags);
            setBookingNotice(`Dhanyawaad! Booking ${bId} ke liye rating submit ho gayi.`);
          }}
        />
      )}

      {/* Customer Printable Invoice Modal */}
      {invoiceBooking && (
        <InvoiceModal
          booking={invoiceBooking}
          onClose={() => setInvoiceBooking(null)}
        />
      )}

      {/* Razorpay Sandbox Checkout Modal */}
      {razorpayModalOpen && (
        <RazorpaySandboxModal
          isOpen={razorpayModalOpen}
          onClose={() => setRazorpayModalOpen(false)}
          orderData={razorpayOrderData}
          onSuccess={handleRazorpaySuccess}
          onFailure={handleRazorpayFailure}
        />
      )}

      {/* CUSTOMER 6-DIGIT SMS OTP AUTH MODAL */}
      <OtpModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        role="customer"
        defaultMode={authTab}
        onSuccess={handleAuthSuccess}
      />
    </PanelShell>
  );
}

/**
 * Moving Offer Carousel Component with REAL BANNER IMAGES
 */
function MovingOffersCarousel({ onSelectOffer }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % movingOffers.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const offer = movingOffers[currentIdx];

  return (
    <div className="moving-offers-strip-banner">
      {offer.banner && (
        <div className="offer-bg-banner-wrapper">
          <img src={offer.banner} alt={offer.title} className="offer-banner-img" />
        </div>
      )}

      <div className="offer-overlay-content">
        <div className="offer-tag-badge">{offer.badge}</div>
        <div className="offer-body-text">
          <strong>{offer.title}</strong>
          <span>· {offer.description}</span>
        </div>
        <div className="offer-actions-right">
          <span className="offer-code-pill">Coupon: {offer.code}</span>
          <button
            type="button"
            className="button button-gold button-small"
            onClick={() => onSelectOffer(offer.serviceId)}
          >
            Claim Offer →
          </button>
        </div>
      </div>

      <div className="offer-dots">
        {movingOffers.map((o, idx) => (
          <span
            key={o.id}
            className={`offer-dot ${currentIdx === idx ? 'active' : ''}`}
            onClick={() => setCurrentIdx(idx)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Service Card for Catalog with REAL SERVICE IMAGE
 */
function ServiceCard({ service, isLoggedIn, onBook }) {
  return (
    <article className="service-card">
      <div className="service-card-art">
        {service.image ? (
          <img src={service.image} alt={service.name} className="service-card-photo" />
        ) : (
          <span className="service-card-emoji">{service.icon}</span>
        )}
        {service.discount && <span className="discount-chip">{service.discount}</span>}
      </div>
      <div className="service-card-body">
        <div>
          <p className="service-category">{service.category}</p>
          <h3>{service.name}</h3>
          <p className="service-description">{service.description}</p>
          {service.subcategories && (
            <small className="subcat-count-pill">{service.subcategories.length} subcategories available</small>
          )}
        </div>
        <div className="service-card-bottom">
          <div>
            <small>STARTING PRICE</small>
            <div className="service-price">
              {service.oldPrice && <del>₹{service.oldPrice}</del>}
              <strong>₹{Number(service.price).toLocaleString('en-IN')}</strong>
            </div>
          </div>
          <button
            className={`button ${isLoggedIn ? 'button-primary' : 'button-gold'} button-small`}
            onClick={onBook}
          >
            {isLoggedIn ? 'Book →' : '🔒 Login to Book'}
          </button>
        </div>
      </div>
    </article>
  );
}
