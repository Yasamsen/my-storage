/**
 * Shared dashboard shell: sidebar, user, logout, theme
 */

let currentUser = null;

async function initShell(activePage) {
  currentUser = await requireAuth();
  if (!currentUser) return null;

  // Greeting / username
  document.querySelectorAll('[data-username]').forEach((el) => {
    el.textContent = currentUser.username;
  });
  document.querySelectorAll('[data-greeting]').forEach((el) => {
    el.textContent = greeting() + ', ' + currentUser.username + ' 👋';
  });

  // Theme button
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.textContent =
      document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '🌙';
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      themeBtn.textContent = next === 'dark' ? '☀' : '🌙';
      API.patch('/api/user/profile', { theme: next }).catch(() => {});
    });
  }

  // Mobile menu
  const menuBtn = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('open');
    });
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
      });
    }
  }

  // Active nav
  if (activePage) {
    document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
      if (el.dataset.page === activePage) el.classList.add('active');
    });
  }

  // Logout
  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await API.post('/api/auth/logout');
      } catch {}
      localStorage.removeItem('token');
      window.location.href = '/login';
    });
  });

  return currentUser;
}

function sidebarHTML() {
  return `
  <aside class="sidebar" id="sidebar">
    <a href="/dashboard" class="sidebar-brand">
      <span class="logo">☁</span> MyStorage
    </a>
    <nav class="sidebar-nav">
      <div class="nav-section">
        <a href="/dashboard" class="nav-item" data-page="dashboard"><span class="icon">🏠</span> Dashboard</a>
        <a href="/files" class="nav-item" data-page="files"><span class="icon">📁</span> My Files</a>
        <a href="/files?category=image" class="nav-item" data-page="images"><span class="icon">🖼️</span> Images</a>
        <a href="/files?category=video" class="nav-item" data-page="videos"><span class="icon">🎬</span> Videos</a>
        <a href="/files?category=document" class="nav-item" data-page="documents"><span class="icon">📄</span> Documents</a>
        <a href="/files?category=audio" class="nav-item" data-page="audio"><span class="icon">🎵</span> Audio</a>
      </div>
      <div class="nav-section">
        <a href="/files?shared=1" class="nav-item" data-page="shared"><span class="icon">🔗</span> Shared</a>
        <a href="/trash" class="nav-item" data-page="trash"><span class="icon">🗑️</span> Trash</a>
      </div>
    </nav>
    <div class="sidebar-footer">
      <a href="/settings" class="nav-item" data-page="settings"><span class="icon">⚙️</span> Settings</a>
      <button class="nav-item" data-logout><span class="icon">🚪</span> Logout</button>
    </div>
  </aside>
  <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
  `;
}
