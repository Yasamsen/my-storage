/**
 * Upload system – drag & drop, progress, multi-file
 */

function createUploadModal() {
  if (document.getElementById('uploadModal')) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'uploadModal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h2 class="modal-title">Uploading...</h2>
        <button class="btn btn-ghost btn-icon" onclick="closeModal('uploadModal')" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" id="uploadList"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('uploadModal')">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function uploadFiles(fileList, folderId = null) {
  const files = Array.from(fileList);
  if (!files.length) return;

  createUploadModal();
  openModal('uploadModal');
  const list = document.getElementById('uploadList');
  list.innerHTML = '';

  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  if (folderId) formData.append('folderId', folderId);

  // Show pending items
  files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.id = 'upload-item-' + i;
    item.innerHTML = `
      <div class="upload-item-info">
        <div class="upload-item-name">${escapeHtml(f.name)}</div>
        <div class="upload-item-meta">${formatBytes(f.size)} · Waiting...</div>
        <div class="progress" style="margin-top:6px"><div class="progress-bar" style="width:0%"></div></div>
      </div>
    `;
    list.appendChild(item);
  });

  try {
    const token = localStorage.getItem('token');
    const xhr = new XMLHttpRequest();

    const result = await new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        files.forEach((_, i) => {
          const item = document.getElementById('upload-item-' + i);
          if (!item) return;
          const bar = item.querySelector('.progress-bar');
          const meta = item.querySelector('.upload-item-meta');
          if (bar) bar.style.width = pct + '%';
          if (meta) {
            meta.textContent =
              formatBytes(Math.round((e.loaded / files.length))) +
              ' / ' +
              formatBytes(files[i].size) +
              ' · ' +
              pct +
              '%';
          }
        });
      });

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.success) {
            resolve(data);
          } else {
            reject(new Error(data.message || 'Upload failed'));
          }
        } catch {
          reject(new Error('Upload failed'));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Connection lost')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', '/api/files/upload');
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.withCredentials = true;
      xhr.send(formData);
    });

    files.forEach((_, i) => {
      const item = document.getElementById('upload-item-' + i);
      if (!item) return;
      const bar = item.querySelector('.progress-bar');
      const meta = item.querySelector('.upload-item-meta');
      if (bar) bar.style.width = '100%';
      if (meta) meta.textContent = formatBytes(files[i].size) + ' · Done';
    });

    const title = document.querySelector('#uploadModal .modal-title');
    if (title) title.textContent = 'Upload completed';

    showToast(
      result.message || (files.length === 1 ? 'File uploaded' : files.length + ' files uploaded'),
      'success'
    );

    // Callback for page refresh
    if (typeof window.onUploadComplete === 'function') {
      window.onUploadComplete(result.data);
    }
  } catch (err) {
    showToast(err.message || 'Upload failed', 'error');
    const title = document.querySelector('#uploadModal .modal-title');
    if (title) title.textContent = 'Upload failed';
  }
}

function setupDropzone(zoneEl, folderIdGetter) {
  if (!zoneEl) return;

  ['dragenter', 'dragover'].forEach((ev) => {
    zoneEl.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zoneEl.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    zoneEl.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zoneEl.classList.remove('dragover');
    });
  });
  zoneEl.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) {
      const folderId = typeof folderIdGetter === 'function' ? folderIdGetter() : null;
      uploadFiles(files, folderId);
    }
  });
}

function openFilePicker(folderId, multiple = true) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = multiple;
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    if (input.files.length) uploadFiles(input.files, folderId);
    input.remove();
  });
  input.click();
}
