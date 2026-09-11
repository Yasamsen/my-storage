/**
 * Auth helpers – API calls, session check, theme
 */

const API = {
  async request(url, options = {}) {
    const opts = {
      credentials: 'include',
      headers: { ...(options.headers || {}) },
      ...options
    };
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    // Attach token from localStorage as fallback
    const token = localStorage.getItem('token');
    if (token && !opts.headers.Authorization) {
      opts.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, opts);
      const data = await res.json().catch(() => ({ success: false, message: 'Invalid response' }));
      if (!res.ok) {
        const err = new Error(data.message || 'Request failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.status) throw err;
      throw new Error('Connection lost. Please check your internet connection.');
    }
  },

  get(url) {
    return this.request(url);
  },
  post(url, body) {
    return this.request(url, { method: 'POST', body });
  },
  patch(url, body) {
    return this.request(url, { method: 'PATCH', body });
  },
  delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
};

async function getCurrentUser() {
  try {
    const res = await API.get('/api/auth/me');
    return res.data;
  } catch {
    return null;
  }
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login';
    return null;
  }
  return user;
}

async function redirectIfAuth() {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = '/dashboard';
  }
}

function applyTheme(theme) {
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme || 'light');
  }
  localStorage.setItem('theme', theme || 'system');
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'system';
  applyTheme(saved);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('theme') || 'system') === 'system') {
      applyTheme('system');
    }
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function categoryIcon(category, extension) {
  const map = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: extension === 'pdf' ? '📄' : '📝',
    archive: '📦',
    other: '📎'
  };
  return map[category] || '📎';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* Toast system */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;
  container.appendChild(toast);
  const remove = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 200);
  };
  toast.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, 4000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* Modal helpers */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

initTheme();
