// alp.js - Non-module entry point with proxy queue
(() => {
  'use strict';

  const BASE = document.currentScript?.src.replace(/[^/]+$/, '') || '';

  const el = (t, a) => Object.assign(document.createElement(t), a);
  const css = href => document.head.appendChild(el('link', { rel: 'stylesheet', href }));
  const js = src => new Promise((ok, err) => document.head.appendChild(el('script', { src, onload: ok, onerror: err })));

  // Load CSS immediately
  css('https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/tabulator-tables/dist/css/tabulator_simple.min.css');

  // Proxy queue - allows alp.define() calls before core is loaded
  window.alp = new Proxy(() => {}, (() => {
    let t, ready = 0, q = [];
    const go = () => {
      if (!(ready & 3) || !t) return;
      for (; q.length;) {
        const [k, a] = q.shift();
        (k ? t[k] : t)(...a);
      }
    };
    document.addEventListener('alpine:init', () => { ready |= 2; go(); }, { once: 1 });
    return {
      get: (_, k) => k === '__q' ? 1
        : k === 'bind' ? o => (t = o, ready |= 1, go(), o)
        : (ready & 3) && t && (k in t) && typeof t[k] !== 'function' ? t[k]
        : (...a) => (ready & 3) && t ? t[k](...a) : q.push([k, a]),
      apply: (_, __, a) => (ready & 3) && t ? t(...a) : q.push([null, a])
    };
  })());

  // Boot sequence
  const boot = () =>
    js('https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web,npm/dexie@4,npm/tabulator-tables')
      .then(() => {
        console.log('📦 Alp deps loaded');
        return import(`${BASE}core.js`);
      })
      .then(({ alp }) => {
        window.alp.bind(alp);
        return import(`${BASE}components/inspector.js`);
      })
      .then(() => js('https://unpkg.com/alpinejs@3'))
      .then(() => console.log('🎨 Alpine.js loaded'));

  // Start when DOM ready
  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', boot, { once: 1 })
    : boot();
})();
