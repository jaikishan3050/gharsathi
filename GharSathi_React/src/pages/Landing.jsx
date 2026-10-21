import { Link } from 'react-router-dom';
import { Brand, BackendStatusBadge } from '../components/Common.jsx';

const roles = [
  {
    to: '/customer',
    icon: '🏡',
    title: 'Customer Panel',
    tag: 'BOOK A SERVICE · OTP LOGIN',
    description: 'OTP login & signup, moving offer discounts, dropdown services with subcategories, live work-step notifications, and technician rating after service.',
    action: 'Open customer panel',
  },
  {
    to: '/technician',
    icon: '🧰',
    title: 'Technician Panel',
    tag: 'MOBILE & PASSWORD LOGIN',
    description: 'Login with mobile/password, partner signup with live selfie & Aadhaar, work assigned ringtone alert, customer location map redirect, and ₹149 fixed fee.',
    action: 'Open technician panel',
  },
  {
    to: '/admin',
    icon: '📊',
    title: 'Admin Dashboard',
    tag: 'EMAIL & PASSWORD LOGIN',
    description: 'Secure admin portal, total customer count display, progress & growth graphs tab, booking lifecycle management, and compulsory ₹149 fixed commission reports.',
    action: 'Open admin dashboard',
  },
];

export default function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Brand />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <BackendStatusBadge />
          <span className="landing-pill">
            <span className="online-dot" /> ONE PLATFORM · THREE PANELS · FIXED ₹149 COMMISSION
          </span>
        </div>
      </header>

      <main className="landing-main">
        <div className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-gold">HOME SERVICES & PARTNER ECOSYSTEM</p>
            <h1>
              Har ghar ke kaam ke liye<br />
              <span>ek hi saathi.</span>
            </h1>
            <p>
              AC, Washing Machine, Fridge, RO, Electrician, Chimney aur Home Repairs.
              Transparent ₹149 fixed commission guarantee, real-time work step alerts, aur verified technician partners.
            </p>
            <div className="hero-highlights">
              <span>✓ OTP Customer Auth</span>
              <span>✓ Fixed ₹149 Platform Commission</span>
              <span>✓ Work Step Notification Ring</span>
              <span>✓ Direct Customer Google Maps</span>
              <span>✓ Progress & Growth Graphs</span>
            </div>
          </div>

          <div className="hero-art-photo-wrap" aria-label="Ghar Sathi Home Services">
            <img
              src="/images/happy-family.png"
              alt="Happy Home Care - Ghar Sathi"
              className="landing-hero-photo"
              onError={(e) => {
                e.target.src = '/images/gharsathibanner.png';
              }}
            />
            <div className="art-tool tool-one" title="Expert Plumbing & Repair">🔧</div>
            <div className="art-tool tool-two" title="AC & Cooling Service">❄️</div>
            <div className="art-tool tool-three" title="Electrical Works">💡</div>
            <span className="art-caption">HAR GHAR KA VISHWAS</span>
          </div>
        </div>

        <section className="role-section">
          <div className="role-section-heading">
            <div>
              <p className="eyebrow">CHOOSE YOUR WORKSPACE</p>
              <h2>Welcome to Ghar Sathi</h2>
            </div>
            <p>Select your panel to explore features designed for Customers, Technicians, and Super Admins.</p>
          </div>

          <div className="role-grid">
            {roles.map((role, index) => (
              <article key={role.to} className={`role-card role-card-${index + 1}`}>
                <div className="role-card-head">
                  <span className="role-card-icon">{role.icon}</span>
                  <span className="role-card-index">0{index + 1}</span>
                </div>
                <p className="role-tag">{role.tag}</p>
                <h3>{role.title}</h3>
                <p className="role-description">{role.description}</p>
                <Link className="button button-primary role-action" to={role.to}>
                  {role.action}
                  <span>→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Why Choose Ghar Sathi Section with Real Assets */}
        <section className="why-choose-banner-card" style={{ marginTop: '30px' }}>
          <div className="why-choose-text">
            <p className="eyebrow eyebrow-gold">BIHAR'S TRUSTED SERVICE PARTNER</p>
            <h3>Fixed ₹149 Commission & 100% Quality Guarantee</h3>
            <p>
              Patna, Danapur, Bihta, Maner aur Ara ke hazaron ghron ka vishwas.
              Ghar Sathi par AC service, washing machine repair, electrical wiring aur deep cleaning ke liye verified technicians payein.
            </p>
            <div className="why-points-list">
              <span>✓ OTP-Protected Customer Accounts</span>
              <span>✓ Verified & Background-Checked Technicians</span>
              <span>✓ Live Google Maps Navigation for Fast Arrival</span>
              <span>✓ Fixed ₹149 Fair Platform Fee Guarantee</span>
            </div>
          </div>
          <div className="why-choose-img-box">
            <img
              src="/images/why-choose-gharsathi.png"
              alt="Why Choose Ghar Sathi"
              className="why-choose-img"
            />
          </div>
        </section>

        {/* Patna Mera Gaurav Gallery */}
        <section className="patna-trust-strip">
          <div className="patna-trust-header">
            <p className="eyebrow">PATNA KA GAURAV · BIHAR PRIDE</p>
            <h3>Serving Over 10,000+ Happy Households Across Bihar</h3>
          </div>
          <div className="patna-photos-grid">
            <img src="/images/patna mera gaurav.jpg" alt="Patna Mera Gaurav" className="patna-img" />
            <img src="/images/patna ka gaurav3.jpg" alt="Patna Ka Gaurav 3" className="patna-img" />
            <img src="/images/patna ka  gaurav4.jpg" alt="Patna Ka Gaurav 4" className="patna-img" />
            <img src="/images/patna ka  gaurav5.jpg" alt="Patna Ka Gaurav 5" className="patna-img" />
          </div>
        </section>

        <div className="demo-notice">
          <span>ⓘ</span>
          <div>
            <strong>Interactive Multi-Panel System Ready</strong>
            <p>
              All customer OTP login/signup flows, technician selfie & GPS registration, work-assigned ringing sound,
              Google Maps redirection, customer ratings, and Admin progress graphs with compulsory ₹149 fixed commission are active.
            </p>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <Brand compact />
        <span>© {new Date().getFullYear()} Ghar Sathi · Har Ghar Ka Vishwas</span>
        <span>Strict ₹149 Fixed Platform Commission Policy · Zero Percentage Deductions</span>
      </footer>
    </div>
  );
}
