import { useMemo, useState } from 'react';
import { useGharSathi } from '../context/AppDataContext.jsx';
import { areas, FIXED_PLATFORM_COMMISSION, serviceCategories } from '../data/services.js';
import {
  EmptyState,
  Field,
  PageHeading,
  PanelShell,
  StatCard,
  StatusBadge,
  TopBarProfile,
  InvoiceModal,
  ReviewsModal,
  ResetDemoButton,
  SkeletonCard,
  SkeletonList,
} from '../components/Common.jsx';

const items = [
  { id: 'overview', icon: '▦', label: 'Overview' },
  { id: 'progress', icon: '📈', label: 'Progress & Graphs' },
  { id: 'bookings', icon: '▤', label: 'All bookings' },
  { id: 'technicians', icon: '🧰', label: 'Technicians' },
  { id: 'customers', icon: '♙', label: 'Customers' },
  { id: 'services', icon: '✦', label: 'Services & prices' },
  { id: 'complaints', icon: '✉', label: 'Complaints' },
  { id: 'withdrawals', icon: '💸', label: 'Money withdrawals' },
  { id: 'reports', icon: '₹', label: 'Fixed commission reports' },
];

const bookingStatuses = ['Pending', 'Accepted', 'In Progress', 'Completed', 'Cancelled'];

export default function AdminPanel() {
  const {
    data,
    isAdminLoggedIn,
    loginAdmin,
    logoutAdmin,
    updateBooking,
    addTechnician,
    updateTechnician,
    updateServicePrice,
    updateSubservicePrice,
    addService,
    addSubservice,
    deleteService,
    deleteSubservice,
    purgeProductionData,
    updateComplaint,
    resetDemoData,
    requestAdminWithdrawal,
    updateAdminWithdrawalStatus,
  } = useGharSathi();

  const [active, setActive] = useState('overview');
  const [notice, setNotice] = useState('');

  // Delete & Purge Modal States
  const [deleteServiceModal, setDeleteServiceModal] = useState(null);
  const [deleteSubserviceModal, setDeleteSubserviceModal] = useState(null);
  const [purgeConfirmModal, setPurgeConfirmModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Admin Search & Filter States
  const [adminBookingSearch, setAdminBookingSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [invoiceBooking, setInvoiceBooking] = useState(null);
  const [selectedTechForReviews, setSelectedTechForReviews] = useState(null);

  // Admin Service & Subservice Catalogue Management States
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [adminServiceSearch, setAdminServiceSearch] = useState('');
  const [adminServiceCategory, setAdminServiceCategory] = useState('all');
  const [priceDrafts, setPriceDrafts] = useState({});
  const [commissionDrafts, setCommissionDrafts] = useState({});
  const [subPriceDrafts, setSubPriceDrafts] = useState({});
  const [subCommDrafts, setSubCommDrafts] = useState({});
  const [addingSubserviceFor, setAddingSubserviceFor] = useState(null);
  const [newSubForm, setNewSubForm] = useState({
    name: '',
    price: '',
    commission_fee: '149',
    time: '45 mins',
    description: '',
  });

  // Admin Money Withdrawal Payout States
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    bankDetails: 'ghar.sathi@okhdfcbank',
    adminNotes: '',
  });
  const [withdrawalError, setWithdrawalError] = useState('');

  // Admin Login Form
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  // Add Technician Modal/Form
  const [techFormOpen, setTechFormOpen] = useState(false);
  const [techForm, setTechForm] = useState({
    name: '',
    phone: '',
    password: 'password123',
    email: '',
    aadhaar: '',
    area: areas[0],
    skills: 'AC Service & Repair, Electrician',
    address: 'Patna, Bihar',
  });

  // Summary Metrics
  const completed = useMemo(() => data.bookings.filter((b) => b.status === 'Completed'), [data.bookings]);
  const pending = useMemo(() => data.bookings.filter((b) => b.status === 'Pending'), [data.bookings]);
  const activeJobs = useMemo(
    () => data.bookings.filter((b) => ['Accepted', 'In Progress'].includes(b.status)),
    [data.bookings]
  );
  const cancelled = useMemo(() => data.bookings.filter((b) => b.status === 'Cancelled'), [data.bookings]);

  const totalVolume = completed.reduce((sum, b) => sum + Number(b.price || 0), 0);

  // STRICT COMPULSORY FIXED COMMISSION RULE:
  // Commission is strictly Rs 149 per completed job, not percentage-based!
  const totalFixedCommission = completed.length * FIXED_PLATFORM_COMMISSION; // 149 * completed count
  const totalTechnicianPayout = Math.max(0, totalVolume - totalFixedCommission);

  // Admin Payout / Withdrawal FinTech Metrics
  const withdrawalsList = useMemo(() => data.withdrawals || [], [data.withdrawals]);
  const totalApprovedWithdrawn = useMemo(
    () =>
      withdrawalsList
        .filter((w) => w.status === 'Approved')
        .reduce((sum, w) => sum + Number(w.amount || 0), 0),
    [withdrawalsList]
  );
  const totalPendingWithdrawn = useMemo(
    () =>
      withdrawalsList
        .filter((w) => w.status === 'Pending')
        .reduce((sum, w) => sum + Number(w.amount || 0), 0),
    [withdrawalsList]
  );
  const availableWithdrawalBalance = Math.max(
    0,
    totalFixedCommission - totalApprovedWithdrawn - totalPendingWithdrawn
  );

  // Proportional shares
  const techSharePct = totalVolume > 0 ? Math.round((totalTechnicianPayout / totalVolume) * 100) : 75;
  const platformSharePct = 100 - techSharePct;

  // Order Fulfillment Health Ratios
  const totalBookingsCount = data.bookings.length || 1;
  const completedPct = Math.round((completed.length / totalBookingsCount) * 100);
  const activePct = Math.round((activeJobs.length / totalBookingsCount) * 100);
  const pendingPct = Math.round((pending.length / totalBookingsCount) * 100);
  const cancelledPct = Math.max(0, 100 - (completedPct + activePct + pendingPct));

  // Top Performing Services Breakdown
  const servicePerformance = useMemo(() => {
    const counts = {};
    const revenues = {};

    data.bookings.forEach((b) => {
      const name = b.serviceName || 'Service';
      counts[name] = (counts[name] || 0) + 1;
      if (b.status === 'Completed') {
        revenues[name] = (revenues[name] || 0) + Number(b.price || 0);
      }
    });

    const maxCount = Math.max(1, ...Object.values(counts));

    return Object.keys(counts)
      .map((name) => ({
        name,
        count: counts[name],
        revenue: revenues[name] || 0,
        pct: Math.round((counts[name] / maxCount) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [data.bookings]);

  const verifiedTechs = data.technicians.filter((tech) => tech.status === 'Verified').length;
  const recentBookings = useMemo(
    () => [...data.bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
    [data.bookings]
  );

  const filteredAdminBookings = useMemo(() => {
    return data.bookings.filter((b) => {
      const matchesStatus =
        adminStatusFilter === 'all' ||
        b.status.toLowerCase() === adminStatusFilter.toLowerCase();
      const q = adminBookingSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.phone.includes(q) ||
        b.serviceName.toLowerCase().includes(q) ||
        (b.subcategoryName && b.subcategoryName.toLowerCase().includes(q)) ||
        (b.technicianName && b.technicianName.toLowerCase().includes(q)) ||
        b.area.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [data.bookings, adminStatusFilter, adminBookingSearch]);

  const filteredAdminServices = useMemo(() => {
    return (data.services || []).filter((s) => {
      const matchesCat =
        adminServiceCategory === 'all' ||
        (s.categoryId || s.category || '').toLowerCase() === adminServiceCategory.toLowerCase();
      const q = adminServiceSearch.toLowerCase().trim();
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.subcategories && s.subcategories.some((sub) => sub.name.toLowerCase().includes(q)));
      return matchesCat && matchesQuery;
    });
  }, [data.services, adminServiceCategory, adminServiceSearch]);

  // Admin Login Submission
  const handleAdminLogin = (e) => {
    e.preventDefault();
    setAdminAuthError('');
    const res = loginAdmin(adminEmail, adminPassword);
    if (!res.success) {
      setAdminAuthError(res.error);
    } else {
      setNotice('Admin authentication verified. Welcome to Ghar Sathi Platform Center.');
    }
  };

  const addNewTechnician = (event) => {
    event.preventDefault();
    const cleanPhone = techForm.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setNotice('Technician ke liye valid 10-digit mobile number daalein.');
      return;
    }
    const existing = data.technicians.some((tech) => tech.phone === cleanPhone);
    if (existing) {
      setNotice('Is mobile number se technician pehle se listed hai.');
      return;
    }
    const record = addTechnician(techForm);
    setNotice(`${record.name} add ho gaye. Verification pending hai.`);
    setTechForm({
      name: '',
      phone: '',
      password: 'password123',
      email: '',
      aadhaar: '',
      area: areas[0],
      skills: 'AC Service & Repair, Electrician',
      address: 'Patna, Bihar',
    });
    setTechFormOpen(false);
  };

  const setBookingAssignment = (booking, technicianId) => {
    const tech = data.technicians.find((item) => item.id === technicianId);
    updateBooking(booking.id, {
      technicianId: tech?.id || '',
      technicianName: tech?.name || '',
      technicianPhone: tech?.phone || '',
      ...(tech && booking.status === 'Pending' ? { status: 'Accepted' } : {}),
    });
    setNotice(
      tech
        ? `${booking.id} ko technician ${tech.name} assign ho gaye. Work step notification sent!`
        : `${booking.id} se assignment hata diya gaya.`
    );
  };

  const setBookingStatus = (booking, status) => {
    if (status === 'Completed' && !booking.technicianId) {
      setNotice('Job complete mark karne se pehle technician assign karein.');
      return;
    }
    updateBooking(booking.id, { status });
    if (status === 'Completed') {
      setNotice(
        `${booking.id} marked Completed. Fixed platform commission of ₹${FIXED_PLATFORM_COMMISSION} recorded.`
      );
    } else {
      setNotice(`${booking.id} status ab "${status}" ho gaya. Customer ko notification dispatched.`);
    }
  };

  const savePrice = (service) => {
    const raw = priceDrafts[service.id] ?? service.price;
    const rawCommission = commissionDrafts[service.id] ?? (service.commission_fee ?? service.commissionFee ?? 149);
    const amount = Number(raw);
    const commAmount = Number(rawCommission);
    if (!Number.isFinite(amount) || amount < 0) {
      setNotice('Price zero ya positive number hona chahiye.');
      return;
    }
    if (!Number.isFinite(commAmount) || commAmount < 0) {
      setNotice('Commission fee zero ya positive number hona chahiye.');
      return;
    }
    updateServicePrice(service.id, amount, commAmount);
    setNotice(`${service.name} ka price (₹${amount}) aur commission (₹${commAmount}) update ho gaya.`);
  };

  const saveSubPrice = (serviceId, sub) => {
    const rawPrice = subPriceDrafts[sub.id] ?? sub.price;
    const rawComm = subCommDrafts[sub.id] ?? sub.commission_fee ?? sub.commissionFee ?? sub.commission ?? 149;
    const amount = Number(rawPrice);
    const commAmount = Number(rawComm);
    if (!Number.isFinite(amount) || amount < 0) {
      setNotice('Price zero ya positive number hona chahiye.');
      return;
    }
    if (!Number.isFinite(commAmount) || commAmount < 0) {
      setNotice('Commission fee zero ya positive number hona chahiye.');
      return;
    }
    updateSubservicePrice(serviceId, sub.id, amount, commAmount);
    setNotice(`${sub.name} ka rate ₹${amount} aur commission ₹${commAmount} update ho gaya.`);
  };

  const handleCreateSubservice = async (serviceId) => {
    const subName = newSubForm.name.trim();
    if (!subName) {
      setNotice('Subservice name required hai.');
      return;
    }
    const price = Number(newSubForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setNotice('Valid price enter karein.');
      return;
    }
    const comm = Number(newSubForm.commission_fee || 149);
    if (!Number.isFinite(comm) || comm < 0) {
      setNotice('Valid commission fee enter karein.');
      return;
    }

    await addSubservice(serviceId, {
      name: subName,
      price,
      commission_fee: comm,
      time: newSubForm.time || '45 mins',
      description: newSubForm.description || '',
    });

    setAddingSubserviceFor(null);
    setNewSubForm({ name: '', price: '', commission_fee: '149', time: '45 mins', description: '' });
    setNotice(`Naya subservice "${subName}" (Rate: ₹${price}, Comm: ₹${comm}) add ho gaya.`);
  };

  // Withdrawal Form Submission & FinTech Payout Controls
  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    setWithdrawalError('');
    const amt = Number(withdrawalForm.amount);
    if (!amt || amt <= 0) {
      setWithdrawalError('Please enter a valid withdrawal amount.');
      return;
    }
    if (amt > availableWithdrawalBalance) {
      setWithdrawalError(`Requested amount (₹${amt}) exceeds available balance (₹${availableWithdrawalBalance}).`);
      return;
    }
    if (!withdrawalForm.bankDetails.trim()) {
      setWithdrawalError('Please enter beneficiary UPI ID or Bank account details.');
      return;
    }

    setWithdrawalSubmitting(true);
    const result = await requestAdminWithdrawal({
      amount: amt,
      bankDetails: withdrawalForm.bankDetails.trim(),
      adminNotes: withdrawalForm.adminNotes.trim(),
    });
    setWithdrawalSubmitting(false);

    if (result && result.success) {
      setWithdrawalModalOpen(false);
      setWithdrawalForm({
        amount: '',
        bankDetails: 'ghar.sathi@okhdfcbank',
        adminNotes: '',
      });
      setNotice(`Payout request for ₹${amt} submitted successfully.`);
    } else {
      setWithdrawalError(result?.error || 'Failed to submit withdrawal request.');
    }
  };

  const handleQuickPercent = (pct) => {
    if (availableWithdrawalBalance <= 0) return;
    const calc = Math.floor((availableWithdrawalBalance * pct) / 100);
    setWithdrawalForm((prev) => ({ ...prev, amount: String(calc) }));
    setWithdrawalError('');
  };

  const handleApproveWithdrawal = async (wId) => {
    await updateAdminWithdrawalStatus(wId, 'Approved', 'Approved & dispatched by admin');
    setNotice(`Payout request ${wId} approved and marked as dispatched.`);
  };

  const handleRejectWithdrawal = async (wId) => {
    await updateAdminWithdrawalStatus(wId, 'Rejected', 'Rejected by admin');
    setNotice(`Payout request ${wId} rejected.`);
  };

  const clearDemo = () => {
    const okay = window.confirm(
      'Demo browser data reset karein? Bookings, technician records aur customer profiles delete ho jayengi.'
    );
    if (okay) {
      resetDemoData();
      setNotice('Demo data reset ho gaya.');
    }
  };

  // Top Actions
  const topActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <ResetDemoButton compact />
      <TopBarProfile
        user={{ name: 'Platform Admin', email: 'admin@gharsathi.com' }}
        role="Admin"
        onLogout={logoutAdmin}
      />
    </div>
  );

  // If Not Logged In, Render Admin Login Screen
  if (!isAdminLoggedIn) {
    return (
      <div className="admin-gate-page">
        <div className="admin-gate-card">
          <div className="role-gate-brand">
            <img src="/images/gharsathi-logo.png" alt="Ghar Sathi" className="gate-logo-img" />
            <span>Ghar <em>Sathi</em></span>
          </div>

          <p className="eyebrow eyebrow-gold">SUPER ADMIN CONSOLE</p>
          <h1>Admin Portal Login</h1>
          <p className="gate-subtitle">
            Enter your email ID and password to access platform analytics, customer records, and operations.
          </p>

          {adminAuthError && <div className="warning-notice">{adminAuthError}</div>}

          <form onSubmit={handleAdminLogin} className="admin-login-form">
            <Field label="Admin Email ID *" hint="Production: prabhat@gharsathi.in">
              <input
                required
                type="text"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="prabhat@gharsathi.in"
                autoFocus
              />
            </Field>

            <Field label="Password *" hint="Production: Gharsathi@2026">
              <input
                required
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </Field>

            <button type="submit" className="button button-gold button-wide" style={{ marginTop: '16px' }}>
              Sign In to Admin Dashboard <span>→</span>
            </button>

            <div className="demo-credentials-box">
              <small>Production Super Admin Access:</small>
              <p>Email: <strong>prabhat@gharsathi.in</strong> · Password: <strong>Gharsathi@2026</strong></p>
            </div>
          </form>

          <a href="/" className="back-link">
            ← Back to Home / Switch Panel
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PanelShell
        role="Admin"
      title="Admin Dashboard"
      description="Supervise customer count, progress graphs, bookings, and fixed ₹149 platform commission."
      active={active}
      onChange={(id) => {
        setActive(id);
        setNotice('');
      }}
      items={items}
      topActions={topActions}
    >
      {notice && (
        <div className="inline-notice admin-notice" role="status">
          <span>✓</span>
          {notice}
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {active === 'overview' && (
        <>
          <div className="admin-welcome">
            <div>
              <p className="eyebrow eyebrow-gold">PLATFORM CONTROL CENTER</p>
              <h2>
                Namaste, Super Admin <span>✦</span>
              </h2>
              <p>
                Platform par registered customers, service requests, aur technician operations ek hi dashboard se
                supervise karein.
              </p>
            </div>
            <div className="admin-welcome-mark">⌂</div>
          </div>

          {/* DASHBOARD METRICS: Includes Prominent Number of Customers */}
          <div className="stats-grid admin-stat-grid">
            <StatCard
              label="Total Customers Registered"
              value={data.customers.length}
              icon="♙"
              note="Active customer database"
            />
            <StatCard
              label="Total Bookings"
              value={data.bookings.length}
              icon="▤"
              note={`${pending.length} pending requests`}
            />
            <StatCard
              label="Active Jobs"
              value={activeJobs.length}
              icon="⚙"
              note="Accepted or in progress"
            />
            <StatCard
              label="Fixed Platform Commission"
              value={`₹${totalFixedCommission.toLocaleString('en-IN')}`}
              icon="🛡️"
              note={`₹${FIXED_PLATFORM_COMMISSION} flat per completed job`}
            />
          </div>

          {/* Fixed Commission Banner */}
          <div className="fixed-commission-highlight-box">
            <span>🛡️</span>
            <div>
              <strong>Compulsory Fixed Commission Policy: ₹{FIXED_PLATFORM_COMMISSION} Flat Per Job</strong>
              <p>
                Commission is strictly fixed at ₹{FIXED_PLATFORM_COMMISSION} per completed service booking regardless of
                service ticket value (no percentage cut). Fair pricing for both customers and service partners.
              </p>
            </div>
          </div>

          {/* Visual Revenue Analytics & Platform Health Breakdown */}
          <section className="admin-analytics-section">
            <div className="analytics-grid-two">
              {/* Card 1: Revenue Split (GBV vs. Technician Payouts vs. Platform Earnings) */}
              <div className="analytics-card revenue-split-card">
                <div className="analytics-card-header">
                  <div>
                    <span className="analytics-tag">FINANCIAL REVENUE SPLIT</span>
                    <h3>Gross Booking Value vs. Fixed Earnings</h3>
                  </div>
                  <span className="fintech-pill">Flat ₹{FIXED_PLATFORM_COMMISSION} / Job</span>
                </div>

                <div className="revenue-split-metrics">
                  <div className="metric-box gbv-box">
                    <small>Gross Booking Value (GBV)</small>
                    <strong>₹{totalVolume.toLocaleString('en-IN')}</strong>
                    <span>{completed.length} completed jobs</span>
                  </div>
                  <div className="metric-box tech-box">
                    <small>Technician Payouts ({techSharePct}%)</small>
                    <strong className="tech-green-text">₹{totalTechnicianPayout.toLocaleString('en-IN')}</strong>
                    <span>Direct partner earnings</span>
                  </div>
                  <div className="metric-box platform-box">
                    <small>Platform Net ({platformSharePct}%)</small>
                    <strong className="platform-gold-text">₹{totalFixedCommission.toLocaleString('en-IN')}</strong>
                    <span>Fixed ₹149 margin</span>
                  </div>
                </div>

                <div
                  className="proportional-split-bar"
                  title={`Technician Share: ${techSharePct}%, Platform: ${platformSharePct}%`}
                >
                  <div className="split-segment tech-segment" style={{ width: `${techSharePct}%` }}>
                    {techSharePct > 20 && <span>Partner {techSharePct}%</span>}
                  </div>
                  <div className="split-segment platform-segment" style={{ width: `${platformSharePct}%` }}>
                    {platformSharePct > 15 && <span>Platform {platformSharePct}%</span>}
                  </div>
                </div>

                <div className="split-legend-row">
                  <span className="legend-item">
                    <span className="legend-dot dot-green" /> Partner Share (Labor & Spares)
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot dot-gold" /> Ghar Sathi (Fixed Platform Fee)
                  </span>
                </div>
              </div>

              {/* Card 2: Order Fulfillment Health Ratio Bar */}
              <div className="analytics-card fulfillment-health-card">
                <div className="analytics-card-header">
                  <div>
                    <span className="analytics-tag">SERVICE LIFECYCLE</span>
                    <h3>Order Fulfillment Health</h3>
                  </div>
                  <span className="fintech-pill">{data.bookings.length} Total Orders</span>
                </div>

                <div className="fulfillment-segmented-bar">
                  <div
                    className="health-segment segment-completed"
                    style={{ width: `${completedPct}%` }}
                    title={`Completed: ${completed.length} (${completedPct}%)`}
                  >
                    {completedPct > 15 && <span>{completedPct}%</span>}
                  </div>
                  <div
                    className="health-segment segment-active"
                    style={{ width: `${activePct}%` }}
                    title={`Active: ${activeJobs.length} (${activePct}%)`}
                  >
                    {activePct > 15 && <span>{activePct}%</span>}
                  </div>
                  <div
                    className="health-segment segment-pending"
                    style={{ width: `${pendingPct}%` }}
                    title={`Pending: ${pending.length} (${pendingPct}%)`}
                  >
                    {pendingPct > 15 && <span>{pendingPct}%</span>}
                  </div>
                  {cancelledPct > 0 && (
                    <div
                      className="health-segment segment-cancelled"
                      style={{ width: `${cancelledPct}%` }}
                      title={`Cancelled: ${cancelled.length} (${cancelledPct}%)`}
                    >
                      {cancelledPct > 15 && <span>{cancelledPct}%</span>}
                    </div>
                  )}
                </div>

                <div className="health-breakdown-grid">
                  <div className="health-chip">
                    <span className="health-dot dot-completed" />
                    <div>
                      <small>Completed</small>
                      <strong>{completed.length} ({completedPct}%)</strong>
                    </div>
                  </div>
                  <div className="health-chip">
                    <span className="health-dot dot-active" />
                    <div>
                      <small>In Progress</small>
                      <strong>{activeJobs.length} ({activePct}%)</strong>
                    </div>
                  </div>
                  <div className="health-chip">
                    <span className="health-dot dot-pending" />
                    <div>
                      <small>Pending</small>
                      <strong>{pending.length} ({pendingPct}%)</strong>
                    </div>
                  </div>
                  <div className="health-chip">
                    <span className="health-dot dot-cancelled" />
                    <div>
                      <small>Cancelled</small>
                      <strong>{cancelled.length} ({cancelledPct}%)</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Top Performing Services Horizontal Bars */}
            <div className="analytics-card top-services-card" style={{ marginTop: '16px' }}>
              <div className="analytics-card-header">
                <div>
                  <span className="analytics-tag">DEMAND VOLUMES</span>
                  <h3>Top Performing Services & Volume Share</h3>
                </div>
                <small className="muted">Demand by booking volume & completed gross revenue</small>
              </div>

              <div className="services-progress-list">
                {servicePerformance.map((item) => (
                  <div key={item.name} className="service-progress-item">
                    <div className="progress-item-header">
                      <strong className="service-cat-title">{item.name}</strong>
                      <div className="progress-item-numbers">
                        <span className="service-booking-count">{item.count} bookings</span>
                        <span className="service-rev-val">₹{item.revenue.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.max(8, item.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Financial Payout & Money Withdrawal Card */}
          <div className="financial-payout-card">
            <div className="payout-card-left">
              <div className="payout-badge-row">
                <span className="payout-status-chip">ADMIN PAYOUT WALLET</span>
                <span className="payout-flat-fee-note">🛡️ Compulsory ₹{FIXED_PLATFORM_COMMISSION} Flat Fee Model</span>
              </div>
              <h3 className="payout-title">Platform Net Earnings & Fund Withdrawal</h3>
              <p className="payout-desc">
                Har completed booking ka fixed ₹{FIXED_PLATFORM_COMMISSION} commission platform wallet me jama hota hai.
                Available balance ko company bank account ya UPI me transfer karein.
              </p>

              <div className="payout-metrics-row">
                <div className="payout-metric-col available-col">
                  <small>Available to Withdraw</small>
                  <strong className="available-amount">₹{availableWithdrawalBalance.toLocaleString('en-IN')}</strong>
                  <span className="payout-hint">Instant UPI / IMPS</span>
                </div>
                <div className="payout-metric-divider" />
                <div className="payout-metric-col">
                  <small>Total Platform Net</small>
                  <strong>₹{totalFixedCommission.toLocaleString('en-IN')}</strong>
                  <span className="payout-subtext">{completed.length} completed jobs</span>
                </div>
                <div className="payout-metric-col">
                  <small>Total Withdrawn</small>
                  <strong className="withdrawn-amount">₹{totalApprovedWithdrawn.toLocaleString('en-IN')}</strong>
                  <span className="payout-subtext">Approved payouts</span>
                </div>
                {totalPendingWithdrawn > 0 && (
                  <div className="payout-metric-col pending-col">
                    <small>In Processing</small>
                    <strong className="pending-amount">₹{totalPendingWithdrawn.toLocaleString('en-IN')}</strong>
                    <span className="payout-subtext">Pending approval</span>
                  </div>
                )}
              </div>
            </div>

            <div className="payout-card-right">
              <button
                type="button"
                className="button button-gold button-large request-payout-btn"
                onClick={() => {
                  setWithdrawalError('');
                  setWithdrawalModalOpen(true);
                }}
                disabled={availableWithdrawalBalance <= 0}
                title={availableWithdrawalBalance <= 0 ? 'No available earnings to withdraw' : 'Request payout to bank or UPI'}
              >
                <span>💸</span> Request Withdrawal / Payout
              </button>
              <button
                type="button"
                className="text-button view-withdrawals-link"
                onClick={() => setActive('withdrawals')}
              >
                View Payout History ({withdrawalsList.length}) →
              </button>
            </div>
          </div>

          <div className="admin-overview-grid">
            <section className="table-card">
              <div className="table-card-header">
                <div>
                  <h3>Recent Bookings</h3>
                  <p>Latest customer service requests</p>
                </div>
                <button className="text-button" onClick={() => setActive('bookings')}>
                  View all ({data.bookings.length}) →
                </button>
              </div>

              {recentBookings.length === 0 ? (
                <EmptyState
                  icon="▤"
                  title="No bookings yet"
                  message="Customer panel se jab booking create hogi, woh yahan aayegi."
                  action={
                    <button className="button button-outline button-small" onClick={() => setActive('bookings')}>
                      Open bookings
                    </button>
                  }
                />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Customer / Service</th>
                        <th>Price</th>
                        <th>Fixed Fee</th>
                        <th>Status</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map((booking) => (
                        <tr key={booking.id}>
                          <td>
                            <strong>{booking.id}</strong>
                            <small className="cell-subline">{booking.area}</small>
                          </td>
                          <td>
                            {booking.customerName}
                            <small className="cell-subline">{booking.serviceName}</small>
                          </td>
                          <td>₹{Number(booking.price).toLocaleString('en-IN')}</td>
                          <td>
                            <span className="fixed-fee-tag">₹{FIXED_PLATFORM_COMMISSION}</span>
                          </td>
                          <td>
                            <StatusBadge status={booking.status} />
                          </td>
                          <td>
                            {booking.status === 'Completed' ? (
                              <button
                                type="button"
                                className="button button-small button-outline invoice-trigger-btn"
                                onClick={() => setInvoiceBooking(booking)}
                                title="View / Print Tax Invoice"
                              >
                                🧾 Invoice
                              </button>
                            ) : (
                              <small className="muted">-</small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="activity-card">
              <div className="table-card-header">
                <div>
                  <h3>Platform Activity Log</h3>
                  <p>Step events & audit updates</p>
                </div>
              </div>
              {data.activity.length === 0 ? (
                <EmptyState icon="◷" title="No activity yet" message="Real-time actions will log here." />
              ) : (
                <div className="activity-list">
                  {data.activity.slice(0, 8).map((activity) => (
                    <div className="activity-row" key={activity.id}>
                      <span className="activity-dot" />
                      <div>
                        <p>{activity.message}</p>
                        <small>{activity.at}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="admin-shortcuts">
            <button onClick={() => setActive('progress')}>
              <span>📈</span>
              <strong>Progress & Growth Graphs</strong>
              <small>Visual trends, commission & analytics</small>
              <b>→</b>
            </button>
            <button onClick={() => setActive('customers')}>
              <span>♙</span>
              <strong>Customer Directory ({data.customers.length})</strong>
              <small>View address, pincode & booking history</small>
              <b>→</b>
            </button>
            <button onClick={() => setActive('technicians')}>
              <span>🧰</span>
              <strong>Verify Technicians ({data.technicians.filter((t) => t.status !== 'Verified').length} pending)</strong>
              <small>{data.technicians.length} total registered partners</small>
              <b>→</b>
            </button>
            <button onClick={() => setActive('withdrawals')}>
              <span>💸</span>
              <strong>Admin Payouts (₹{availableWithdrawalBalance.toLocaleString('en-IN')})</strong>
              <small>Withdraw platform commission via UPI/Bank</small>
              <b>→</b>
            </button>
          </div>
        </>
      )}

      {/* PROGRESS & ANALYTICS TAB THROUGH GRAPHS */}
      {active === 'progress' && (
        <ProgressGraphsTab
          bookings={data.bookings}
          customers={data.customers}
          technicians={data.technicians}
          fixedCommission={FIXED_PLATFORM_COMMISSION}
        />
      )}

      {/* ALL BOOKINGS TAB */}
      {active === 'bookings' && (
        <>
          <PageHeading eyebrow="BOOKING OPERATIONS" title="All Bookings & Assignments">
            <span className="result-count">{filteredAdminBookings.length} of {data.bookings.length} records</span>
          </PageHeading>

          {/* Real-Time Search & Status Filter Toolbar */}
          <div className="filter-controls-bar">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="search"
                value={adminBookingSearch}
                onChange={(e) => setAdminBookingSearch(e.target.value)}
                placeholder="Search by Booking ID, customer name, phone, area, service, or technician..."
                className="catalogue-search-input"
              />
              {adminBookingSearch && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setAdminBookingSearch('')}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="status-filter-pills-row">
              {['all', 'Pending', 'Accepted', 'In Progress', 'Completed', 'Cancelled'].map((st) => {
                const count =
                  st === 'all'
                    ? data.bookings.length
                    : data.bookings.filter((b) => b.status.toLowerCase() === st.toLowerCase()).length;
                return (
                  <button
                    key={st}
                    type="button"
                    className={`status-filter-pill ${adminStatusFilter === st ? 'active' : ''}`}
                    onClick={() => setAdminStatusFilter(st)}
                  >
                    {st === 'all' ? 'All Bookings' : st}
                    <span className="pill-count">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Booking & Work Step Manager</h3>
                <p>Assign verified technician, advance work status, or view official GST invoices.</p>
              </div>
            </div>

            {data.bookings.length === 0 ? (
              <EmptyState
                icon="▤"
                title="No bookings to manage"
                message="Customer panel mein test booking create karke wapas yahan dekhein."
              />
            ) : filteredAdminBookings.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No bookings match your filters"
                message={
                  adminBookingSearch
                    ? `No bookings found for "${adminBookingSearch}". Try adjusting your search query or status filter.`
                    : `No bookings found with status "${adminStatusFilter}".`
                }
                action={
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={() => {
                      setAdminBookingSearch('');
                      setAdminStatusFilter('all');
                    }}
                  >
                    Reset Search & Filters
                  </button>
                }
              />
            ) : (
              <div className="table-scroll">
                <table className="wide-table">
                  <thead>
                    <tr>
                      <th>Booking / Customer</th>
                      <th>Service Details</th>
                      <th>Technician Assignment</th>
                      <th>Price & Fixed Fee</th>
                      <th>Status & Step</th>
                      <th>Tax Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredAdminBookings]
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map((booking) => (
                        <tr key={booking.id}>
                          <td>
                            <strong>{booking.id}</strong>
                            <small className="cell-subline">{booking.customerName}</small>
                            <small className="cell-subline">📞 {booking.phone}</small>
                            <small className="cell-subline">📍 {booking.address} {booking.pincode ? `(${booking.pincode})` : ''}</small>
                          </td>
                          <td>
                            <strong>{booking.serviceName}</strong>
                            {booking.subcategoryName && (
                              <small className="cell-subline">{booking.subcategoryName}</small>
                            )}
                            <small className="cell-subline">
                              {booking.area} · {booking.date} · {booking.time}
                            </small>
                            <small className="cell-subline">Payment: {booking.payment}</small>
                          </td>
                          <td>
                            <select
                              aria-label={`Assign technician to ${booking.id}`}
                              value={booking.technicianId || ''}
                              onChange={(e) => setBookingAssignment(booking, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {data.technicians
                                .filter((tech) => tech.status === 'Verified')
                                .map((tech) => (
                                  <option key={tech.id} value={tech.id}>
                                    {tech.name} ({tech.area})
                                  </option>
                                ))}
                            </select>
                            {booking.technicianName && (
                              <small className="cell-subline">
                                Assigned: {booking.technicianName} ({booking.technicianPhone || 'N/A'})
                              </small>
                            )}
                          </td>
                          <td>
                            <strong>₹{Number(booking.price).toLocaleString('en-IN')}</strong>
                            <small className="cell-subline">
                              Compulsory Platform Fee: <b className="fixed-fee-tag">₹{FIXED_PLATFORM_COMMISSION}</b>
                            </small>
                            <small className="cell-subline">
                              Tech Share: ₹{Number(booking.price) - FIXED_PLATFORM_COMMISSION}
                            </small>
                          </td>
                          <td>
                            <select
                              aria-label={`Status for ${booking.id}`}
                              value={booking.status}
                              onChange={(e) => setBookingStatus(booking, e.target.value)}
                            >
                              {bookingStatuses.map((status) => (
                                <option key={status}>{status}</option>
                              ))}
                            </select>
                            <div className="table-status-badge">
                              <StatusBadge status={booking.status} />
                            </div>
                            {booking.rating && (
                              <small className="rating-mini-badge">
                                ⭐ {booking.rating}/5 "{booking.review}"
                              </small>
                            )}
                          </td>
                          <td>
                            {booking.status === 'Completed' ? (
                              <button
                                type="button"
                                className="button button-small button-outline invoice-trigger-btn"
                                onClick={() => setInvoiceBooking(booking)}
                                title="View & print official receipt"
                              >
                                <span>🧾</span> View Invoice
                              </button>
                            ) : (
                              <small className="muted">Pending completion</small>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TECHNICIANS TAB */}
      {active === 'technicians' && (
        <>
          <PageHeading eyebrow="WORKFORCE MANAGEMENT" title="Technician Partners">
            <button className="button button-primary button-small" onClick={() => setTechFormOpen((v) => !v)}>
              {techFormOpen ? 'Cancel' : '+ Add Technician'}
            </button>
          </PageHeading>

          {techFormOpen && (
            <form className="form-card admin-add-form" onSubmit={addNewTechnician}>
              <h3>Add Technician Manually</h3>
              <div className="form-grid">
                <Field label="Full Name *">
                  <input
                    required
                    value={techForm.name}
                    onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                  />
                </Field>
                <Field label="Mobile Number *">
                  <input
                    required
                    maxLength="10"
                    inputMode="numeric"
                    value={techForm.phone}
                    onChange={(e) =>
                      setTechForm({ ...techForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                    }
                  />
                </Field>
                <Field label="Area">
                  <select
                    value={techForm.area}
                    onChange={(e) => setTechForm({ ...techForm, area: e.target.value })}
                  >
                    {areas.map((area) => (
                      <option key={area}>{area}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Skills">
                  <input
                    required
                    value={techForm.skills}
                    onChange={(e) => setTechForm({ ...techForm, skills: e.target.value })}
                  />
                </Field>
                <Field label="Aadhaar Number">
                  <input
                    value={techForm.aadhaar}
                    onChange={(e) => setTechForm({ ...techForm, aadhaar: e.target.value })}
                    placeholder="XXXX XXXX XXXX"
                  />
                </Field>
                <Field label="Email ID">
                  <input
                    type="email"
                    value={techForm.email}
                    onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
                  />
                </Field>
              </div>
              <button className="button button-primary" type="submit">
                Save Technician
              </button>
            </form>
          )}

          <div className="stats-grid mini-stat-grid">
            <StatCard label="Total Technicians" value={data.technicians.length} icon="🧰" />
            <StatCard label="Verified" value={verifiedTechs} icon="✓" />
            <StatCard
              label="Pending Verification"
              value={data.technicians.length - verifiedTechs}
              icon="◷"
            />
          </div>

          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Technician Directory & Verification</h3>
                <p>Verify partners and review customer ratings.</p>
              </div>
            </div>

            {data.technicians.length === 0 ? (
              <EmptyState
                icon="🧰"
                title="No technicians registered yet"
                message="Add your first technician or register from Technician Panel."
                action={
                  <button className="button button-primary" onClick={() => setTechFormOpen(true)}>
                    + Add Technician
                  </button>
                }
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Technician</th>
                      <th>Skills / Area</th>
                      <th>Rating & Reviews</th>
                      <th>Jobs Done</th>
                      <th>Verification</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.technicians.map((tech) => (
                      <tr key={tech.id}>
                        <td>
                          <div className="table-person">
                            <span className="person-avatar">{tech.name.charAt(0).toUpperCase()}</span>
                            <span>
                              <strong>{tech.name}</strong>
                              <small>{tech.id}</small>
                              <small>📞 {tech.phone}</small>
                              {tech.aadhaar && <small>Aadhaar: {tech.aadhaar}</small>}
                            </span>
                          </div>
                        </td>
                        <td>
                          {tech.skills}
                          <small className="cell-subline">{tech.area}</small>
                        </td>
                        <td>
                          <strong>⭐ {tech.rating || 5.0}</strong>
                          <small className="cell-subline">{tech.ratingCount || 0} customer ratings</small>
                          <button
                            type="button"
                            className="button button-small button-quiet view-tech-reviews-btn"
                            style={{ marginTop: '5px' }}
                            onClick={() => setSelectedTechForReviews(tech)}
                            title="View customer feedback and comments"
                          >
                            ⭐ View Reviews
                          </button>
                        </td>
                        <td>
                          {data.bookings.filter((b) => b.technicianId === tech.id && b.status === 'Completed').length}
                        </td>
                        <td>
                          <StatusBadge status={tech.status} />
                        </td>
                        <td>
                          <div className="action-button-row">
                            {tech.status !== 'Verified' ? (
                              <button
                                className="button button-small button-primary"
                                onClick={() => {
                                  updateTechnician(tech.id, { status: 'Verified' });
                                  setNotice(`${tech.name} verified ho gaye.`);
                                }}
                              >
                                Approve & Verify
                              </button>
                            ) : (
                              <button
                                className="button button-small button-outline"
                                onClick={() => {
                                  updateTechnician(tech.id, { status: 'Pending Verification' });
                                  setNotice(`${tech.name} verification hold par rakhi gayi.`);
                                }}
                              >
                                Put On Hold
                              </button>
                            )}
                            <button
                              className="button button-small button-quiet"
                              onClick={() => {
                                updateTechnician(tech.id, { isOnline: !tech.isOnline });
                                setNotice(`${tech.name} online status toggle hua.`);
                              }}
                            >
                              {tech.isOnline ? 'Set Offline' : 'Set Online'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* CUSTOMERS TAB (Prominently displaying Customer Count) */}
      {active === 'customers' && (
        <>
          <PageHeading eyebrow="CUSTOMER RELATIONSHIPS" title="Registered Customers">
            <span className="result-count">{data.customers.length} total customer profiles</span>
          </PageHeading>

          <div className="stats-grid mini-stat-grid">
            <StatCard label="Total Customer Base" value={data.customers.length} icon="♙" note="Verified via OTP" />
            <StatCard
              label="Repeat Customers"
              value={data.customers.filter((c) => (c.bookings || 0) > 1).length}
              icon="★"
              note="Booked 2+ times"
            />
            <StatCard
              label="Total Orders Placed"
              value={data.bookings.length}
              icon="▤"
              note="Across all service areas"
            />
          </div>

          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Customer Directory & OTP Verified Accounts</h3>
                <p>Profiles created during customer signup & OTP verification.</p>
              </div>
            </div>

            {data.customers.length === 0 ? (
              <EmptyState
                icon="♙"
                title="No customer profiles yet"
                message="Customer panel se jab customer signup karega ya booking banayega, data yahan appear hoga."
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mobile (OTP Verified)</th>
                      <th>Address & Pincode</th>
                      <th>Area</th>
                      <th>Total Bookings</th>
                      <th>Account Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <div className="table-person">
                            <span className="person-avatar">{customer.name.charAt(0).toUpperCase()}</span>
                            <span>
                              <strong>{customer.name}</strong>
                              <small>{customer.id}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>📞 {customer.phone}</strong>
                        </td>
                        <td>
                          {customer.address || 'Address provided on booking'}
                          {customer.pincode && (
                            <small className="cell-subline">Pincode: {customer.pincode}</small>
                          )}
                        </td>
                        <td>{customer.area}</td>
                        <td>
                          <strong>{data.bookings.filter((b) => b.phone === customer.phone).length}</strong>
                        </td>
                        <td>
                          <StatusBadge status={customer.status || 'Active'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* SERVICES & PRICING CATALOGUE TAB */}
      {active === 'services' && (
        <>
          <PageHeading eyebrow="CATALOGUE MANAGEMENT" title="Services, Subservices & Pricing Catalogue">
            <div className="catalogue-heading-actions">
              <span className="result-count">{filteredAdminServices.length} of {data.services.length} services</span>
              <button
                type="button"
                className="button button-gold button-small"
                onClick={() => setServiceModalOpen(true)}
              >
                <span>✦</span> + Add New Service
              </button>
            </div>
          </PageHeading>

          {/* Real-time Search and Category Filter Toolbar */}
          <div className="filter-controls-bar">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="search"
                placeholder="Search services or subservices (e.g. AC, Jet wash, Washing Machine)..."
                value={adminServiceSearch}
                onChange={(e) => setAdminServiceSearch(e.target.value)}
              />
              {adminServiceSearch && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setAdminServiceSearch('')}
                >
                  ×
                </button>
              )}
            </div>

            <div className="filter-status-pills">
              {[
                { id: 'all', label: 'All Categories' },
                { id: 'appliance', label: 'Appliance Repair' },
                { id: 'electrical', label: 'Electrical & Wiring' },
                { id: 'cleaning', label: 'Cleaning & Sanitization' },
                { id: 'plumbing', label: 'Plumbing & Repairs' },
                { id: 'general', label: 'General / Handyman' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`status-filter-pill ${adminServiceCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setAdminServiceCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {filteredAdminServices.length === 0 ? (
            <EmptyState
              icon="✦"
              title="No services match your search or filter"
              message="Category filter change karein ya naya service catalogue me add karein."
              action={
                <button
                  className="button button-gold button-small"
                  onClick={() => setServiceModalOpen(true)}
                >
                  + Add New Service
                </button>
              }
            />
          ) : (
            <div className="admin-service-management-grid">
              {filteredAdminServices.map((service) => (
                <article className="admin-service-mgmt-card" key={service.id}>
                  {/* Card Header & Base Price Row */}
                  <div className="service-mgmt-header">
                    <div className="service-mgmt-identity">
                      <div className="admin-service-icon-lg">{service.icon}</div>
                      <div>
                        <div className="service-badge-strip">
                          <span className="category-pill">{service.category}</span>
                          <span className="service-active-pill">Active Catalogue</span>
                        </div>
                        <h3>{service.name}</h3>
                        <p>{service.description}</p>
                      </div>
                    </div>

                    <div className="admin-base-price-box">
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                          <label htmlFor={`base-price-${service.id}`} style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>Price (₹)</label>
                          <div className="price-edit-row">
                            <span className="currency-prefix">₹</span>
                            <input
                              id={`base-price-${service.id}`}
                              type="number"
                              min="0"
                              step="1"
                              style={{ width: '85px' }}
                              value={priceDrafts[service.id] ?? service.price}
                              onChange={(e) =>
                                setPriceDrafts({ ...priceDrafts, [service.id]: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`comm-fee-${service.id}`} style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>Commission Fee (₹)</label>
                          <div className="price-edit-row">
                            <span className="currency-prefix">₹</span>
                            <input
                              id={`comm-fee-${service.id}`}
                              type="number"
                              min="0"
                              step="1"
                              style={{ width: '85px' }}
                              value={commissionDrafts[service.id] ?? (service.commission_fee ?? service.commissionFee ?? 149)}
                              onChange={(e) =>
                                setCommissionDrafts({ ...commissionDrafts, [service.id]: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="button button-small button-primary"
                            onClick={() => savePrice(service)}
                            title="Save starting base rate & commission"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="button button-small button-danger"
                            onClick={() => setDeleteServiceModal(service)}
                            title={`Permanently delete ${service.name}`}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subservices & Packages Management Section */}
                  <div className="subservices-mgmt-section">
                    <div className="subservices-section-head">
                      <div>
                        <h4>
                          Subservices & Packages <span>({service.subcategories?.length || 0})</span>
                        </h4>
                        <small>Subservice rate edit karein ya naya subservice package add karein.</small>
                      </div>
                      <button
                        type="button"
                        className="button button-small button-outline add-subservice-btn"
                        onClick={() => {
                          setAddingSubserviceFor(addingSubserviceFor === service.id ? null : service.id);
                          setNewSubForm({ name: '', price: '', commission_fee: String(service.commission_fee || 149), time: '45 mins', description: '' });
                        }}
                      >
                        {addingSubserviceFor === service.id ? '✕ Close Form' : '+ Add Subservice'}
                      </button>
                    </div>

                    {/* Inline Add Subservice Form */}
                    {addingSubserviceFor === service.id && (
                      <div className="inline-add-subservice-box">
                        <h5>Add New Subservice to {service.name}</h5>
                        <div className="inline-sub-form-grid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr 1fr' }}>
                          <input
                            type="text"
                            placeholder="Subservice Name (e.g. Foam Jet Deep Clean)"
                            value={newSubForm.name}
                            onChange={(e) => setNewSubForm({ ...newSubForm, name: e.target.value })}
                            required
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Price (₹)"
                            value={newSubForm.price}
                            onChange={(e) => setNewSubForm({ ...newSubForm, price: e.target.value })}
                            required
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Commission (₹)"
                            value={newSubForm.commission_fee}
                            onChange={(e) => setNewSubForm({ ...newSubForm, commission_fee: e.target.value })}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Duration (e.g. 45 mins)"
                            value={newSubForm.time}
                            onChange={(e) => setNewSubForm({ ...newSubForm, time: e.target.value })}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Brief package description (optional)"
                          value={newSubForm.description}
                          onChange={(e) => setNewSubForm({ ...newSubForm, description: e.target.value })}
                          className="sub-desc-input"
                        />
                        <div className="inline-sub-actions">
                          <button
                            type="button"
                            className="button button-small button-outline"
                            onClick={() => setAddingSubserviceFor(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="button button-small button-gold"
                            onClick={() => handleCreateSubservice(service.id)}
                            disabled={!newSubForm.name.trim() || !newSubForm.price}
                          >
                            Save Subservice
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subservices List */}
                    {(!service.subcategories || service.subcategories.length === 0) ? (
                      <div className="empty-subservices-note">
                        <span>ℹ️</span> No subservices listed for this service. Customers will book at base rate ₹{service.price}.
                      </div>
                    ) : (
                      <div className="subservices-table-wrap">
                        <table className="subservices-table">
                          <thead>
                            <tr>
                              <th>Subservice Name & Description</th>
                              <th style={{ width: '90px' }}>Est. Time</th>
                              <th style={{ width: '130px' }}>Price (₹)</th>
                              <th style={{ width: '130px' }}>Commission (₹)</th>
                              <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {service.subcategories.map((sub) => {
                              const currentPrice = sub.price ?? 0;
                              const currentComm = sub.commission_fee ?? sub.commissionFee ?? sub.commission ?? service.commission_fee ?? 149;
                              const draftPrice = subPriceDrafts[sub.id] ?? currentPrice;
                              const draftComm = subCommDrafts[sub.id] ?? currentComm;
                              const isPriceModified = Number(draftPrice) !== Number(currentPrice);
                              const isCommModified = Number(draftComm) !== Number(currentComm);
                              const isModified = isPriceModified || isCommModified;
                              return (
                                <tr key={sub.id}>
                                  <td>
                                    <strong className="subservice-name-text">{sub.name}</strong>
                                    {sub.description && (
                                      <small className="subservice-desc-text">{sub.description}</small>
                                    )}
                                  </td>
                                  <td>
                                    <span className="subservice-time-chip">⏱️ {sub.time || '45 mins'}</span>
                                  </td>
                                  <td>
                                    <div className="subservice-price-edit-row">
                                      <span className="sub-currency">₹</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className={`subservice-price-input ${isPriceModified ? 'price-input-dirty' : ''}`}
                                        value={draftPrice}
                                        onChange={(e) =>
                                          setSubPriceDrafts({
                                            ...subPriceDrafts,
                                            [sub.id]: e.target.value,
                                          })
                                        }
                                        title={`Price for ${sub.name}`}
                                      />
                                    </div>
                                  </td>
                                  <td>
                                    <div className="subservice-price-edit-row">
                                      <span className="sub-currency" style={{ color: '#0d9488' }}>₹</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className={`subservice-price-input ${isCommModified ? 'price-input-dirty' : ''}`}
                                        value={draftComm}
                                        onChange={(e) =>
                                          setSubCommDrafts({
                                            ...subCommDrafts,
                                            [sub.id]: e.target.value,
                                          })
                                        }
                                        title={`Commission Fee for ${sub.name}`}
                                      />
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <button
                                      type="button"
                                      className={`button button-small ${isModified ? 'button-gold' : 'button-outline'}`}
                                      onClick={() => saveSubPrice(service.id, sub)}
                                      title={`Save ${sub.name} price & commission`}
                                      style={{ marginRight: '6px' }}
                                    >
                                      {isModified ? 'Update' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      className="button button-small button-danger"
                                      onClick={() => setDeleteSubserviceModal({ serviceId: service.id, serviceName: service.name, sub })}
                                      title={`Delete package ${sub.name}`}
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* COMPLAINTS TAB */}
      {active === 'complaints' && (
        <>
          <PageHeading eyebrow="CUSTOMER SUPPORT" title="Customer Complaints & Grievances">
            <span className="result-count">{data.complaints.length} total</span>
          </PageHeading>

          {data.complaints.length === 0 ? (
            <EmptyState
              icon="✉"
              title="No complaints yet"
              message="Customer panel ke Help & complaint section se test complaint submit kar sakte hain."
            />
          ) : (
            <div className="complaint-list">
              {data.complaints.map((item) => (
                <article className="complaint-card" key={item.id}>
                  <div className="complaint-card-top">
                    <div>
                      <span className="booking-id">{item.id}</span>
                      <h3>{item.customerName}</h3>
                      <p>
                        📞 {item.phone} {item.bookingId ? `· Booking Ref: ${item.bookingId}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="complaint-message">{item.message}</p>
                  <div className="complaint-actions">
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                    <select
                      aria-label={`Update complaint ${item.id}`}
                      value={item.status}
                      onChange={(e) => {
                        updateComplaint(item.id, e.target.value);
                        setNotice(`${item.id} status update hua.`);
                      }}
                    >
                      <option>Open</option>
                      <option>In Review</option>
                      <option>Resolved</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* ADMIN WITHDRAWALS & PAYOUTS TAB */}
      {active === 'withdrawals' && (
        <>
          <PageHeading eyebrow="FINANCIAL OPERATIONS" title="Admin Money Withdrawals & Payouts">
            <span className="result-count">{withdrawalsList.length} total payout records</span>
          </PageHeading>

          {/* FinTech Withdrawal Hero Banner */}
          <div className="withdrawal-hero-banner">
            <div className="withdrawal-hero-left">
              <span className="eyebrow eyebrow-gold">PLATFORM NET EARNINGS WALLET</span>
              <h2>₹{availableWithdrawalBalance.toLocaleString('en-IN')}</h2>
              <p>Available platform earnings ready for instant withdrawal to company bank account or UPI.</p>
              <div className="hero-audit-notes">
                <span>🛡️ Compulsory ₹{FIXED_PLATFORM_COMMISSION} flat fee per completed booking</span>
                <span>⚡ Instant IMPS / UPI transfer</span>
              </div>
            </div>
            <div className="withdrawal-hero-right">
              <button
                type="button"
                className="button button-gold button-large"
                onClick={() => {
                  setWithdrawalError('');
                  setWithdrawalModalOpen(true);
                }}
                disabled={availableWithdrawalBalance <= 0}
              >
                <span>💸</span> Request Withdrawal / Payout
              </button>
              <small className="hero-balance-note">
                {availableWithdrawalBalance <= 0
                  ? 'Zero balance available to withdraw.'
                  : `Up to ₹${availableWithdrawalBalance.toLocaleString('en-IN')} ready for withdrawal`}
              </small>
            </div>
          </div>

          <div className="stats-grid">
            <StatCard
              label="Available for Withdrawal"
              value={`₹${availableWithdrawalBalance.toLocaleString('en-IN')}`}
              icon="💸"
              note="Net unwithdrawn platform commission"
            />
            <StatCard
              label="Total Platform Earnings"
              value={`₹${totalFixedCommission.toLocaleString('en-IN')}`}
              icon="🛡️"
              note={`${completed.length} completed jobs × ₹${FIXED_PLATFORM_COMMISSION}`}
            />
            <StatCard
              label="Total Approved Payouts"
              value={`₹${totalApprovedWithdrawn.toLocaleString('en-IN')}`}
              icon="✓"
              note={`${withdrawalsList.filter((w) => w.status === 'Approved').length} processed transfers`}
            />
            <StatCard
              label="Pending Processing"
              value={`₹${totalPendingWithdrawn.toLocaleString('en-IN')}`}
              icon="⏳"
              note={`${withdrawalsList.filter((w) => w.status === 'Pending').length} pending requests`}
            />
          </div>

          {/* Fixed Commission Banner */}
          <div className="fixed-commission-highlight-box">
            <span>🛡️</span>
            <div>
              <strong>Compulsory Fixed ₹{FIXED_PLATFORM_COMMISSION} Platform Commission Policy</strong>
              <p>
                Platform revenue is derived strictly from a flat ₹{FIXED_PLATFORM_COMMISSION} charge on each completed job.
                Technicians receive 100% of their service and spare parts balance.
              </p>
            </div>
          </div>

          {/* Withdrawal & Payout History Table */}
          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Withdrawal & Payout History</h3>
                <p>Real-time audit log of all admin payout requests and direct transfers.</p>
              </div>
              <button
                type="button"
                className="button button-gold button-small"
                onClick={() => {
                  setWithdrawalError('');
                  setWithdrawalModalOpen(true);
                }}
                disabled={availableWithdrawalBalance <= 0}
              >
                + New Withdrawal
              </button>
            </div>

            {withdrawalsList.length === 0 ? (
              <EmptyState
                icon="💸"
                title="No withdrawals recorded yet"
                message="Platform earnings accumulate at ₹149 per completed job. Complete bookings to unlock withdrawals."
                action={
                  <button
                    className="button button-gold button-small"
                    onClick={() => {
                      setWithdrawalError('');
                      setWithdrawalModalOpen(true);
                    }}
                    disabled={availableWithdrawalBalance <= 0}
                  >
                    Request Payout
                  </button>
                }
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Payout ID</th>
                      <th>Requested At</th>
                      <th>Amount (₹)</th>
                      <th>Beneficiary Bank / UPI</th>
                      <th>Status</th>
                      <th>Admin Notes / Processed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalsList.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.id}</strong>
                        </td>
                        <td>
                          {new Date(item.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <strong className="payout-amount-val">₹{Number(item.amount).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>
                          <span className="payout-beneficiary-tag">🏦 {item.bankDetails}</span>
                        </td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td>
                          <small className="cell-subline">
                            {item.adminNotes || 'Platform earnings payout'}
                          </small>
                          {item.processedAt && (
                            <small className="muted cell-subline">
                              Processed: {new Date(item.processedAt).toLocaleDateString('en-IN')}
                            </small>
                          )}
                        </td>
                        <td>
                          {item.status === 'Pending' ? (
                            <div className="action-button-row">
                              <button
                                type="button"
                                className="button button-small button-primary"
                                style={{ padding: '6px 10px', fontSize: '10px' }}
                                onClick={() => handleApproveWithdrawal(item.id)}
                                title="Approve payout and mark as dispatched"
                              >
                                ✓ Approve
                              </button>
                              <button
                                type="button"
                                className="button button-small button-danger"
                                style={{ padding: '6px 10px', fontSize: '10px' }}
                                onClick={() => handleRejectWithdrawal(item.id)}
                                title="Reject payout request"
                              >
                                ✕ Reject
                              </button>
                            </div>
                          ) : item.status === 'Approved' ? (
                            <span className="payout-dispatched-chip">Dispatched ✅</span>
                          ) : (
                            <span className="payout-rejected-chip">Rejected ✕</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* FIXED COMMISSION REPORTS TAB */}
      {active === 'reports' && (
        <>
          <PageHeading eyebrow="FINANCE & OPERATIONS" title="Fixed ₹149 Commission Reports" />

          <div className="reports-hero">
            <div>
              <p className="eyebrow eyebrow-gold">COMPULSORY FIXED COMMISSION MODEL</p>
              <h2>₹{totalFixedCommission.toLocaleString('en-IN')}</h2>
              <p>Platform Revenue (Strictly ₹{FIXED_PLATFORM_COMMISSION} flat per completed job)</p>
            </div>
            <span className="reports-hero-icon">₹</span>
          </div>

          <div className="reports-withdrawal-strip">
            <div className="reports-withdrawal-info">
              <span className="reports-strip-tag">AVAILABLE FOR PAYOUT</span>
              <strong className="reports-avail-num">₹{availableWithdrawalBalance.toLocaleString('en-IN')}</strong>
              <small>Fixed Platform Revenue ₹{totalFixedCommission.toLocaleString('en-IN')} · Withdrawn ₹{totalApprovedWithdrawn.toLocaleString('en-IN')}</small>
            </div>
            <button
              type="button"
              className="button button-gold button-small"
              onClick={() => {
                setWithdrawalError('');
                setWithdrawalModalOpen(true);
              }}
              disabled={availableWithdrawalBalance <= 0}
            >
              <span>💸</span> Request Payout
            </button>
          </div>

          <div className="stats-grid">
            <StatCard
              label="Completed Jobs Value"
              value={`₹${totalVolume.toLocaleString('en-IN')}`}
              icon="▤"
              note={`${completed.length} completed bookings`}
            />
            <StatCard
              label={`Platform Share (₹${FIXED_PLATFORM_COMMISSION} Fixed / Job)`}
              value={`₹${totalFixedCommission.toLocaleString('en-IN')}`}
              icon="🛡️"
              note="Strict compulsory commission"
            />
            <StatCard
              label="Technician Net Share"
              value={`₹${totalTechnicianPayout.toLocaleString('en-IN')}`}
              icon="🧰"
              note="Gross minus ₹149 per job"
            />
            <StatCard
              label="Average Job Ticket"
              value={completed.length ? `₹${Math.round(totalVolume / completed.length)}` : '₹0'}
              icon="✓"
              note="Per completed booking"
            />
          </div>

          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Fixed Commission Ledger Breakdown</h3>
                <p>Calculated at ₹{FIXED_PLATFORM_COMMISSION} flat fee per completed service record.</p>
              </div>
            </div>

            {completed.length === 0 ? (
              <EmptyState
                icon="₹"
                title="No completed jobs to report"
                message="Admin ya technician panel se booking complete karein."
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Service / Customer</th>
                      <th>Gross Price</th>
                      <th>Compulsory Commission</th>
                      <th>Technician Share</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.id}</td>
                        <td>
                          {booking.serviceName}
                          <small className="cell-subline">Customer: {booking.customerName}</small>
                          <small className="cell-subline">
                            Tech: {booking.technicianName || 'Unassigned'}
                          </small>
                        </td>
                        <td>₹{Number(booking.price).toLocaleString('en-IN')}</td>
                        <td>
                          <strong className="fixed-fee-tag">₹{FIXED_PLATFORM_COMMISSION}</strong>
                        </td>
                        <td>
                          <strong>₹{(Number(booking.price) - FIXED_PLATFORM_COMMISSION).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>{booking.payment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="danger-zone">
            <div>
              <strong>Reset Local Demo Data</strong>
              <p>Delete demo bookings, profiles, customer accounts and complaints.</p>
            </div>
            <button className="button button-danger" onClick={clearDemo}>
              Reset Demo Data
            </button>
          </div>

          <div className="danger-zone" style={{ marginTop: '16px', border: '1.5px solid #ef4444', background: '#fff5f5' }}>
            <div>
              <strong style={{ color: '#b91c1c' }}>Purge All Mock Data (Production Clean Mode)</strong>
              <p style={{ color: '#7f1d1d' }}>
                Completely wipes all mock bookings, dummy technicians, test complaints, and simulated transactions from the live PostgreSQL database.
                Retains official service catalogue and provisions primary superuser (prabhat@gharsathi.in).
              </p>
            </div>
            <button
              type="button"
              className="button button-danger"
              style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
              onClick={() => setPurgeConfirmModal(true)}
            >
              Purge Database Now ⚠️
            </button>
          </div>
        </>
      )}
    </PanelShell>
    {invoiceBooking && (
      <InvoiceModal
        booking={invoiceBooking}
        onClose={() => setInvoiceBooking(null)}
      />
    )}
    {selectedTechForReviews && (
      <ReviewsModal
        technician={selectedTechForReviews}
        bookings={data.bookings}
        onClose={() => setSelectedTechForReviews(null)}
      />
    )}
    {withdrawalModalOpen && (
      <AdminWithdrawalModal
        isOpen={withdrawalModalOpen}
        onClose={() => {
          setWithdrawalModalOpen(false);
          setWithdrawalError('');
        }}
        availableBalance={availableWithdrawalBalance}
        formData={withdrawalForm}
        setFormData={setWithdrawalForm}
        onSubmit={handleWithdrawalSubmit}
        isSubmitting={withdrawalSubmitting}
        error={withdrawalError}
        setError={setWithdrawalError}
        onQuickPercent={handleQuickPercent}
      />
    )}
    {serviceModalOpen && (
      <AddServiceModal
        isOpen={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        onAddService={addService}
      />
    )}

    {/* Delete Service Confirmation Modal */}
    {deleteServiceModal && (
      <div className="modal-overlay" onClick={() => setDeleteServiceModal(null)}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
          <div className="modal-header">
            <div>
              <p className="eyebrow eyebrow-gold">CONFIRM SERVICE DELETION</p>
              <h3 style={{ color: '#dc2626' }}>Delete {deleteServiceModal.name}?</h3>
            </div>
            <button type="button" className="modal-close-btn" onClick={() => setDeleteServiceModal(null)}>✕</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5', color: '#4b6354' }}>
              Are you sure you want to permanently delete <strong>{deleteServiceModal.name}</strong> from the catalogue?
              All associated subservice packages ({deleteServiceModal.subcategories?.length || 0}) will also be removed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="button button-outline" onClick={() => setDeleteServiceModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={async () => {
                  await deleteService(deleteServiceModal.id);
                  setDeleteServiceModal(null);
                  setNotice(`Service "${deleteServiceModal.name}" deleted.`);
                }}
              >
                Confirm Delete Service 🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Delete Subservice Confirmation Modal */}
    {deleteSubserviceModal && (
      <div className="modal-overlay" onClick={() => setDeleteSubserviceModal(null)}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
          <div className="modal-header">
            <div>
              <p className="eyebrow eyebrow-gold">CONFIRM PACKAGE DELETION</p>
              <h3 style={{ color: '#dc2626' }}>Delete {deleteSubserviceModal.sub.name}?</h3>
            </div>
            <button type="button" className="modal-close-btn" onClick={() => setDeleteSubserviceModal(null)}>✕</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5', color: '#4b6354' }}>
              Remove package <strong>{deleteSubserviceModal.sub.name}</strong> (₹{deleteSubserviceModal.sub.price}) from <strong>{deleteSubserviceModal.serviceName}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="button button-outline" onClick={() => setDeleteSubserviceModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={async () => {
                  await deleteSubservice(deleteSubserviceModal.serviceId, deleteSubserviceModal.sub.id);
                  setDeleteSubserviceModal(null);
                  setNotice(`Package "${deleteSubserviceModal.sub.name}" deleted.`);
                }}
              >
                Confirm Delete Package 🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Production Purge Confirmation Modal */}
    {purgeConfirmModal && (
      <div className="modal-overlay" onClick={() => !isPurging && setPurgeConfirmModal(false)}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <div>
              <p className="eyebrow eyebrow-gold">PRODUCTION PURGE</p>
              <h3 style={{ color: '#dc2626' }}>Wipe All Mock/Demo Data?</h3>
            </div>
            <button type="button" className="modal-close-btn" disabled={isPurging} onClick={() => setPurgeConfirmModal(false)}>✕</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5', color: '#4b6354' }}>
              This will completely wipe all test bookings, mock complaints, dummy technicians, and simulated wallet entries from the live database.
            </p>
            <p style={{ fontSize: '12px', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', color: '#991b1b', border: '1px solid #fecaca' }}>
              ⚠️ The primary superuser <strong>prabhat@gharsathi.in</strong> (Gharsathi@2026) and official services catalog will remain intact.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="button button-outline" disabled={isPurging} onClick={() => setPurgeConfirmModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={async () => {
                  setIsPurging(true);
                  try {
                    await purgeProductionData();
                    setNotice('Production database purged cleanly. 0 demo records remain.');
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsPurging(false);
                    setPurgeConfirmModal(false);
                  }
                }}
              >
                {isPurging ? 'Purging Live Database…' : 'Yes, Purge Database Now ⚠️'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

/**
 * DEDICATED PROGRESS TAB THROUGH GRAPHS
 * Renders SVG Growth, Volume, Status Distribution, and Fixed Commission Trend Charts
 */
function ProgressGraphsTab({ bookings, customers, technicians, fixedCommission }) {
  const completedCount = bookings.filter((b) => b.status === 'Completed').length;
  const inProgressCount = bookings.filter((b) => b.status === 'In Progress').length;
  const acceptedCount = bookings.filter((b) => b.status === 'Accepted').length;
  const pendingCount = bookings.filter((b) => b.status === 'Pending').length;

  const totalCommission = completedCount * fixedCommission;

  // Category Breakdown
  const catCounts = {
    Appliance: bookings.filter((b) => (b.serviceId || '').match(/ac|washing|fridge|ro|cooler|geyser/)).length,
    Electrical: bookings.filter((b) => (b.serviceId || '').match(/electrician/)).length,
    Cleaning: bookings.filter((b) => (b.serviceId || '').match(/cleaning|chimney/)).length,
    Plumbing: bookings.filter((b) => (b.serviceId || '').match(/other/)).length,
  };

  // Mock / Calculated Monthly Growth Data
  const monthlyData = [
    { month: 'Jun', bookings: Math.max(2, Math.round(bookings.length * 0.2)), revenue: 149 * 2 },
    { month: 'Jul', bookings: Math.max(4, Math.round(bookings.length * 0.4)), revenue: 149 * 4 },
    { month: 'Aug', bookings: Math.max(7, Math.round(bookings.length * 0.6)), revenue: 149 * 7 },
    { month: 'Sep', bookings: Math.max(10, Math.round(bookings.length * 0.8)), revenue: 149 * 10 },
    { month: 'Oct (Current)', bookings: Math.max(14, bookings.length + 8), revenue: totalCommission || 149 * 12 },
  ];

  const maxBookings = Math.max(...monthlyData.map((d) => d.bookings), 16);

  return (
    <div className="progress-graphs-section">
      <PageHeading eyebrow="ANALYTICS & VISUAL PROGRESS" title="Progress & Growth Graphs">
        <span className="result-count">Real-time Platform Visualizations</span>
      </PageHeading>

      <div className="stats-grid">
        <StatCard
          label="Total Registered Customers"
          value={customers.length}
          icon="♙"
          note="Growing customer base"
        />
        <StatCard
          label="Total Platform Bookings"
          value={bookings.length}
          icon="📈"
          note={`${completedCount} completed`}
        />
        <StatCard
          label="Fixed Platform Revenue"
          value={`₹${totalCommission.toLocaleString('en-IN')}`}
          icon="🛡️"
          note={`₹${fixedCommission} × ${completedCount} jobs`}
        />
      </div>

      {/* GRAPH 1: MONTHLY BOOKING VOLUME & PROGRESS (SVG Bar & Trend Line) */}
      <section className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3>Monthly Service Booking Growth & Progress</h3>
            <p>Visual trend showing customer service request volume over time</p>
          </div>
          <span className="chart-badge">Volume Trend</span>
        </div>

        <div className="svg-chart-container">
          <svg viewBox="0 0 700 240" className="responsive-svg-chart">
            {/* Horizontal Grid lines */}
            <line x1="50" y1="30" x2="680" y2="30" stroke="#e8ece8" strokeDasharray="4 4" />
            <line x1="50" y1="80" x2="680" y2="80" stroke="#e8ece8" strokeDasharray="4 4" />
            <line x1="50" y1="130" x2="680" y2="130" stroke="#e8ece8" strokeDasharray="4 4" />
            <line x1="50" y1="180" x2="680" y2="180" stroke="#e8ece8" />

            {/* Y-Axis Labels */}
            <text x="35" y="34" className="svg-axis-text">{maxBookings}</text>
            <text x="35" y="84" className="svg-axis-text">{Math.round(maxBookings * 0.66)}</text>
            <text x="35" y="134" className="svg-axis-text">{Math.round(maxBookings * 0.33)}</text>
            <text x="35" y="184" className="svg-axis-text">0</text>

            {/* Bars & Points */}
            {monthlyData.map((d, index) => {
              const x = 90 + index * 125;
              const barHeight = (d.bookings / maxBookings) * 150;
              const y = 180 - barHeight;

              return (
                <g key={d.month} className="svg-bar-group">
                  {/* Background Bar */}
                  <rect
                    x={x}
                    y={y}
                    width="48"
                    height={barHeight}
                    rx="6"
                    className="svg-bar-fill"
                  />
                  {/* Top Highlight */}
                  <rect
                    x={x}
                    y={y}
                    width="48"
                    height="5"
                    rx="2"
                    fill="#d4af37"
                  />
                  {/* Value on top of bar */}
                  <text
                    x={x + 24}
                    y={y - 8}
                    textAnchor="middle"
                    className="svg-bar-value"
                  >
                    {d.bookings}
                  </text>
                  {/* Month Label */}
                  <text
                    x={x + 24}
                    y="205"
                    textAnchor="middle"
                    className="svg-axis-label"
                  >
                    {d.month}
                  </text>
                </g>
              );
            })}

            {/* Trend line overlay */}
            <polyline
              fill="none"
              stroke="#d4af37"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={monthlyData
                .map((d, index) => `${90 + index * 125 + 24},${180 - (d.bookings / maxBookings) * 150}`)
                .join(' ')}
            />
          </svg>
        </div>
      </section>

      {/* GRAPH 2 & 3: GRID LAYOUT */}
      <div className="progress-dual-grid">
        {/* GRAPH 2: WORK STATUS PIPELINE DISTRIBUTION */}
        <section className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3>Booking Lifecycle & Status Progress</h3>
              <p>Distribution across work steps</p>
            </div>
          </div>

          <div className="status-progress-bars">
            <div className="progress-bar-row">
              <div className="bar-label-line">
                <span>Completed Jobs</span>
                <strong>{completedCount} ({bookings.length ? Math.round((completedCount / bookings.length) * 100) : 0}%)</strong>
              </div>
              <div className="track-bar">
                <div
                  className="fill-bar fill-completed"
                  style={{ width: `${bookings.length ? (completedCount / bookings.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="progress-bar-row">
              <div className="bar-label-line">
                <span>In Progress (Active On-Site)</span>
                <strong>{inProgressCount} ({bookings.length ? Math.round((inProgressCount / bookings.length) * 100) : 0}%)</strong>
              </div>
              <div className="track-bar">
                <div
                  className="fill-bar fill-inprogress"
                  style={{ width: `${bookings.length ? (inProgressCount / bookings.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="progress-bar-row">
              <div className="bar-label-line">
                <span>Accepted & Dispatched</span>
                <strong>{acceptedCount} ({bookings.length ? Math.round((acceptedCount / bookings.length) * 100) : 0}%)</strong>
              </div>
              <div className="track-bar">
                <div
                  className="fill-bar fill-accepted"
                  style={{ width: `${bookings.length ? (acceptedCount / bookings.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="progress-bar-row">
              <div className="bar-label-line">
                <span>Pending Assignment</span>
                <strong>{pendingCount} ({bookings.length ? Math.round((pendingCount / bookings.length) * 100) : 0}%)</strong>
              </div>
              <div className="track-bar">
                <div
                  className="fill-bar fill-pending"
                  style={{ width: `${bookings.length ? (pendingCount / bookings.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* GRAPH 3: FIXED COMMISSION PROGRESS (₹149 / JOB) */}
        <section className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3>Fixed Commission Growth (₹149 / Job)</h3>
              <p>Platform earnings accumulating strictly at ₹149 per job</p>
            </div>
            <span className="fixed-fee-tag">₹{fixedCommission} Fixed</span>
          </div>

          <div className="commission-progress-visual">
            <div className="comm-dial-box">
              <span className="comm-dial-number">₹{totalCommission.toLocaleString('en-IN')}</span>
              <small>Earned from {completedCount} Completed Jobs</small>
            </div>

            <div className="comm-progress-tiers">
              <div className="tier-row">
                <span>Milestone: 10 Jobs (₹1,490)</span>
                <span className={`milestone-tag ${completedCount >= 10 ? 'achieved' : ''}`}>
                  {completedCount >= 10 ? 'Achieved ✓' : `${10 - completedCount} more needed`}
                </span>
              </div>
              <div className="tier-row">
                <span>Milestone: 25 Jobs (₹3,725)</span>
                <span className={`milestone-tag ${completedCount >= 25 ? 'achieved' : ''}`}>
                  {completedCount >= 25 ? 'Achieved ✓' : `${Math.max(0, 25 - completedCount)} more needed`}
                </span>
              </div>
              <div className="tier-row">
                <span>Milestone: 50 Jobs (₹7,450)</span>
                <span className={`milestone-tag ${completedCount >= 50 ? 'achieved' : ''}`}>
                  {completedCount >= 50 ? 'Achieved ✓' : `${Math.max(0, 50 - completedCount)} more needed`}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* GRAPH 4: SERVICE CATEGORY DISTRIBUTION */}
      <section className="chart-card" style={{ marginTop: '20px' }}>
        <div className="chart-card-header">
          <div>
            <h3>Category-Wise Service Request Distribution</h3>
            <p>Popular demand comparison across Home Appliances, Electrical, Cleaning & Plumbing</p>
          </div>
        </div>

        <div className="category-bars-grid">
          {Object.entries(catCounts).map(([catName, count]) => {
            const pct = bookings.length ? Math.round((count / bookings.length) * 100) : 25;
            return (
              <div key={catName} className="cat-bar-item">
                <span className="cat-name">{catName}</span>
                <div className="cat-bar-wrap">
                  <div className="cat-bar-inner" style={{ width: `${Math.max(pct, 12)}%` }}>
                    <span>{count} jobs</span>
                  </div>
                </div>
                <strong className="cat-pct">{pct}%</strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/**
 * Admin Money Withdrawal / Payout Modal
 * Enables administrators to withdraw accumulated platform revenue (flat ₹149 per completed booking)
 */
function AdminWithdrawalModal({
  isOpen,
  onClose,
  availableBalance,
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  error,
  setError,
  onQuickPercent,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay withdrawal-modal-overlay" onClick={onClose}>
      <div className="modal-card withdrawal-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header withdrawal-modal-head">
          <div>
            <span className="payout-modal-tag">FINTECH SETTLEMENT GATEWAY</span>
            <h3>Request Admin Money Withdrawal</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close withdrawal modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="withdrawal-modal-form">
          <div className="withdrawal-balance-banner">
            <div>
              <small>Available Platform Earnings Balance</small>
              <strong className="green-balance">₹{availableBalance.toLocaleString('en-IN')}</strong>
            </div>
            <span className="balance-lock-tag">🛡️ Flat ₹149 Commission Protected</span>
          </div>

          {error && <div className="withdrawal-error-banner">⚠️ {error}</div>}

          {/* Quick Presets */}
          <div className="preset-buttons-group">
            <span className="preset-label">Quick Presets:</span>
            <button
              type="button"
              className="percent-pill"
              onClick={() => onQuickPercent(25)}
              disabled={availableBalance < 4}
            >
              25%
            </button>
            <button
              type="button"
              className="percent-pill"
              onClick={() => onQuickPercent(50)}
              disabled={availableBalance < 2}
            >
              50%
            </button>
            <button
              type="button"
              className="percent-pill"
              onClick={() => onQuickPercent(75)}
              disabled={availableBalance < 4}
            >
              75%
            </button>
            <button
              type="button"
              className="percent-pill percent-pill-max"
              onClick={() => onQuickPercent(100)}
              disabled={availableBalance <= 0}
            >
              100% (Max ₹{availableBalance})
            </button>
            {availableBalance >= 149 && (
              <button
                type="button"
                className="percent-pill percent-pill-fixed"
                onClick={() => {
                  setFormData((p) => ({ ...p, amount: '149' }));
                  setError('');
                }}
              >
                ₹149 (1 Job)
              </button>
            )}
          </div>

          <Field
            label="Withdrawal Amount (₹)"
            hint={`Enter amount in Rupees (Max available: ₹${availableBalance.toLocaleString('en-IN')})`}
          >
            <input
              type="number"
              min="1"
              max={availableBalance}
              step="1"
              placeholder="e.g. 149"
              value={formData.amount}
              onChange={(e) => {
                setFormData((p) => ({ ...p, amount: e.target.value }));
                setError('');
              }}
              required
            />
          </Field>

          <Field
            label="Beneficiary UPI ID or Bank Account Details"
            hint="IMPS / UPI instant settlement (A/C + IFSC or UPI VPA)"
          >
            <input
              type="text"
              placeholder="e.g. ghar.sathi@okhdfcbank or 9876543210@paytm"
              value={formData.bankDetails}
              onChange={(e) => {
                setFormData((p) => ({ ...p, bankDetails: e.target.value }));
                setError('');
              }}
              required
            />
          </Field>

          <Field
            label="Admin Purpose / Accounting Remarks (Optional)"
            hint="Audit remark for company financial statements"
          >
            <input
              type="text"
              placeholder="e.g. Founder payout, office operational reserve, server expenses"
              value={formData.adminNotes}
              onChange={(e) => setFormData((p) => ({ ...p, adminNotes: e.target.value }))}
            />
          </Field>

          <div className="withdrawal-modal-footer">
            <button
              type="button"
              className="button button-outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-gold"
              disabled={
                isSubmitting ||
                !formData.amount ||
                Number(formData.amount) <= 0 ||
                Number(formData.amount) > availableBalance
              }
            >
              {isSubmitting
                ? 'Processing Payout...'
                : `Confirm Withdrawal (₹${Number(formData.amount || 0).toLocaleString('en-IN')})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Add New Service Modal
 * Enables administrators to create a new service with custom icon, base price, category, and subservices
 */
function AddServiceModal({ isOpen, onClose, onAddService }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Appliance Repair');
  const [categoryId, setCategoryId] = useState('appliance');
  const [price, setPrice] = useState('499');
  const [commissionFee, setCommissionFee] = useState('149');
  const [icon, setIcon] = useState('❄️');
  const [description, setDescription] = useState('');
  const [subservices, setSubservices] = useState([
    { name: '', price: '499', commission_fee: '149', time: '45 mins', description: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const quickIcons = ['❄️', '💡', '🧹', '🧰', '🫧', '🧊', '💧', '🚿', '🌀', '🍳', '🛋️', '🚪', '🛠️', '🚗', '🎨', '🪵'];

  const categoryOptions = [
    { id: 'appliance', name: 'Appliance Repair' },
    { id: 'electrical', name: 'Electrical & Wiring' },
    { id: 'cleaning', name: 'Cleaning & Sanitization' },
    { id: 'plumbing', name: 'Plumbing & Home Repair' },
    { id: 'general', name: 'General Home Services' },
  ];

  const handleCategoryChange = (e) => {
    const selectedId = e.target.value;
    setCategoryId(selectedId);
    const cat = categoryOptions.find((c) => c.id === selectedId);
    setCategory(cat ? cat.name : 'General Home Services');
  };

  const handleSubserviceChange = (index, field, value) => {
    const updated = [...subservices];
    updated[index][field] = value;
    setSubservices(updated);
  };

  const handleAddSubserviceRow = () => {
    setSubservices([
      ...subservices,
      { name: '', price: price || '299', commission_fee: commissionFee || '149', time: '45 mins', description: '' },
    ]);
  };

  const handleRemoveSubserviceRow = (index) => {
    if (subservices.length <= 1) return;
    setSubservices(subservices.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter service name.');
      return;
    }

    const basePriceNum = Number(price);
    if (!Number.isFinite(basePriceNum) || basePriceNum < 0) {
      setFormError('Please enter a valid starting price.');
      return;
    }

    const commissionFeeNum = Number(commissionFee);
    if (!Number.isFinite(commissionFeeNum) || commissionFeeNum < 0) {
      setFormError('Please enter a valid commission fee.');
      return;
    }

    // Format subservices with valid IDs and commission fees
    const slugBase =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
      `service-${Date.now().toString().slice(-4)}`;
    const formattedSubs = subservices
      .filter((s) => s.name.trim())
      .map((s, idx) => ({
        id: `${slugBase}-sub-${idx + 1}`,
        name: s.name.trim(),
        price: Number(s.price || basePriceNum),
        commission_fee: Number(s.commission_fee || commissionFeeNum),
        commissionFee: Number(s.commission_fee || commissionFeeNum),
        oldPrice: Math.round(Number(s.price || basePriceNum) * 1.25),
        time: s.time || '45 mins',
        description: s.description || `${s.name.trim()} package for ${name}`,
      }));

    setSubmitting(true);
    const res = await onAddService({
      name: name.trim(),
      category,
      categoryId,
      price: basePriceNum,
      commission_fee: commissionFeeNum,
      commissionFee: commissionFeeNum,
      icon: icon.trim() || '✦',
      description: description.trim(),
      slug: slugBase,
      subcategories: formattedSubs,
    });
    setSubmitting(false);

    if (res && res.success) {
      onClose();
    } else {
      setFormError(res?.error || 'Failed to add service.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay add-service-modal-overlay" onClick={onClose}>
      <div className="modal-card add-service-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="payout-modal-tag">CATALOGUE EXPANSION</span>
            <h3>Add New Home Service</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-service-form">
          {formError && <div className="withdrawal-error-banner">⚠️ {formError}</div>}

          <div className="form-grid" style={{ marginBottom: '14px' }}>
            <Field label="Service Name" hint="e.g. Sofa Cleaning & Sanitization">
              <input
                type="text"
                placeholder="Service title..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>

            <Field label="Category" hint="Category group for filters & search">
              <select value={categoryId} onChange={handleCategoryChange}>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="form-grid" style={{ marginBottom: '14px' }}>
            <Field label="Starting / Base Price (₹)" hint="Minimum starting ticket price">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="499"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </Field>

            <Field label="Commission Fee (₹)" hint="Admin platform margin deducted on completion">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="149"
                value={commissionFee}
                onChange={(e) => setCommissionFee(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="form-grid" style={{ marginBottom: '14px' }}>
            <Field label="Service Icon / Emoji" hint="Click an emoji below or type custom">
              <div className="icon-picker-input-wrap">
                <input
                  type="text"
                  maxLength={4}
                  style={{ width: '65px', textAlign: 'center', fontSize: '20px' }}
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                />
                <div className="quick-emoji-scroll">
                  {quickIcons.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className={`emoji-choice-btn ${icon === em ? 'active' : ''}`}
                      onClick={() => setIcon(em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>

          <Field label="Short Description" hint="Customer-facing description of the service">
            <textarea
              rows={2}
              placeholder="e.g. Deep cleaning, stain removal & anti-bacterial sanitization for fabric and leather sofas."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          {/* Subservices / Packages Builder */}
          <div className="modal-subservices-builder">
            <div className="builder-head">
              <div>
                <strong>Subservices & Package Options</strong>
                <small>Add specific packages that customers can choose with individual pricing.</small>
              </div>
              <button
                type="button"
                className="button button-small button-outline"
                onClick={handleAddSubserviceRow}
              >
                + Add Subservice Option
              </button>
            </div>

            <div className="builder-rows-list">
              {subservices.map((sub, idx) => (
                <div key={idx} className="builder-row-item">
                  <span className="builder-row-num">#{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Package Name (e.g. 2-Seater Deep Clean)"
                    value={sub.name}
                    onChange={(e) => handleSubserviceChange(idx, 'name', e.target.value)}
                    required
                  />
                  <div className="builder-price-wrap" title="Sub-Service Price (₹)">
                    <span>₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={sub.price}
                      onChange={(e) => handleSubserviceChange(idx, 'price', e.target.value)}
                      required
                    />
                  </div>
                  <div className="builder-price-wrap" title="Sub-Service Commission Fee (₹)">
                    <span style={{ color: '#0d9488' }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Comm"
                      value={sub.commission_fee}
                      onChange={(e) => handleSubserviceChange(idx, 'commission_fee', e.target.value)}
                      required
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Time (45 mins)"
                    style={{ width: '100px' }}
                    value={sub.time}
                    onChange={(e) => handleSubserviceChange(idx, 'time', e.target.value)}
                  />
                  {subservices.length > 1 && (
                    <button
                      type="button"
                      className="builder-delete-btn"
                      onClick={() => handleRemoveSubserviceRow(idx)}
                      title="Remove package"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="withdrawal-modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="button button-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="button button-gold" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating Service...' : 'Add Service to Catalogue (✦)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
