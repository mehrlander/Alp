// alp.js - Minimal entry point with GitHub SHA-based versioning
// Pass token via query param: <script src="alp.js?token=YOUR_TOKEN"></script>
(() => {
  'use strict';

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
      console.warn('⚠️ Failed to fetch SHA:', err.message);
      return null;
    }
  };

  // Boot: fetch SHA and load core.js
  const boot = async () => {
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
  };

  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', boot, { once: 1 })
    : boot();
})();
