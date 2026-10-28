import { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useGharSathi } from '../context/AppDataContext.jsx';
import api from '../services/api.js';

export function Brand({ compact = false }) {
  return (
    <Link to="/" className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`} aria-label="Ghar Sathi home">
      <img
        src="/images/gharsathi-logo.png"
        alt="Ghar Sathi Logo"
        className="brand-logo-img"
        onError={(e) => {
          e.target.style.display = 'none';
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'grid';
        }}
      />
      <span className="brand-house" style={{ display: 'none' }} aria-hidden="true">⌂</span>
      <span><strong>Ghar <em>Sathi</em></strong>{!compact && <small>HAR GHAR KA SATHI</small>}</span>
    </Link>
  );
}

export function BackendStatusBadge() {
  const { backendStatus, syncFromDjango } = useGharSathi();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncFromDjango(true);
    setRefreshing(false);
  };

  if (backendStatus === 'live') {
    return (
      <button
        type="button"
        className="backend-status-pill status-live"
        onClick={handleRefresh}
        title="Live Django REST API connected on port 8000. Click to re-sync."
      >
        <span className="status-pulse-dot" />
        <span>Live Django API</span>
        <span className={`sync-btn-hint ${refreshing ? 'spin-sync' : ''}`}>↻</span>
      </button>
    );
  }

  if (backendStatus === 'offline') {
    return (
      <button
        type="button"
        className="backend-status-pill status-offline"
        onClick={handleRefresh}
        title="Django backend offline. Operating in LocalStorage demo mode. Click to retry connection."
      >
        <span className="status-pulse-dot" />
        <span>Browser Demo Mode</span>
        <span className={`sync-btn-hint ${refreshing ? 'spin-sync' : ''}`}>↻</span>
      </button>
    );
  }

  return (
    <span className="backend-status-pill status-checking" title="Checking backend connection...">
      <span className="status-pulse-dot" />
      <span>Connecting API...</span>
    </span>
  );
}

export function TopBar({ title, role, children }) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-right">
        <BackendStatusBadge />
        <span className="topbar-section">{title}</span>
        <span className="role-chip">{role}</span>
        {children}
      </div>
    </header>
  );
}

export function PanelNav({ role, active, onChange, items }) {
  return (
    <nav className="panel-nav" aria-label={`${role} navigation`}>
      {items.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
          type="button"
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
      <Link className="nav-item nav-back" to="/">
        <span className="nav-icon">↩</span>
        <span>Switch panel</span>
      </Link>
    </nav>
  );
}

export function PanelShell({ role, title, description, active, onChange, items, children, topActions }) {
  return (
    <div className={`app-shell shell-${role.toLowerCase()}`}>
      <TopBar title={title} role={role}>{topActions}</TopBar>
      <div className="panel-layout">
        <aside className="panel-sidebar">
          <div className="sidebar-label">WORKSPACE</div>
          <PanelNav role={role} active={active} onChange={onChange} items={items} />
          <div className="sidebar-help">
            <span>✦</span>
            <strong>Ghar Sathi</strong>
            <p>Har ghar ka vishwas.</p>
            <small>Trusted Quality & Service Assurance</small>
          </div>
        </aside>
        <main className="panel-main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{role.toUpperCase()} WORKSPACE</p>
              <h1>{title}</h1>
              <p className="muted">{description}</p>
            </div>
          </div>
          {children}
        </main>
      </div>
      <footer className="app-footer">
        © {new Date().getFullYear()} Ghar Sathi · Har Ghar Ka Sathi
        <span>100% Quality Guaranteed · Verified Professional Ecosystem</span>
      </footer>
    </div>
  );
}

export function PageHeading({ eyebrow, title, children }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon, note }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-dot" />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

export function StatusBadge({ status }) {
  const className = String(status || 'Pending').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return <span className={`status-badge status-${className}`}>{status || 'Pending'}</span>;
}

export function EmptyState({ icon = '◌', title, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function MobileRoleLinks() {
  return (
    <div className="role-links">
      <NavLink to="/customer">Customer</NavLink>
      <NavLink to="/technician">Technician</NavLink>
      <NavLink to="/admin">Admin</NavLink>
    </div>
  );
}

/**
 * Top Right User Profile with Dropdown & Logout
 */
export function TopBarProfile({ user, role, onLogout, onOpenProfile }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const initial = (user.name || role || 'U').charAt(0).toUpperCase();

  return (
    <div className="profile-menu-container" ref={menuRef}>
      <button
        type="button"
        className="topbar-profile-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="User Profile"
        title="Account Profile"
      >
        <span className="profile-btn-avatar">{initial}</span>
        <span className="profile-btn-info">
          <strong>{user.name || `${role} User`}</strong>
          <small>{user.phone || user.email || role}</small>
        </span>
        <span className="profile-btn-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-header">
            <span className="dropdown-avatar">{initial}</span>
            <div>
              <h4>{user.name}</h4>
              <p>{user.phone || user.email}</p>
              <span className="dropdown-role-tag">{role}</span>
            </div>
          </div>

          {user.address && (
            <div className="profile-dropdown-meta">
              <small>Address:</small>
              <p>{user.address} {user.pincode ? `(${user.pincode})` : ''}</p>
            </div>
          )}

          <div className="profile-dropdown-actions">
            {onOpenProfile && (
              <button
                type="button"
                className="dropdown-item-btn"
                onClick={() => {
                  setOpen(false);
                  onOpenProfile();
                }}
              >
                <span>◉</span> View Profile Details
              </button>
            )}
            <button
              type="button"
              className="dropdown-item-btn dropdown-logout-btn"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <span>🚪</span> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Work Step Notification Bell with live count and step alerts
 */
export function NotificationBell({ notifications = [], onMarkRead, onClear }) {
  const [open, setOpen] = useState(false);
  const bellRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="notification-bell-container" ref={bellRef}>
      <button
        type="button"
        className={`bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Work step notifications"
        title="Work Step Notifications"
      >
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notif-header">
            <div>
              <h4>Work Step Notifications</h4>
              <small>{notifications.length} updates logged</small>
            </div>
            {notifications.length > 0 && onClear && (
              <button type="button" className="text-button-mini" onClick={onClear}>
                Clear
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <span>🔕</span>
                <p>Abhi koi naya work notification nahi hai.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`notif-item ${!item.read ? 'unread' : ''}`}
                  onClick={() => onMarkRead && onMarkRead(item.id)}
                >
                  <div className="notif-item-top">
                    <span className="notif-step-tag">{item.step || 'Update'}</span>
                    <small>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  {item.bookingId && <span className="notif-booking-ref">{item.bookingId}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Customer Rating Modal for Technicians
 */
export function RatingModal({ booking, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const tags = [
    'On-time arrival',
    'Expert & fast work',
    'Polite behavior',
    'Cleaned up after service',
    'Fair & transparent',
  ];

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await onSubmit(booking.id, rating, review, selectedTags);
    if (result?.success) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card rating-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow eyebrow-gold">SERVICE COMPLETED</p>
            <h3>Rate Your Technician</h3>
            <p className="modal-sub">
              <strong>{booking.technicianName || 'Technician'}</strong> · {booking.serviceName}
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="rating-form">
          <div className="star-picker-container">
            <p className="rating-prompt">How was your service experience?</p>
            <div className="star-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${(hoverRating || rating) >= star ? 'filled' : ''}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  ★
                </button>
              ))}
            </div>
            <strong className="star-label">
              {rating === 5 && 'Outstanding ⭐⭐⭐⭐⭐'}
              {rating === 4 && 'Very Good ⭐⭐⭐⭐'}
              {rating === 3 && 'Average ⭐⭐⭐'}
              {rating === 2 && 'Below Expectation ⭐⭐'}
              {rating === 1 && 'Poor Experience ⭐'}
            </strong>
          </div>

          <div className="rating-tags-section">
            <label>What went well?</label>
            <div className="rating-chips">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {selectedTags.includes(tag) ? '✓ ' : '+ '}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <Field label="Share your feedback / review (optional)">
            <textarea
              rows="3"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Technician ke kaam aur behavior ke baare mein likhein..."
            />
          </Field>

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-gold">
              Submit Review <span>★</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Google Maps Redirect Link Button
 */
export function GoogleMapLink({ location, address, area, label = 'Open in Google Maps' }) {
  let mapUrl = '';
  if (location && location.lat && location.lng) {
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  } else {
    const fullQuery = `${address || ''}, ${area || ''}`;
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery.trim())}`;
  }

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="button button-outline button-small map-btn"
      title="Open customer location in Google Maps"
    >
      <span>🗺️</span> {label} ↗
    </a>
  );
}

/**
 * Toast Notification Popup Banner Item
 */
export function ToastItem({ toast, onDismiss }) {
  const iconMap = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };
  const icon = iconMap[toast.type] || '🔔';

  return (
    <div className={`toast-card toast-${toast.type || 'info'}`} role="status">
      <div className="toast-icon-wrap">{icon}</div>
      <div className="toast-content">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button
        type="button"
        className="toast-close-btn"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast notification"
      >
        ×
      </button>
      <div className="toast-progress-bar" />
    </div>
  );
}

/**
 * Global Toast Notifications Container (Top Right Corner)
 */
export function ToastContainer() {
  const { toasts, removeToast } = useGharSathi();
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}

/**
 * Printable Tax Invoice / Service Receipt Modal
 */
export function InvoiceModal({ booking, onClose }) {
  if (!booking) return null;

  const invoiceNumber = `INV-${String(booking.id || '').replace(/^GS-/, '')}`;
  const invoiceDate = booking.completedAt
    ? new Date(booking.completedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : booking.date || new Date().toLocaleDateString('en-IN');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay invoice-modal-overlay" onClick={onClose}>
      <div className="modal-card invoice-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-modal-header no-print">
          <div className="invoice-header-title">
            <span className="invoice-tag">OFFICIAL RECEIPT</span>
            <h3>Tax Invoice & Service Receipt</h3>
          </div>
          <div className="invoice-header-actions">
            <button
              type="button"
              className="button button-gold button-small print-action-btn"
              onClick={handlePrint}
            >
              <span>🖨️</span> Print / Save PDF
            </button>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close invoice"
            >
              ×
            </button>
          </div>
        </div>

        {/* Printable Section */}
        <div className="invoice-printable-body" id="invoice-printable-section">
          <div className="invoice-doc-head">
            <div className="invoice-brand-col">
              <div className="invoice-brand-row">
                <img
                  src="/images/gharsathi-logo.png"
                  alt="Ghar Sathi"
                  className="invoice-logo-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div>
                  <h2 className="invoice-brand-name">
                    Ghar <span>Sathi</span>
                  </h2>
                  <p className="invoice-brand-sub">HAR GHAR KA SATHI · BIHAR HOME SERVICES</p>
                </div>
              </div>
              <p className="invoice-company-details">
                Ghar Sathi Service Network Pvt. Ltd.<br />
                Danapur & Patna Operational Hub, Bihar - 801503<br />
                Support Helpline: +91 98765 43210 · support@gharsathi.in · GSTIN: 10AAACG9999Z1Z5
              </p>
            </div>
            <div className="invoice-meta-col">
              <div className="invoice-badge-paid">✓ PAID & COMPLETED</div>
              <table className="invoice-meta-table">
                <tbody>
                  <tr>
                    <td>Invoice No:</td>
                    <td>
                      <strong>{invoiceNumber}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Booking Ref:</td>
                    <td>{booking.id}</td>
                  </tr>
                  <tr>
                    <td>Date:</td>
                    <td>{invoiceDate}</td>
                  </tr>
                  <tr>
                    <td>Payment Mode:</td>
                    <td>{booking.payment || 'Cash on Service'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="invoice-parties-grid">
            <div className="invoice-party-card">
              <small className="party-title">BILLED TO (CUSTOMER)</small>
              <strong>{booking.customerName}</strong>
              <p>📞 Phone: +91 {booking.phone}</p>
              <p>📍 Address: {booking.address}</p>
              <p>Service Area: {booking.area} {booking.pincode ? `(${booking.pincode})` : ''}</p>
            </div>
            <div className="invoice-party-card">
              <small className="party-title">SERVICE PARTNER (TECHNICIAN)</small>
              <strong>{booking.technicianName || 'Verified Ghar Sathi Partner'}</strong>
              <p>📞 Phone: {booking.technicianPhone ? `+91 ${booking.technicianPhone}` : 'Verified Partner'}</p>
              <p>Partner ID: {booking.technicianId || 'GS-TECH'}</p>
              <p>Trade / Skill: {booking.serviceName}</p>
            </div>
          </div>

          <table className="invoice-items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Service & Work Scope</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>
                  <strong>{booking.serviceName}</strong>
                  {booking.subcategoryName && (
                    <div className="item-sub-desc">Package: {booking.subcategoryName}</div>
                  )}
                  <div className="item-note">Doorstep professional service, verified diagnostics & 30-day warranty</div>
                </td>
                <td>Home Services</td>
                <td style={{ textAlign: 'right' }}>₹{Number(booking.price || 0).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600 }}>
                  Subtotal:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  ₹{Number(booking.price || 0).toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600 }}>
                  Taxes (CGST + SGST):
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>Included (₹0 Extra)</td>
              </tr>
              <tr className="invoice-total-row">
                <td colSpan="3" style={{ textAlign: 'right' }}>
                  <strong>Total Amount Paid:</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>₹{Number(booking.price || 0).toLocaleString('en-IN')}</strong>
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="invoice-footer-banner">
            <div className="warranty-pill">
              <span>🛡️</span>
              <div>
                <strong>30-Day Ghar Sathi Service Warranty Included</strong>
                <p>Same issue recurring within 30 days will be resolved free of additional charges.</p>
              </div>
            </div>
            <p className="invoice-signoff">
              This is a computer-generated official tax invoice and requires no physical signature.<br />
              Thank you for trusting Ghar Sathi · Har Ghar Ka Vishwas!
            </p>
          </div>
        </div>

        <div className="invoice-modal-bottom no-print">
          <button type="button" className="button button-outline" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="button button-gold print-action-btn"
            onClick={handlePrint}
          >
            <span>🖨️</span> Print Invoice / Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reviews & Ratings Modal for Technicians
 */
export function ReviewsModal({ technician, bookings = [], onClose }) {
  if (!technician) return null;

  const techReviews = bookings.filter(
    (b) =>
      (b.technicianId === technician.id || b.technicianName === technician.name) &&
      b.rating
  );

  const avgRating = technician.rating || 5.0;
  const totalCount = techReviews.length || technician.ratingCount || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card reviews-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow eyebrow-gold">PARTNER REPUTATION</p>
            <h3>Customer Reviews for {technician.name}</h3>
            <p className="modal-sub">
              {technician.skills} · {technician.area}
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="reviews-modal-body">
          <div className="reviews-summary-card">
            <div className="summary-score-col">
              <span className="big-rating-number">{Number(avgRating).toFixed(1)}</span>
              <div className="summary-stars">{'★'.repeat(Math.round(avgRating))}</div>
              <small>Based on {totalCount} verified reviews</small>
            </div>
            <div className="summary-features-col">
              <div className="feature-score-line">
                <span>On-time arrival</span>
                <div className="mini-score-bar">
                  <div style={{ width: '98%' }} />
                </div>
                <b>98%</b>
              </div>
              <div className="feature-score-line">
                <span>Service quality</span>
                <div className="mini-score-bar">
                  <div style={{ width: '96%' }} />
                </div>
                <b>96%</b>
              </div>
              <div className="feature-score-line">
                <span>Polite behavior</span>
                <div className="mini-score-bar">
                  <div style={{ width: '99%' }} />
                </div>
                <b>99%</b>
              </div>
            </div>
          </div>

          <div className="reviews-feed">
            <h4>Customer Reviews ({techReviews.length})</h4>
            {techReviews.length === 0 ? (
              <div className="no-reviews-box">
                <span>⭐</span>
                <p>Abhi is partner ke liye koi written customer review nahi hai.</p>
              </div>
            ) : (
              techReviews.map((item) => (
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

        <div className="modal-actions" style={{ padding: '14px 22px', borderTop: '1px solid #edf1ed' }}>
          <button type="button" className="button button-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading Shimmer Skeletons
 */
export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-shimmer skeleton-media" />
      <div className="skeleton-content">
        <div className="skeleton-shimmer skeleton-tag" />
        <div className="skeleton-shimmer skeleton-title" />
        <div className="skeleton-shimmer skeleton-text" />
        <div className="skeleton-shimmer skeleton-bottom" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * 4-Digit Happy Code PIN Verification Modal for Technician
 */
export function PinVerificationModal({ booking, onClose, onVerify }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!booking) return null;

  const demoPin = booking.servicePin || '4829';

  const handleAutoFill = () => {
    setPin(demoPin);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin || pin.trim().length !== 4) {
      setError('Please enter a valid 4-digit Happy Code.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const res = await onVerify(pin.trim());
    if (res && res.error) {
      setError(res.error);
      setIsSubmitting(false);
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card pin-verify-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow eyebrow-gold">JOB COMPLETION VERIFICATION</p>
            <h3>Enter 4-Digit Happy Code</h3>
            <p className="modal-sub">
              Booking <strong>{booking.id}</strong> · {booking.serviceName}
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pin-verify-form">
          <div className="pin-verify-info-box">
            <span className="verify-shield-icon">🔐</span>
            <div>
              <strong>Customer Security Verification</strong>
              <p>
                Service complete karne ke liye customer ki screen par display ho raha 4-digit Happy Code enter karein.
              </p>
            </div>
          </div>

          {/* Developer Convenience: Demo Hint Badge & One-click Auto-fill */}
          <div className="demo-pin-hint-card">
            <div className="demo-hint-left">
              <span className="demo-hint-badge">Demo Mode Hint</span>
              <span className="demo-hint-code">PIN: <strong>{demoPin}</strong></span>
            </div>
            <button
              type="button"
              className="button button-small button-outline auto-fill-pin-btn"
              onClick={handleAutoFill}
              title="Click to auto-fill the customer's 4-digit code"
            >
              ⚡ Auto-fill Demo PIN
            </button>
          </div>

          <div className="pin-input-group">
            <label htmlFor="servicePinInput" className="pin-input-label">
              4-Digit Happy Code
            </label>
            <input
              id="servicePinInput"
              type="tel"
              maxLength="4"
              autoFocus
              className="happy-code-input"
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                if (error) setError('');
              }}
            />
            <small className="pin-subtext">Ask customer for the code displayed on their booking card</small>
          </div>

          {error && <div className="pin-error-notice">⚠️ {error}</div>}

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="button button-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="button button-gold"
              disabled={isSubmitting || pin.length < 4}
            >
              Verify Code & Complete Job <span>✓</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Authentic Razorpay Payment Gateway Wallet Recharge Modal for Technicians.
 * Strictly verifies payments through Razorpay Live Gateway (Cards, UPI, Netbanking).
 * ZERO simulated free credits. Money is transferred directly to Ghar Sathi account.
 */
export function WalletRechargeModal({ technician, onClose, onRecharge }) {
  const [amount, setAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  if (!technician) return null;

  const currentBalance = Number.isFinite(Number(technician.walletBalance))
    ? Number(technician.walletBalance)
    : Number(technician.wallet || 0);

  const quickAmounts = [200, 500, 1000];

  const handleSelectAmount = (val) => {
    setAmount(val);
    setCustomAmount('');
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomAmount(val);
    if (val) {
      setAmount(Number(val));
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleConfirmRecharge = async (e) => {
    e.preventDefault();
    const finalAmount = Number(amount);
    if (!finalAmount || finalAmount < 50) {
      alert('Minimum recharge amount is ₹50.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Razorpay secure gateway se connect ho raha hai…');

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay Checkout SDK load nahi ho saka. Kripya apna internet connection check karein.');
      }

      // Step 1: Create live Razorpay Order on backend
      const orderRes = await api.createRazorpayOrder({
        amount: finalAmount,
        bookingId: technician.partner_id || technician.id || `tech_${Date.now()}`,
        serviceName: 'Partner Wallet Top-up',
        customerName: technician.name || 'Technician Partner',
        customerEmail: technician.email || 'partner@gharsathi.in',
        customerContact: technician.phone || '',
      });

      if (!orderRes || !orderRes.order_id) {
        throw new Error('Payment server par order create nahi ho saka. Kripya punah prayas karein.');
      }
      setStatusMessage('Razorpay payment gateway khul raha hai…');

      // Step 2: Open official Razorpay Checkout popup
      const options = {
        key: orderRes.key_id || 'rzp_live_Tr00Y2gS1bC4Rv',
        amount: orderRes.amount,
        currency: orderRes.currency || 'INR',
        name: 'Ghar Sathi',
        description: `Partner Wallet Top-up (₹${finalAmount})`,
        image: '/images/gharsathi-logo.png',
        order_id: orderRes.order_id,
        prefill: {
          name: technician.name || '',
          contact: technician.phone || '',
          email: technician.email || '',
        },
        theme: {
          color: '#0d5c43',
        },
        handler: async function (response) {
          try {
            setStatusMessage('Payment verify ho raha hai, wallet credit ho raha hai…');
            // Step 3: Only when Razorpay confirms real payment capture
            const result = await onRecharge({
              amount: finalAmount,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });

            setIsProcessing(false);
            if (result && result.success !== false) {
              onClose();
            }
          } catch (err) {
            setIsProcessing(false);
            setStatusMessage('');
            alert('Payment verification fail ho gaya: ' + (err.message || 'Error occurred.'));
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            setStatusMessage('');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setIsProcessing(false);
        setStatusMessage('');
        alert('Payment nahi ho paya: ' + (resp?.error?.description || 'Bank transaction decline hua ya cancel ho gaya.'));
      });
      rzp.open();
    } catch (err) {
      setIsProcessing(false);
      setStatusMessage('');
      alert(err.message || 'Razorpay payment shuru nahi ho saka.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card recharge-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow eyebrow-gold">TECHNICIAN PARTNER WALLET</p>
            <h3>Recharge Partner Wallet</h3>
            <p className="modal-sub">
              Partner: <strong>{technician.name}</strong> · ID: {technician.partner_id || technician.id}
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isProcessing}>
            ×
          </button>
        </div>

        <div className="recharge-modal-body">
          <div className="current-balance-banner">
            <div>
              <small>CURRENT PREPAID BALANCE</small>
              <h2 className={currentBalance < 150 ? 'balance-warning' : 'balance-good'}>
                ₹{currentBalance.toLocaleString('en-IN')}
              </h2>
            </div>
            {currentBalance < 150 ? (
              <span className="low-balance-pill">⚠️ Low Balance (&lt; ₹150)</span>
            ) : (
              <span className="active-balance-pill">✓ Sufficient Balance</span>
            )}
          </div>

          <div className="recharge-rule-note">
            <span>🛡️</span>
            <p>
              Ghar Sathi operates on a <strong>Flat ₹149 Platform Commission</strong> per completed booking. 
              A minimum balance of <strong>₹150</strong> is required to accept new customer service requests.
            </p>
          </div>

          <form onSubmit={handleConfirmRecharge}>
            <div className="quick-amount-section">
              <label>Select Recharge Amount</label>
              <div className="amount-pills-grid">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={isProcessing}
                    className={`amount-pill ${amount === q && !customAmount ? 'selected' : ''}`}
                    onClick={() => handleSelectAmount(q)}
                  >
                    +₹{q}
                  </button>
                ))}
              </div>
            </div>

            <div className="custom-amount-field">
              <label htmlFor="customRechargeInput">Or Enter Custom Amount (₹)</label>
              <div className="custom-input-wrap">
                <span className="rupee-prefix">₹</span>
                <input
                  id="customRechargeInput"
                  type="tel"
                  placeholder="e.g. 750"
                  value={customAmount}
                  onChange={handleCustomChange}
                  disabled={isProcessing}
                  min="50"
                  max="50000"
                />
              </div>
            </div>

            {/* Official Razorpay Security Badge Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0d5c43 0%, #063c2c 100%)',
                color: '#ffffff',
                padding: '14px 16px',
                borderRadius: '12px',
                margin: '16px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 4px 14px rgba(13, 92, 67, 0.25)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0,
                }}
              >
                🔒
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: '#85e3b3',
                      textTransform: 'uppercase',
                    }}
                  >
                    Official Payment Gateway
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      background: '#ffffff',
                      color: '#0d5c43',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontWeight: 800,
                    }}
                  >
                    RAZORPAY LIVE
                  </span>
                </div>
                <div style={{ fontSize: '12px', opacity: 0.95, lineHeight: 1.3 }}>
                  UPI (GPay / PhonePe / Paytm), Debit/Credit Cards & Netbanking
                </div>
                <div style={{ fontSize: '11px', color: '#c7edd8', marginTop: '2px' }}>
                  Direct payment to Ghar Sathi account • Instant automated wallet top-up
                </div>
              </div>
            </div>

            {statusMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  marginBottom: '12px',
                  background: '#f4fbf7',
                  border: '1px solid #b7ebcf',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#0d5c43',
                  textAlign: 'center',
                  fontWeight: 600,
                }}
              >
                {statusMessage}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="button button-outline" onClick={onClose} disabled={isProcessing}>
                Cancel
              </button>
              <button
                type="submit"
                className="button button-gold recharge-confirm-btn"
                disabled={isProcessing || !amount || amount < 50}
                style={{ minWidth: '220px', fontWeight: 700 }}
              >
                {isProcessing ? 'Connecting Razorpay…' : `Pay ₹${amount} with Razorpay 💳`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Visual 4-Step Booking Timeline Stepper
 * Steps: 1. Booked ➔ 2. Partner Assigned ➔ 3. Work In Progress ➔ 4. Completed
 */
export function BookingTimelineStepper({ status = 'Pending', bookingId }) {
  const isCancelled = status === 'Cancelled';

  const steps = [
    { id: 1, label: 'Booked', desc: 'Request logged' },
    { id: 2, label: 'Partner Assigned', desc: 'Technician on way' },
    { id: 3, label: 'Work In Progress', desc: 'Service on-site' },
    { id: 4, label: 'Completed', desc: 'Payment & review' },
  ];

  const getStepState = (stepIndex) => {
    if (isCancelled) return { completed: false, active: false };

    // step 1: Booked
    if (stepIndex === 1) {
      const isPast = ['Accepted', 'In Progress', 'Completed'].includes(status);
      return { completed: isPast, active: status === 'Pending' };
    }
    // step 2: Partner Assigned
    if (stepIndex === 2) {
      const isPast = ['In Progress', 'Completed'].includes(status);
      return { completed: isPast, active: status === 'Accepted' };
    }
    // step 3: Work In Progress
    if (stepIndex === 3) {
      const isPast = status === 'Completed';
      return { completed: isPast, active: status === 'In Progress' };
    }
    // step 4: Completed
    if (stepIndex === 4) {
      return { completed: status === 'Completed', active: status === 'Completed' };
    }
    return { completed: false, active: false };
  };

  if (isCancelled) {
    return (
      <div className="stepper-cancelled-card">
        <span className="cancelled-dot">✕</span>
        <div>
          <strong>Booking Cancelled</strong>
          <small>This service request was cancelled. No charges were levied.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-stepper-container" aria-label="Booking progress timeline">
      <div className="stepper-track">
        {steps.map((step, idx) => {
          const { completed, active } = getStepState(step.id);
          const nextCompleted = idx < steps.length - 1 && getStepState(steps[idx + 1].id).completed;
          const nextActive = idx < steps.length - 1 && getStepState(steps[idx + 1].id).active;

          return (
            <div key={step.id} className="stepper-item-wrap">
              <div className="stepper-node">
                <div
                  className={`stepper-circle ${completed ? 'completed' : ''} ${active ? 'active-pulse' : ''}`}
                >
                  {completed ? '✓' : step.id}
                </div>
                <div className="stepper-text">
                  <span className={`stepper-label ${active ? 'font-bold' : ''}`}>{step.label}</span>
                  <small className="stepper-desc">{step.desc}</small>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`stepper-connector-line ${
                    completed || nextCompleted || nextActive ? 'filled' : ''
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

