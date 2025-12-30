// alp.js - Minimal entry point with GitHub SHA-based versioning
// Pass token via query param: <script src="alp.js?token=YOUR_TOKEN"></script>
(() => {
  'use strict';

  // === ON-PAGE ERROR DISPLAY (for mobile debugging) ===
  const errorContainer = document.createElement('div');
  errorContainer.id = 'alp-error-container';
  errorContainer.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 99999;
    max-height: 40vh;
    overflow-y: auto;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
  `;

  const showError = (message, type = 'error') => {
    // Always log to console as well
    const consoleMethod = type === 'warn' ? console.warn : console.error;
    consoleMethod('[Alp]', message);

    // Create error toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: ${type === 'warn' ? '#f59e0b' : '#ef4444'};
      color: white;
      padding: 12px 40px 12px 16px;
      margin: 4px 8px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      position: relative;
      word-break: break-word;
      animation: alp-slide-up 0.3s ease-out;
    `;
    toast.textContent = message;

    // Dismiss button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      opacity: 0.8;
    `;
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(closeBtn);

    // Add animation keyframes if not already added
    if (!document.getElementById('alp-error-styles')) {
      const style = document.createElement('style');
      style.id = 'alp-error-styles';
      style.textContent = `
        @keyframes alp-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Ensure container is in DOM
    if (!errorContainer.parentNode) {
      document.body.appendChild(errorContainer);
    }
    errorContainer.appendChild(toast);

    // Auto-dismiss after 15 seconds (but user can dismiss earlier)
    setTimeout(() => toast.remove(), 15000);
  };

  // Expose showError globally for use by core.js and other modules
  window.__alpShowError = showError;

  // Global error handlers
  window.addEventListener('error', (e) => {
    showError(`${e.message} (${e.filename}:${e.lineno})`);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason?.message || e.reason || 'Unknown promise rejection';
    showError(`Unhandled: ${reason}`);
  });

  // Parse token from query params
  const params = new URL(document.currentScript.src).searchParams;
  const GH_TOKEN = params.get('token') || '';
  const isAuth = GH_TOKEN && !GH_TOKEN.includes('🎟️');
  const getHeaders = () => isAuth ? { 'Authorization': `Bearer ${GH_TOKEN.trim()}` } : {};

  // Base URL for loading other modules
  const BASE = document.currentScript?.src.replace(/[^/]+$/, '') || '';

  // Fetch latest commit SHA from GitHub
  const fetchSha = async () => {
    try {
      const res = await fetch('https://api.github.com/repos/mehrlander/Alp/commits/main', {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
      const data = await res.json();
      return data.sha?.slice(0, 7) || null;
    } catch (err) {
      showError(`Failed to fetch SHA: ${err.message}`, 'warn');
      return null;
    }
  };

  // Boot: fetch SHA and load core.js
  const boot = async () => {
    try {
      const sha = await fetchSha();
      const version = sha || Date.now().toString(36);

      // Set global state for other modules
      window.__alp = { version, token: GH_TOKEN, isAuth };

      if (sha) {
        console.log(`📌 Alp version: ${sha}`);
      } else {
        console.log('📌 Alp version: fallback (no SHA)');
      }

      // Load core.js with version cache-busting
      const coreUrl = `${BASE}core.js?v=${version}`;
      await import(coreUrl);
    } catch (err) {
      showError(`Failed to load core.js: ${err.message}`);
    }
  };

  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', boot, { once: 1 })
    : boot();
})();
