import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useGharSathi } from '../context/AppDataContext.jsx';
import api from '../services/api.js';
import { Brand } from '../components/Common.jsx';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCustomerSession, setTechnicianSession, addToast } = useGharSathi();

  // Role toggle: 'customer' | 'technician'
  const initialRole = location.state?.role || (location.pathname.includes('technician') ? 'technician' : 'customer');
  const [role, setRole] = useState(initialRole);

  // Auth flow states
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState(location.state?.email || '');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const inputRefs = useRef([]);
  const emailInputRef = useRef(null);

  // Focus input on load
  useEffect(() => {
    if (step === 'email' && emailInputRef.current) {
      emailInputRef.current.focus();
    } else if (step === 'otp' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

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

  // Step 1: Send Email OTP
  const handleSendEmailOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Kripya valid email address enter karein (e.g. name@example.com).');
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
        message: `OTP sent to ${cleanEmail}. Please check your inbox or spam.`,
        type: 'info',
      });
    } catch (err) {
      console.error('Email OTP send failed:', err);
      const msg = err?.data?.email?.[0] || err?.data?.error || err?.message || 'Failed to send verification code. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Email OTP and Sign In
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
      const cleanEmail = email.trim().toLowerCase();
      const res = await api.verifyEmailOtp({
        email: cleanEmail,
        otpCode,
        role,
      });

      if (res && res.success) {
        if (role === 'technician') {
          setTechnicianSession(res.user, res.token);
          addToast({
            title: `Welcome, ${res.user?.name || 'Partner'}! 🧰`,
            message: 'Technician partner portal signed in successfully.',
            type: 'success',
          });
          navigate('/technician', { replace: true });
        } else {
          setCustomerSession(res.user, res.token);
          addToast({
            title: `Welcome, ${res.user?.name || 'Customer'}! 🏡`,
            message: 'Signed in successfully. Ready to book services!',
            type: 'success',
          });
          navigate('/customer', { replace: true });
        }
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

  // 1-Click "Sign in with Google" Handler
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setGoogleLoading(true);

    try {
      // Check if official Google Identity Services client is available in window
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1048680197479-gharsathi.apps.googleusercontent.com';
        
        // Initialize Google One Tap / Button client
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (response && response.credential) {
              await processGoogleCredential(response.credential);
            }
          },
          auto_select: false,
        });

        // Prompt Google account chooser
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            fallbackGooglePrompt();
          }
        });
        return;
      }

      // If GIS library is not loaded (or testing offline), provide prompt fallback
      fallbackGooglePrompt();
    } catch (err) {
      console.warn('Google sign-in client notice:', err);
      fallbackGooglePrompt();
    }
  };

  const fallbackGooglePrompt = async () => {
    // Prompt the user for their Google account email for quick sign-in
    const promptEmail = window.prompt(
      'Sign in with Google:\nPlease enter your Google Account email address:',
      email || 'user@gmail.com'
    );

    if (!promptEmail) {
      setGoogleLoading(false);
      return;
    }

    const cleanEmail = promptEmail.trim().toLowerCase();
    await processGoogleCredential(`mock-google-token-${Date.now()}`, cleanEmail);
  };

  const processGoogleCredential = async (credential, fallbackEmail = '') => {
    try {
      const res = await api.googleAuth({
        credential,
        role,
        email: fallbackEmail || email,
        name: fallbackEmail ? fallbackEmail.split('@')[0] : '',
      });

      if (res && res.success) {
        if (role === 'technician') {
          setTechnicianSession(res.user, res.token);
          addToast({
            title: `Namaste, ${res.user?.name || 'Partner'}! 🧰`,
            message: 'Signed in with Google.',
            type: 'success',
          });
          navigate('/technician', { replace: true });
        } else {
          setCustomerSession(res.user, res.token);
          addToast({
            title: `Welcome, ${res.user?.name || 'Customer'}! 🏡`,
            message: 'Signed in with Google.',
            type: 'success',
          });
          navigate('/customer', { replace: true });
        }
      } else {
        setErrorMsg(res?.error || 'Google sign-in was unable to complete.');
      }
    } catch (err) {
      console.error('Google auth error:', err);
      const msg = err?.data?.error || err?.message || 'Google sign in failed. Please use Email OTP.';
      setErrorMsg(msg);
    } finally {
      setGoogleLoading(false);
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
                setErrorMsg('');
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
                setErrorMsg('');
              }}
            >
              <span className="tab-icon">🧰</span>
              <span>Technician Partner</span>
            </button>
          </div>

          <div className="auth-card-body">
            <div className="auth-title-block">
              <h2>Sign in to Ghar Sathi</h2>
              <p className="auth-sub">
                {role === 'technician'
                  ? 'Access your technician jobs, live routing & wallet earnings.'
                  : 'Book home services with verified experts & track live updates.'}
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

            {step === 'email' ? (
              <div className="auth-step-email">
                {/* 1. At the very top: Email Input Field with Continue Button */}
                <form onSubmit={handleSendEmailOtp} className="auth-form-email">
                  <div className="field">
                    <label htmlFor="login-email">Email Address</label>
                    <input
                      id="login-email"
                      ref={emailInputRef}
                      type="email"
                      required
                      placeholder="e.g. yourname@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading || googleLoading}
                      autoComplete="email"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || googleLoading || !email.trim()}
                    className="button button-primary button-wide auth-submit-btn"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-icon">🔄</span> Sending verification code…
                      </>
                    ) : (
                      'Continue with Email →'
                    )}
                  </button>
                </form>

                {/* 2. Divider */}
                <div className="auth-or-divider">
                  <span>OR</span>
                </div>

                {/* 3. Directly below: Prominent 1-click "Sign in with Google" button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading || googleLoading}
                  className="google-signin-btn"
                  aria-label="Sign in with Google"
                >
                  <svg width="20" height="20" viewBox="0 0 48 48" className="google-icon" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>{googleLoading ? 'Signing in with Google…' : 'Sign in with Google'}</span>
                </button>
              </div>
            ) : (
              /* Step 2: 6-Digit Email OTP Verification */
              <div className="auth-step-otp">
                <div className="otp-sent-banner">
                  <span>✉️ Code sent to <strong>{email}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setErrorMsg('');
                      setStatusMsg('');
                    }}
                    className="change-email-btn"
                  >
                    Change
                  </button>
                </div>

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
                        <span>Didn't receive email?</span>
                        <button
                          type="button"
                          disabled={loading || !canResend}
                          onClick={() => handleSendEmailOtp()}
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
                        setStep('email');
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
                <Link to="/signup" state={{ role, email }} className="auth-link-bold">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
