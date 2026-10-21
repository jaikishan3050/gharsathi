/**
 * Ghar Sathi Real-Time Live Job Dispatch WebSocket Client
 * Connects to Django Channels on `ws://localhost:8000/ws/jobs/`
 * Broadcasts instant unassigned bookings to online technicians with auto-reconnect.
 */

class JobWebSocketService {
  constructor() {
    this.socket = null;
    this.subscribers = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.reconnectInterval = 2500;
    this.reconnectTimer = null;
    this.isExplicitDisconnect = false;
    this.currentArea = null;
    this.status = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
  }

  getWebSocketUrl(area = null) {
    if (import.meta.env.VITE_WS_URL) {
      const base = import.meta.env.VITE_WS_URL.replace(/\/+$/, '');
      const areaSuffix = area ? `/${encodeURIComponent(area)}/` : '/';
      return `${base}${areaSuffix}`;
    }
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    // Production environment (Firebase Hosting / Cloud Run / Render)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const areaSuffix = area ? `/${encodeURIComponent(area)}/` : '/';
      if (hostname.includes('gharsathi.in') || hostname.endsWith('.web.app') || hostname.endsWith('.firebaseapp.com')) {
        return `${protocol}//${window.location.host}/ws/jobs${areaSuffix}`;
      }
      return `wss://gharsathi-backend.onrender.com/ws/jobs${areaSuffix}`;
    }

    const port = '8000';
    const areaSuffix = area ? `${encodeURIComponent(area)}/` : '';
    return `${protocol}//${hostname}:${port}/ws/jobs/${areaSuffix}`;
  }

  connect(area = null) {
    if (typeof window === 'undefined') return;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      if (area && area !== this.currentArea) {
        this.setArea(area);
      }
      return;
    }

    this.isExplicitDisconnect = false;
    this.currentArea = area || this.currentArea;
    this.status = 'connecting';
    this.notifySubscribers({ type: 'status_change', status: 'connecting' });

    const wsUrl = this.getWebSocketUrl(this.currentArea);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        console.log(`[GharSathi WS] Connected to Live Dispatch at ${wsUrl}`);

        if (this.currentArea) {
          this.setArea(this.currentArea);
        }

        this.notifySubscribers({
          type: 'status_change',
          status: 'connected',
          message: 'Real-time live job dispatch connected',
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifySubscribers(data);
        } catch (err) {
          console.warn('[GharSathi WS] Received non-JSON message:', event.data);
        }
      };

      this.socket.onclose = (event) => {
        this.status = 'disconnected';
        this.notifySubscribers({ type: 'status_change', status: 'disconnected' });

        if (!this.isExplicitDisconnect) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[GharSathi WS] Connection error:', err);
        if (this.socket) {
          try {
            this.socket.close();
          } catch {}
        }
      };
    } catch (err) {
      console.warn('[GharSathi WS] Failed to initialize WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[GharSathi WS] Max reconnect attempts reached. Standing by.');
      return;
    }

    const backoffDelay = Math.min(this.reconnectInterval * Math.pow(1.3, this.reconnectAttempts), 15000);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitDisconnect) {
        this.connect(this.currentArea);
      }
    }, backoffDelay);
  }

  setArea(area) {
    this.currentArea = area;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ action: 'subscribe_area', area }));
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    }
    return false;
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(data) {
    this.subscribers.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error('[GharSathi WS] Subscriber error:', err);
      }
    });
  }

  disconnect() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.status = 'disconnected';
    this.notifySubscribers({ type: 'status_change', status: 'disconnected' });
  }

  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

export const jobWebSocket = new JobWebSocketService();
export default jobWebSocket;
