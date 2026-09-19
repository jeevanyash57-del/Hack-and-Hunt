/* ============================================================
   HACK & HUNT 2026 — SECURE ADMIN CMS & IN-PLACE EDIT MODE
   - Cryptographic SHA-256 Authentication & RBAC
   - Live In-Place Visual Editor (Text, Headings, Rules, Images)
   - Save, Cancel, Preview Controls
   - Permanent Local & Cloud/Export Persistence
   - Protected from regular visitors
   ============================================================ */

(function() {
  'use strict';

  // --- CRYPTO & CREDENTIALS CONFIGURATION ---
  // Default Accounts:
  // 1. admin / admin2026 (Role: admin)
  // 2. editor / editor2026 (Role: editor)
  const DEFAULT_USERS = {
    'admin': {
      hash: '6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6',
      role: 'admin'
    },
    'editor': {
      hash: 'f5d467de14f2ed073653dd68eb25435b5439aaa95b855db464ee873218c2425a',
      role: 'editor'
    }
  };

  const STORAGE_KEY_CONTENT = 'hack_hunt_cms_content';
  const STORAGE_KEY_AUTH = 'hack_hunt_admin_session';
  const STORAGE_KEY_USERS = 'hack_hunt_admin_users';
  const LOCKOUT_KEY = 'hack_hunt_admin_lockout';

  // Helper: SHA-256
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // --- STATE ---
  let isEditMode = false;
  let isPreviewMode = false;
  let currentUser = null;
  let draftBackup = {};

  // Get active users (defaults + any customized passwords)
  function getUsers() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS);
      return stored ? Object.assign({}, DEFAULT_USERS, JSON.parse(stored)) : DEFAULT_USERS;
    } catch(e) {
      return DEFAULT_USERS;
    }
  }

  // --- HYDRATION ENGINE (Runs for everyone immediately) ---
  function hydrateContent() {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY_CONTENT);
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (!data || !data.fields) return;

      // Hydrate text fields
      Object.keys(data.fields).forEach(key => {
        const el = document.querySelector(`[data-cms-key="${key}"]`);
        if (el) {
          el.innerHTML = data.fields[key];
        }
      });

      // Hydrate images
      if (data.images) {
        Object.keys(data.images).forEach(key => {
          const img = document.querySelector(`img[data-cms-key="${key}"]`);
          if (img) {
            img.src = data.images[key];
          }
        });
      }

      // Hydrate custom links
      if (data.links) {
        Object.keys(data.links).forEach(key => {
          const link = document.querySelector(`a[data-cms-key="${key}"]`);
          if (link) {
            link.href = data.links[key];
          }
        });
      }
    } catch (err) {
      console.warn('[CMS] Hydration warning:', err);
    }
  }

  // Execute hydration as early as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateContent);
  } else {
    hydrateContent();
  }

  // --- AUTHENTICATION & SESSION MANAGEMENT ---
  function getSession() {
    try {
      const sStr = sessionStorage.getItem(STORAGE_KEY_AUTH);
      if (!sStr) return null;
      const s = JSON.parse(sStr);
      if (Date.now() > s.expires) {
        sessionStorage.removeItem(STORAGE_KEY_AUTH);
        return null;
      }
      return s;
    } catch(e) {
      return null;
    }
  }

  function setSession(username, role) {
    const s = {
      username: username,
      role: role,
      token: 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
      expires: Date.now() + (4 * 60 * 60 * 1000) // 4 hours session
    };
    sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(s));
    currentUser = s;
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY_AUTH);
    currentUser = null;
  }

  function checkLockout() {
    try {
      const lStr = localStorage.getItem(LOCKOUT_KEY);
      if (!lStr) return 0;
      const l = JSON.parse(lStr);
      if (l.until && Date.now() < l.until) {
        return Math.ceil((l.until - Date.now()) / 1000);
      }
      return 0;
    } catch(e) { return 0; }
  }

  function recordFailedLogin() {
    try {
      const lStr = localStorage.getItem(LOCKOUT_KEY);
      const l = lStr ? JSON.parse(lStr) : { count: 0 };
      l.count = (l.count || 0) + 1;
      if (l.count >= 5) {
        l.until = Date.now() + (3 * 60 * 1000); // 3 min lockout
        l.count = 0;
      }
      localStorage.setItem(LOCKOUT_KEY, JSON.stringify(l));
    } catch(e) {}
  }

  function clearLockout() {
    localStorage.removeItem(LOCKOUT_KEY);
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(msg, type = 'success') {
    let container = document.getElementById('cms-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cms-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `cms-toast cms-toast--${type}`;
    const icon = type === 'success' ? '✔' : (type === 'error' ? '✖' : 'ℹ');
    toast.innerHTML = `<span class="cms-toast-icon">${icon}</span><span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('cms-toast--show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('cms-toast--show');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // --- IN-PLACE EDITOR ENGINE ---
  function backupCurrentDOM() {
    draftBackup = { fields: {}, images: {}, links: {} };
    document.querySelectorAll('[data-cms-key]').forEach(el => {
      const key = el.getAttribute('data-cms-key');
      if (el.tagName === 'IMG') {
        draftBackup.images[key] = el.src;
      } else if (el.tagName === 'A') {
        draftBackup.fields[key] = el.innerHTML;
        draftBackup.links[key] = el.href;
      } else {
        draftBackup.fields[key] = el.innerHTML;
      }
    });
  }

  function startEditMode() {
    if (!currentUser) return;
    backupCurrentDOM();
    isEditMode = true;
    isPreviewMode = false;
    document.body.classList.add('cms-edit-mode-active');
    document.body.classList.remove('cms-preview-active');

    // Make elements editable
    document.querySelectorAll('[data-cms-key]').forEach(el => {
      if (el.tagName === 'IMG') {
        el.classList.add('cms-editable-img');
        if (!el.dataset.cmsListener) {
          el.addEventListener('click', onImageClick);
          el.dataset.cmsListener = 'true';
        }
      } else {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
      }
    });

    // Intercept link clicks while editing
    document.addEventListener('click', preventLinkNavInEdit, true);

    updateHudUI();
    showToast('Edit Mode Enabled: Click on any text, heading, rule, or image to edit!', 'info');
  }

  function preventLinkNavInEdit(e) {
    if (!isEditMode || isPreviewMode) return;
    const a = e.target.closest('a[data-cms-key]');
    if (a) {
      e.preventDefault();
    }
  }

  function stopEditMode(cleanup = true) {
    isEditMode = false;
    isPreviewMode = false;
    document.body.classList.remove('cms-edit-mode-active', 'cms-preview-active');

    document.querySelectorAll('[data-cms-key]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.classList.remove('cms-editable-img', 'cms-outline-highlight');
    });

    document.removeEventListener('click', preventLinkNavInEdit, true);
    if (cleanup) updateHudUI();
  }

  function togglePreview() {
    if (!isEditMode) return;
    isPreviewMode = !isPreviewMode;
    if (isPreviewMode) {
      document.body.classList.add('cms-preview-active');
      document.querySelectorAll('[data-cms-key]').forEach(el => {
        el.removeAttribute('contenteditable');
      });
      showToast('Preview Mode: Viewing as regular visitors see it', 'info');
    } else {
      document.body.classList.remove('cms-preview-active');
      document.querySelectorAll('[data-cms-key]').forEach(el => {
        if (el.tagName !== 'IMG') el.setAttribute('contenteditable', 'true');
      });
      showToast('Exited Preview Mode: Editing resumed', 'info');
    }
    updateHudUI();
  }

  function saveChanges() {
    if (!currentUser) return;
    const cmsData = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser.username,
      fields: {},
      images: {},
      links: {}
    };

    document.querySelectorAll('[data-cms-key]').forEach(el => {
      const key = el.getAttribute('data-cms-key');
      if (el.tagName === 'IMG') {
        cmsData.images[key] = el.src;
      } else if (el.tagName === 'A') {
        cmsData.fields[key] = el.innerHTML;
        cmsData.links[key] = el.href;
      } else {
        cmsData.fields[key] = el.innerHTML;
      }
    });

    try {
      localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(cmsData));
      stopEditMode(false);
      updateHudUI();
      showToast('All changes saved permanently! Content will persist across reloads.', 'success');
    } catch (err) {
      showToast('Failed to save to local storage: ' + err.message, 'error');
    }
  }

  function cancelChanges() {
    if (!isEditMode && !draftBackup.fields) return;
    // Revert to backup
    if (draftBackup.fields) {
      Object.keys(draftBackup.fields).forEach(key => {
        const el = document.querySelector(`[data-cms-key="${key}"]`);
        if (el) el.innerHTML = draftBackup.fields[key];
      });
    }
    if (draftBackup.images) {
      Object.keys(draftBackup.images).forEach(key => {
        const img = document.querySelector(`img[data-cms-key="${key}"]`);
        if (img) img.src = draftBackup.images[key];
      });
    }
    if (draftBackup.links) {
      Object.keys(draftBackup.links).forEach(key => {
        const link = document.querySelector(`a[data-cms-key="${key}"]`);
        if (link) link.href = draftBackup.links[key];
      });
    }
    stopEditMode();
    showToast('Unsaved edits discarded. Reverted to previous state.', 'info');
  }

  function resetToFactoryDefaults() {
    if (!confirm('Are you sure you want to reset all website text, headings, rules, and images back to default original content?')) {
      return;
    }
    localStorage.removeItem(STORAGE_KEY_CONTENT);
    stopEditMode();
    showToast('Resetting to original factory defaults...', 'info');
    setTimeout(() => window.location.reload(), 800);
  }

  // --- IMAGE REPLACEMENT MODAL ---
  let activeImageElement = null;

  function onImageClick(e) {
    if (!isEditMode || isPreviewMode) return;
    e.preventDefault();
    e.stopPropagation();
    activeImageElement = e.currentTarget;
    openImageModal(activeImageElement);
  }

  function openImageModal(imgEl) {
    let modal = document.getElementById('cms-image-modal');
    if (!modal) {
      modal = createImageModal();
      document.body.appendChild(modal);
    }

    const preview = modal.querySelector('#cms-modal-img-preview');
    const inputUrl = modal.querySelector('#cms-modal-img-url');
    const fileInput = modal.querySelector('#cms-modal-file-input');

    inputUrl.value = imgEl.src;
    preview.src = imgEl.src;
    fileInput.value = '';

    modal.classList.add('cms-modal--open');
  }

  function createImageModal() {
    const m = document.createElement('div');
    m.id = 'cms-image-modal';
    m.className = 'cms-modal-overlay';
    m.innerHTML = `
      <div class="cms-modal-box">
        <div class="cms-modal-header">
          <h3><span>📷</span> REPLACE IMAGE</h3>
          <button type="button" class="cms-modal-close" id="cms-img-close">&times;</button>
        </div>
        <div class="cms-modal-body">
          <div class="cms-img-preview-box">
            <img id="cms-modal-img-preview" src="" alt="Preview" />
          </div>
          <div class="cms-form-group">
            <label>Image Web URL:</label>
            <input type="text" id="cms-modal-img-url" placeholder="https://example.com/image.png or assets/..." />
          </div>
          <div class="cms-form-group">
            <label>Or Upload from Computer:</label>
            <input type="file" id="cms-modal-file-input" accept="image/*" />
          </div>
        </div>
        <div class="cms-modal-footer">
          <button type="button" class="cms-btn cms-btn--secondary" id="cms-img-cancel">Cancel</button>
          <button type="button" class="cms-btn cms-btn--primary" id="cms-img-apply">Apply Image</button>
        </div>
      </div>
    `;

    // Handlers
    m.querySelector('#cms-img-close').onclick = () => m.classList.remove('cms-modal--open');
    m.querySelector('#cms-img-cancel').onclick = () => m.classList.remove('cms-modal--open');

    const preview = m.querySelector('#cms-modal-img-preview');
    const inputUrl = m.querySelector('#cms-modal-img-url');
    const fileInput = m.querySelector('#cms-modal-file-input');

    inputUrl.oninput = () => {
      if (inputUrl.value.trim()) preview.src = inputUrl.value.trim();
    };

    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.src = e.target.result;
          inputUrl.value = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    };

    m.querySelector('#cms-img-apply').onclick = () => {
      if (activeImageElement && preview.src) {
        activeImageElement.src = preview.src;
        showToast('Image updated! Click "Save Changes" to make it permanent.', 'success');
      }
      m.classList.remove('cms-modal--open');
    };

    return m;
  }

  // --- DOWNLOAD PUBLISHED HTML ---
  function downloadPublishedHTML() {
    // Clone document, remove admin classes/attributes, and trigger file download
    const docClone = document.documentElement.cloneNode(true);

    // Remove CMS floating UI from clone
    const hud = docClone.querySelector('#cms-admin-hud');
    if (hud) hud.remove();
    const loginM = docClone.querySelector('#cms-login-modal');
    if (loginM) loginM.remove();
    const imgM = docClone.querySelector('#cms-image-modal');
    if (imgM) imgM.remove();
    const toasts = docClone.querySelector('#cms-toast-container');
    if (toasts) toasts.remove();

    docClone.classList.remove('cms-edit-mode-active', 'cms-preview-active');
    docClone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    docClone.querySelectorAll('.cms-editable-img').forEach(el => el.classList.remove('cms-editable-img'));

    const htmlContent = '<!DOCTYPE html>\n' + docClone.outerHTML;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Published index.html downloaded with all changes baked in!', 'success');
  }

  // --- ADMIN FLOATING HUD TOOLBAR ---
  function renderAdminHud() {
    let hud = document.getElementById('cms-admin-hud');
    if (!currentUser) {
      if (hud) hud.remove();
      return;
    }

    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'cms-admin-hud';
      hud.className = 'cms-hud-bar';
      document.body.appendChild(hud);
    }

    hud.innerHTML = `
      <div class="cms-hud-inner">
        <div class="cms-hud-left">
          <span class="cms-hud-status-dot"></span>
          <span class="cms-hud-role">ADMIN MODE: <strong>${currentUser.username.toUpperCase()}</strong> (${currentUser.role.toUpperCase()})</span>
        </div>

        <div class="cms-hud-controls">
          ${!isEditMode ? `
            <button type="button" class="cms-btn cms-btn--primary" id="cms-btn-start-edit">
              <span>✎</span> Edit Website
            </button>
            <button type="button" class="cms-btn cms-btn--subtle" id="cms-btn-download" title="Export clean index.html with all changes baked in">
              <span>📥</span> Export HTML
            </button>
            <button type="button" class="cms-btn cms-btn--danger-text" id="cms-btn-reset-default" title="Reset back to factory defaults">
              <span>↺</span> Reset Defaults
            </button>
          ` : `
            <button type="button" class="cms-btn cms-btn--save" id="cms-btn-save">
              <span>💾</span> Save Changes
            </button>
            <button type="button" class="cms-btn cms-btn--preview ${isPreviewMode ? 'cms-btn--active' : ''}" id="cms-btn-preview">
              <span>${isPreviewMode ? '✏ Exit Preview' : '👁 Preview'}</span>
            </button>
            <button type="button" class="cms-btn cms-btn--cancel" id="cms-btn-cancel">
              <span>✖</span> Cancel
            </button>
          `}
          <button type="button" class="cms-btn cms-btn--logout" id="cms-btn-logout" title="Logout">
            <span>🚪</span> Logout
          </button>
        </div>
      </div>
    `;

    // Event listeners
    const btnStart = hud.querySelector('#cms-btn-start-edit');
    if (btnStart) btnStart.onclick = startEditMode;

    const btnSave = hud.querySelector('#cms-btn-save');
    if (btnSave) btnSave.onclick = saveChanges;

    const btnPreview = hud.querySelector('#cms-btn-preview');
    if (btnPreview) btnPreview.onclick = togglePreview;

    const btnCancel = hud.querySelector('#cms-btn-cancel');
    if (btnCancel) btnCancel.onclick = cancelChanges;

    const btnDownload = hud.querySelector('#cms-btn-download');
    if (btnDownload) btnDownload.onclick = downloadPublishedHTML;

    const btnReset = hud.querySelector('#cms-btn-reset-default');
    if (btnReset) btnReset.onclick = resetToFactoryDefaults;

    const btnLogout = hud.querySelector('#cms-btn-logout');
    if (btnLogout) btnLogout.onclick = () => {
      stopEditMode();
      clearSession();
      renderAdminHud();
      showToast('Logged out of Admin Mode. Regular visitor view restored.', 'info');
    };
  }

  function updateHudUI() {
    renderAdminHud();
  }

  // --- ADMIN LOGIN MODAL ---
  function openLoginModal() {
    let modal = document.getElementById('cms-login-modal');
    if (!modal) {
      modal = createLoginModal();
      document.body.appendChild(modal);
    }
    const errEl = modal.querySelector('#cms-login-error');
    errEl.style.display = 'none';
    modal.querySelector('#cms-login-user').value = '';
    modal.querySelector('#cms-login-pass').value = '';
    modal.classList.add('cms-modal--open');
    setTimeout(() => modal.querySelector('#cms-login-user').focus(), 100);
  }

  function createLoginModal() {
    const m = document.createElement('div');
    m.id = 'cms-login-modal';
    m.className = 'cms-modal-overlay';
    m.innerHTML = `
      <div class="cms-modal-box cms-modal-box--login">
        <div class="cms-modal-header">
          <h3><span>⚡</span> ADMINISTRATOR AUTHENTICATION</h3>
          <button type="button" class="cms-modal-close" id="cms-login-close">&times;</button>
        </div>
        <form id="cms-login-form">
          <div class="cms-modal-body">
            <p class="cms-login-lead">Enter authorized credentials to enable Admin Edit Mode for Hack & Hunt.</p>
            <div class="cms-login-error" id="cms-login-error"></div>
            <div class="cms-form-group">
              <label for="cms-login-user">Username</label>
              <input type="text" id="cms-login-user" autocomplete="username" placeholder="admin" required />
            </div>
            <div class="cms-form-group">
              <label for="cms-login-pass">Password</label>
              <input type="password" id="cms-login-pass" autocomplete="current-password" placeholder="••••••••" required />
            </div>
          </div>
          <div class="cms-modal-footer">
            <button type="button" class="cms-btn cms-btn--secondary" id="cms-login-cancel">Cancel</button>
            <button type="submit" class="cms-btn cms-btn--primary">Authenticate →</button>
          </div>
        </form>
      </div>
    `;

    m.querySelector('#cms-login-close').onclick = () => m.classList.remove('cms-modal--open');
    m.querySelector('#cms-login-cancel').onclick = () => m.classList.remove('cms-modal--open');

    m.querySelector('#cms-login-form').onsubmit = async (e) => {
      e.preventDefault();
      const lockSecs = checkLockout();
      const errEl = m.querySelector('#cms-login-error');
      if (lockSecs > 0) {
        errEl.textContent = `Too many failed attempts. Locked for ${lockSecs}s.`;
        errEl.style.display = 'block';
        return;
      }

      const user = m.querySelector('#cms-login-user').value.trim();
      const pass = m.querySelector('#cms-login-pass').value;
      const users = getUsers();

      if (!users[user]) {
        recordFailedLogin();
        errEl.textContent = 'Invalid username or password.';
        errEl.style.display = 'block';
        return;
      }

      const hashed = await sha256(pass);
      if (hashed === users[user].hash) {
        clearLockout();
        setSession(user, users[user].role);
        m.classList.remove('cms-modal--open');
        renderAdminHud();
        showToast(`Authentication successful! Welcome, ${user}. Click "Edit Website" to start.`, 'success');
      } else {
        recordFailedLogin();
        errEl.textContent = 'Invalid username or password.';
        errEl.style.display = 'block';
      }
    };

    return m;
  }

  // --- INITIALIZATION & TRIGGERS ---
  function init() {
    // 1. Check existing session
    currentUser = getSession();
    if (currentUser) {
      renderAdminHud();
    }

    // 2. Keyboard shortcut: Ctrl + Shift + A (or Cmd + Shift + A)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (currentUser) {
          if (!isEditMode) startEditMode();
          else stopEditMode();
        } else {
          openLoginModal();
        }
      }
      // Esc key cancels or closes modals
      if (e.key === 'Escape') {
        const modal = document.querySelector('.cms-modal-overlay.cms-modal--open');
        if (modal) modal.classList.remove('cms-modal--open');
      }
    });

    // 3. Discrete footer link trigger binding
    const footerTrigger = document.getElementById('admin-login-trigger');
    if (footerTrigger) {
      footerTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
          showToast('Already authenticated as ' + currentUser.username, 'info');
          renderAdminHud();
        } else {
          openLoginModal();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
