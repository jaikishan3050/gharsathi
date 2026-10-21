import { useState, useMemo, useEffect, useRef } from 'react';
import { useGharSathi } from '../context/AppDataContext.jsx';
import { areas, technicianSkillList, FIXED_PLATFORM_COMMISSION } from '../data/services.js';
import {
  EmptyState,
  Field,
  PageHeading,
  PanelShell,
  StatCard,
  StatusBadge,
  TopBarProfile,
  NotificationBell,
  GoogleMapLink,
  InvoiceModal,
  PinVerificationModal,
  WalletRechargeModal,
} from '../components/Common.jsx';
import BookingMiniMap from '../components/BookingMiniMap.jsx';
import { playRingingBell } from '../utils/sound.js';
import api from '../services/api.js';

const items = [
  { id: 'jobs', icon: '▤', label: 'Available jobs' },
  { id: 'myjobs', icon: '✓', label: 'My jobs' },
  { id: 'wallet', icon: '₹', label: 'Earnings & wallet' },
  { id: 'profile', icon: '◉', label: 'My profile' },
];

export default function TechnicianPanel() {
  const {
    data,
    currentTechnician,
    registerTechnician,
    loginTechnician,
    logoutTechnician,
    updateTechnician,
    updateBooking,
    completeJobWithPin,
    rechargeTechnicianWallet,
    markNotificationRead,
    clearNotifications,
    wsStatus,
    jobWebSocket,
  } = useGharSathi();

  const [active, setActive] = useState('jobs');
  const [notice, setNotice] = useState('');
  const [receiptBooking, setReceiptBooking] = useState(null);
  const [pinModalBooking, setPinModalBooking] = useState(null);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);

  // Auth screen states: 'login' | 'register'
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');

  // Login Form
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });

  // Registration Form States
  const [regForm, setRegForm] = useState({
    name: '',
    phone: '',
    password: '',
    email: '',
    aadhaar: '',
    address: '',
    area: areas[0],
    skills: ['AC Service & Repair', 'Electrician & Wiring'],
    liveLocation: null,
    liveImage: '',
  });

  const [regOtpStep, setRegOtpStep] = useState(false);
  const [regOtp, setRegOtp] = useState('');
  const [sentRegOtp, setSentRegOtp] = useState('');
  const [regCountdown, setRegCountdown] = useState(60);
  const [regLoading, setRegLoading] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);

  // Countdown timer for Technician SMS OTP
  useEffect(() => {
    let timer = null;
    if (regOtpStep && regCountdown > 0) {
      timer = setInterval(() => {
        setRegCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [regOtpStep, regCountdown]);

  // Work Assigned Ring Alert State
  const [assignedRingingJob, setAssignedRingingJob] = useState(null);
  const fileInputRef = useRef(null);

  // Available & My Jobs
  const availableJobs = useMemo(() => {
    return data.bookings.filter((booking) => booking.status === 'Pending' && !booking.technicianId);
  }, [data.bookings]);

  const myJobs = useMemo(() => {
    if (!currentTechnician) return [];
    return data.bookings.filter((booking) => booking.technicianId === currentTechnician.id);
  }, [data.bookings, currentTechnician]);

  const completedJobs = useMemo(() => {
    return myJobs.filter((booking) => booking.status === 'Completed');
  }, [myJobs]);

  // Financial calculations with FIXED RS 149 COMMISSION:
  const grossEarnings = completedJobs.reduce((total, booking) => total + Number(booking.price || 0), 0);
  const totalFixedCommission = completedJobs.length * FIXED_PLATFORM_COMMISSION; // 149 per job
  const technicianTakeHome = grossEarnings - totalFixedCommission;

  // Technician Notifications
  const techNotifications = useMemo(() => {
    if (!currentTechnician) return [];
    return (data.notifications || []).filter(
      (n) => n.role === 'technician' && (n.userId === currentTechnician.id || n.userId === 'all')
    );
  }, [data.notifications, currentTechnician]);

  // Listen for newly assigned jobs to this technician and trigger ringing bell
  useEffect(() => {
    if (!currentTechnician) return;
    const latestAssigned = myJobs.find(
      (job) => job.status === 'Accepted' && !job.hasAcknowledgedRing
    );
    if (latestAssigned && (!assignedRingingJob || assignedRingingJob.id !== latestAssigned.id)) {
      setAssignedRingingJob(latestAssigned);
      playRingingBell();
    }
  }, [myJobs, currentTechnician, assignedRingingJob]);

  // Handle Login
  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError('');
    const res = loginTechnician(loginForm.phone, loginForm.password);
    if (!res.success) {
      setAuthError(res.error);
    } else {
      setNotice(`Namaste ${res.technician.name}, login successful!`);
    }
  };

  // Handle Send Real SMS OTP for Registration
  const handleSendRegOtp = async (e, isResend = false) => {
    if (e) e.preventDefault();
    const cleanPhone = regForm.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setAuthError('Kripya valid 10-digit Indian mobile number daalein.');
      return;
    }
    if (!regForm.name.trim()) {
      setAuthError('Apna poora naam likhein.');
      return;
    }
    if (!regForm.password || regForm.password.length < 4) {
      setAuthError('Kam se kam 4 character ka password banayein.');
      return;
    }
    if (!regForm.email.includes('@')) {
      setAuthError('Valid Email ID daalein.');
      return;
    }
    const cleanAadhaar = regForm.aadhaar.replace(/\D/g, '');
    if (cleanAadhaar.length !== 12) {
      setAuthError('Kripya 12-digit Aadhaar number daalein.');
      return;
    }
    if (regForm.skills.length === 0) {
      setAuthError('Kam se kam ek skill select karein.');
      return;
    }

    setRegLoading(true);
    setAuthError('');
    try {
      const res = await api.sendOtp(cleanPhone, 'technician');
      setRegLoading(false);
      setSentRegOtp(res.debug_otp || '123456');
      setRegOtpStep(true);
      setRegCountdown(60);
      if (isResend) {
        setNotice(`Naya OTP code +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)} par SMS ke dwara bhej diya gaya hai.`);
      }
    } catch (err) {
      setRegLoading(false);
      setAuthError(err.message || 'OTP send karne mein samasya aayi.');
    }
  };

  // Complete Registration after OTP Verification
  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setAuthError('');
    const cleanPhone = regForm.phone.replace(/\D/g, '').slice(-10);
    setRegLoading(true);
    try {
      await api.verifyOtp({
        phoneNumber: cleanPhone,
        otpCode: regOtp,
        role: 'technician',
        name: regForm.name,
        skills: Array.isArray(regForm.skills) ? regForm.skills.join(', ') : regForm.skills,
        area: regForm.area,
        address: regForm.address,
      });

      setRegLoading(false);
      const record = registerTechnician(regForm);
      setRegOtpStep(false);
      setNotice(
        `Technician registration complete! Welcome ${record.name}. Mobile number verified.`
      );
    } catch (err) {
      setRegLoading(false);
      setAuthError(err.message || 'Galat OTP daala gaya hai.');
    }
  };

  // Live Image Upload / Camera
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setRegForm((prev) => ({ ...prev, liveImage: uploadEvent.target?.result || '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Capture Live GPS Location
  const detectLiveLocation = () => {
    setLocationDetecting(true);
    setAuthError('');
    if (!navigator.geolocation) {
      setAuthError('Geolocation browser mein supported nahi hai. Address manually bharein.');
      setLocationDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRegForm((prev) => ({
          ...prev,
          liveLocation: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            address: `${prev.area}, Bihar`,
          },
        }));
        setLocationDetecting(false);
      },
      (err) => {
        setAuthError(err.code === 1 ? 'Location permission denied by browser.' : 'Location detect nahi ho saki.');
        setLocationDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Toggle Skill
  const toggleSkill = (skill) => {
    setRegForm((prev) => {
      const exists = prev.skills.includes(skill);
      return {
        ...prev,
        skills: exists ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
      };
    });
  };

  // Low-Balance Guardrail: Minimum ₹150 required in wallet to accept new bookings
  const MIN_WALLET_BALANCE = 150;
  const techWalletBalance = Number.isFinite(Number(currentTechnician?.walletBalance))
    ? Number(currentTechnician?.walletBalance)
    : Number(currentTechnician?.wallet || 0);
  const isLowBalance = techWalletBalance < MIN_WALLET_BALANCE;

  // Accept Job
  const acceptJob = (booking) => {
    if (!currentTechnician || currentTechnician.status !== 'Verified') {
      setNotice('Job accept karne ke liye Admin se pehle profile verify karwayein.');
      return;
    }

    if (isLowBalance) {
      setNotice('Low Wallet Balance! Minimum ₹150 required to accept new bookings. Please recharge your wallet.');
      setRechargeModalOpen(true);
      return;
    }

    updateBooking(booking.id, {
      technicianId: currentTechnician.id,
      technicianName: currentTechnician.name,
      technicianPhone: currentTechnician.phone,
      status: 'Accepted',
    });

    setNotice(`Booking ${booking.id} accept ho gayi! Customer location map mein khul rahi hai.`);
    setActive('myjobs');

    // Auto trigger map redirect or highlight customer navigation
    const mapUrl = booking.location
      ? `https://www.google.com/maps/dir/?api=1&destination=${booking.location.lat},${booking.location.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address + ', ' + booking.area)}`;
    window.open(mapUrl, '_blank');
  };

  // Advance Job Status - Requires 4-digit Happy Code to complete
  const advanceJob = (booking) => {
    if (booking.status === 'Accepted') {
      updateBooking(booking.id, { status: 'In Progress' });
      setNotice(`Booking ${booking.id} status ab "In Progress" hai. Work step notification customer ko bhej di gayi hai.`);
    } else if (booking.status === 'In Progress') {
      setPinModalBooking(booking);
    }
  };

  const handlePinVerification = (pin) => {
    if (!pinModalBooking) return { success: false, error: 'No booking selected' };
    const res = completeJobWithPin(pinModalBooking.id, pin);
    if (res.success) {
      setNotice(
        `Booking ${pinModalBooking.id} completed! Fixed platform fee ₹${FIXED_PLATFORM_COMMISSION} deduct ho kar aapka share wallet ledger mein record ho gaya.`
      );
    }
    return res;
  };

  const handleWalletRecharge = (amount) => {
    if (!currentTechnician) return { success: false };
    const res = rechargeTechnicianWallet(currentTechnician.id, amount);
    if (res.success) {
      setNotice(`Wallet recharged with ₹${amount}! New balance: ₹${res.balance}. Aap ab naye jobs accept kar sakte hain.`);
    }
    return res;
  };

  // Subscribe technician to their specific area on WebSocket
  useEffect(() => {
    if (currentTechnician?.area && jobWebSocket) {
      jobWebSocket.setArea(currentTechnician.area);
    }
  }, [currentTechnician?.area, jobWebSocket]);

  // Top Actions
  const topActions = (
    <div className="topbar-actions-group">
      <div
        className={`ws-status-badge ${wsStatus === 'connected' ? 'ws-online' : 'ws-connecting'}`}
        title="Real-Time Django Channels WebSocket Dispatch"
      >
        <span className="ws-dot"></span>
        <span className="ws-label">{wsStatus === 'connected' ? '⚡ Live Dispatch Active' : 'Connecting Dispatch...'}</span>
      </div>
      <NotificationBell
        notifications={techNotifications}
        onMarkRead={markNotificationRead}
        onClear={() => clearNotifications('technician', currentTechnician?.id)}
      />
      {currentTechnician && (
        <TopBarProfile
          user={currentTechnician}
          role="Technician"
          onLogout={logoutTechnician}
          onOpenProfile={() => setActive('profile')}
        />
      )}
    </div>
  );

  // If Not Logged In, Render Dedicated Technician Login / Registration Gate
  if (!currentTechnician) {
    return (
      <div className="technician-gate-page">
        <div className="technician-gate-card">
          <div className="role-gate-brand">
            <img src="/images/gharsathi-logo.png" alt="Ghar Sathi" className="gate-logo-img" />
            <span>Ghar <em>Sathi</em></span>
          </div>

          <p className="eyebrow eyebrow-gold">TECHNICIAN PARTNER PORTAL</p>
          <h1>Technician Workspace</h1>
          <p className="gate-subtitle">
            Ghar Sathi partner banein. Fixed ₹149 platform fee, direct customer navigation, aur daily earning manage karein.
          </p>

          <div className="auth-tab-switch">
            <button
              type="button"
              className={`tab-switch-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
            >
              Login with Mobile & Password
            </button>
            <button
              type="button"
              className={`tab-switch-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
            >
              New Technician Register
            </button>
          </div>

          {authError && <div className="warning-notice">{authError}</div>}

          {/* 1. LOGIN WITH MOBILE NUMBER & PASSWORD */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="technician-auth-form">
              <Field label="Mobile Number *" hint="Demo: 9876500001">
                <input
                  required
                  type="tel"
                  maxLength="10"
                  value={loginForm.phone}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                  placeholder="10-digit mobile number"
                />
              </Field>

              <Field label="Password *" hint="Demo: password123">
                <input
                  required
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Enter your password"
                />
              </Field>

              <button type="submit" className="button button-gold button-wide" style={{ marginTop: '16px' }}>
                Login to Technician Dashboard <span>→</span>
              </button>

              <div className="demo-credentials-box">
                <small>Demo Technician Credentials:</small>
                <p>Phone: <strong>9876500001</strong> · Password: <strong>password123</strong> (Manoj Kumar - Verified)</p>
              </div>
            </form>
          )}

          {/* 2. TECHNICIAN REGISTRATION FORM */}
          {authMode === 'register' && (
            <div className="technician-reg-container">
              {!regOtpStep ? (
                <form onSubmit={handleSendRegOtp} className="technician-auth-form">
                  <div className="form-grid">
                    <Field label="Full Name *">
                      <input
                        required
                        value={regForm.name}
                        onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                        placeholder="Apna poora naam"
                      />
                    </Field>

                    <Field label="Mobile Number *" hint="Will be verified with one-time OTP">
                      <input
                        required
                        maxLength="10"
                        value={regForm.phone}
                        onChange={(e) =>
                          setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                        }
                        placeholder="10-digit mobile number"
                      />
                    </Field>

                    <Field label="Create Password *" hint="Min 4 characters for login">
                      <input
                        required
                        type="password"
                        value={regForm.password}
                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                        placeholder="Create strong password"
                      />
                    </Field>

                    <Field label="Email ID *">
                      <input
                        required
                        type="email"
                        value={regForm.email}
                        onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                        placeholder="technician@example.com"
                      />
                    </Field>

                    <Field label="Aadhaar Card Number *" hint="12-digit Indian Aadhaar">
                      <input
                        required
                        maxLength="14"
                        value={regForm.aadhaar}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                          const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                          setRegForm({ ...regForm, aadhaar: formatted });
                        }}
                        placeholder="XXXX XXXX XXXX"
                      />
                    </Field>

                    <Field label="Operating Service Area *">
                      <select
                        value={regForm.area}
                        onChange={(e) => setRegForm({ ...regForm, area: e.target.value })}
                      >
                        {areas.map((area) => (
                          <option key={area}>{area}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Full Address *">
                    <textarea
                      required
                      rows="2"
                      value={regForm.address}
                      onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                      placeholder="Ghar ka pata, gali, sheher..."
                    />
                  </Field>

                  {/* Skills Multi-Selection */}
                  <div className="skills-picker-box">
                    <label>Select Skills / Services Provided *</label>
                    <div className="skills-chip-grid">
                      {technicianSkillList.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          className={`skill-chip ${regForm.skills.includes(skill) ? 'selected' : ''}`}
                          onClick={() => toggleSkill(skill)}
                        >
                          {regForm.skills.includes(skill) ? '✓ ' : '+ '}
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Image / Selfie Upload */}
                  <div className="reg-upload-section">
                    <label>Live Profile Photo / Selfie *</label>
                    <div className="image-upload-row">
                      <div className="image-preview-box">
                        {regForm.liveImage ? (
                          <img src={regForm.liveImage} alt="Selfie preview" className="preview-img" />
                        ) : (
                          <span className="placeholder-cam">📷</span>
                        )}
                      </div>
                      <div className="upload-controls">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          style={{ display: 'none' }}
                          onChange={handleImageChange}
                        />
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {regForm.liveImage ? 'Change Photo' : 'Upload / Take Live Selfie'}
                        </button>
                        <small>Clear photo of face required for customer verification.</small>
                      </div>
                    </div>
                  </div>

                  {/* Live Location Capture */}
                  <div className="reg-location-section">
                    <label>Live GPS Location *</label>
                    <div className="location-action-box">
                      <button
                        type="button"
                        className="button button-outline button-small"
                        onClick={detectLiveLocation}
                        disabled={locationDetecting}
                      >
                        {locationDetecting ? 'Detecting GPS...' : '📍 Fetch My Live Location'}
                      </button>
                      {regForm.liveLocation ? (
                        <span className="location-success-badge">
                          ✓ GPS Attached: {regForm.liveLocation.lat.toFixed(4)}, {regForm.liveLocation.lng.toFixed(4)}
                        </span>
                      ) : (
                        <small>Nearby customer bookings assign karne ke liye GPS location attach karein.</small>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="button button-primary button-wide" style={{ marginTop: '20px' }}>
                    Send One-Time OTP to Verify <span>📲</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCompleteRegistration} className="technician-auth-form">
                  <div className="otp-verification-banner">
                    <span className="otp-shield-icon">🛡️</span>
                    <div className="otp-header-info">
                      <strong>SMS OTP sent to +91 {regForm.phone.slice(0, 2)}******{regForm.phone.slice(-2)}</strong>
                      <p>Kripya apne mobile SMS inbox mein bheja gaya 6-digit verification code enter karein.</p>
                    </div>
                  </div>

                  {sentRegOtp && (
                    <div className="otp-demo-hint-strip">
                      <span className="hint-pill">SANDBOX HINT</span>
                      <span>Demo OTP: <strong>{sentRegOtp}</strong></span>
                      <button
                        type="button"
                        className="autofill-btn"
                        onClick={() => setRegOtp(sentRegOtp)}
                        title="Auto-fill OTP code"
                      >
                        Auto-fill ⚡
                      </button>
                    </div>
                  )}

                  <Field label="Enter 6-Digit SMS OTP *">
                    <input
                      required
                      maxLength="6"
                      value={regOtp}
                      onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit OTP"
                      autoFocus
                      style={{ fontSize: '20px', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
                    />
                  </Field>

                  {/* 60s Resend Countdown Timer */}
                  <div className="otp-resend-countdown-bar" style={{ marginTop: '14px', marginBottom: '14px' }}>
                    {regCountdown > 0 ? (
                      <div className="countdown-pill active">
                        <span className="timer-icon">⏳</span>
                        <span>
                          Resend OTP in <strong>00:{regCountdown < 10 ? `0${regCountdown}` : regCountdown}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="countdown-pill expired">
                        <span>Didn't receive SMS?</span>
                        <button
                          type="button"
                          disabled={regLoading}
                          onClick={(e) => handleSendRegOtp(e, true)}
                          className="resend-action-link"
                        >
                          {regLoading ? 'Resending…' : 'Resend SMS OTP 🔄'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions" style={{ marginTop: '18px' }}>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setRegOtpStep(false)}
                    >
                      ← Back / Edit Details
                    </button>
                    <button
                      type="submit"
                      disabled={regLoading || regOtp.length !== 6}
                      className="button button-primary"
                    >
                      {regLoading ? 'Verifying…' : 'Complete Registration ✓'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <a href="/" className="back-link">
            ← Back to Home / Switch Panel
          </a>
        </div>
      </div>
    );
  }

  // LOGGED-IN TECHNICIAN DASHBOARD
  return (
    <>
      <PanelShell
        role="Technician"
      title="Technician Panel"
      description="Manage service bookings, open customer maps, and track fixed-commission earnings."
      active={active}
      onChange={(id) => {
        setActive(id);
        setNotice('');
      }}
      items={items}
      topActions={topActions}
    >
      {/* WORK ASSIGNED NOTIFICATION RING BANNER */}
      {assignedRingingJob && (
        <div className="work-assigned-ring-banner">
          <div className="ring-pulse-icon">🔔</div>
          <div className="ring-content">
            <h4>WORK ASSIGNED! NOTIFICATION RINGING 🔔</h4>
            <p>
              New Job #{assignedRingingJob.id}: <strong>{assignedRingingJob.serviceName}</strong> for customer{' '}
              <strong>{assignedRingingJob.customerName}</strong> in <strong>{assignedRingingJob.area}</strong>.
            </p>
          </div>
          <div className="ring-actions">
            <GoogleMapLink
              location={assignedRingingJob.location}
              address={assignedRingingJob.address}
              area={assignedRingingJob.area}
              label="Open Customer Map"
            />
            <button
              type="button"
              className="button button-gold button-small"
              onClick={() => {
                setAssignedRingingJob(null);
                setActive('myjobs');
              }}
            >
              View in My Jobs ✓
            </button>
          </div>
        </div>
      )}

      {/* TECHNICIAN PROFILE HEADER CARD */}
      <div className="current-tech-banner">
        <div className="person-avatar person-avatar-lg">
          {currentTechnician.liveImage ? (
            <img src={currentTechnician.liveImage} alt="Profile" className="avatar-img-round" />
          ) : (
            currentTechnician.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="current-tech-details">
          <p className="eyebrow">SIGNED IN TECHNICIAN</p>
          <h2>{currentTechnician.name}</h2>
          <p>
            {currentTechnician.area} · 📞 {currentTechnician.phone} · Skills: {currentTechnician.skills}
          </p>
          <div className="tech-rating-pill">
            ⭐ {currentTechnician.rating || 5.0} ({currentTechnician.ratingCount || 0} reviews)
          </div>
        </div>

        <StatusBadge status={currentTechnician.status} />

        <button
          className={`button ${currentTechnician.isOnline ? 'button-outline' : 'button-primary'} button-small`}
          onClick={() =>
            updateTechnician(currentTechnician.id, { isOnline: !currentTechnician.isOnline })
          }
        >
          {currentTechnician.isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {notice && <div className="inline-notice" role="status">{notice}</div>}

      {/* AVAILABLE JOBS TAB */}
      {active === 'jobs' && (
        <>
          <div className="stats-grid">
            <StatCard
              label="Available Jobs"
              value={availableJobs.length}
              icon="▤"
              note="Unassigned requests"
            />
            <StatCard
              label="My Active Jobs"
              value={myJobs.filter((j) => j.status !== 'Completed' && j.status !== 'Cancelled').length}
              icon="⚙"
              note="Accepted & In progress"
            />
            <StatCard
              label="Completed Jobs"
              value={completedJobs.length}
              icon="✓"
              note="Fixed ₹149 fee per job"
            />
          </div>

          <PageHeading eyebrow="NEW OPPORTUNITIES" title="Available Service Bookings" />

          {/* Low Wallet Balance Warning Banner */}
          {isLowBalance && (
            <div className="wallet-warning-banner">
              <span className="warning-banner-icon">⚠️</span>
              <div className="warning-banner-content">
                <strong>Low Wallet Balance! Minimum ₹150 required to accept new bookings.</strong>
                <p>
                  Aapke wallet mein abhi ₹{techWalletBalance} hain. Customer jobs accept karne ke liye demo UPI se instant recharge karein.
                </p>
              </div>
              <button
                type="button"
                className="button button-gold button-small recharge-btn-pill"
                onClick={() => setRechargeModalOpen(true)}
              >
                ⚡ Recharge Wallet
              </button>
            </div>
          )}

          {currentTechnician.status !== 'Verified' && (
            <div className="warning-notice">
              <span>!</span>
              <div>
                <strong>Profile Verification Pending</strong>
                <p>
                  Aapki profile admin verification ke liye pending hai. Admin approval ke baad aap jobs accept kar sakenge.
                </p>
              </div>
            </div>
          )}

          {availableJobs.length === 0 ? (
            <EmptyState
              icon="▤"
              title="No new bookings right now"
              message="Jab customer booking submit karega, unassigned request yahan dikhegi aur notification chime bajega."
            />
          ) : (
            <div className="job-list">
              {availableJobs.map((booking) => (
                <article className="job-card" key={booking.id}>
                  <div className="job-card-top">
                    <span className="job-icon">🧰</span>
                    <div className="job-title">
                      <span className="booking-id">{booking.id}</span>
                      <h3>{booking.serviceName}</h3>
                      {booking.subcategoryName && (
                        <p className="job-subcat-badge">Subcategory: {booking.subcategoryName}</p>
                      )}
                      <p>
                        {booking.area} {booking.pincode ? `(${booking.pincode})` : ''} · {booking.date || 'Today'} ·{' '}
                        {booking.time || 'Immediate'}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>

                  <div className="job-customer">
                    <div>
                      <small>Customer & Address</small>
                      <strong>{booking.customerName}</strong>
                      <p className="job-address">⌖ {booking.address}</p>
                    </div>
                    <div>
                      <small>Service Price</small>
                      <strong className="job-price">₹{Number(booking.price).toLocaleString('en-IN')}</strong>
                      <small>Platform Fee: Fixed ₹{FIXED_PLATFORM_COMMISSION}</small>
                      <b className="tech-take-home">Your Share: ₹{Number(booking.price) - FIXED_PLATFORM_COMMISSION}</b>
                    </div>
                  </div>

                  {/* Doorstep Location Mini-Map Preview */}
                  <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                    <BookingMiniMap
                      latitude={booking.latitude || booking.location?.lat}
                      longitude={booking.longitude || booking.location?.lng}
                      address={booking.address}
                      area={booking.area}
                      technicianLocation={currentTechnician.liveLocation}
                      technicianName={currentTechnician.name}
                      height="135px"
                    />
                  </div>

                  <div className="job-card-action">
                    <GoogleMapLink
                      location={booking.location}
                      address={booking.address}
                      area={booking.area}
                      label="View Location Map"
                    />
                    <button
                      className={`button ${isLowBalance ? 'button-outline' : 'button-primary'} button-small`}
                      disabled={currentTechnician.status !== 'Verified' || isLowBalance}
                      onClick={() => acceptJob(booking)}
                      title={isLowBalance ? 'Minimum ₹150 wallet balance required to accept bookings' : ''}
                    >
                      {isLowBalance ? 'Low Balance (Recharge)' : 'Accept Job & Open Map'} <span>→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* MY JOBS TAB */}
      {active === 'myjobs' && (
        <>
          <PageHeading eyebrow="YOUR ASSIGNED WORK" title="My Assigned Jobs & Direct Map">
            <span className="result-count">{myJobs.length} jobs assigned</span>
          </PageHeading>

          {myJobs.length === 0 ? (
            <EmptyState
              icon="✓"
              title="Abhi koi assigned job nahi hai"
              message="Available jobs se request accept karein ya admin se assign karwayein."
              action={
                <button className="button button-primary" onClick={() => setActive('jobs')}>
                  View available jobs
                </button>
              }
            />
          ) : (
            <div className="job-list">
              {myJobs.map((booking) => (
                <article className="job-card active-job-card" key={booking.id}>
                  <div className="job-card-top">
                    <span className="job-icon">🧰</span>
                    <div className="job-title">
                      <span className="booking-id">{booking.id}</span>
                      <h3>{booking.serviceName}</h3>
                      {booking.subcategoryName && (
                        <p className="job-subcat-badge">Subcategory: {booking.subcategoryName}</p>
                      )}
                      <p>
                        {booking.area} · Scheduled: {booking.date} · {booking.time}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>

                  {/* Customer Contact & Map Redirection Box */}
                  <div className="job-customer-box">
                    <div className="customer-info-col">
                      <small>Customer Contact</small>
                      <strong>{booking.customerName}</strong>
                      <p>📞 Phone: <a href={`tel:${booking.phone}`}>{booking.phone}</a></p>
                      <p className="job-address">📍 Address: {booking.address} {booking.pincode ? `(${booking.pincode})` : ''}</p>
                      {booking.location && (
                        <small className="gps-pill">
                          GPS: {booking.location.lat.toFixed(4)}, {booking.location.lng.toFixed(4)}
                        </small>
                      )}
                    </div>

                    <div className="map-action-col">
                      <GoogleMapLink
                        location={booking.location}
                        address={booking.address}
                        area={booking.area}
                        label="Navigate via Google Maps"
                      />
                    </div>
                  </div>

                  {/* Interactive Route & Destination Mini-Map */}
                  <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                    <BookingMiniMap
                      latitude={booking.latitude || booking.location?.lat}
                      longitude={booking.longitude || booking.location?.lng}
                      address={booking.address}
                      area={booking.area}
                      technicianLocation={currentTechnician.liveLocation}
                      technicianName={currentTechnician.name}
                      height="155px"
                    />
                  </div>

                  {/* Financial Share for this Job */}
                  <div className="job-finance-strip">
                    <div>
                      <small>Total Price</small>
                      <b>₹{booking.price}</b>
                    </div>
                    <div>
                      <small>Platform Fee (Fixed)</small>
                      <span className="fixed-fee-tag">₹{FIXED_PLATFORM_COMMISSION}</span>
                    </div>
                    <div>
                      <small>Your Net Earnings</small>
                      <strong className="net-earning-val">₹{Number(booking.price) - FIXED_PLATFORM_COMMISSION}</strong>
                    </div>
                  </div>

                  {/* Customer Review display if completed & rated */}
                  {booking.rating && (
                    <div className="technician-review-snippet">
                      <span>Customer Review:</span>
                      <strong>⭐ {booking.rating}/5 stars</strong>
                      {booking.review && <p>"{booking.review}"</p>}
                    </div>
                  )}

                  <div className="job-card-action">
                    {booking.status === 'Completed' ? (
                      <div className="job-action-buttons-group">
                        <span className="finished-label">✓ Job Finished & Payment Received</span>
                        <button
                          type="button"
                          className="button button-small button-outline invoice-trigger-btn"
                          onClick={() => setReceiptBooking(booking)}
                          title="View / Print Tax Receipt"
                        >
                          <span>🧾</span> View Receipt
                        </button>
                      </div>
                    ) : booking.status === 'Cancelled' ? (
                      <span className="cancelled-label">Job Cancelled</span>
                    ) : booking.status === 'In Progress' ? (
                      <button
                        type="button"
                        className="button button-gold button-small verify-pin-btn"
                        onClick={() => setPinModalBooking(booking)}
                        title="Enter the customer's 4-digit Happy Code to complete this job"
                      >
                        🔐 Verify Happy Code & Complete <span>✓</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-primary button-small"
                        onClick={() => advanceJob(booking)}
                      >
                        Start Job (In Progress) <span>→</span>
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* EARNINGS & WALLET TAB WITH INTERACTIVE LEDGER & FIXED COMMISSION */}
      {active === 'wallet' && (
        <>
          <PageHeading eyebrow="FINANCIAL SETTLEMENT & FINTECH WALLET" title="Partner Wallet & Earnings">
            <button
              type="button"
              className="button button-gold button-small"
              onClick={() => setRechargeModalOpen(true)}
            >
              ⚡ Recharge Wallet
            </button>
          </PageHeading>

          {/* Wallet Balance Hero Card */}
          <div className="wallet-hero">
            <div>
              <small className="wallet-hero-tag">PREPAID PARTNER WALLET</small>
              <h2 className="wallet-hero-balance">₹{techWalletBalance.toLocaleString('en-IN')}</h2>
              <p>
                Available balance for receiving & accepting bookings. Min ₹150 required.
              </p>
              <div className="wallet-hero-badges">
                {isLowBalance ? (
                  <span className="wallet-badge-low">⚠️ Low Balance (&lt; ₹150) · Job Acceptance Paused</span>
                ) : (
                  <span className="wallet-badge-ok">✓ Active Balance · Eligible for Live Bookings</span>
                )}
                <span className="wallet-badge-rule">Flat ₹149 Fee Per Job</span>
              </div>
            </div>
            <div className="wallet-hero-actions">
              <button
                type="button"
                className="button button-gold button-large recharge-hero-btn"
                onClick={() => setRechargeModalOpen(true)}
              >
                <span>⚡</span> Recharge Wallet (Demo UPI)
              </button>
            </div>
          </div>

          {/* Low Balance Warning Banner */}
          {isLowBalance && (
            <div className="wallet-warning-banner">
              <span className="warning-banner-icon">⚠️</span>
              <div className="warning-banner-content">
                <strong>Low Wallet Balance! Minimum ₹150 required to accept new bookings.</strong>
                <p>
                  Aapke wallet mein abhi ₹{techWalletBalance} hain. Unassigned jobs accept karne ke liye demo UPI se instant recharge karein.
                </p>
              </div>
              <button
                type="button"
                className="button button-gold button-small recharge-btn-pill"
                onClick={() => setRechargeModalOpen(true)}
              >
                ⚡ Recharge Wallet
              </button>
            </div>
          )}

          <div className="stats-grid wallet-stat-grid">
            <StatCard
              label="Prepaid Wallet Balance"
              value={`₹${techWalletBalance.toLocaleString('en-IN')}`}
              icon="₹"
              note={isLowBalance ? 'Top up required' : 'Ready for bookings'}
            />
            <StatCard
              label="Completed Service Value"
              value={`₹${grossEarnings.toLocaleString('en-IN')}`}
              icon="▤"
              note={`${completedJobs.length} completed jobs`}
            />
            <StatCard
              label={`Platform Fee (₹${FIXED_PLATFORM_COMMISSION} Fixed / Job)`}
              value={`₹${totalFixedCommission.toLocaleString('en-IN')}`}
              icon="🛡️"
              note="Compulsory ₹149 per job"
            />
            <StatCard
              label="Technician Take Home"
              value={`₹${technicianTakeHome.toLocaleString('en-IN')}`}
              icon="✓"
              note="No percentage cut"
            />
          </div>

          <div className="fixed-commission-highlight-box">
            <span>🛡️</span>
            <div>
              <strong>Ghar Sathi Fixed Commission Guarantee</strong>
              <p>
                Aapke har complete kaam par company ka commission fixed ₹{FIXED_PLATFORM_COMMISSION} hai. Kaam ₹500 ka ho ya
                ₹5000 ka, koi extra percentage cut nahi hoga! Platform fee automatically aapke wallet se deduct hoti hai.
              </p>
            </div>
          </div>

          {/* Interactive Technician Wallet Ledger Table */}
          <div className="table-card wallet-ledger-card">
            <div className="table-card-header">
              <div>
                <h3>Partner Wallet Ledger (Debits & Credits)</h3>
                <p>Real-time transaction history of all UPI recharges and fixed ₹149 job fee deductions</p>
              </div>
              <button
                type="button"
                className="button button-outline button-small"
                onClick={() => setRechargeModalOpen(true)}
              >
                + Top-up Balance
              </button>
            </div>

            {(!currentTechnician.walletTransactions || currentTechnician.walletTransactions.length === 0) ? (
              <EmptyState
                icon="₹"
                title="No wallet transactions yet"
                message="Wallet recharge karne ya job complete karne par transactions yahan record honge."
                action={
                  <button
                    type="button"
                    className="button button-gold button-small"
                    onClick={() => setRechargeModalOpen(true)}
                  >
                    ⚡ Recharge Wallet Now
                  </button>
                }
              />
            ) : (
              <div className="table-scroll">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Tx ID</th>
                      <th>Type</th>
                      <th>Transaction Details</th>
                      <th>Amount (₹)</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTechnician.walletTransactions.map((tx) => (
                      <tr key={tx.id} className={`tx-row tx-${tx.type}`}>
                        <td>
                          <span className="tx-id-badge">{tx.id}</span>
                        </td>
                        <td>
                          {tx.type === 'credit' ? (
                            <span className="tx-type-chip tx-credit">
                              <span>↓</span> Credit (Top-up)
                            </span>
                          ) : (
                            <span className="tx-type-chip tx-debit">
                              <span>↑</span> Debit (Platform Fee)
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{tx.description}</strong>
                          {tx.bookingId && <small className="cell-subline">Booking: {tx.bookingId}</small>}
                        </td>
                        <td>
                          <span className={`tx-amount-val ${tx.type === 'credit' ? 'val-credit' : 'val-debit'}`}>
                            {tx.type === 'credit' ? `+₹${tx.amount}` : `-₹${tx.amount}`}
                          </span>
                        </td>
                        <td>
                          <small className="tx-date-cell">
                            {new Date(tx.timestamp).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Completed Service Settlements Table */}
          {completedJobs.length > 0 ? (
            <div className="table-card">
              <div className="table-card-header">
                <div>
                  <h3>Completed Job Settlements</h3>
                  <p>Customer service ticket breakdown & GST receipts</p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Service Name</th>
                      <th>Gross Price</th>
                      <th>Platform Fee</th>
                      <th>Your Earnings</th>
                      <th>Date</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedJobs.map((job) => (
                      <tr key={job.id}>
                        <td>{job.id}</td>
                        <td>
                          {job.serviceName}
                          {job.subcategoryName && <small className="cell-subline">{job.subcategoryName}</small>}
                        </td>
                        <td>₹{job.price}</td>
                        <td>
                          <span className="fixed-fee-tag">₹{FIXED_PLATFORM_COMMISSION}</span>
                        </td>
                        <td>
                          <strong>₹{Number(job.price) - FIXED_PLATFORM_COMMISSION}</strong>
                        </td>
                        <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            type="button"
                            className="button button-small button-outline invoice-trigger-btn"
                            onClick={() => setReceiptBooking(job)}
                            title="View / Print Tax Receipt"
                          >
                            🧾 Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="₹"
              title="No completed earnings yet"
              message="Jobs complete hote hi har job par fixed ₹149 platform deduction ke baad aapka share yahan dikhega."
            />
          )}
        </>
      )}

      {/* MY PROFILE TAB */}
      {active === 'profile' && (
        <>
          <PageHeading eyebrow="PARTNER DETAILS" title="Technician Profile" />
          <div className="profile-detail-card">
            <div className="profile-avatar">
              {currentTechnician.liveImage ? (
                <img src={currentTechnician.liveImage} alt="Profile" className="avatar-img-round" />
              ) : (
                currentTechnician.name.charAt(0).toUpperCase()
              )}
            </div>

            <h2>{currentTechnician.name}</h2>
            <p className="tech-id-badge">{currentTechnician.id}</p>
            <StatusBadge status={currentTechnician.status} />

            <div className="profile-detail-list">
              <div>
                <span>Mobile Number</span>
                <strong>{currentTechnician.phone}</strong>
              </div>
              <div>
                <span>Email ID</span>
                <strong>{currentTechnician.email || 'Not provided'}</strong>
              </div>
              <div>
                <span>Aadhaar Number</span>
                <strong>{currentTechnician.aadhaar || 'Verified on signup'}</strong>
              </div>
              <div>
                <span>Operating Service Area</span>
                <strong>{currentTechnician.area}</strong>
              </div>
              <div>
                <span>Registered Skills</span>
                <strong>{currentTechnician.skills}</strong>
              </div>
              <div>
                <span>Address</span>
                <strong>{currentTechnician.address}</strong>
              </div>
              <div>
                <span>Customer Rating</span>
                <strong>⭐ {currentTechnician.rating || 5.0} ({currentTechnician.ratingCount || 0} reviews)</strong>
              </div>
              <div>
                <span>Live GPS Status</span>
                <strong>
                  {currentTechnician.liveLocation
                    ? `Lat: ${currentTechnician.liveLocation.lat?.toFixed(4)}, Lng: ${currentTechnician.liveLocation.lng?.toFixed(4)}`
                    : 'Location recorded'}
                </strong>
              </div>
            </div>

            <div className="profile-actions-row" style={{ marginTop: '20px' }}>
              <button
                className="button button-danger"
                onClick={logoutTechnician}
              >
                🚪 Logout Technician Session
              </button>
            </div>
          </div>

          {/* Customer Reviews Section on Technician Profile */}
          <div className="profile-detail-card reviews-profile-card" style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--green)', marginBottom: '6px' }}>
              Customer Ratings & Reviews Received
            </h3>
            <p className="small-muted" style={{ margin: '0 0 16px' }}>
              Verified ratings and reviews submitted by customers after job completion.
            </p>

            <div className="reviews-summary-card">
              <div className="summary-score-col">
                <span className="big-rating-number">{Number(currentTechnician.rating || 5.0).toFixed(1)}</span>
                <div className="summary-stars">{'★'.repeat(Math.round(currentTechnician.rating || 5.0))}</div>
                <small>Average Rating ({currentTechnician.ratingCount || 0} reviews)</small>
              </div>
              <div className="summary-features-col">
                <div className="feature-score-line">
                  <span>Customer Satisfaction</span>
                  <div className="mini-score-bar"><div style={{ width: '98%' }} /></div>
                  <b>98%</b>
                </div>
                <div className="feature-score-line">
                  <span>Punctuality</span>
                  <div className="mini-score-bar"><div style={{ width: '96%' }} /></div>
                  <b>96%</b>
                </div>
                <div className="feature-score-line">
                  <span>Behavior & Cleanliness</span>
                  <div className="mini-score-bar"><div style={{ width: '99%' }} /></div>
                  <b>99%</b>
                </div>
              </div>
            </div>

            <div className="reviews-feed" style={{ marginTop: '18px', textAlign: 'left' }}>
              {myJobs.filter((j) => j.rating).length === 0 ? (
                <div className="no-reviews-box">
                  <span>⭐</span>
                  <p>Abhi tak koi written customer review record nahi hua hai.</p>
                </div>
              ) : (
                myJobs
                  .filter((j) => j.rating)
                  .map((item) => (
                    <div key={item.id} className="review-feed-item">
                      <div className="review-feed-top">
                        <strong>{item.customerName || 'Verified Customer'}</strong>
                        <div className="review-feed-stars">
                          {'★'.repeat(item.rating || 5)}
                          <small>
                            · {item.ratedAt ? new Date(item.ratedAt).toLocaleDateString() : item.date}
                          </small>
                        </div>
                      </div>
                      <p className="review-service-name">
                        Service: {item.serviceName}{' '}
                        {item.subcategoryName ? `(${item.subcategoryName})` : ''}
                      </p>
                      {item.review && <p className="review-comment">"{item.review}"</p>}
                      {item.reviewTags && item.reviewTags.length > 0 && (
                        <div className="review-compliments-list">
                          {item.reviewTags.map((tag) => (
                            <span key={tag} className="compliment-pill">
                              ✓ {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}
    </PanelShell>
    {receiptBooking && (
      <InvoiceModal
        booking={receiptBooking}
        onClose={() => setReceiptBooking(null)}
      />
    )}
    {pinModalBooking && (
      <PinVerificationModal
        booking={pinModalBooking}
        onClose={() => setPinModalBooking(null)}
        onVerify={handlePinVerification}
      />
    )}
    {rechargeModalOpen && (
      <WalletRechargeModal
        technician={currentTechnician}
        onClose={() => setRechargeModalOpen(false)}
        onRecharge={handleWalletRecharge}
      />
    )}
  </>
  );
}
