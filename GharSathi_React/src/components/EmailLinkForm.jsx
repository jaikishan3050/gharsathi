import { useState } from 'react';
import api from '../services/api.js';

/**
 * Requires an existing authenticated customer session.
 * An email is never saved to the profile until its challenge is confirmed.
 */
export default function EmailLinkForm({ currentEmail = '', emailVerified = false, onLinked }) {
  const [email, setEmail] = useState(currentEmail);
  const [verifiedEmail, setVerifiedEmail] = useState(emailVerified ? currentEmail : '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const normalized = email.trim().toLowerCase();
      await api.linkCustomerEmail(normalized, sent ? code.trim() : '');
      if (sent) {
        setMessage('Email verified and linked successfully. You can now use Email OTP login.');
        setSent(false);
        setCode('');
        setVerifiedEmail(normalized);
        onLinked?.(normalized);
      } else {
        setSent(true);
        setMessage('6-digit verification code sent to your email.');
      }
    } catch (err) {
      setError(err.message || 'Unable to verify email. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form-card narrow-form" aria-label="Verify and link email" style={{ marginTop: '20px' }}>
      <h3>Verify Email for OTP Login</h3>
      <p>Apne existing account ke liye email verify karein. Email OTP login tabhi available hoga.</p>
      <p role="status">{verifiedEmail && verifiedEmail === email.trim().toLowerCase()
        ? '✓ Email verified — Email OTP login enabled for this account.'
        : 'Email not verified — Email OTP login unavailable until verification.'}</p>
      <form onSubmit={submit}>
        <div className="field-block">
          <label className="field-label" htmlFor="customer-link-email">Email address</label>
          <input id="customer-link-email" type="email" className="modal-form-input"
            required autoComplete="email" value={email} disabled={busy || sent}
            onChange={(event) => setEmail(event.target.value)} />
        </div>
        {sent && (
          <div className="field-block">
            <label className="field-label" htmlFor="customer-link-code">6-digit email code</label>
            <input id="customer-link-code" className="modal-form-input" type="text"
              inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required
              autoComplete="one-time-code" value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          </div>
        )}
        {error && <p role="alert" className="warning-notice">{error}</p>}
        {message && <p role="status" className="success-text">{message}</p>}
        <button className="button button-primary" type="submit" disabled={busy || (sent && code.length !== 6)}>
          {busy ? 'Please wait…' : sent ? 'Verify & Link Email' : 'Send Email Verification Code'}
        </button>
        {sent && <button type="button" className="button button-outline" onClick={() => {
          setSent(false); setCode(''); setError(''); setMessage('');
        }}>Change Email</button>}
      </form>
    </section>
  );
}
