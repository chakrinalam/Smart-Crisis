// ============================================================
//  DataStore — tries the Node API first, falls back to
//  localStorage so the app works even without `node server.js`
// ============================================================

const DEFAULT_DB = {
  users: [
    { username: 'admin',      password: 'password', role: 'admin'     },
    { username: 'ngo1',       password: 'password', role: 'ngo'       },
    { username: 'authority1', password: 'password', role: 'authority' },
    { username: 'citizen1',   password: 'password', role: 'citizen'   }
  ],
  complaints: [],
  resources: []
};

const DataStore = {
  // Returns true when the Node server is reachable
  async _serverAvailable() {
    try {
      const res = await fetch('/api/data', { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async load() {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        // Seed localStorage mirror so offline reads stay current
        localStorage.setItem('aquasmart_db', JSON.stringify(data));
        return data;
      }
    } catch { /* fall through */ }

    // ---- Offline fallback: use localStorage ----
    const raw = localStorage.getItem('aquasmart_db');
    if (raw) {
      try { return JSON.parse(raw); } catch { /* corrupt, reset */ }
    }
    // First-ever load with no server — seed default data
    localStorage.setItem('aquasmart_db', JSON.stringify(DEFAULT_DB));
    return JSON.parse(JSON.stringify(DEFAULT_DB)); // deep clone
  },

  async save(data) {
    // Always save to localStorage immediately (instant, offline-safe)
    localStorage.setItem('aquasmart_db', JSON.stringify(data));

    // Also try to persist to server if available
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch { /* server not running — localStorage is our source of truth */ }
  }
};

// ============================================================
//  Auth
// ============================================================
const Auth = {
  async login(username, password) {
    const db = await DataStore.load();
    const user = db.users.find(
      u => u.username === username && u.password === password
    );
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      return user;
    }
    return null;
  },

  async register(username, password, role) {
    const db = await DataStore.load();
    if (db.users.find(u => u.username === username)) return false;
    const newUser = { username, password, role };
    db.users.push(newUser);
    await DataStore.save(db);
    return newUser;
  },

  logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  },

  getCurrentUser() {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  },

  guard(allowedRole) {
    const user = Auth.getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return null; }
    if (allowedRole && user.role !== allowedRole) {
      window.location.href = `${user.role}.html`;
      return null;
    }
    return user;
  }
};

// ============================================================
//  UI Utilities
// ============================================================
const AppUtils = {
  showAlert(message, type, elementId = 'alertBox') {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.className = `alert alert-${type} fade-in`;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 3500);
    } else {
      alert(message);
    }
  },

  generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
  },

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  logoutHandler() {
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); Auth.logout(); });
  },

  initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AppUtils.logoutHandler();
  AppUtils.initTheme();
  const user = Auth.getCurrentUser();
  if (user) {
    document.querySelectorAll('.username-display').forEach(el => {
      el.textContent = user.username;
    });
  }
});
