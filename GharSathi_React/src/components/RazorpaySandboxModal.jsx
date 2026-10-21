import React, { useState } from 'react';

export default function RazorpaySandboxModal({
  isOpen,
  onClose,
  orderData,
  onSuccess,
  onFailure,
}) {
  const [activeTab, setActiveTab] = useState('upi'); // 'upi' | 'card' | 'netbanking'
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [processing, setProcessing] = useState(false);
  const [simulatedCardNumber, setSimulatedCardNumber] = useState('4111 2222 3333 4242');
  const [simulatedExpiry, setSimulatedExpiry] = useState('12/28');
  const [simulatedCvv, setSimulatedCvv] = useState('888');

  if (!isOpen || !orderData) return null;

  const totalAmount = orderData.amount_in_rupees || (orderData.amount ? orderData.amount / 100 : 0);
  const platformFee = orderData.platform_fee || 149;
  const serviceBasePrice = Math.max(0, totalAmount - platformFee);
  const orderId = orderData.order_id || `order_demo_${Date.now()}`;

  const handleSimulatePayment = (isSuccess = true) => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      if (isSuccess) {
        const paymentId = `pay_demo_${Date.now().toString().slice(-8)}_${Math.floor(Math.random() * 1000)}`;
        const signature = `simulated_sandbox_signature_${Date.now()}`;
        onSuccess({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });
      } else {
        if (onFailure) {
          onFailure({
            error: {
              code: 'BAD_REQUEST_ERROR',
              description: 'Payment was cancelled or failed in sandbox simulation.',
            },
          });
        }
        onClose();
      }
    }, 900);
  };

  return (
    <div className="rzp-sandbox-overlay" onClick={onClose}>
      <div className="rzp-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Razorpay Brand Header */}
        <div className="rzp-brand-header">
          <div className="rzp-brand-left">
            <div className="rzp-logo-badge">
              <span className="rzp-r-symbol">R</span>
              <div className="rzp-brand-names">
                <strong>Razorpay</strong>
                <span className="rzp-sandbox-pill">SANDBOX DEMO</span>
              </div>
            </div>
            <div className="rzp-merchant-info">
              <h4>Ghar Sathi Home Services</h4>
              <small>Order Ref: {orderId}</small>
            </div>
          </div>

          <button type="button" className="rzp-close-btn" onClick={onClose} aria-label="Cancel Payment">
            ✕
          </button>
        </div>

        {/* Amount Breakdown Strip */}
        <div className="rzp-amount-summary-strip">
          <div className="rzp-amount-item">
            <span>Service Base</span>
            <strong>₹{serviceBasePrice.toLocaleString('en-IN')}</strong>
          </div>
          <span className="rzp-plus-sign">+</span>
          <div className="rzp-amount-item">
            <span>Platform Fee</span>
            <strong className="rzp-gold-fee">₹{platformFee}</strong>
          </div>
          <span className="rzp-equals-sign">=</span>
          <div className="rzp-amount-total">
            <span>Payable Amount</span>
            <h2>₹{totalAmount.toLocaleString('en-IN')}</h2>
          </div>
        </div>

        {/* Payment Method Selector Tabs */}
        <div className="rzp-method-tabs">
          <button
            type="button"
            className={`rzp-tab-btn ${activeTab === 'upi' ? 'active' : ''}`}
            onClick={() => setActiveTab('upi')}
          >
            <span>📱</span> UPI / QR
          </button>
          <button
            type="button"
            className={`rzp-tab-btn ${activeTab === 'card' ? 'active' : ''}`}
            onClick={() => setActiveTab('card')}
          >
            <span>💳</span> Cards
          </button>
          <button
            type="button"
            className={`rzp-tab-btn ${activeTab === 'netbanking' ? 'active' : ''}`}
            onClick={() => setActiveTab('netbanking')}
          >
            <span>🏦</span> Netbanking
          </button>
        </div>

        {/* Tab Body */}
        <div className="rzp-tab-content">
          {activeTab === 'upi' && (
            <div className="rzp-upi-view">
              <p className="rzp-section-hint">Select your preferred UPI app or scan the demo QR code:</p>
              
              <div className="rzp-upi-apps-grid">
                {[
                  { id: 'gpay', name: 'Google Pay', icon: '🟢' },
                  { id: 'phonepe', name: 'PhonePe', icon: '🟣' },
                  { id: 'paytm', name: 'Paytm', icon: '🔵' },
                  { id: 'bhim', name: 'BHIM UPI', icon: '🟠' },
                ].map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className={`rzp-upi-app-card ${selectedUpiApp === app.id ? 'selected' : ''}`}
                    onClick={() => setSelectedUpiApp(app.id)}
                  >
                    <span className="upi-app-icon">{app.icon}</span>
                    <strong className="upi-app-name">{app.name}</strong>
                  </button>
                ))}
              </div>

              <div className="rzp-qr-sim-box">
                <div className="rzp-qr-code-graphic">
                  <span className="qr-sim-icon">🏁</span>
                  <small>UPI QR SIMULATION</small>
                </div>
                <div className="rzp-qr-instructions">
                  <strong>UPI ID: gharsathi@razorpay</strong>
                  <small>Tap "Pay with {selectedUpiApp.toUpperCase()}" below to complete instant sandbox checkout.</small>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'card' && (
            <div className="rzp-card-view">
              <p className="rzp-section-hint">Pre-filled with Sandbox Test Credentials (Visa / RuPay):</p>
              <div className="rzp-card-inputs">
                <div className="rzp-input-field">
                  <label>Card Number</label>
                  <input
                    type="text"
                    value={simulatedCardNumber}
                    onChange={(e) => setSimulatedCardNumber(e.target.value)}
                  />
                </div>
                <div className="rzp-card-row-split">
                  <div className="rzp-input-field">
                    <label>Valid Thru</label>
                    <input
                      type="text"
                      value={simulatedExpiry}
                      onChange={(e) => setSimulatedExpiry(e.target.value)}
                    />
                  </div>
                  <div className="rzp-input-field">
                    <label>CVV</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={simulatedCvv}
                      onChange={(e) => setSimulatedCvv(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'netbanking' && (
            <div className="rzp-netbanking-view">
              <p className="rzp-section-hint">Choose any Indian Bank for instant payment simulation:</p>
              <div className="rzp-banks-grid">
                {['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Punjab National Bank'].map(
                  (bank, idx) => (
                    <div key={bank} className={`rzp-bank-card ${idx === 0 ? 'selected' : ''}`}>
                      <span>🏛️</span>
                      <strong>{bank}</strong>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="rzp-modal-footer">
          <div className="rzp-security-assurance">
            <span>🔒</span>
            <small>256-bit SSL Encrypted • PCI-DSS Certified</small>
          </div>

          <div className="rzp-footer-buttons">
            <button
              type="button"
              className="rzp-btn-fail"
              onClick={() => handleSimulatePayment(false)}
              disabled={processing}
              title="Test payment failure workflow"
            >
              Simulate Failure
            </button>
            <button
              type="button"
              className="rzp-btn-pay"
              onClick={() => handleSimulatePayment(true)}
              disabled={processing}
            >
              {processing ? (
                <span>⏳ Processing ₹{totalAmount}...</span>
              ) : (
                <span>✓ Pay ₹{totalAmount.toLocaleString('en-IN')} (Success)</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
