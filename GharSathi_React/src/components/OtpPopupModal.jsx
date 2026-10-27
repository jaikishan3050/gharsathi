import { useState } from 'react';

export default function OtpPopupModal({
  isOpen,
  otp,
  phone = '',
  onClose,
  onAutoFill,
  title = 'Technician Verification OTP',
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !otp) return null;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAutoFillAndClose = () => {
    if (onAutoFill) {
      onAutoFill(otp);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 100000 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '440px',
          width: '92%',
          borderRadius: '20px',
          border: '2px solid #d4af37',
          boxShadow: '0 24px 60px rgba(11, 61, 46, 0.35)',
          overflow: 'hidden',
          animation: 'cardFadeUp 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0b3d2e 0%, #16523e 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🔔</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#ffffff', fontWeight: 800 }}>{title}</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#d4af37', fontWeight: 600 }}>
                Direct On-Screen Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              fontSize: '20px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 24px 28px', textAlign: 'center', background: '#ffffff' }}>
          <p style={{ fontSize: '13px', color: '#4b5563', margin: '0 0 14px' }}>
            {phone ? (
              <>
                Mobile Number: <strong>+91 {phone.slice(-10)}</strong>
              </>
            ) : (
              'Use the verification OTP below to complete your login / signup:'
            )}
          </p>

          <div
            style={{
              background: '#fefce8',
              border: '2px dashed #d4af37',
              borderRadius: '16px',
              padding: '18px 12px',
              margin: '0 auto 18px',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#854d0e', fontWeight: 800, marginBottom: '6px' }}>
              Your Verification OTP is:
            </div>
            <div
              style={{
                fontSize: '34px',
                fontWeight: 900,
                letterSpacing: '8px',
                color: '#0b3d2e',
                fontFamily: 'monospace, sans-serif',
                textShadow: '0 2px 4px rgba(0,0,0,0.06)',
              }}
            >
              {otp}
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
            ⚡ <em>Generated instantly on-screen. Valid for 5 minutes without any external SMS gateway delay.</em>
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              className="button button-gold"
              onClick={handleAutoFillAndClose}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '12px',
              }}
            >
              ⚡ Auto-Fill & Proceed
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={handleCopy}
              style={{
                padding: '12px 18px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '12px',
              }}
            >
              {copied ? '✓ Copied!' : '📋 Copy OTP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
