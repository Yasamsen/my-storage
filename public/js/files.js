/**
 * File manager logic
 */

let state = {
  folderId: null,
  category: null,
  search: '',
  sort: 'newest',
  view: localStorage.getItem('fileView') || 'list',
  page: 1,
  selected: new Set(),
  files: [],
  folders: [],
  breadcrumb: []
};

async function loadFiles() {
  const params = new URLSearchParams();
  if (state.folderId) params.set('folderId', state.folderId);
  if (state.category) params.set('category', state.category);
  if (state.search) params.set('search', state.search);
  params.set('sort', state.sort);
  params.set('page', state.page);
  params.set('limit', '50');

  const container = document.getElementById('fileContainer');
  if (container) {
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div><p class="mt-4">Loading files...</p></div>';
  }

  try {
    const res = await API.get('/api/files?' + params.toString());
    state.files = res.data.files || [];
    state.folders = res.data.folders || [];
    state.breadcrumb = res.data.breadcrumb || [];
    renderFiles();
    renderBreadcrumb();
  } catch (err) {
    showToast(err.message, 'error');
    if (container) {
      container.innerHTML = '<div class="empty-state"><h3>Failed to load files</h3><p>' + escapeHtml(err.message) + '</p></div>';
    }
  }
}

function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  if (!el) return;
  el.innerHTML = state.breadcrumb
    .map((b, i) => {
      const isLast = i === state.breadcrumb.length - 1;
      if (isLast) {
        return '<span class="current">' + escapeHtml(b.name) + '</span>';
      }
      return (
        '<a href="#" data-folder="' +
        (b.id || '') +
        '">' +
        escapeHtml(b.name) +
        '</a><span class="sep">/</span>'
      );
    })
    .join('');

  el.querySelectorAll('[data-folder]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      state.folderId = a.dataset.folder || null;
      state.page = 1;
      loadFiles();
    });
  });
}

function renderFiles() {
  const container = document.getElementById('fileContainer');
  if (!container) return;

  const items = [...state.folders.map((f) => ({ ...f, _type: 'folder' })), ...state.files.map((f) => ({ ...f, _type: 'file' }))];

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <h3>${state.search ? 'No results' : state.folderId ? 'This folder is empty' : 'No files yet'}</h3>
        <p>${state.search ? 'Try a different search term.' : 'Upload your first file to get started.'}</p>
        ${!state.search ? '<button class="btn btn-primary" onclick="openFilePicker(state.folderId)">+ Upload File</button>' : ''}
      </div>`;
    return;
  }

  if (state.view === 'grid') {
    container.innerHTML =
      '<div class="file-grid">' +
      items
        .map((item) => {
          if (item._type === 'folder') {
            return `
            <div class="file-card" data-id="${item.id}" data-type="folder" ondblclick="openFolder('${item.id}')">
              <div class="file-card-thumb">📁</div>
              <div class="file-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
              <div class="file-card-meta">Folder</div>
            </div>`;
          }
          const icon =
            item.category === 'image'
              ? `<img src="/api/files/${item.id}/stream" alt="" loading="lazy" onerror="this.parentElement.textContent='🖼️'" />`
              : categoryIcon(item.category, item.extension);
          return `
          <div class="file-card ${state.selected.has(item.id) ? 'selected' : ''}" data-id="${item.id}" data-type="file"
               ondblclick="previewFile('${item.id}')" oncontextmenu="showContextMenu(event,'${item.id}')">
            <input type="checkbox" class="file-check" style="position:absolute;top:10px;left:10px;z-index:2"
                   ${state.selected.has(item.id) ? 'checked' : ''} onchange="toggleSelect('${item.id}', this.checked)" />
            <div class="file-card-thumb">${typeof icon === 'string' && icon.startsWith('<') ? icon : icon}</div>
            <div class="file-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="file-card-meta">${formatBytes(item.size)}</div>
            <div class="file-actions">
              <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();showActionMenu(event,'${item.id}')" aria-label="Actions">⋮</button>
            </div>
          </div>`;
        })
        .join('') +
      '</div>';
  } else {
    container.innerHTML = `
      <table class="file-table">
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" class="file-check" id="selectAll" onchange="toggleSelectAll(this.checked)" /></th>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Modified</th>
            <th style="width:50px"></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((item) => {
              if (item._type === 'folder') {
                return `
                <tr data-id="${item.id}" data-type="folder" ondblclick="openFolder('${item.id}')">
                  <td></td>
                  <td><div class="file-name-cell"><div class="file-icon">📁</div><span class="file-name">${escapeHtml(item.name)}</span></div></td>
                  <td class="text-secondary">Folder</td>
                  <td class="text-secondary">—</td>
                  <td class="text-secondary">${formatDate(item.updatedAt || item.createdAt)}</td>
                  <td></td>
                </tr>`;
              }
              const icon =
                item.category === 'image'
                  ? `<img src="/api/files/${item.id}/stream" alt="" loading="lazy" onerror="this.parentElement.textContent='🖼️'" />`
                  : categoryIcon(item.category, item.extension);
              return `
              <tr class="${state.selected.has(item.id) ? 'selected' : ''}" data-id="${item.id}" data-type="file"
                  ondblclick="previewFile('${item.id}')" oncontextmenu="showContextMenu(event,'${item.id}')">
                <td><input type="checkbox" class="file-check" ${state.selected.has(item.id) ? 'checked' : ''} onchange="toggleSelect('${item.id}', this.checked)" /></td>
                <td><div class="file-name-cell"><div class="file-icon">${typeof icon === 'string' && icon.startsWith('<') ? icon : icon}</div><span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span></div></td>
                <td class="text-secondary">${escapeHtml((item.extension || item.category || '').toUpperCase())}</td>
                <td class="text-secondary">${formatBytes(item.size)}</td>
                <td class="text-secondary">${formatDate(item.updatedAt || item.createdAt)}</td>
                <td><div class="file-actions"><button class="btn btn-ghost btn-icon" onclick="showActionMenu(event,'${item.id}')" aria-label="Actions">⋮</button></div></td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
  }

  updateSelectionBar();
}

function openFolder(id) {
  state.folderId = id;
  state.page = 1;
  state.selected.clear();
  loadFiles();
}

function toggleSelect(id, checked) {
  if (checked) state.selected.add(id);
  else state.selected.delete(id);
  updateSelectionBar();
  renderFiles();
}

function toggleSelectAll(checked) {
  state.selected.clear();
  if (checked) state.files.forEach((f) => state.selected.add(f.id));
  updateSelectionBar();
  renderFiles();
}

function updateSelectionBar() {
  const bar = document.getElementById('selectionBar');
  if (!bar) return;
  if (state.selected.size > 0) {
    bar.classList.add('visible');
    bar.querySelector('.sel-count').textContent = state.selected.size + ' selected';
  } else {
    bar.classList.remove('visible');
  }
}

function setView(view) {
  state.view = view;
  localStorage.setItem('fileView', view);
  document.querySelectorAll('.view-toggle button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  renderFiles();
}

/* Actions */
async function downloadFile(id) {
  const token = localStorage.getItem('token');
  window.open('/api/files/' + id + '/download' + (token ? '?t=' + token : ''), '_blank');
  // Better: use fetch with blob
  try {
    const res = await fetch('/api/files/' + id + '/download', {
      credentials: 'include',
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const file = state.files.find((f) => f.id === id);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file ? file.name : 'download';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteFile(id) {
  if (!confirm('Move this file to trash?')) return;
  try {
    await API.delete('/api/files/' + id);
    showToast('File moved to trash', 'success');
    state.selected.delete(id);
    loadFiles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renameFile(id) {
  const file = state.files.find((f) => f.id === id);
  if (!file) return;
  const name = prompt('New name:', file.name);
  if (!name || name === file.name) return;
  try {
    await API.patch('/api/files/' + id + '/rename', { name });
    showToast('File renamed', 'success');
    loadFiles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function shareFile(id) {
  try {
    const res = await API.post('/api/share/' + id, {
      permission: 'download',
      expiresIn: 'never'
    });
    const url = res.data.url;
    await navigator.clipboard.writeText(url).catch(() => {});
    showToast('Share link copied: ' + url, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showFileDetails(id) {
  try {
    const res = await API.get('/api/files/' + id);
    const f = res.data;
    alert(
      'File Details\n\n' +
        'Name: ' + f.name + '\n' +
        'Type: ' + (f.mimeType || f.extension) + '\n' +
        'Size: ' + formatBytes(f.size) + '\n' +
        'Location: ' + f.location + '\n' +
        'Uploaded: ' + formatDate(f.createdAt) + '\n' +
        'Modified: ' + formatDate(f.updatedAt)
    );
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function previewFile(id) {
  window.location.href = '/preview?id=' + id;
}

/* Context / action menu */
function showContextMenu(e, id) {
  e.preventDefault();
  showMenuAt(e.clientX, e.clientY, id);
}

function showActionMenu(e, id) {
  e.stopPropagation();
  const rect = e.currentTarget.getBoundingClientRect();
  showMenuAt(rect.left, rect.bottom + 4, id);
}

function showMenuAt(x, y, id) {
  let menu = document.getElementById('contextMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'contextMenu';
    menu.className = 'context-menu';
    document.body.appendChild(menu);
  }
  menu.innerHTML = `
    <button onclick="previewFile('${id}');hideMenu()">👁️ Preview</button>
    <button onclick="downloadFile('${id}');hideMenu()">⬇️ Download</button>
    <button onclick="shareFile('${id}');hideMenu()">🔗 Share</button>
    <button onclick="renameFile('${id}');hideMenu()">✏️ Rename</button>
    <button onclick="showFileDetails('${id}');hideMenu()">ℹ️ Details</button>
    <hr />
    <button class="danger" onclick="deleteFile('${id}');hideMenu()">🗑️ Delete</button>
  `;
  menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 280) + 'px';
  menu.classList.add('open');
}

function hideMenu() {
  const menu = document.getElementById('contextMenu');
  if (menu) menu.classList.remove('open');
}

document.addEventListener('click', hideMenu);

async function createFolder() {
  const name = prompt('Folder name:');
  if (!name) return;
  try {
    await API.post('/api/folders', { name, parentId: state.folderId });
    showToast('Folder created', 'success');
    loadFiles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSelected() {
  if (!state.selected.size) return;
  if (!confirm('Move ' + state.selected.size + ' file(s) to trash?')) return;
  for (const id of state.selected) {
    try {
      await API.delete('/api/files/' + id);
    } catch {}
  }
  state.selected.clear();
  showToast('Files moved to trash', 'success');
  loadFiles();
}

async function downloadSelected() {
  for (const id of state.selected) {
    await downloadFile(id);
  }
}
