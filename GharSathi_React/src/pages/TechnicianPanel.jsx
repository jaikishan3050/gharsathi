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
import OtpPopupModal from '../components/OtpPopupModal.jsx';

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
    setTechnicianSession,
    addToast,
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

  // Direct On-Screen Popup OTP states
  const [popupOtp, setPopupOtp] = useState('');
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupTarget, setPopupTarget] = useState('login'); // 'login' | 'register' | 'forgot'

  // Auth screen states: 'login' (OTP login) | 'register' | 'password' | 'forgot'
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');

  // Mobile OTP Login States
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpStep, setLoginOtpStep] = useState(false);
  const [loginCountdown, setLoginCountdown] = useState(60);
  const [loginLoading, setLoginLoading] = useState(false);

  // Password Login Form
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });

  // Countdown timer for Technician Mobile OTP Login
  useEffect(() => {
    let timer = null;
    if (loginOtpStep && loginCountdown > 0) {
      timer = setInterval(() => {
        setLoginCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loginOtpStep, loginCountdown]);

  // Forgot Password States
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter phone, 2 = enter otp & new password
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCountdown, setForgotCountdown] = useState(60);

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

  // Countdown timer for Forgot Password SMS OTP
  useEffect(() => {
    let timer = null;
    if (forgotStep === 2 && forgotCountdown > 0) {
      timer = setInterval(() => {
        setForgotCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [forgotStep, forgotCountdown]);

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

  // Handle Send Mobile OTP for Technician Login
  const handleSendLoginOtp = async (e, isResend = false) => {
    if (e) e.preventDefault();
    const cleanPhone = loginPhone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      const errMsg = 'Kripya valid 10-digit Indian mobile number daalein (e.g. 9876500001).';
      setAuthError(errMsg);
      addToast({ title: 'Invalid Mobile Number', message: errMsg, type: 'error' });
      return;
    }

    setLoginLoading(true);
    setAuthError('');
    try {
      const res = await api.sendOtp(cleanPhone, 'technician');
      setLoginLoading(false);
      setLoginOtpStep(true);
      setLoginCountdown(60);
      const otp = res?.debug_otp || res?.otp;
      if (otp) {
        setPopupOtp(otp);
        setPopupTarget('login');
        setPopupOpen(true);
      }
      addToast({
        title: 'Verification OTP Ready! 🔔',
        message: `OTP: ${otp || 'Generated on screen'}`,
        type: 'success',
      });
    } catch (err) {
      setLoginLoading(false);
      const errMsg = err?.data?.error || err?.message || 'OTP send karne mein samasya aayi.';
      setAuthError(errMsg);
      addToast({ title: 'OTP Error', message: errMsg, type: 'error' });
    }
  };

  // Handle Verify Mobile OTP for Technician Login
  const handleVerifyLoginOtp = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    const cleanPhone = loginPhone.replace(/\D/g, '').slice(-10);
    const cleanOtp = loginOtp.replace(/\D/g, '').trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      const errMsg = 'Kripya poora 6-digit OTP code enter karein.';
      setAuthError(errMsg);
      addToast({ title: 'Invalid OTP', message: errMsg, type: 'error' });
      return;
    }

    setLoginLoading(true);
    try {
      const res = await api.verifyOtp({
        phoneNumber: cleanPhone,
        otpCode: cleanOtp,
        role: 'technician',
      });
      setLoginLoading(false);

      const techProfile = res?.technician || res?.user;
      if (techProfile) {
        setTechnicianSession(techProfile, res.token);
        setLoginOtpStep(false);
        setNotice(`Namaste ${techProfile.name}! Workspace active.`);
        addToast({
          title: `Namaste, ${techProfile.name}! 🧰`,
          message: 'Technician partner logged in successfully.',
          type: 'success',
        });
      } else {
        setAuthError('Login verify nahi ho saka. Kripya punah prayas karein.');
      }
    } catch (err) {
      setLoginLoading(false);
      const errMsg = err?.data?.error || err?.message || 'Galat OTP code daala gaya hai.';
      setAuthError(errMsg);
      addToast({ title: 'Login Failed', message: errMsg, type: 'error' });
    }
  };

  // Handle Password Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    const res = await loginTechnician(loginForm.phone, loginForm.password);
    if (!res.success) {
      setAuthError(res.error);
    } else {
      setNotice(`Namaste ${res.technician.name}, login successful!`);
    }
  };

  // Normalize phone helper
  const normalizePhoneNumber = (raw) => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  };

  // Handle Send Forgot Password OTP
  const handleSendForgotOtp = async (e, isResend = false) => {
    if (e) e.preventDefault();
    const cleanPhone = normalizePhoneNumber(forgotPhone);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      const errMsg = 'Kripya valid 10-digit Indian mobile number daalein (e.g. 9876500001).';
      setAuthError(errMsg);
      addToast({ title: 'Invalid Mobile Number', message: errMsg, type: 'error' });
      return;
    }
    setForgotLoading(true);
    setAuthError('');
    try {
      const res = await api.forgotPasswordTechnician(cleanPhone);
      setForgotLoading(false);
      setForgotStep(2);
      setForgotCountdown(60);
      const otp = res?.debug_otp || res?.otp;
      if (otp) {
        setPopupOtp(otp);
        setPopupTarget('forgot');
        setPopupOpen(true);
      }
      const successMsg = res?.message || `OTP code +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)} par bhej diya gaya hai.`;
      setNotice(successMsg);
      addToast({
        title: 'Reset OTP Ready! 🔔',
        message: `OTP: ${otp || 'Generated on screen'}`,
        type: 'success',
      });
    } catch (err) {
      setForgotLoading(false);
      const errMsg = err?.data?.error || err?.data?.detail || err?.error || err?.message || 'OTP send karne mein samasya aayi. Kripya number verify karein.';
      setAuthError(errMsg);
      addToast({ title: 'Account Not Found', message: errMsg, type: 'error' });
    }
  };

  // Handle Reset Password via OTP
  const handleResetPasswordOtp = async (e) => {
    e.preventDefault();
    const cleanPhone = normalizePhoneNumber(forgotPhone);
    const cleanOtp = forgotOtp.replace(/\D/g, '').trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      const errMsg = 'Kripya 6-digit OTP code enter karein.';
      setAuthError(errMsg);
      addToast({ title: 'Invalid OTP', message: errMsg, type: 'error' });
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      const errMsg = 'Naya password kam se kam 4 characters ka hona chahiye.';
      setAuthError(errMsg);
      addToast({ title: 'Weak Password', message: errMsg, type: 'error' });
      return;
    }
    setForgotLoading(true);
    setAuthError('');
    try {
      const res = await api.resetPasswordTechnician(cleanPhone, cleanOtp, newPassword);
      setForgotLoading(false);
      const successMsg = res?.message || 'Password successfully update ho gaya hai!';
      setNotice(successMsg);
      addToast({ title: 'Password Reset! 🔑', message: successMsg, type: 'success' });
      setLoginForm({ phone: cleanPhone, password: newPassword });
      setAuthMode('login');
      setForgotStep(1);
      setForgotOtp('');
      setNewPassword('');
    } catch (err) {
      setForgotLoading(false);
      const errMsg = err?.data?.error || err?.data?.detail || err?.error || err?.message || 'Password reset fail ho gaya. Kripya OTP check karein.';
      setAuthError(errMsg);
      addToast({ title: 'Reset Failed', message: errMsg, type: 'error' });
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
      setRegOtpStep(true);
      setRegCountdown(60);
      const otp = res?.debug_otp || res?.otp;
      if (otp) {
        setPopupOtp(otp);
        setPopupTarget('register');
        setPopupOpen(true);
      }
      addToast({
        title: 'Verification OTP Ready! 🔔',
        message: `OTP: ${otp || 'Generated on screen'}`,
        type: 'success',
      });
      if (isResend) {
        setNotice(`Naya OTP code +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)} tayyar hai.`);
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
      const res = await api.verifyOtp({
        phoneNumber: cleanPhone,
        otpCode: regOtp,
        role: 'technician',
        name: regForm.name,
        skills: Array.isArray(regForm.skills) ? regForm.skills.join(', ') : regForm.skills,
        area: regForm.area,
        address: regForm.address,
      });

      setRegLoading(false);
      const techProfile = res?.technician || res?.user;
      if (techProfile) {
        setTechnicianSession(techProfile, res.token);
      } else {
        registerTechnician(regForm);
      }
      setRegOtpStep(false);
      setNotice(
        `Technician registration complete! Welcome ${regForm.name}. Mobile number verified.`
      );
      addToast({
        title: 'Registration Complete! 🎉',
        message: `Welcome ${regForm.name}! Wallet balance initialized to ₹0.00.`,
        type: 'success',
      });
    } catch (err) {
      setRegLoading(false);
      setAuthError(err?.data?.error || err?.message || 'Galat OTP daala gaya hai.');
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

  const handleWalletRecharge = async (payload) => {
    if (!currentTechnician) return { success: false };
    const res = await rechargeTechnicianWallet(currentTechnician.id, payload);
    if (res && res.success) {
      const creditedAmount = res.amount || (typeof payload === 'object' ? payload.amount : payload);
      setNotice(`Wallet recharged with ₹${creditedAmount}! New balance: ₹${res.balance}. Aap ab naye jobs accept kar sakte hain.`);
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

          <div className="auth-tab-switch" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <button
              type="button"
              className={`tab-switch-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
            >
              Login with Mobile OTP 📲
            </button>
            <button
              type="button"
              className={`tab-switch-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
            >
              New Partner Register 📝
            </button>
            <button
              type="button"
              className={`tab-switch-btn ${authMode === 'password' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('password');
                setAuthError('');
              }}
            >
              Password Login 🔑
            </button>
          </div>

          {authError && <div className="warning-notice">{authError}</div>}

          {/* 1. LOGIN WITH MOBILE NUMBER & ON-SCREEN POPUP OTP */}
          {authMode === 'login' && (
            <div className="technician-auth-form">
              {!loginOtpStep ? (
                <form onSubmit={handleSendLoginOtp}>
                  <Field label="Mobile Number *" hint="10-digit registered Indian mobile number">
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #dce4dc', borderRadius: '10px', background: '#fbfcfb', overflow: 'hidden' }}>
                      <span style={{ padding: '12px 14px', background: '#eef4f0', color: '#16523e', fontWeight: 800, fontSize: '12px', borderRight: '1px solid #dce4dc' }}>
                        🇮🇳 +91
                      </span>
                      <input
                        required
                        type="tel"
                        maxLength="10"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="e.g. 9876500001"
                        autoFocus
                        style={{ border: 'none', background: 'transparent', flex: 1, padding: '12px 14px', outline: 'none' }}
                      />
                    </div>
                  </Field>

                  <button
                    type="submit"
                    className="button button-gold button-wide"
                    style={{ marginTop: '16px' }}
                    disabled={loginLoading || loginPhone.replace(/\D/g, '').length !== 10}
                  >
                    {loginLoading ? 'Generating OTP…' : 'Send OTP to Screen 📲'}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#0d5c43', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => {
                        setAuthMode('password');
                        setLoginForm({ ...loginForm, phone: loginPhone });
                        setAuthError('');
                      }}
                    >
                      Login with Password instead 🔑
                    </button>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#0d5c43', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError('');
                      }}
                    >
                      New Partner? Register 📝
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyLoginOtp}>
                  {/* On-screen OTP notification banner */}
                  <div
                    style={{
                      background: '#fefce8',
                      border: '2px dashed #d4af37',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      marginBottom: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#854d0e', fontWeight: 800 }}>
                      ⚡ Your Verification OTP is:
                    </div>
                    <div
                      style={{
                        fontSize: '30px',
                        fontWeight: 900,
                        letterSpacing: '8px',
                        color: '#0b3d2e',
                        fontFamily: 'monospace, sans-serif',
                        margin: '6px 0',
                      }}
                    >
                      {popupOtp || '482910'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLoginOtp(popupOtp)}
                      style={{
                        background: '#0b3d2e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ Click to Auto-Fill OTP
                    </button>
                  </div>

                  <Field label="Enter 6-Digit OTP *" hint={`Sent to +91 ${loginPhone}`}>
                    <input
                      required
                      type="tel"
                      maxLength="6"
                      value={loginOtp}
                      onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      autoFocus
                      style={{ fontSize: '22px', letterSpacing: '6px', textAlign: 'center', fontWeight: 'bold' }}
                    />
                  </Field>

                  {/* Resend Countdown Bar */}
                  <div className="otp-resend-countdown-bar" style={{ marginTop: '12px', marginBottom: '14px' }}>
                    {loginCountdown > 0 ? (
                      <div className="countdown-pill active">
                        <span className="timer-icon">⏳</span>
                        <span>Resend in <strong>00:{loginCountdown < 10 ? `0${loginCountdown}` : loginCountdown}</strong></span>
                      </div>
                    ) : (
                      <div className="countdown-pill expired">
                        <span>Code not received?</span>
                        <button
                          type="button"
                          disabled={loginLoading}
                          onClick={(e) => handleSendLoginOtp(e, true)}
                          className="resend-action-link"
                        >
                          {loginLoading ? 'Resending…' : 'Regenerate OTP 🔄'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => {
                        setLoginOtpStep(false);
                        setAuthError('');
                      }}
                      disabled={loginLoading}
                    >
                      ← Change Number
                    </button>
                    <button
                      type="submit"
                      className="button button-primary"
                      style={{ flex: 1 }}
                      disabled={loginLoading || loginOtp.length !== 6}
                    >
                      {loginLoading ? 'Verifying…' : 'Verify & Login 🚀'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 2. LOGIN WITH MOBILE NUMBER & PASSWORD */}
          {authMode === 'password' && (
            <form onSubmit={handleLogin} className="technician-auth-form">
              <Field label="Mobile Number *">
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

              <Field label="Password *">
                <input
                  required
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Enter your password"
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0d5c43',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => {
                    setAuthMode('login');
                    setLoginPhone(loginForm.phone);
                    setAuthError('');
                  }}
                >
                  ← Login with OTP instead
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0d5c43',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => {
                    setAuthMode('forgot');
                    setForgotPhone(loginForm.phone);
                    setForgotStep(1);
                    setAuthError('');
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" className="button button-gold button-wide" style={{ marginTop: '16px' }}>
                Login with Password <span>→</span>
              </button>
            </form>
          )}

          {/* 2. FORGOT PASSWORD VIA MOBILE OTP */}
          {authMode === 'forgot' && (
            <div className="technician-auth-form">
              <div style={{ marginBottom: '14px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px', color: '#1b4332' }}>
                  Reset Password via SMS OTP
                </h3>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  Apne registered mobile number par OTP prapt karein aur naya password banayein.
                </p>
              </div>

              {forgotStep === 1 ? (
                <form onSubmit={handleSendForgotOtp}>
                  <Field label="Registered Mobile Number *" hint="Enter 10-digit mobile number">
                    <input
                      required
                      type="tel"
                      maxLength="16"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="e.g. 9876500001 or +91 98765 00001"
                      disabled={forgotLoading}
                    />
                  </Field>

                  <button
                    type="submit"
                    className="button button-gold button-wide"
                    style={{ marginTop: '16px' }}
                    disabled={forgotLoading || forgotPhone.replace(/\D/g, '').length < 10}
                  >
                    {forgotLoading ? 'Sending SMS OTP…' : 'Send Reset OTP 📲'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="button button-outline button-small"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                      }}
                    >
                      ← Back to Login
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordOtp}>
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      fontSize: '12px',
                      color: '#166534',
                    }}
                  >
                    OTP sent to <strong>+91 {normalizePhoneNumber(forgotPhone).slice(0, 2)}******{normalizePhoneNumber(forgotPhone).slice(-2)}</strong>
                  </div>

                  {/* On-screen OTP notification banner */}
                  <div
                    style={{
                      background: '#fefce8',
                      border: '2px dashed #d4af37',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      marginBottom: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#854d0e', fontWeight: 800 }}>
                      ⚡ Reset Verification OTP:
                    </div>
                    <div
                      style={{
                        fontSize: '30px',
                        fontWeight: 900,
                        letterSpacing: '8px',
                        color: '#0b3d2e',
                        fontFamily: 'monospace, sans-serif',
                        margin: '6px 0',
                      }}
                    >
                      {popupOtp || '482910'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setForgotOtp(popupOtp)}
                      style={{
                        background: '#0b3d2e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ Click to Auto-Fill OTP
                    </button>
                  </div>

                  <Field label="Enter 6-Digit SMS OTP *" hint="Check your mobile SMS">
                    <input
                      required
                      type="tel"
                      maxLength="6"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      disabled={forgotLoading}
                    />
                  </Field>

                  <Field label="Create New Password *" hint="Min 4 characters">
                    <input
                      required
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new strong password"
                      disabled={forgotLoading}
                    />
                  </Field>

                  <button
                    type="submit"
                    className="button button-gold button-wide"
                    style={{ marginTop: '16px' }}
                    disabled={forgotLoading || forgotOtp.length < 4 || newPassword.length < 4}
                  >
                    {forgotLoading ? 'Updating Password…' : 'Reset Password & Save 🔑'}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="button button-outline button-small"
                      onClick={() => {
                        setForgotStep(1);
                        setAuthError('');
                      }}
                      disabled={forgotLoading}
                    >
                      Change Number
                    </button>

                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: forgotCountdown > 0 ? '#9ca3af' : '#0d5c43',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: forgotCountdown > 0 ? 'default' : 'pointer',
                      }}
                      disabled={forgotCountdown > 0 || forgotLoading}
                      onClick={(e) => handleSendForgotOtp(e, true)}
                    >
                      {forgotCountdown > 0 ? `Resend OTP in ${forgotCountdown}s` : 'Resend OTP 🔄'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 3. TECHNICIAN REGISTRATION FORM */}
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
                      <p>Kripya apne mobile SMS inbox ya on-screen popup mein praapt 6-digit verification code enter karein.</p>
                    </div>
                  </div>

                  {/* On-screen OTP notification banner */}
                  <div
                    style={{
                      background: '#fefce8',
                      border: '2px dashed #d4af37',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      marginBottom: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#854d0e', fontWeight: 800 }}>
                      ⚡ Partner Verification OTP:
                    </div>
                    <div
                      style={{
                        fontSize: '30px',
                        fontWeight: 900,
                        letterSpacing: '8px',
                        color: '#0b3d2e',
                        fontFamily: 'monospace, sans-serif',
                        margin: '6px 0',
                      }}
                    >
                      {popupOtp || '482910'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegOtp(popupOtp)}
                      style={{
                        background: '#0b3d2e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ Click to Auto-Fill OTP
                    </button>
                  </div>


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

          {/* On-Screen Popup OTP Modal */}
          <OtpPopupModal
            isOpen={popupOpen}
            otp={popupOtp}
            phone={popupTarget === 'login' ? loginPhone : popupTarget === 'register' ? regForm.phone : forgotPhone}
            title={
              popupTarget === 'login'
                ? 'Technician Login OTP'
                : popupTarget === 'register'
                ? 'Partner Registration OTP'
                : 'Reset Password OTP'
            }
            onClose={() => setPopupOpen(false)}
            onAutoFill={(code) => {
              if (popupTarget === 'login') setLoginOtp(code);
              else if (popupTarget === 'register') setRegOtp(code);
              else if (popupTarget === 'forgot') setForgotOtp(code);
            }}
          />
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
                  Aapke wallet mein abhi ₹{techWalletBalance} hain. Customer jobs accept karne ke liye Razorpay se instant recharge karein.
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
                <span>💳</span> Recharge Wallet (Razorpay)
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
                  Aapke wallet mein abhi ₹{techWalletBalance} hain. Unassigned jobs accept karne ke liye Razorpay se instant recharge karein.
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
