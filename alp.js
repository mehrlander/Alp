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
  
  // Auth status logging
  console.log('🏔️ Alp initializing:', {
    href: location.href,
    base: BASE,
    authMode: isAuth ? 'authenticated' : 'anonymous',
    tokenPresent: !!GH_TOKEN,
    tokenLength: GH_TOKEN.length,
    hasPlaceholder: GH_TOKEN.includes('🎟️')
  });
  
  // Fetch latest commit SHA from GitHub
  const fetchSha = async () => {
    const endpoint = 'https://api.github.com/repos/mehrlander/Alp/commits/main';
    console.log('🔍 Fetching SHA from:', endpoint);
    
    try {
      const res = await fetch(endpoint, { headers: getHeaders() });
      
      // Log rate limit info
      const rateRemaining = res.headers.get('x-ratelimit-remaining');
      const rateLimit = res.headers.get('x-ratelimit-limit');
      console.log(`📊 GitHub rate limit: ${rateRemaining}/${rateLimit}`);
      
      if (!res.ok) {
        console.error('❌ GitHub API error:', { status: res.status, statusText: res.statusText });
        throw new Error(`GitHub API: ${res.status}`);
      }
      
      const data = await res.json();
      const sha = data.sha?.slice(0, 7) || null;
      console.log('✅ SHA fetched:', sha, '| Full:', data.sha);
      return sha;
    } catch (err) {
      console.warn('⚠️ Failed to fetch SHA:', err.message);
      return null;
    }
  };
  
  // Boot: fetch SHA and load core.js
  const boot = async () => {
    console.log('🚀 Boot started at:', new Date().toISOString());
    
    const sha = await fetchSha();
    const version = sha || Date.now().toString(36);
    
    // Set global state for other modules
    window.__alp = { version, token: GH_TOKEN, isAuth, base: BASE };
    console.log('🌐 window.__alp set:', { version, isAuth, base: BASE });
    
    if (sha) {
      console.log(`📌 Alp version: ${sha}`);
    } else {
      console.log('📌 Alp version: fallback (no SHA) -', version);
    }
    
    // Load core.js with version cache-busting
    const coreUrl = `${BASE}core.js?v=${version}`;
    console.log('📦 Loading core.js:', coreUrl);
    
    try {
      await import(coreUrl);
      console.log('✅ core.js loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load core.js:', err.message, { coreUrl });
    }
  };
  
  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
