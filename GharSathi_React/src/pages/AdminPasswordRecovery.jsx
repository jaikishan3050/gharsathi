import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api.js';

export default function AdminPasswordRecovery() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const isReset = Boolean(uid && token);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleRequest = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api.requestAdminPasswordReset(email.trim());
      setMessage(response?.message || 'If an active admin account uses that email, a reset link has been sent.');
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Reset email could not be sent. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.resetAdminPassword({ uid, token, newPassword: password });
      setMessage(response?.message || 'Password updated. You can sign in now.');
      setTimeout(() => navigate('/admin', { replace: true }), 1800);
    } catch (err) {
      setError(err?.data?.error || err?.message || 'This reset link is invalid or expired. Request a new one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-gate-page">
      <section className="admin-gate-card" aria-labelledby="admin-recovery-title">
        <div className="role-gate-brand">
          <img src="/images/gharsathi-logo.png" alt="Ghar Sathi" className="gate-logo-img" />
          <span>Ghar <em>Sathi</em></span>
        </div>
        <p className="eyebrow eyebrow-gold">SUPER ADMIN CONSOLE</p>
        <h1 id="admin-recovery-title">{isReset ? 'Choose a new password' : 'Reset admin password'}</h1>
        <p className="gate-subtitle">
          {isReset
            ? 'Set a new password with at least 12 characters.'
            : 'We’ll email a secure password reset link to the admin account.'}
        </p>

        {error && <div className="warning-notice" role="alert">{error}</div>}
        {message && <div className="success-banner" role="status">{message}</div>}

        {isReset ? (
          <form onSubmit={handleReset} className="admin-login-form">
            <label className="field-block">
              <span>New password</span>
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="field-block">
              <span>Confirm new password</span>
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <button className="button button-gold button-wide" type="submit" disabled={busy}>
              {busy ? 'Updating password…' : 'Save new password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequest} className="admin-login-form">
            <label className="field-block">
              <span>Admin email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
              />
            </label>
            <button className="button button-gold button-wide" type="submit" disabled={busy}>
              {busy ? 'Sending reset link…' : 'Email me a reset link'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <Link to="/admin" className="back-link">← Back to Admin Login</Link>
        </div>
      </section>
    </main>
  );
}
