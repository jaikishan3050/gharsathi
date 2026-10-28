import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { initialServices, FIXED_PLATFORM_COMMISSION } from '../data/services.js';
import { playNotificationChime, playRingingBell } from '../utils/sound.js';
import {
  api,
  checkBackendHealth,
  normalizeBookingFromDjango,
  normalizeTechnicianFromDjango,
  normalizeComplaintFromDjango,
  normalizeWithdrawalFromDjango,
  normalizeServiceFromDjango,
  apiRequest,
} from '../services/api.js';
import jobWebSocket from '../services/websocket.js';

const AppDataContext = createContext(null);
const STORAGE_KEY = 'gharsathi_react_v3_data';
const CUSTOMER_AUTH_KEY = 'gharsathi_customer_session';
const TECH_AUTH_KEY = 'gharsathi_tech_session';
const ADMIN_AUTH_KEY = 'gharsathi_admin_session';
const AUTH_TOKEN_KEY = 'gharsathi_auth_token_tab';

export const initialDemoData = {
  bookings: [],
  technicians: [],
  customers: [],
  services: initialServices,
  complaints: [],
  withdrawals: [],
  activity: [],
  notifications: [],
  transactions: [],
  profile: { name: '', phone: '', email: '', address: '', pincode: '' },
};

const readStored = () => {
  try {
    // Discard the previous release's bundled demo fixtures from browser storage.
    localStorage.removeItem('gharsathi_react_v2_data');
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.services || parsed.services.length === 0) parsed.services = initialServices;
      if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
      if (!Array.isArray(parsed.customers)) parsed.customers = [];
      if (!Array.isArray(parsed.withdrawals)) parsed.withdrawals = [];
      if (!Array.isArray(parsed.bookings)) parsed.bookings = [];
      if (!Array.isArray(parsed.technicians)) parsed.technicians = [];
      if (!Array.isArray(parsed.complaints)) parsed.complaints = [];
      if (!Array.isArray(parsed.transactions)) parsed.transactions = [];
      if (!Array.isArray(parsed.activity)) parsed.activity = [];

      // Ensure all bookings have a 4-digit Happy Code servicePin
      if (Array.isArray(parsed.bookings)) {
        parsed.bookings = parsed.bookings.map((b) => ({
          ...b,
          servicePin: b.servicePin || String(Math.floor(1000 + Math.random() * 9000)),
        }));
      }

      // Ensure all technicians have walletBalance and walletTransactions
      if (Array.isArray(parsed.technicians)) {
        parsed.technicians = parsed.technicians.map((t) => {
          const balance = Number.isFinite(Number(t.walletBalance))
            ? Number(t.walletBalance)
            : Number.isFinite(Number(t.wallet))
            ? Number(t.wallet)
            : 600;
          return {
            ...t,
            wallet: balance,
            walletBalance: balance,
            walletTransactions: Array.isArray(t.walletTransactions)
              ? t.walletTransactions
              : [
                  {
                    id: `WTX-${Date.now().toString().slice(-6)}`,
                    type: 'credit',
                    amount: balance,
                    description: 'Starting Partner Wallet Balance',
                    timestamp: new Date().toISOString(),
                  },
                ],
          };
        });
      }

      return parsed;
    }
  } catch (error) {
    console.warn('Ghar Sathi demo storage could not be read.', error);
  }
  return initialDemoData;
};

export function AppDataProvider({ children }) {
  const [data, setData] = useState(readStored);

  // Authentication states
  const [currentCustomer, setCurrentCustomer] = useState(() => {
    return null;
  });

  const [currentTechnician, setCurrentTechnician] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Reusable Toast Notification Queue
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, type = 'success', duration = 3800 }) => {
    const id = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newToast = { id, title, message, type, duration };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  // Hybrid Backend Integration: Status & Sync
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'live' | 'offline'
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const syncFromDjango = useCallback(
    async (notify = false) => {
      const authRole = isAdminLoggedIn
        ? 'admin'
        : currentTechnician
          ? 'technician'
          : currentCustomer
            ? 'customer'
            : null;

      try {
        const health = await checkBackendHealth();
        if (!health.online) {
          setBackendStatus('offline');
          if (notify) {
            addToast({
              title: 'Browser Demo Mode 🟡',
              message: 'Django API offline. Running with local browser storage.',
              type: 'info',
            });
          }
          return false;
        }

        const [servicesRes, techsRes, bookingsRes, customersRes, complaintsRes, withdrawalsRes] = await Promise.all([
          api.getServices().catch(() => null),
          authRole === 'admin' ? api.getTechnicians().catch(() => null) : Promise.resolve(null),
          authRole ? api.getBookings().catch(() => null) : Promise.resolve(null),
          authRole === 'admin' ? api.getCustomers().catch(() => null) : Promise.resolve(null),
          authRole ? api.getComplaints().catch(() => null) : Promise.resolve(null),
          authRole === 'admin' ? api.getAdminWithdrawals().catch(() => null) : Promise.resolve(null),
        ]);

        setData((current) => {
          let updatedServices = current.services;
          if (Array.isArray(servicesRes) && servicesRes.length > 0) {
            const merged = current.services.map((localSvc) => {
              const remote = servicesRes.find((s) => s.slug === localSvc.id || s.name === localSvc.name);
              if (remote) {
                return {
                  ...localSvc,
                  price: Number(remote.base_price ?? localSvc.price),
                  pk: remote.id,
                  subcategories:
                    Array.isArray(remote.subcategories) && remote.subcategories.length > 0
                      ? remote.subcategories
                      : localSvc.subcategories,
                };
              }
              return localSvc;
            });

            // Append any newly added services in Django that aren't in local state yet
            servicesRes.forEach((remote) => {
              const exists = merged.some((m) => m.id === remote.slug || m.name === remote.name);
              if (!exists) {
                const normalized = normalizeServiceFromDjango(remote);
                if (normalized) merged.push(normalized);
              }
            });

            updatedServices = merged;
          }

          let updatedTechnicians = current.technicians;
          if (Array.isArray(techsRes)) {
            updatedTechnicians = techsRes.map(normalizeTechnicianFromDjango);
          }

          let updatedBookings = current.bookings;
          if (Array.isArray(bookingsRes)) {
            updatedBookings = bookingsRes.map(normalizeBookingFromDjango);
          }

          let updatedCustomers = current.customers;
          if (Array.isArray(customersRes)) {
            const bookingsByPhone = new Map();
            (Array.isArray(bookingsRes) ? bookingsRes : []).forEach((booking) => {
              const phone = String(booking.customer_phone || '').replace(/\D/g, '').slice(-10);
              if (phone) bookingsByPhone.set(phone, (bookingsByPhone.get(phone) || 0) + 1);
            });
            updatedCustomers = customersRes.map((customer) => ({
              id: customer.customer_id || customer.id,
              name: customer.name || 'Customer',
              phone: customer.phone || '',
              email: customer.email || '',
              address: customer.address || '',
              area: customer.area || '',
              pincode: customer.pincode || '',
              bookings: bookingsByPhone.get(String(customer.phone || '').replace(/\D/g, '').slice(-10)) || 0,
              status: customer.status || 'Active',
              registeredAt: customer.created_at || '',
            }));
          }

          let updatedComplaints = current.complaints;
          if (Array.isArray(complaintsRes)) {
            updatedComplaints = complaintsRes.map(normalizeComplaintFromDjango);
          }

          let updatedWithdrawals = current.withdrawals || [];
          if (Array.isArray(withdrawalsRes)) {
            updatedWithdrawals = withdrawalsRes.map(normalizeWithdrawalFromDjango);
          }

          return {
            ...current,
            services: updatedServices,
            technicians: updatedTechnicians,
            bookings: updatedBookings,
            customers: updatedCustomers,
            complaints: updatedComplaints,
            withdrawals: updatedWithdrawals,
          };
        });

        // Sync currentTechnician if active
        if (Array.isArray(techsRes) && techsRes.length > 0) {
          setCurrentTechnician((prev) => {
            if (!prev) return null;
            const remoteTech = techsRes.find(
              (t) => t.partner_id === prev.id || t.phone === prev.phone || t.id === prev.pk
            );
            return remoteTech ? normalizeTechnicianFromDjango(remoteTech) : prev;
          });
        }

        setBackendStatus('live');
        setLastSyncTime(new Date());

        if (notify) {
          addToast({
            title: 'Django API Connected 🟢',
            message: 'Synced services, bookings, and wallet data live from database.',
            type: 'success',
          });
        }
        return true;
      } catch (err) {
        console.warn('Sync from Django failed:', err);
        setBackendStatus('offline');
        if (notify) {
          addToast({
            title: 'Demo Mode Active 🟡',
            message: 'Operating in standalone browser mode.',
            type: 'info',
          });
        }
        return false;
      }
    },
    [addToast, currentCustomer, currentTechnician, isAdminLoggedIn]
  );

  // Auto-sync on initial mount
  useEffect(() => {
    syncFromDjango(false);
  }, [syncFromDjango]);

  // Real-Time Live Job Dispatch via Django Channels & WebSockets
  const [wsStatus, setWsStatus] = useState('connecting');

  useEffect(() => {
    jobWebSocket.connect();

    const unsubscribe = jobWebSocket.subscribe((data) => {
      if (data.type === 'status_change') {
        setWsStatus(data.status);
        return;
      }

      if (data.event === 'NEW_JOB') {
        playNotificationChime();
        addToast({
          title: '🔔 Live Job Alert!',
          message: `${data.service_name || 'New Service'} in ${data.customer_area || 'your area'} (₹${data.total_amount || 499})`,
          type: 'success',
          duration: 6000,
        });

        // Add new booking to state in real-time
        if (data.booking) {
          const normalized = normalizeBookingFromDjango(data.booking);
          setData((prev) => {
            const exists = prev.bookings.some((b) => b.id === normalized.id);
            if (exists) return prev;
            return {
              ...prev,
              bookings: [normalized, ...prev.bookings],
            };
          });
        }
      } else if (
        data.event === 'JOB_ACCEPTED' ||
        data.event === 'JOB_STARTED' ||
        data.event === 'JOB_COMPLETED'
      ) {
        if (data.booking) {
          const normalized = normalizeBookingFromDjango(data.booking);
          setData((prev) => ({
            ...prev,
            bookings: prev.bookings.map((b) => (b.id === normalized.id ? normalized : b)),
          }));
        }
        if (data.event === 'JOB_ACCEPTED') {
          addToast({
            title: 'Job Accepted ✓',
            message: `Booking ${data.booking_code} assigned to technician.`,
            type: 'info',
          });
        } else if (data.event === 'JOB_COMPLETED') {
          playNotificationChime();
          addToast({
            title: 'Job Completed 🎉',
            message: `Booking ${data.booking_code} marked completed. ₹149 platform fee settled.`,
            type: 'success',
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addToast]);

  // Cross-panel / Cross-tab synchronization via storage event
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch (err) {
          console.warn('Sync failed:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Persist demo data to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Ghar Sathi demo data could not be saved.', error);
    }
  }, [data]);

  // Persist customer auth
  useEffect(() => {
    try {
      if (currentCustomer) sessionStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify(currentCustomer));
      else sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
    } catch {}
  }, [currentCustomer]);

  // Persist technician auth
  useEffect(() => {
    try {
      if (currentTechnician) sessionStorage.setItem(TECH_AUTH_KEY, JSON.stringify(currentTechnician));
      else sessionStorage.removeItem(TECH_AUTH_KEY);
    } catch {}
  }, [currentTechnician]);

  // Persist admin auth
  useEffect(() => {
    try {
      if (isAdminLoggedIn) sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
      else sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch {}
  }, [isAdminLoggedIn]);

  // Session Persistence on Mount: Verify auth token against /api/auth/me/ to prevent unwanted redirects
  useEffect(() => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
      sessionStorage.removeItem(TECH_AUTH_KEY);
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      return;
    }

    let isMounted = true;
    api
      .getMe(token)
      .then((res) => {
        if (!isMounted) return;
        if (!res || !res.success) throw new Error('Session verification failed.');
        if (res.role === 'technician' && res.technician) {
          const normalized = normalizeTechnicianFromDjango(res.technician);
          setCurrentTechnician(normalized);
          sessionStorage.setItem(TECH_AUTH_KEY, JSON.stringify(normalized));
          sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
          sessionStorage.removeItem(ADMIN_AUTH_KEY);
        } else if (res.role === 'customer' && res.user) {
          setCurrentCustomer(res.user);
          sessionStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify(res.user));
          sessionStorage.removeItem(TECH_AUTH_KEY);
          sessionStorage.removeItem(ADMIN_AUTH_KEY);
        } else if (res.role === 'admin') {
          setIsAdminLoggedIn(true);
          sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
          sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
          sessionStorage.removeItem(TECH_AUTH_KEY);
        } else {
          throw new Error('Unsupported session role.');
        }
      })
      .catch((err) => {
        console.warn('Session verification notice (/api/auth/me/):', err?.message);
        if (!isMounted) return;
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
        sessionStorage.removeItem(TECH_AUTH_KEY);
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        setCurrentCustomer(null);
        setCurrentTechnician(null);
        setIsAdminLoggedIn(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const addActivity = useCallback((message) => ({
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    message,
    at: new Date().toLocaleString(),
  }), []);

  // Central Notification Dispatcher: Dispatches to customer / technician and plays chime/ring
  const sendStepNotification = useCallback(({ role, userId, bookingId, title, message, step, playSound = true, isRing = false }) => {
    const notif = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      role, // 'customer' | 'technician' | 'admin' | 'all'
      userId: userId || 'all',
      bookingId: bookingId || '',
      title,
      message,
      step: step || 'Update',
      read: false,
      timestamp: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      notifications: [notif, ...(current.notifications || [])].slice(0, 100),
    }));

    if (playSound) {
      if (isRing) {
        playRingingBell();
      } else {
        playNotificationChime();
      }
    }
    return notif;
  }, []);

  const markNotificationRead = useCallback((notifId) => {
    setData((current) => ({
      ...current,
      notifications: (current.notifications || []).map((n) => (n.id === notifId ? { ...n, read: true } : n)),
    }));
  }, []);

  const clearNotifications = useCallback((role, userId) => {
    setData((current) => ({
      ...current,
      notifications: (current.notifications || []).filter((n) => {
        if (role && n.role !== role) return true;
        if (userId && n.userId !== userId && n.userId !== 'all') return true;
        return false;
      }),
    }));
  }, []);

  // Customer Management & Authentication
  const signupCustomer = useCallback(({ name, phone, address, pincode, area }) => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const existing = data.customers.find((c) => c.phone === cleanPhone);

    const customerRecord = existing || {
      id: `CUS-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      phone: cleanPhone,
      address: address.trim(),
      pincode: pincode.trim(),
      area: area || 'Maner',
      bookings: 0,
      status: 'Active',
      registeredAt: new Date().toISOString(),
    };

    if (!existing) {
      setData((current) => ({
        ...current,
        customers: [customerRecord, ...current.customers],
        activity: [addActivity(`New customer ${customerRecord.name} registered`), ...current.activity].slice(0, 50),
      }));
    }

    setCurrentCustomer(customerRecord);
    addToast({
      title: 'Registration Successful! 🎉',
      message: `Welcome to Ghar Sathi, ${customerRecord.name}!`,
      type: 'success',
    });
    return customerRecord;
  }, [data.customers, addActivity, addToast]);

  const setCustomerSession = useCallback((customer, token = null) => {
    if (token) {
      try {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {}
    }
    setCurrentTechnician(null);
    setIsAdminLoggedIn(false);
    setCurrentCustomer(customer);
    try {
      sessionStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify(customer));
      sessionStorage.removeItem(TECH_AUTH_KEY);
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch {}
  }, []);

  const setTechnicianSession = useCallback((technician, token = null) => {
    if (token) {
      try {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {}
    }
    const normalized = normalizeTechnicianFromDjango(technician) || technician;
    setCurrentCustomer(null);
    setIsAdminLoggedIn(false);
    setCurrentTechnician(normalized);
    try {
      sessionStorage.setItem(TECH_AUTH_KEY, JSON.stringify(normalized));
      sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch {}
  }, []);

  const logoutCustomer = useCallback(() => {
    setCurrentCustomer(null);
    setCurrentTechnician(null);
    setIsAdminLoggedIn(false);
    try {
      sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {}
    addToast({
      title: 'Logged Out',
      message: 'Customer session ended securely.',
      type: 'info',
    });
  }, [addToast]);

  // Technician Authentication & Registration
  const registerTechnician = useCallback((form) => {
    const cleanPhone = form.phone.replace(/\D/g, '').slice(-10);
    const technician = {
      id: `TECH-${Date.now().toString().slice(-6)}`,
      name: form.name.trim(),
      phone: cleanPhone,
      password: form.password || 'password123',
      email: (form.email || '').trim().toLowerCase(),
      aadhaar: form.aadhaar.trim(),
      area: form.area || 'Maner',
      address: form.address.trim(),
      skills: Array.isArray(form.skills) ? form.skills.join(', ') : form.skills.trim(),
      liveLocation: form.liveLocation || null,
      liveImage: form.liveImage || '',
      status: 'Pending Verification',
      wallet: 0,
      walletBalance: 0,
      walletTransactions: [],
      completedJobs: 0,
      rating: 5.0,
      ratingCount: 0,
      isOnline: true,
      registeredAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      technicians: [technician, ...current.technicians],
      activity: [addActivity(`Technician ${technician.name} registered (pending verification)`), ...current.activity].slice(0, 50),
    }));

    setCurrentTechnician(technician);
    addToast({
      title: 'Technician Profile Created! 🧰',
      message: 'Pending admin verification before accepting live bookings.',
      type: 'success',
    });
    return technician;
  }, [addActivity, addToast]);

  const loginTechnician = useCallback(async (phone, password) => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // 1. Attempt official Django authentication via API
    try {
      const res = await api.login({ phone: cleanPhone, password, role: 'technician' });
      if (res?.success && res.role === 'technician' && res.token && res.technician) {
        const normalized = normalizeTechnicianFromDjango(res.technician);
        setTechnicianSession(normalized, res.token);
        addToast({
          title: `Namaste, ${normalized.name}! 🧰`,
          message: 'Technician partner portal active.',
          type: 'success',
        });
        return { success: true, technician: normalized, token: res.token };
      }
    } catch (err) {
      console.warn('Backend login attempt notice:', err);
      // If server specifically returned an invalid password / credential error, display it
      const errorMsg = err?.data?.error || err?.message || 'Could not verify credentials with the server.';
      addToast({ title: 'Login Failed', message: errorMsg, type: 'error' });
      return { success: false, error: errorMsg };
    }
    const errorMsg = 'Invalid mobile number or password.';
    addToast({ title: 'Login Failed', message: errorMsg, type: 'error' });
    return { success: false, error: errorMsg };
  }, [addToast, setTechnicianSession]);

  const logoutTechnician = useCallback(() => {
    setCurrentTechnician(null);
    setCurrentCustomer(null);
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem(TECH_AUTH_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    addToast({
      title: 'Logged Out',
      message: 'Technician session closed.',
      type: 'info',
    });
  }, [addToast]);

  // Admin Authentication
  const loginAdmin = useCallback(async (email, password) => {
    try {
      const res = await api.login({ username: (email || '').trim(), password, role: 'admin' });
      if (!res?.success || res.role !== 'admin' || !res.token) {
        return { success: false, error: res?.error || 'Admin credentials could not be verified.' };
      }
      sessionStorage.setItem(AUTH_TOKEN_KEY, res.token);
      sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
      sessionStorage.removeItem(TECH_AUTH_KEY);
      setCurrentCustomer(null);
      setCurrentTechnician(null);
      setIsAdminLoggedIn(true);
      addToast({ title: 'Admin sign-in successful', message: 'Admin access verified by the server.', type: 'success' });
      return { success: true };
    } catch (err) {
      const error = err?.data?.error || err?.message || 'Could not connect to the authentication server.';
      addToast({ title: 'Admin Login Failed', message: error, type: 'error' });
      return { success: false, error };
    }
  }, [addToast]);

  const logoutAdmin = useCallback(() => {
    setIsAdminLoggedIn(false);
    setCurrentCustomer(null);
    setCurrentTechnician(null);
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    addToast({
      title: 'Admin Session Ended',
      message: 'Logged out from Admin Dashboard.',
      type: 'info',
    });
  }, [addToast]);

  // Create Booking (Customer)
  const createBooking = useCallback((input) => {
    const service = data.services.find((item) => item.id === input.serviceId) || data.services[0];
    let price = input.price || service.price;
    let subcategoryName = input.subcategoryName || '';

    if (input.subcategoryId && service.subcategories) {
      const sub = service.subcategories.find((s) => s.id === input.subcategoryId);
      if (sub) {
        price = sub.price;
        subcategoryName = sub.name;
      }
    }

    const cleanPhone = input.phone.replace(/\D/g, '').slice(-10);

    const booking = {
      id: `GS-${Date.now().toString().slice(-8)}`,
      customerName: input.customerName.trim(),
      phone: cleanPhone,
      pincode: (input.pincode || '').trim(),
      serviceId: service.id,
      serviceName: service.name,
      subcategoryId: input.subcategoryId || '',
      subcategoryName,
      price,
      area: input.area,
      address: input.address.trim(),
      date: input.date,
      time: input.time,
      payment: input.payment || 'Cash on Service',
      paymentStatus: input.paymentStatus || (input.payment?.includes('Online') || input.payment?.includes('Razorpay') ? 'Paid' : 'Pending'),
      razorpayOrderId: input.razorpayOrderId || input.razorpay_order_id || '',
      razorpayPaymentId: input.razorpayPaymentId || input.razorpay_payment_id || '',
      razorpaySignature: input.razorpaySignature || input.razorpay_signature || '',
      latitude: input.latitude || input.location?.lat || null,
      longitude: input.longitude || input.location?.lng || null,
      location: input.location || (input.latitude && input.longitude ? { lat: input.latitude, lng: input.longitude } : null),
      notes: input.notes || '',
      status: 'Pending',
      servicePin: String(Math.floor(1000 + Math.random() * 9000)),
      technicianId: '',
      technicianName: '',
      technicianPhone: '',
      createdAt: new Date().toISOString(),
      commission: 0, // Commission is 0 until job is completed, then strictly fixed at Rs 149!
    };

    // If Django backend is live, asynchronously persist to database
    if (backendStatus === 'live') {
      api.createBooking(booking, service.pk || 1).catch((err) => {
        console.warn('Live API createBooking sync warning:', err);
        const authRejected = err?.status === 401 || err?.status === 403;
        if (authRejected) {
          sessionStorage.removeItem(AUTH_TOKEN_KEY);
          sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
          setCurrentCustomer(null);
        }
        setData((current) => ({
          ...current,
          bookings: current.bookings.filter((item) => item.id !== booking.id),
          customers: current.customers.filter((item) => item.phone !== cleanPhone),
          notifications: current.notifications.filter((item) => item.bookingId !== booking.id),
          activity: current.activity.filter((item) => !item.message?.includes(booking.id)),
        }));
        addToast({
          title: authRejected ? 'Customer login expired' : 'Booking could not be saved',
          message: authRejected
            ? 'Customer data was cleared from the database. Sign in again with mobile OTP, then retry the booking.'
            : err?.data?.detail || err?.data?.error || err?.message || 'Database ne booking save nahi ki. Please retry.',
          type: 'error',
          duration: 7000,
        });
      });
    }

    setData((current) => {
      const known = current.customers.some((customer) => customer.phone === cleanPhone);
      const customers = known
        ? current.customers.map((customer) =>
            customer.phone === cleanPhone
              ? {
                  ...customer,
                  name: booking.customerName,
                  area: booking.area,
                  address: booking.address,
                  pincode: booking.pincode || customer.pincode,
                  bookings: Number(customer.bookings || 0) + 1,
                }
              : customer
          )
        : [
            ...current.customers,
            {
              id: `CUS-${Date.now().toString().slice(-6)}`,
              name: booking.customerName,
              phone: cleanPhone,
              area: booking.area,
              address: booking.address,
              pincode: booking.pincode,
              bookings: 1,
              status: 'Active',
              registeredAt: new Date().toISOString(),
            },
          ];

      return {
        ...current,
        bookings: [booking, ...current.bookings],
        customers,
        activity: [addActivity(`New booking ${booking.id} created for ${booking.customerName}`), ...current.activity].slice(0, 50),
      };
    });

    // Step 1 Notification: Booking Received
    sendStepNotification({
      role: 'customer',
      userId: cleanPhone,
      bookingId: booking.id,
      title: 'Booking Request Received',
      message: `Aapki booking ${booking.id} (${booking.serviceName}) receive ho gayi hai. Technician assign hote hi notification aayega.`,
      step: 'Booking Placed',
      playSound: true,
    });

    // Notify all active technicians of new available job
    sendStepNotification({
      role: 'technician',
      userId: 'all',
      bookingId: booking.id,
      title: 'New Job Available 🧰',
      message: `New booking ${booking.id} in ${booking.area} (${booking.serviceName}). View & accept in Available Jobs.`,
      step: 'New Job',
      playSound: true,
    });

    // Sleek Popup Toast
    addToast({
      title: 'Booking Confirmed! 📅',
      message: `Request ${booking.id} placed for ${booking.serviceName}.`,
      type: 'success',
    });

    return booking;
  }, [backendStatus, data.services, addActivity, sendStepNotification, addToast]);

  // Update Booking Status & Trigger Work Step Notifications + Toasts
  const updateBooking = useCallback((id, changes) => {
    // Sync with Django if live
    if (backendStatus === 'live') {
      if (changes.technicianId && changes.technicianName) {
        api.acceptBooking(id, changes.technicianId, changes.technicianId).catch((err) => {
          console.warn('Backend acceptBooking sync warning:', err);
        });
      } else if (changes.status === 'In Progress') {
        api.startBooking(id).catch((err) => {
          console.warn('Backend startBooking sync warning:', err);
        });
      }
    }

    setData((current) => {
      let updatedBooking = null;

      const bookings = current.bookings.map((booking) => {
        if (booking.id !== id) return booking;
        const next = { ...booking, ...changes };

        // COMPULSORY FIXED COMMISSION RULE:
        // When status is 'Completed', commission is strictly fixed at Rs 149 (not percentage!)
        if (changes.status === 'Completed') {
          next.commission = FIXED_PLATFORM_COMMISSION; // Rs 149 fixed!
          next.completedAt = new Date().toISOString();
        }

        updatedBooking = next;
        return next;
      });

      if (!updatedBooking) return current;

      // Handle Step Notifications based on changes:
      // 1. Technician Assigned
      if (changes.technicianId && changes.technicianName) {
        sendStepNotification({
          role: 'customer',
          userId: updatedBooking.phone,
          bookingId: updatedBooking.id,
          title: 'Technician Assigned 🧑‍🔧',
          message: `Aapki booking ${updatedBooking.id} ke liye technician ${changes.technicianName} assign ho gaye hain.`,
          step: 'Assigned',
          playSound: true,
        });

        // Notify and RING technician!
        sendStepNotification({
          role: 'technician',
          userId: changes.technicianId,
          bookingId: updatedBooking.id,
          title: 'Work Assigned! 🔔 Ringing',
          message: `Naya kaam assign hua hai: ${updatedBooking.id} (${updatedBooking.serviceName}) for ${updatedBooking.customerName}. Customer location map mein dekhein.`,
          step: 'Assigned',
          playSound: true,
          isRing: true, // Audio ringtone!
        });

        addToast({
          title: 'Technician Assigned 🧑‍🔧',
          message: `${changes.technicianName} assigned to booking ${updatedBooking.id}`,
          type: 'info',
        });
      }

      // 2. Status advanced to 'In Progress'
      if (changes.status === 'In Progress') {
        sendStepNotification({
          role: 'customer',
          userId: updatedBooking.phone,
          bookingId: updatedBooking.id,
          title: 'Work In Progress ⚙️',
          message: `Technician ${updatedBooking.technicianName || 'Technician'} ne aapke ghar par service start kar di hai.`,
          step: 'In Progress',
          playSound: true,
        });

        addToast({
          title: 'Work In Progress ⚙️',
          message: `Technician started service for ${updatedBooking.id}.`,
          type: 'info',
        });
      }

      // 3. Status advanced to 'Completed'
      if (changes.status === 'Completed') {
        sendStepNotification({
          role: 'customer',
          userId: updatedBooking.phone,
          bookingId: updatedBooking.id,
          title: 'Service Completed! ⭐ Please Rate',
          message: `Service ${updatedBooking.id} poori ho gayi hai. Kripya apne technician ko rate & review karein! Receipt invoice available.`,
          step: 'Completed',
          playSound: true,
        });

        sendStepNotification({
          role: 'technician',
          userId: updatedBooking.technicianId,
          bookingId: updatedBooking.id,
          title: 'Job Completed Successfully ✅',
          message: `Booking ${updatedBooking.id} complete ho gayi. Platform fee Rs 149 deduct ho kar aapka share wallet mein calculate ho gaya.`,
          step: 'Completed',
          playSound: true,
        });

        addToast({
          title: 'Job Completed! ✅',
          message: `Booking ${updatedBooking.id} finished. ₹${FIXED_PLATFORM_COMMISSION} fixed platform fee calculated.`,
          type: 'success',
        });
      }

      return {
        ...current,
        bookings,
        activity: [addActivity(`Booking ${id} status updated to ${changes.status || 'modified'}`), ...current.activity].slice(0, 50),
      };
    });
  }, [backendStatus, addActivity, sendStepNotification, addToast]);

  // Rate Technician (Customer Rating after service)
  const rateTechnician = useCallback((bookingId, ratingValue, reviewComment, tags = []) => {
    if (backendStatus === 'live') {
      api.rateBooking(bookingId, ratingValue, reviewComment, tags).catch((err) => {
        console.warn('Backend rateBooking sync warning:', err);
      });
    }

    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const techId = booking.technicianId;

    setData((current) => {
      // 1. Update booking with rating & review
      const bookings = current.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              rating: ratingValue,
              review: (reviewComment || '').trim(),
              reviewTags: tags,
              ratedAt: new Date().toISOString(),
            }
          : b
      );

      // 2. Recalculate technician rating average
      const technicians = current.technicians.map((tech) => {
        if (tech.id !== techId) return tech;
        const techBookings = bookings.filter((b) => b.technicianId === tech.id && b.rating);
        const totalRating = techBookings.reduce((sum, b) => sum + Number(b.rating), 0);
        const count = techBookings.length;
        const avgRating = count > 0 ? parseFloat((totalRating / count).toFixed(1)) : 5.0;

        return {
          ...tech,
          rating: avgRating,
          ratingCount: count,
        };
      });

      return {
        ...current,
        bookings,
        technicians,
        activity: [addActivity(`Customer rated booking ${bookingId}: ${ratingValue} stars`), ...current.activity].slice(0, 50),
      };
    });

    // Notify technician of review
    if (techId) {
      sendStepNotification({
        role: 'technician',
        userId: techId,
        bookingId,
        title: `Customer Rated You ${ratingValue} Stars! ⭐`,
        message: `${booking.customerName} ne aapko ${ratingValue}/5 star rating aur review diya: "${reviewComment || 'Great service!'}"`,
        step: 'Review',
        playSound: true,
      });
    }

    addToast({
      title: 'Review Submitted! ⭐',
      message: `Thank you for rating your service ${ratingValue} stars.`,
      type: 'success',
    });
  }, [backendStatus, data.bookings, addActivity, sendStepNotification, addToast]);

  // Add / Update Technician
  const addTechnician = useCallback((form) => {
    return registerTechnician(form);
  }, [registerTechnician]);

  const updateTechnician = useCallback((id, changes) => {
    if (backendStatus === 'live' && changes.status) {
      api.verifyTechnicianKyc(id, changes.status, changes.kycRemarks || '').catch((err) => {
        console.warn('Backend verifyTechnicianKyc sync warning:', err);
      });
    }

    setData((current) => {
      const technicians = current.technicians.map((tech) => (tech.id === id ? { ...tech, ...changes } : tech));
      if (currentTechnician && currentTechnician.id === id) {
        setCurrentTechnician((prev) => ({ ...prev, ...changes }));
      }
      return {
        ...current,
        technicians,
        activity: [addActivity(`Technician ${id} updated`), ...current.activity].slice(0, 50),
      };
    });
  }, [backendStatus, addActivity, currentTechnician]);

  // Update Service Price & Dynamic Commission (Admin)
  const updateServicePrice = useCallback((id, price, commissionFee) => {
    const amount = Number(price);
    const commFee = commissionFee !== undefined && commissionFee !== null && commissionFee !== '' ? Number(commissionFee) : undefined;
    if (!Number.isFinite(amount) || amount < 0) return;

    if (backendStatus === 'live') {
      api.updateServicePrice(id, amount, commFee).catch((err) => {
        console.warn('Backend updateServicePrice sync warning:', err);
      });
    }

    setData((current) => ({
      ...current,
      services: current.services.map((service) => (service.id === id ? {
        ...service,
        price: amount,
        ...(commFee !== undefined ? { commissionFee: commFee, commission_fee: commFee } : {}),
      } : service)),
      activity: [addActivity(`Price and commission updated for ${id}`), ...current.activity].slice(0, 50),
    }));
    addToast({
      title: 'Pricing Updated! 💰',
      message: `Starting rate: ₹${amount}${commFee !== undefined ? ` · Commission: ₹${commFee}` : ''}`,
      type: 'success',
    });
  }, [backendStatus, addActivity, addToast]);

  // Update Subservice Price & Commission (Admin)
  const updateSubservicePrice = useCallback((serviceId, subserviceId, price, commissionFee) => {
    const amount = price !== undefined && price !== null && price !== '' ? Number(price) : null;
    const comm = commissionFee !== undefined && commissionFee !== null && commissionFee !== '' ? Number(commissionFee) : null;

    if (backendStatus === 'live') {
      api.updateSubservicePrice(serviceId, subserviceId, amount, comm).catch((err) => {
        console.warn('Backend updateSubservicePrice sync warning:', err);
      });
    }

    setData((current) => {
      const updatedServices = current.services.map((service) => {
        if (service.id !== serviceId && service.pk !== serviceId) return service;
        const updatedSubs = (service.subcategories || []).map((sub) => {
          if (sub.id !== subserviceId) return sub;
          return {
            ...sub,
            ...(amount !== null && Number.isFinite(amount) ? { price: amount } : {}),
            ...(comm !== null && Number.isFinite(comm) ? { commission_fee: comm, commission: comm, commissionFee: comm } : {}),
          };
        });
        return {
          ...service,
          subcategories: updatedSubs,
        };
      });

      return {
        ...current,
        services: updatedServices,
        activity: [
          addActivity(
            `Subservice updated for ${serviceId} / ${subserviceId}` +
            (amount !== null ? ` rate ₹${amount}` : '') +
            (comm !== null ? ` commission ₹${comm}` : '')
          ),
          ...current.activity,
        ].slice(0, 50),
      };
    });

    addToast({
      title: 'Subservice Rates Updated! 💰',
      message: `${amount !== null ? `Rate: ₹${amount} ` : ''}${comm !== null ? `| Comm: ₹${comm}` : ''}`,
      type: 'success',
    });
  }, [backendStatus, addActivity, addToast]);

  // Add New Service (Admin)
  const addService = useCallback(async (form) => {
    const name = (form.name || '').trim();
    if (!name) {
      addToast({ title: 'Validation Error', message: 'Service name is required', type: 'error' });
      return { success: false, error: 'Service name is required' };
    }

    const price = Number(form.price || form.base_price || 299);
    const commissionFee = Number(form.commissionFee ?? form.commission_fee ?? 149);
    const category = form.category || 'Appliance Repair';
    const categoryId = (form.categoryId || form.category || 'appliance').toLowerCase();
    const icon = form.icon || '✦';
    const description = form.description || '';
    const slug = form.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `service-${Date.now().toString().slice(-4)}`;

    let subs = Array.isArray(form.subcategories) ? form.subcategories : [];
    if (subs.length === 0) {
      subs = [
        {
          id: `${slug}-std`,
          name: `${name} Standard Service`,
          price: price,
          oldPrice: Math.round(price * 1.25),
          time: '45 mins',
          description: `Complete ${name} inspection and standard service package.`,
        },
      ];
    }

    const newServiceObj = {
      id: slug,
      name,
      shortName: name.split(' ')[0] || name,
      category,
      categoryId,
      price,
      commissionFee,
      commission_fee: commissionFee,
      oldPrice: Math.round(price * 1.25),
      discount: '20% OFF',
      icon,
      image: form.image || '/images/other-service.png',
      description,
      subcategories: subs,
    };

    if (backendStatus === 'live') {
      try {
        const res = await api.createService(newServiceObj);
        if (res && res.id) {
          newServiceObj.pk = res.id;
          if (res.slug) newServiceObj.id = res.slug;
        }
      } catch (err) {
        console.warn('Backend createService warning:', err);
      }
    }

    setData((current) => ({
      ...current,
      services: [...current.services, newServiceObj],
      activity: [addActivity(`Admin added new service: ${name}`), ...current.activity].slice(0, 50),
    }));

    addToast({
      title: 'New Service Added! ✦',
      message: `${name} has been added to the catalogue.`,
      type: 'success',
    });

    return { success: true, service: newServiceObj };
  }, [backendStatus, addActivity, addToast]);

  // Add Subservice to existing service (Admin)
  const addSubservice = useCallback(async (serviceId, subForm) => {
    const subName = (subForm.name || '').trim();
    if (!subName) return;
    const price = Number(subForm.price || 199);
    const subId = subForm.id || `${serviceId}-${Date.now().toString().slice(-4)}`;
    const newSub = {
      id: subId,
      name: subName,
      price,
      oldPrice: Math.round(price * 1.25),
      time: subForm.time || '45 mins',
      description: subForm.description || '',
    };

    if (backendStatus === 'live') {
      api.addSubservice(serviceId, newSub).catch((err) => {
        console.warn('Backend addSubservice warning:', err);
      });
    }

    setData((current) => ({
      ...current,
      services: current.services.map((s) => {
        if (s.id !== serviceId && s.pk !== serviceId) return s;
        return {
          ...s,
          subcategories: [...(s.subcategories || []), newSub],
        };
      }),
      activity: [addActivity(`Added subservice ${subName} to ${serviceId}`), ...current.activity].slice(0, 50),
    }));

    addToast({
      title: 'Subservice Added! ✦',
      message: `${subName} added to service.`,
      type: 'success',
    });
  }, [backendStatus, addActivity, addToast]);

  // Delete Service (Admin)
  const deleteService = useCallback(async (serviceId) => {
    if (backendStatus === 'live') {
      try {
        await api.deleteService(serviceId);
      } catch (err) {
        console.warn('Backend deleteService warning:', err);
      }
    }

    setData((current) => ({
      ...current,
      services: current.services.filter((s) => s.id !== serviceId && s.pk !== serviceId && s.slug !== serviceId),
      activity: [addActivity(`Deleted service: ${serviceId}`), ...current.activity].slice(0, 50),
    }));

    addToast({
      title: 'Service Deleted 🗑️',
      message: 'Service has been removed from catalogue.',
      type: 'info',
    });
    return { success: true };
  }, [backendStatus, addActivity, addToast]);

  // Delete Subservice (Admin)
  const deleteSubservice = useCallback(async (serviceId, subserviceId) => {
    if (backendStatus === 'live') {
      try {
        await api.deleteSubservice(serviceId, subserviceId);
      } catch (err) {
        console.warn('Backend deleteSubservice warning:', err);
      }
    }

    setData((current) => ({
      ...current,
      services: current.services.map((s) => {
        if (s.id !== serviceId && s.pk !== serviceId && s.slug !== serviceId) return s;
        return {
          ...s,
          subcategories: (s.subcategories || []).filter((sub) => String(sub.id) !== String(subserviceId)),
        };
      }),
      activity: [addActivity(`Deleted package ${subserviceId} from ${serviceId}`), ...current.activity].slice(0, 50),
    }));

    addToast({
      title: 'Package Removed 🗑️',
      message: 'Subservice package has been deleted.',
      type: 'info',
    });
    return { success: true };
  }, [backendStatus, addActivity, addToast]);

  // Purge all demo/mock data (Admin)
  const purgeProductionData = useCallback(async () => {
    let res = null;
    if (backendStatus === 'live') {
      try {
        res = await api.purgeProductionData();
      } catch (err) {
        console.warn('Backend purgeProductionData warning:', err);
      }
    }

    setData((current) => ({
      ...current,
      bookings: [],
      customers: [],
      complaints: [],
      technicians: [],
      transactions: [],
      withdrawals: [],
      notifications: [],
      activity: [addActivity('Clean production wipe: All demo and test data purged.'), ...current.activity].slice(0, 50),
    }));

    addToast({
      title: 'Clean Production Wipe ✓',
      message: 'All mock bookings, dummy technicians and test data have been purged.',
      type: 'success',
    });
    return res || { success: true };
  }, [backendStatus, addActivity, addToast]);

  // Complaints
  const addComplaint = useCallback((form) => {
    const complaint = {
      id: `CMP-${Date.now().toString().slice(-6)}`,
      ...form,
      status: 'Open',
      createdAt: new Date().toISOString(),
    };

    if (backendStatus === 'live') {
      api.createComplaint({
        customerName: complaint.customerName || complaint.name,
        phone: complaint.phone,
        category: complaint.category,
        priority: complaint.priority,
        description: complaint.description,
      }).catch((err) => {
        console.warn('Backend createComplaint sync warning:', err);
      });
    }

    setData((current) => ({
      ...current,
      complaints: [complaint, ...current.complaints],
      activity: [addActivity(`Complaint ${complaint.id} submitted`), ...current.activity].slice(0, 50),
    }));
    addToast({
      title: 'Complaint Logged 💬',
      message: `Complaint ticket ${complaint.id} received. Admin will follow up.`,
      type: 'info',
    });
    return complaint;
  }, [backendStatus, addActivity, addToast]);

  const updateComplaint = useCallback((id, status, resolutionAction) => {
    if (backendStatus === 'live' && status === 'Resolved') {
      api.resolveComplaint(id, resolutionAction || 'Resolved after review', '').catch((err) => {
        console.warn('Backend resolveComplaint sync warning:', err);
      });
    }

    setData((current) => ({
      ...current,
      complaints: current.complaints.map((item) =>
        item.id === id ? { ...item, status, resolutionAction: resolutionAction || item.resolutionAction } : item
      ),
    }));
    addToast({
      title: 'Complaint Status Updated',
      message: `Ticket ${id} marked as ${status}.`,
      type: 'info',
    });
  }, [backendStatus, addToast]);

  // Admin Withdrawals / Payout Requests
  const requestAdminWithdrawal = useCallback(
    async (payload) => {
      const amount = Number(payload.amount);
      const bankDetails = (payload.bankDetails || payload.bank_details || '').trim();
      const adminNotes = (payload.adminNotes || payload.admin_notes || '').trim();

      if (!Number.isFinite(amount) || amount <= 0) {
        addToast({
          title: 'Invalid Amount',
          message: 'Kripya valid withdrawal amount enter karein.',
          type: 'error',
        });
        return { success: false, error: 'Valid amount enter karein.' };
      }

      if (!bankDetails) {
        addToast({
          title: 'Bank Details Missing',
          message: 'Kripya UPI ID ya Bank Account details daalein.',
          type: 'error',
        });
        return { success: false, error: 'UPI ID ya Bank Account details required hain.' };
      }

      // Calculate Available Balance
      const completedCount = (data.bookings || []).filter((b) => b.status === 'Completed').length;
      const totalPlatformEarnings = completedCount * FIXED_PLATFORM_COMMISSION;
      const approvedWithdrawn = (data.withdrawals || [])
        .filter((w) => w.status === 'Approved')
        .reduce((sum, w) => sum + Number(w.amount || 0), 0);
      const pendingWithdrawn = (data.withdrawals || [])
        .filter((w) => w.status === 'Pending')
        .reduce((sum, w) => sum + Number(w.amount || 0), 0);
      const availableBalance = Math.max(0, totalPlatformEarnings - approvedWithdrawn - pendingWithdrawn);

      // Strict Guardrail Check
      if (amount > (totalPlatformEarnings - approvedWithdrawn) || amount > availableBalance) {
        addToast({
          title: 'Insufficient Balance ❌',
          message: 'Withdrawal amount available platform balance se zyada hai.',
          type: 'error',
        });
        return { success: false, error: 'Insufficient balance available for withdrawal.' };
      }

      let createdWithdrawal = null;

      if (backendStatus === 'live') {
        try {
          const res = await api.requestAdminWithdrawal({
            amount,
            bankDetails,
            adminNotes,
          });
          if (res && res.withdrawal) {
            createdWithdrawal = normalizeWithdrawalFromDjango(res.withdrawal);
          }
        } catch (err) {
          const errMessage = err.data?.error || err.message || 'Withdrawal request failed';
          addToast({
            title: 'Withdrawal Error',
            message: errMessage,
            type: 'error',
          });
          return { success: false, error: errMessage };
        }
      }

      if (!createdWithdrawal) {
        createdWithdrawal = {
          id: `WDR-${Date.now().toString().slice(-8)}`,
          amount,
          bankDetails,
          status: 'Pending',
          adminNotes,
          createdAt: new Date().toISOString(),
          processedAt: null,
        };
      }

      setData((current) => ({
        ...current,
        withdrawals: [createdWithdrawal, ...(current.withdrawals || [])],
        activity: [
          addActivity(`Admin requested ₹${amount} withdrawal (${createdWithdrawal.id})`),
          ...current.activity,
        ].slice(0, 50),
      }));

      addToast({
        title: 'Payout Requested! 💸',
        message: `₹${amount} withdrawal request submitted (${createdWithdrawal.id}). Pending processing.`,
        type: 'success',
      });

      return { success: true, withdrawal: createdWithdrawal };
    },
    [backendStatus, data.bookings, data.withdrawals, addActivity, addToast]
  );

  const updateAdminWithdrawalStatus = useCallback(
    async (id, newStatus, adminNotes = '') => {
      if (backendStatus === 'live') {
        try {
          await api.updateAdminWithdrawalStatus(id, newStatus, adminNotes);
        } catch (err) {
          console.warn('Backend updateAdminWithdrawalStatus warning:', err);
        }
      }

      const processedTimestamp = newStatus !== 'Pending' ? new Date().toISOString() : null;

      setData((current) => ({
        ...current,
        withdrawals: (current.withdrawals || []).map((w) =>
          w.id === id || w.pk === id
            ? { ...w, status: newStatus, processedAt: processedTimestamp, adminNotes: adminNotes || w.adminNotes }
            : w
        ),
        activity: [
          addActivity(`Withdrawal ${id} marked as ${newStatus}`),
          ...current.activity,
        ].slice(0, 50),
      }));

      addToast({
        title: `Withdrawal ${newStatus}`,
        message: `Payout request ${id} marked as ${newStatus}.`,
        type: newStatus === 'Approved' ? 'success' : 'info',
      });
    },
    [backendStatus, addActivity, addToast]
  );

  // Complete Job With 4-Digit Happy Code Verification & Fixed Platform Fee Wallet Deduction
  const completeJobWithPin = useCallback(
    (bookingId, enteredPin) => {
      const cleanPin = String(enteredPin || '').trim();
      const booking = data.bookings.find((b) => b.id === bookingId);

      if (!booking) {
        addToast({
          title: 'Booking Not Found',
          message: `Booking ${bookingId} not found in system.`,
          type: 'error',
        });
        return { success: false, error: 'Booking nahi mili.' };
      }

      const expectedPin = String(booking.servicePin || '4829').trim();

      // Verify the exact Happy Code; no shared demo PIN is accepted.
      if (!expectedPin || cleanPin !== expectedPin) {
        addToast({
          title: 'Invalid Happy Code! ❌',
          message: 'Security PIN galat hai. Customer se booking screen par 4-digit Happy Code poochein.',
          type: 'error',
        });
        return { success: false, error: 'Invalid PIN. Please check with customer.' };
      }

      const techId = booking.technicianId || (currentTechnician ? currentTechnician.id : '');
      const completedTimestamp = new Date().toISOString();

      // If backend is live, sync to Django in background
      if (backendStatus === 'live') {
        api.completeBooking(bookingId, cleanPin).catch((err) => {
          console.warn('Backend completeBooking sync warning:', err);
        });
      }

      setData((current) => {
        // 1. Advance booking status to Completed with fixed commission
        const bookings = current.bookings.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            status: 'Completed',
            completedAt: completedTimestamp,
            commission: FIXED_PLATFORM_COMMISSION,
          };
        });

        // 2. Deduct fixed platform fee (₹149) from technician's wallet and log ledger transaction
        let updatedCurrentTech = null;
        const technicians = current.technicians.map((t) => {
          if (t.id !== techId && t.id !== currentTechnician?.id) return t;

          const currentBal = Number.isFinite(Number(t.walletBalance))
            ? Number(t.walletBalance)
            : Number(t.wallet || 0);
          const newBal = currentBal - FIXED_PLATFORM_COMMISSION;

          const tx = {
            id: `WTX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`,
            type: 'debit',
            amount: FIXED_PLATFORM_COMMISSION,
            description: `Fixed platform fee deduction for ${booking.id} (${booking.serviceName})`,
            bookingId: booking.id,
            customerName: booking.customerName,
            timestamp: completedTimestamp,
          };

          const updated = {
            ...t,
            wallet: newBal,
            walletBalance: newBal,
            completedJobs: Number(t.completedJobs || 0) + 1,
            walletTransactions: [tx, ...(t.walletTransactions || [])],
          };

          if (currentTechnician && (t.id === currentTechnician.id || t.id === techId)) {
            updatedCurrentTech = updated;
          }

          return updated;
        });

        if (updatedCurrentTech) {
          setCurrentTechnician(updatedCurrentTech);
        }

        return {
          ...current,
          bookings,
          technicians,
          activity: [
            addActivity(
              `Job ${booking.id} completed via Happy Code verification. ₹${FIXED_PLATFORM_COMMISSION} platform fee deducted.`
            ),
            ...current.activity,
          ].slice(0, 50),
        };
      });

      // Customer Step Notification
      sendStepNotification({
        role: 'customer',
        userId: booking.phone,
        bookingId: booking.id,
        title: 'Service Completed! ⭐ Please Rate',
        message: `Happy Code verified! Service ${booking.id} poori ho gayi hai. Kripya apne technician ko rate & review karein! Receipt invoice available.`,
        step: 'Completed',
        playSound: true,
      });

      // Technician Step Notification
      sendStepNotification({
        role: 'technician',
        userId: techId,
        bookingId: booking.id,
        title: 'Job Completed Successfully ✅',
        message: `Booking ${booking.id} complete ho gayi. Platform fee Rs 149 deduct ho kar aapka share wallet mein calculate ho gaya.`,
        step: 'Completed',
        playSound: true,
      });

      addToast({
        title: 'Happy Code Verified! ✅',
        message: `Job ${booking.id} completed! Fixed platform fee ₹${FIXED_PLATFORM_COMMISSION} deducted from wallet.`,
        type: 'success',
      });

      return { success: true };
    },
    [backendStatus, data.bookings, currentTechnician, addActivity, sendStepNotification, addToast]
  );

  // Recharge Technician Wallet (via Verified Razorpay Online Payment)
  const rechargeTechnicianWallet = useCallback(
    async (technicianId, rechargePayload) => {
      const amountVal = typeof rechargePayload === 'object' ? rechargePayload.amount : rechargePayload;
      const numAmount = Number(amountVal);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        addToast({
          title: 'Invalid Amount',
          message: 'Kripya valid recharge amount enter karein.',
          type: 'error',
        });
        return { success: false, error: 'Invalid amount' };
      }

      let backendRes = null;
      if (backendStatus === 'live') {
        try {
          const payload = typeof rechargePayload === 'object'
            ? rechargePayload
            : { amount: numAmount };
          backendRes = await api.rechargeWallet(technicianId, payload);
        } catch (err) {
          console.error('Backend rechargeWallet verification failed:', err);
          const errDetail = err?.error || err?.message || 'Payment verification failed.';
          addToast({
            title: 'Recharge Failed ❌',
            message: `Payment verify nahi hua: ${errDetail}. Wallet credit nahi hua.`,
            type: 'error',
          });
          return { success: false, error: errDetail };
        }
      }

      let finalBalance = 0;
      const paymentRef = (typeof rechargePayload === 'object' && rechargePayload.razorpay_payment_id)
        ? rechargePayload.razorpay_payment_id
        : `WTX-${Date.now().toString().slice(-6)}`;

      setData((current) => {
        let updatedCurrentTech = null;

        const technicians = current.technicians.map((t) => {
          if (t.id !== technicianId) return t;

          const currentBal = Number.isFinite(Number(t.walletBalance))
            ? Number(t.walletBalance)
            : Number(t.wallet || 0);
          const newBal = backendRes?.technician?.wallet_balance != null
            ? Number(backendRes.technician.wallet_balance)
            : currentBal + numAmount;
          finalBalance = newBal;

          const tx = {
            id: paymentRef,
            type: 'credit',
            amount: numAmount,
            description: `Razorpay Online Wallet Top-up (${paymentRef})`,
            timestamp: new Date().toISOString(),
          };

          const updated = {
            ...t,
            wallet: newBal,
            walletBalance: newBal,
            walletTransactions: [tx, ...(t.walletTransactions || [])],
          };

          if (currentTechnician && t.id === currentTechnician.id) {
            updatedCurrentTech = updated;
          }

          return updated;
        });

        if (updatedCurrentTech) {
          setCurrentTechnician(updatedCurrentTech);
        }

        return {
          ...current,
          technicians,
          activity: [
            addActivity(
              `Technician ${technicianId} recharged wallet with ₹${numAmount} via Razorpay. New balance: ₹${finalBalance}`
            ),
            ...current.activity,
          ].slice(0, 50),
        };
      });

      addToast({
        title: 'Wallet Recharged! 💳',
        message: `₹${numAmount} credited successfully via Razorpay! Current balance: ₹${finalBalance}. Aap ab naye bookings accept kar sakte hain.`,
        type: 'success',
      });

      return { success: true, balance: finalBalance, amount: numAmount };
    },
    [backendStatus, currentTechnician, addActivity, addToast]
  );

  // Clear local cached data and re-sync from the database; never restore demo fixtures.
  const resetDemoData = useCallback(async () => {
    if (backendStatus === 'live') {
      try {
        await api.purgeProductionData();
      } catch (err) {
        console.warn('Backend purgeProductionData warning:', err);
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('gharsathi_react_v2_data');
    sessionStorage.removeItem(CUSTOMER_AUTH_KEY);
    sessionStorage.removeItem(TECH_AUTH_KEY);
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    setData(initialDemoData);
    setCurrentCustomer(null);
    setCurrentTechnician(null);
    setIsAdminLoggedIn(false);

    if (backendStatus !== 'live') {
      setData(initialDemoData);
    }

    addToast({
      title: 'Demo Data Cleared ✓',
      message: 'Browser cache cleared. Production database records will load on sync.',
      type: 'success',
    });
  }, [backendStatus, addToast]);

  const value = useMemo(
    () => ({
      data,
      setData,
      backendStatus,
      lastSyncTime,
      syncFromDjango,
      currentCustomer,
      setCurrentCustomer,
      currentTechnician,
      setCurrentTechnician,
      setCustomerSession,
      setTechnicianSession,
      isAdminLoggedIn,
      signupCustomer,
      logoutCustomer,
      registerTechnician,
      loginTechnician,
      logoutTechnician,
      loginAdmin,
      logoutAdmin,
      createBooking,
      updateBooking,
      rateTechnician,
      completeJobWithPin,
      rechargeTechnicianWallet,
      addTechnician,
      updateTechnician,
      updateServicePrice,
      updateSubservicePrice,
      addService,
      addSubservice,
      deleteService,
      deleteSubservice,
      purgeProductionData,
      addComplaint,
      updateComplaint,
      requestAdminWithdrawal,
      updateAdminWithdrawalStatus,
      resetDemoData,
      sendStepNotification,
      markNotificationRead,
      clearNotifications,
      toasts,
      addToast,
      removeToast,
      wsStatus,
      jobWebSocket,
    }),
    [
      data,
      backendStatus,
      lastSyncTime,
      syncFromDjango,
      currentCustomer,
      setCurrentCustomer,
      currentTechnician,
      setCurrentTechnician,
      setCustomerSession,
      setTechnicianSession,
      isAdminLoggedIn,
      signupCustomer,
      logoutCustomer,
      registerTechnician,
      loginTechnician,
      logoutTechnician,
      loginAdmin,
      logoutAdmin,
      createBooking,
      updateBooking,
      rateTechnician,
      completeJobWithPin,
      rechargeTechnicianWallet,
      addTechnician,
      updateTechnician,
      updateServicePrice,
      updateSubservicePrice,
      addService,
      addSubservice,
      deleteService,
      deleteSubservice,
      purgeProductionData,
      addComplaint,
      updateComplaint,
      requestAdminWithdrawal,
      updateAdminWithdrawalStatus,
      resetDemoData,
      sendStepNotification,
      markNotificationRead,
      clearNotifications,
      toasts,
      addToast,
      removeToast,
      wsStatus,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useGharSathi() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useGharSathi must be used inside AppDataProvider');
  return context;
}
