// alp.js - Non-module entry point with proxy queue
(() => {
  'use strict';
  const BASE = document.currentScript?.src.replace(/[^/]+$/, '') || '';
  const el = (t, a) => Object.assign(document.createElement(t), a);
  const css = href => document.head.appendChild(el('link', { rel: 'stylesheet', href }));
  const js = src => new Promise((ok, err) => document.head.appendChild(el('script', { src, onload: ok, onerror: err })));
  css('https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/tabulator-tables/dist/css/tabulator_simple.min.css');

  // Proxy queue factory
  const qProxy = (opts = {}) => new Proxy(() => {}, (() => {
    let t, ready = 0, q = [];
    const { nested, onReady, props } = opts;
    const go = () => {
      if (!(ready & 3) || !t) return;
      while (q.length) {
        const [path, a] = q.shift();
        let obj = t;
        for (const k of path) obj = obj[k];
        obj(...a);
      }
    };
    if (onReady) onReady(() => { ready |= 2; go(); });
    else ready |= 2;
    return {
      get: (_, k) => k === '__q' ? 1
        : k === 'bind' ? o => (t = o, ready |= 1, go(), o)
        : props?.[k] !== undefined ? props[k]
        : nested
          ? new Proxy(() => {}, {
              apply: (_, __, a) => { if ((ready & 3) && t) return t[k](...a); q.push([[k], a]); },
              get: (_, m) => (...a) => { if ((ready & 3) && t) return t[k][m](...a); q.push([[k, m], a]); }
            })
          : (ready & 3) && t && (k in t) && typeof t[k] !== 'function'
            ? t[k]
            : (...a) => { if ((ready & 3) && t) return t[k](...a); q.push([[k], a]); },
      apply: (_, __, a) => { if ((ready & 3) && t) return t(...a); q.push([[], a]); }
    };
  })());

  // Create proxies
  const alpineReady = go => document.addEventListener('alpine:init', go, { once: 1 });
  const kit = qProxy({ onReady: alpineReady, nested: true });
  const fills = qProxy({ onReady: alpineReady });
  window.alp = qProxy({ onReady: alpineReady, props: { kit, fills } });

  // Source storage
  const coreSrc = ['alp.js', 'core.js', 'utils/fills.js', 'utils/kit.js'];
  const storeSources = async (db, componentFiles) => {
    const ns = 'alp-src';
    const all = [...coreSrc, ...componentFiles.map(c => `components/${c}`)];
    await db.alp.where('name').startsWith(`${ns}.`).delete();
    await Promise.all(all.map(f =>
      fetch(BASE + f).then(r => r.text()).then(src =>
        db.alp.put({ name: `${ns}.${f.replace(/\//g, '.')}`, data: src })
      )
    ));
    console.log(`📄 Stored ${all.length} source files`);
  };

  // Boot sequence
  const boot = () =>
    js('https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web,npm/dexie@4,npm/tabulator-tables')
      .then(() => {
        console.log('📦 Alp deps loaded');
        console.log('⏳ Importing core.js...');
        return import(`${BASE}core.js`);
      })
      .then(({ alp }) => {
        console.log('✅ core.js imported', alp ? '(alp present)' : '(alp missing!)');
        window.alp.bind(alp);
        window.alp.kit.bind(alp.kit);
        window.alp.fills.bind(alp.fills); 
        return import(`${BASE}components/index.js`).then(({ components }) => {
          console.log('✅ components/index.js imported', components);
          return { alp, components };
        });
      })
      .then(({ alp, components }) => {
        return Promise.all([
          storeSources(alp.db, components),
          ...components.map(c => {
            return import(`${BASE}components/${c}`).then(() => console.log(`✅ ${c} loaded`));
          })
        ]);
      })
      .then(() => {
        return js('https://unpkg.com/alpinejs@3');
      })
      .then(() => console.log('🎨 Alpine.js loaded'))
      .catch(err => console.error('❌ Boot failed:', err));

  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', boot, { once: 1 })
    : boot();
})();
