// alp.js - Minimal entry point with GitHub SHA-based versioning
// Pass token via query param: <script src="alp.js?token=YOUR_TOKEN"></script>
(() => {
  'use strict';
  
  const params = new URL(document.currentScript.src).searchParams;
  const GH_TOKEN = params.get('token') || '';
  const isAuth = GH_TOKEN && !GH_TOKEN.includes('🎟');
  const getHeaders = () => isAuth ? { 'Authorization': `Bearer ${GH_TOKEN.trim()}` } : {};
  const BASE = document.currentScript?.src.replace(/[^/]+$/, '') || '';
  
  console.log(`🏔️ Alp | ${isAuth ? '🔐 authenticated' : '🔓 anonymous'}${GH_TOKEN ? ` | token: ${GH_TOKEN.slice(0, 8)}…` : ''}`);
  
  const fetchSha = async () => {
    try {
      const res = await fetch('https://api.github.com/repos/mehrlander/Alp/commits/main', { headers: getHeaders() });
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (!res.ok) throw new Error(res.status);
      const sha = (await res.json()).sha?.slice(0, 7);
      console.log(`📌 ${sha} | rate: ${remaining}`);
      return sha;
    } catch (err) {
      console.warn('⚠️ SHA fetch failed:', err.message);
      return null;
    }
  };
  
  const boot = async () => {
    const sha = await fetchSha();
    const version = sha || Date.now().toString(36);
    window.__alp = { version, token: GH_TOKEN, isAuth, base: BASE };
    await import(`${BASE}core.js?v=${version}`);
  };
  
  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
