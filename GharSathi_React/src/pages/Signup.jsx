import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useGharSathi } from '../context/AppDataContext.jsx';
import api from '../services/api.js';
import { Brand } from '../components/Common.jsx';
import { areas } from '../data/services.js';

const TECHNICIAN_SKILLS = [
  'AC Repair & Servicing',
  'Electrician & Wiring',
  'Plumbing & Water Tanks',
  'Washing Machine & Fridge',
  'House Painting & Waterproofing',
  'Deep Cleaning & Pest Control',
  'Carpentry & Furniture Repair',
];

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCustomerSession, setTechnicianSession, addToast } = useGharSathi();

  // Role: 'customer' | 'technician'
  const initialRole = location.state?.role || (location.pathname.includes('technician') ? 'technician' : 'customer');
  const [role, setRole] = useState(initialRole);

  // Flow step: 'form' | 'otp'
  const [step, setStep] = useState('form');

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: location.state?.email || '',
    phone: '',
    area: areas[0] || 'Maner',
    address: '',
    pincode: '801103',
    skills: TECHNICIAN_SKILLS[0],
  });

  // OTP Verification state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const inputRefs = useRef([]);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (step === 'form' && nameInputRef.current) {
      nameInputRef.current.focus();
    } else if (step === 'otp' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // 60-second countdown timer for resend
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Step 1: Validate Fields & Send Email OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    // Name validation
    if (!formData.name.trim()) {
      setErrorMsg('Apna poora naam enter karein.');
      return;
    }

    // Email validation
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Kripya valid email address enter karein (e.g. name@example.com).');
      return;
    }

    // Phone validation (10-digit Indian mobile)
    const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMsg('Kripya valid 10-digit Indian mobile number enter karein (starting with 6-9).');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendEmailOtp(cleanEmail, role);
      setStatusMsg(res?.message || `6-digit verification code sent to ${cleanEmail}`);
      setStep('otp');
      setCountdown(60);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);
      addToast({
        title: 'Verification Code Sent! ✉️',
        message: `OTP sent to ${cleanEmail}. Enter it below to complete signup.`,
        type: 'info',
      });
    } catch (err) {
      console.error('Email OTP request failed:', err);
      const msg = err?.data?.email?.[0] || err?.data?.error || err?.message || 'Failed to send verification code. Please check your email.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Email OTP & Register Account
  const handleVerifyAndSignup = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const otpCode = otpDigits.join('').trim();
    if (otpCode.length !== 6) {
      setErrorMsg('Kripya poora 6-digit OTP enter karein.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10);

      const res = await api.verifyEmailOtp({
        email: cleanEmail,
        otpCode,
        phone: cleanPhone,
        role,
        name: formData.name.trim(),
        area: formData.area,
        address: formData.address.trim(),
        pincode: formData.pincode.trim() || '801103',
        skills: role === 'technician' ? formData.skills : '',
      });

      if (res && res.success) {
        if (role === 'technician') {
          setTechnicianSession(res.user, res.token);
          addToast({
            title: 'Partner Registration Successful! 🎉',
            message: `Welcome aboard, ${formData.name}! Wallet balance initialized to ₹0.00.`,
            type: 'success',
          });
          navigate('/technician', { replace: true });
        } else {
          setCustomerSession(res.user, res.token);
          addToast({
            title: 'Welcome to Ghar Sathi! 🎉',
            message: `Account created for ${formData.name}. Enjoy verified home services!`,
            type: 'success',
          });
          navigate('/customer', { replace: true });
        }
      } else {
        setErrorMsg(res?.error || 'Registration failed. Please check OTP and try again.');
      }
    } catch (err) {
      console.error('Signup OTP verify error:', err);
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

      {/* Main Centered Signup Card */}
      <main className="auth-card-container">
        <div className="auth-card auth-card-wide">
          {/* Role Switcher */}
          <div className="auth-role-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={role === 'customer'}
              className={`auth-role-tab ${role === 'customer' ? 'active' : ''}`}
              onClick={() => {
                setRole('customer');
                setErrorMsg('');
              }}
            >
              <span className="tab-icon">🏡</span>
              <span>Customer Signup</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'technician'}
              className={`auth-role-tab ${role === 'technician' ? 'active' : ''}`}
              onClick={() => {
                setRole('technician');
                setErrorMsg('');
              }}
            >
              <span className="tab-icon">🧰</span>
              <span>Technician Partner Signup</span>
            </button>
          </div>

          <div className="auth-card-body">
            <div className="auth-title-block">
              <h2>{role === 'technician' ? 'Become a Verified Service Partner' : 'Create Your Customer Account'}</h2>
              <p className="auth-sub">
                {role === 'technician'
                  ? 'Join Bihar\'s fastest growing home service network. Get direct job dispatches & 0% hidden fee.'
                  : 'Fast doorstep services across Patna, Danapur, Bihta, Maner & Ara with 100% verified experts.'}
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
                <span className="alert-icon">✉️</span>
                <span>{statusMsg}</span>
              </div>
            )}

            {step === 'form' ? (
              /* Step 1: User Registration Details */
              <form onSubmit={handleRequestOtp} className="signup-fields-grid">
                <div className="field">
                  <label htmlFor="signup-name">Full Name *</label>
                  <input
                    id="signup-name"
                    ref={nameInputRef}
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>

                <div className="field">
                  <label htmlFor="signup-email">Email Address (For Verification OTP) *</label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    placeholder="e.g. ramesh@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <div className="field">
                  <label htmlFor="signup-phone">Mobile Number (10 Digits) *</label>
                  <div className="phone-input-wrap">
                    <span className="phone-prefix">+91</span>
                    <input
                      id="signup-phone"
                      name="phone"
                      type="tel"
                      required
                      placeholder="9876543210"
                      maxLength="10"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={loading}
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="signup-area">Service Area / City *</label>
                  <select
                    id="signup-area"
                    name="area"
                    value={formData.area}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    {areas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                {role === 'technician' && (
                  <div className="field field-full">
                    <label htmlFor="signup-skills">Primary Skill / Service Category *</label>
                    <select
                      id="signup-skills"
                      name="skills"
                      value={formData.skills}
                      onChange={handleChange}
                      disabled={loading}
                    >
                      {TECHNICIAN_SKILLS.map((skill) => (
                        <option key={skill} value={skill}>
                          {skill}
                        </option>
                      ))}
                    </select>
                    <small className="field-hint">
                      ℹ️ Note: All newly registered partner accounts strictly start with ₹0.00 wallet balance.
                    </small>
                  </div>
                )}

                <div className="field field-full">
                  <label htmlFor="signup-address">Local Address / Landmark</label>
                  <input
                    id="signup-address"
                    name="address"
                    type="text"
                    placeholder="e.g. Main Road, Near Market, Maner"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>

                <div className="signup-action-row">
                  <button
                    type="submit"
                    disabled={loading || !formData.email.trim() || !formData.phone.trim() || !formData.name.trim()}
                    className="button button-primary button-wide auth-submit-btn"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-icon">🔄</span> Sending Verification Code…
                      </>
                    ) : (
                      'Send Verification Code to Email →'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Email OTP Entry */
              <div className="auth-step-otp">
                <div className="otp-sent-banner">
                  <span>
                    ✉️ Enter 6-digit code sent to <strong>{formData.email}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setErrorMsg('');
                      setStatusMsg('');
                    }}
                    className="change-email-btn"
                  >
                    Edit Details
                  </button>
                </div>

                <form onSubmit={handleVerifyAndSignup} className="auth-form-otp">
                  <label className="otp-input-label">Email Verification Code</label>
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
                        <span>Didn't receive email?</span>
                        <button
                          type="button"
                          disabled={loading || !canResend}
                          onClick={() => handleRequestOtp()}
                          className="resend-action-link"
                        >
                          {loading ? 'Resending…' : 'Resend Email OTP 🔄'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="auth-otp-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => {
                        setStep('form');
                        setErrorMsg('');
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otpDigits.join('').length !== 6}
                      className="button button-primary verify-btn"
                    >
                      {loading ? 'Verifying & Creating…' : 'Verify & Create Account ✓'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Bottom Nav */}
            <div className="auth-bottom-nav">
              <p>
                Already have an account?{' '}
                <Link to="/login" state={{ role }} className="auth-link-bold">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
