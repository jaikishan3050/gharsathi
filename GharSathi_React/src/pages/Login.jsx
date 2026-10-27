import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useGharSathi } from '../context/AppDataContext.jsx';
import api from '../services/api.js';
import { Brand } from '../components/Common.jsx';
import OtpPopupModal from '../components/OtpPopupModal.jsx';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCustomerSession, setTechnicianSession, addToast } = useGharSathi();

  // Role toggle: 'customer' | 'technician'
  const initialRole = location.state?.role || (location.pathname.includes('technician') ? 'technician' : 'customer');
  const [role, setRole] = useState(initialRole);

  // Auth flow states
  const [step, setStep] = useState('input'); // 'input' | 'otp'
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [password, setPassword] = useState('');
  const [popupOtp, setPopupOtp] = useState('');
  const [popupOpen, setPopupOpen] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const inputRefs = useRef([]);
  const phoneInputRef = useRef(null);

  // Focus input on load
  useEffect(() => {
    if (step === 'input' && phoneInputRef.current) {
      phoneInputRef.current.focus();
    } else if (step === 'otp' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step, role]);

  // Real-time 60-second countdown timer for OTP resend
  useEffect(() => {
    let timer = null;
    if (step === 'otp' && countdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  // Step 1: Generate the OTP and show it in the website popup.
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMsg('Kripya valid 10-digit Indian mobile number enter karein (e.g. 9876500001).');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendOtp(cleanPhone, role);
      setStatusMsg(res?.message || `Verification OTP generated for +91 ${cleanPhone}`);
      setStep('otp');
      setCountdown(60);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);
      const otp = res?.debug_otp;
      if (otp) {
        setPopupOtp(otp);
        setPopupOpen(true);
      }
      addToast({
        title: 'Verification OTP Ready! 🔔',
        message: otp ? `Website OTP: ${otp}` : 'OTP website popup mein dikhaya gaya hai.',
        type: 'success',
      });
    } catch (err) {
      console.error('OTP send failed:', err);
      const msg = err?.data?.error || err?.message || 'Failed to send OTP. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTechnicianPasswordLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.login({ phone, password, role: 'technician' });
      const profile = res?.technician || res?.user;
      if (!res?.success || res.role !== 'technician' || !res.token || !profile) {
        throw new Error(res?.error || 'Invalid mobile number or password.');
      }
      setTechnicianSession(profile, res.token);
      addToast({ title: `Welcome, ${profile.name || 'Partner'}! 🧰`, message: 'Technician signed in with mobile and password.', type: 'success' });
      navigate('/technician', { replace: true });
    } catch (err) {
      setErrorMsg(err?.data?.error || err?.message || 'Invalid mobile number or password.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and Sign In
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const otpCode = otpDigits.join('').trim();
    if (otpCode.length !== 6) {
      setErrorMsg('Kripya poora 6-digit OTP enter karein.');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
      const res = await api.verifyOtp({
        phoneNumber: cleanPhone,
        otpCode,
        role,
      });

      if (res?.success && res.token) {
        const custProfile = res?.user || res?.customer;
        if (!custProfile) throw new Error('Customer profile was not returned by the server.');
        setCustomerSession(custProfile, res.token);
        addToast({
          title: `Welcome, ${custProfile?.name || 'Customer'}! 🏡`,
          message: 'Signed in successfully. Ready to book services!',
          type: 'success',
        });
        navigate('/customer', { replace: true });
      } else {
        setErrorMsg(res?.error || 'Verification failed. Please try again.');
      }
    } catch (err) {
      console.error('OTP verify failed:', err);
      const msg = err?.data?.otp_code?.[0] || err?.data?.error || err?.message || 'Invalid or expired OTP. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // OTP 6-box input handlers
  const handleDigitChange = (index, val) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = char;
    setOtpDigits(updated);

    if (char && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const updated = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setOtpDigits(updated);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  return (
    <div className="auth-fullscreen-page">
      {/* Top Navbar */}
      <header className="auth-header">
        <Brand />
        <Link to="/" className="back-home-link">
          ← Back to Home
        </Link>
      </header>

      {/* Auth Card Centered */}
      <main className="auth-card-container">
        <div className="auth-card">
          {/* Role Switcher */}
          <div className="auth-role-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={role === 'customer'}
              className={`auth-role-tab ${role === 'customer' ? 'active' : ''}`}
              onClick={() => {
                setRole('customer');
                setStep('input');
                setErrorMsg('');
                setStatusMsg('');
                setPopupOtp('');
                setPopupOpen(false);
                setOtpDigits(['', '', '', '', '', '']);
              }}
            >
              <span className="tab-icon">🏡</span>
              <span>Customer</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'technician'}
              className={`auth-role-tab ${role === 'technician' ? 'active' : ''}`}
              onClick={() => {
                setRole('technician');
                setStep('input');
                setErrorMsg('');
                setStatusMsg('');
                setPopupOtp('');
                setPopupOpen(false);
                setOtpDigits(['', '', '', '', '', '']);
              }}
            >
              <span className="tab-icon">🧰</span>
              <span>Technician Partner</span>
            </button>
          </div>

          <div className="auth-card-body">
            <div className="auth-title-block">
              <h2>{role === 'technician' ? 'Technician Partner Login' : 'Sign in to Ghar Sathi'}</h2>
              <p className="auth-sub">
                {role === 'technician'
                  ? 'Technician account ke liye registered mobile number aur password enter karein.'
                  : 'Enter your 10-digit mobile number to access verified home services & track live bookings.'}
              </p>
            </div>

            {/* Error & Status Alerts */}
            {errorMsg && (
              <div className="auth-alert error-alert" role="alert">
                <span className="alert-icon">⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}
            {statusMsg && (
              <div className="auth-alert info-alert" role="status">
                <span className="alert-icon">📲</span>
                <span>{statusMsg}</span>
              </div>
            )}

            {step === 'input' ? (
              <div className="auth-step-input">
                <form onSubmit={role === 'technician' ? handleTechnicianPasswordLogin : handleSendOtp} className="auth-form-email">
                  <div className="field">
                    <label htmlFor="login-phone">Mobile Number (10 Digits)</label>
                    <div className="phone-input-wrap">
                      <span className="phone-prefix">+91</span>
                      <input
                        id="login-phone"
                        ref={phoneInputRef}
                        type="tel"
                        required
                        placeholder="9876543210"
                        maxLength="10"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        disabled={loading}
                        autoComplete="tel"
                      />
                    </div>
                    {role === 'customer' && (
                      <small className="field-hint" style={{ marginTop: '6px', display: 'block', color: '#166534', fontWeight: 600 }}>
                        OTP website par popup mein dikhaya jayega.
                      </small>
                    )}
                  </div>

                  {role === 'technician' && (
                    <div className="field">
                      <label htmlFor="technician-login-password">Password</label>
                      <input
                        id="technician-login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || phone.replace(/\D/g, '').length !== 10 || (role === 'technician' && !password)}
                    className="button button-primary button-wide auth-submit-btn"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-icon">🔄</span> {role === 'technician' ? 'Signing in…' : 'Generating OTP…'}
                      </>
                    ) : (
                      role === 'technician' ? 'Login with Mobile + Password 🔑' : 'Get Verification OTP 📲'
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Step 2: 6-Digit Mobile OTP Verification */
              <div className="auth-step-otp">
                <div className="otp-sent-banner">
                  <span>
                    📲 Website popup mein dikhaya OTP enter karein.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('input');
                      setErrorMsg('');
                      setStatusMsg('');
                    }}
                    className="change-email-btn"
                  >
                    Change Number
                  </button>
                </div>

                {/* On-screen Popup/Banner notification for OTP */}
                {popupOtp && (
                  <div
                    className="otp-screen-callout"
                    role="alert"
                    style={{
                      background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)',
                      border: '2px dashed #d4af37',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      margin: '12px 0 16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                      ⚡ Your On-Screen Verification OTP:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '6px', color: '#0b3d2e', fontFamily: 'monospace' }}>
                        {popupOtp}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const digits = popupOtp.split('').slice(0, 6);
                          setOtpDigits(digits);
                          addToast({ title: 'OTP Auto-Filled! ⚡', message: 'Verification code entered.', type: 'info' });
                        }}
                        style={{
                          background: '#0b3d2e',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Auto-Fill
                      </button>
                    </div>
                    <small style={{ fontSize: '11px', color: '#78350f' }}>Direct on-screen access — no SMS wait required.</small>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="auth-form-otp">
                  <label className="otp-input-label">Enter 6-Digit Verification Code</label>
                  <div className="six-digit-boxes-container" onPaste={handlePaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (inputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className={`otp-digit-input ${digit ? 'filled' : ''}`}
                        aria-label={`Digit ${idx + 1}`}
                      />
                    ))}
                  </div>

                  {/* Countdown Timer & Resend */}
                  <div className="otp-resend-countdown-bar">
                    {countdown > 0 ? (
                      <div className="countdown-pill active">
                        <span className="timer-icon">⏳</span>
                        <span>
                          Resend code in <strong>00:{countdown < 10 ? `0${countdown}` : countdown}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="countdown-pill expired">
                        <span>Need a new OTP?</span>
                        <button
                          type="button"
                          disabled={loading || !canResend}
                          onClick={() => handleSendOtp()}
                          className="resend-action-link"
                        >
                          {loading ? 'Generating…' : 'Get New OTP 🔄'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="auth-otp-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => {
                        setStep('input');
                        setErrorMsg('');
                        setStatusMsg('');
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otpDigits.join('').length !== 6}
                      className="button button-primary verify-btn"
                    >
                      {loading ? 'Verifying…' : 'Verify & Continue ✓'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Bottom Signup Link */}
            <div className="auth-bottom-nav">
              <p>
                New to Ghar Sathi?{' '}
                <Link to={role === 'technician' ? '/technician' : '/signup'} state={{ role, phone }} className="auth-link-bold">
                  Create an account
                </Link>
              </p>
            </div>
          </div>

          {/* On-Screen Popup OTP Modal */}
          <OtpPopupModal
            isOpen={popupOpen}
            otp={popupOtp}
            phone={phone}
            title="Customer Verification OTP"
            onClose={() => setPopupOpen(false)}
            onAutoFill={(code) => {
              const digits = code.split('').slice(0, 6);
              setOtpDigits(digits);
            }}
          />
        </div>
      </main>
    </div>
  );
}
