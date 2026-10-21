import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import { areas } from '../data/services.js';

export default function OtpModal({
  isOpen,
  onClose,
  initialPhone = '',
  role = 'customer',
  defaultMode = 'login', // 'login' | 'signup'
  onSuccess,
}) {
  const [tab, setTab] = useState(defaultMode); // 'login' | 'signup'
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState(initialPhone || '');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [debugOtp, setDebugOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Signup fields
  const [signupData, setSignupData] = useState({
    name: '',
    area: areas[0],
    pincode: '801103',
    address: '',
  });

  const inputRefs = useRef([]);

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab(defaultMode);
      setStep(initialPhone ? 'phone' : 'phone');
      setPhone(initialPhone || '');
      setOtpDigits(['', '', '', '', '', '']);
      setErrorMsg('');
      setStatusMsg('');
      setLoading(false);
    }
  }, [isOpen, defaultMode, initialPhone]);

  // Real-time 60-Second Countdown Timer
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

  if (!isOpen) return null;

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  // Send OTP Handler
  const handleSendOtp = async (isResend = false) => {
    setErrorMsg('');
    setStatusMsg('');

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMsg('Kripya valid 10-digit Indian mobile number (starting with 6-9) daalein.');
      return;
    }

    if (tab === 'signup') {
      if (!signupData.name.trim()) {
        setErrorMsg('Apna poora naam enter karein.');
        return;
      }
      if (!signupData.pincode.trim() || signupData.pincode.length < 6) {
        setErrorMsg('Valid 6-digit Pincode enter karein.');
        return;
      }
      if (!signupData.address.trim()) {
        setErrorMsg('Apna poora address enter karein.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.sendOtp(cleanPhone, role);
      setLoading(false);
      setStep('otp');
      setCountdown(60);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);

      if (res.debug_otp) {
        setDebugOtp(res.debug_otp);
      } else {
        setDebugOtp('');
      }

      setStatusMsg(
        isResend
          ? `Naya OTP mobile +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)} par bhej diya gaya hai!`
          : `OTP verification code mobile +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)} par bhej diya gaya hai.`
      );

      // Auto focus first OTP input after switching
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 150);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'OTP send karne mein dikkat aayi. Kripya punah prayas karein.');
    }
  };

  // Handle OTP digit changes with auto-advance and backspace
  const handleDigitChange = (index, value) => {
    const val = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = val;
    setOtpDigits(newDigits);
    setErrorMsg('');

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
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
    if (pasted) {
      const newDigits = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleAutoFillDebug = () => {
    const code = debugOtp || '123456';
    const newDigits = code.split('').slice(0, 6);
    while (newDigits.length < 6) newDigits.push('');
    setOtpDigits(newDigits);
    inputRefs.current[5]?.focus();
  };

  // Verify OTP Handler
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    const fullOtp = otpDigits.join('');

    if (fullOtp.length !== 6) {
      setErrorMsg('Kripya poora 6-digit OTP code enter karein.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp({
        phoneNumber: cleanPhone,
        otpCode: fullOtp,
        role,
        name: signupData.name,
        area: signupData.area,
        address: signupData.address,
        pincode: signupData.pincode,
      });

      setLoading(false);
      if (onSuccess) {
        onSuccess({
          ...res,
          phone: cleanPhone,
          name: signupData.name || res.user?.name || `Customer ${cleanPhone.slice(-4)}`,
          area: signupData.area || res.user?.area || 'Patna to Danapur',
          address: signupData.address || res.user?.address || '',
          pincode: signupData.pincode || res.user?.pincode || '801103',
        });
      }
      onClose();
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'OTP verification failed. Check the code and try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card auth-modal-card otp-modal-wrapper" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <p className="eyebrow eyebrow-gold">
              {role.toUpperCase()} AUTHENTICATION · REAL-TIME SMS OTP
            </p>
            <h3>
              {step === 'phone'
                ? tab === 'login'
                  ? 'Login with Mobile OTP'
                  : 'New Customer Registration'
                : 'Enter 6-Digit Verification Code'}
            </h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Tab switch only visible on phone step */}
        {step === 'phone' && (
          <div className="auth-tab-switch">
            <button
              type="button"
              className={`tab-switch-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setTab('login');
                setErrorMsg('');
              }}
            >
              OTP Login
            </button>
            <button
              type="button"
              className={`tab-switch-btn ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setTab('signup');
                setErrorMsg('');
              }}
            >
              New Registration
            </button>
          </div>
        )}

        {/* Error / Status notices */}
        {errorMsg && <div className="warning-notice" style={{ marginTop: '12px' }}>⚠️ {errorMsg}</div>}
        {statusMsg && <div className="success-banner" style={{ marginTop: '12px' }}>✓ {statusMsg}</div>}

        {/* STEP 1: ENTER PHONE & DETAILS */}
        {step === 'phone' && (
          <div className="auth-form-body">
            {tab === 'login' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendOtp(false);
                }}
              >
                <p className="auth-intro">
                  Apna 10-digit mobile number enter karein. Transactional SMS ke zariye 6-digit OTP code bheja jayega.
                </p>

                <div className="field-block">
                  <label className="field-label">
                    Mobile Number <span className="req">*</span>
                  </label>
                  <div className="phone-prefix-input-wrap">
                    <span className="phone-prefix-badge">🇮🇳 +91</span>
                    <input
                      type="tel"
                      required
                      maxLength="10"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="e.g. 9876543210"
                      className="phone-styled-input"
                      autoFocus
                    />
                  </div>
                  <small className="field-hint">Demo test accounts: 9876543210 (Ramesh), 9811223344 (Anita)</small>
                </div>

                <button
                  type="submit"
                  disabled={loading || cleanPhone.length !== 10}
                  className="button button-gold button-wide"
                  style={{ marginTop: '20px' }}
                >
                  {loading ? 'Sending OTP SMS…' : 'Send 6-Digit OTP 📲'}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendOtp(false);
                }}
              >
                <p className="auth-intro">
                  Ghar Sathi par naya account banane ke liye details enter karein aur mobile OTP verify karein.
                </p>

                <div className="field-block">
                  <label className="field-label">
                    Full Name <span className="req">*</span>
                  </label>
                  <input
                    required
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    placeholder="Apna poora naam"
                  />
                </div>

                <div className="field-block">
                  <label className="field-label">
                    Mobile Number <span className="req">*</span>
                  </label>
                  <div className="phone-prefix-input-wrap">
                    <span className="phone-prefix-badge">🇮🇳 +91</span>
                    <input
                      type="tel"
                      required
                      maxLength="10"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit Indian number"
                      className="phone-styled-input"
                    />
                  </div>
                </div>

                <div className="field-grid-2col">
                  <div className="field-block">
                    <label className="field-label">Service Area</label>
                    <select
                      value={signupData.area}
                      onChange={(e) => setSignupData({ ...signupData, area: e.target.value })}
                    >
                      {areas.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-block">
                    <label className="field-label">Pincode</label>
                    <input
                      required
                      maxLength="6"
                      value={signupData.pincode}
                      onChange={(e) =>
                        setSignupData({ ...signupData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })
                      }
                      placeholder="e.g. 801103"
                    />
                  </div>
                </div>

                <div className="field-block">
                  <label className="field-label">Address</label>
                  <textarea
                    rows="2"
                    required
                    value={signupData.address}
                    onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                    placeholder="House/Flat No, Street, Landmark..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || cleanPhone.length !== 10}
                  className="button button-gold button-wide"
                  style={{ marginTop: '16px' }}
                >
                  {loading ? 'Sending OTP…' : 'Verify Mobile with OTP 📲'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: 6-DIGIT OTP VERIFICATION */}
        {step === 'otp' && (
          <div className="auth-form-body">
            <div className="otp-verification-banner">
              <span className="otp-shield-icon">🛡️</span>
              <div className="otp-header-info">
                <strong>OTP sent to +91 {cleanPhone.slice(0, 2)}******{cleanPhone.slice(-2)}</strong>
                <p>Kripya apne SMS inbox mein praapt 6-digit verification code daalein.</p>
              </div>
            </div>

            {/* Subtle Sandbox / Debug Hint */}
            {debugOtp && (
              <div className="otp-demo-hint-strip">
                <span className="hint-pill">SANDBOX HINT</span>
                <span>
                  Demo SMS OTP: <strong>{debugOtp}</strong>
                </span>
                <button
                  type="button"
                  className="autofill-btn"
                  onClick={handleAutoFillDebug}
                  title="Auto-fill 6-digit OTP code"
                >
                  Auto-fill Code ⚡
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="otp-form-content">
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

              {/* Countdown & Resend Section */}
              <div className="otp-resend-countdown-bar">
                {countdown > 0 ? (
                  <div className="countdown-pill active">
                    <span className="timer-icon">⏳</span>
                    <span>
                      Resend OTP in <strong>00:{countdown < 10 ? `0${countdown}` : countdown}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="countdown-pill expired">
                    <span>Code not received?</span>
                    <button
                      type="button"
                      disabled={loading || !canResend}
                      onClick={() => handleSendOtp(true)}
                      className="resend-action-link"
                    >
                      {loading ? 'Resending…' : 'Resend SMS OTP 🔄'}
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="otp-modal-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    setStep('phone');
                    setErrorMsg('');
                    setStatusMsg('');
                  }}
                >
                  ← Change Number
                </button>
                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6}
                  className="button button-primary verify-btn"
                >
                  {loading ? 'Verifying OTP…' : 'Verify & Continue ✓'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
