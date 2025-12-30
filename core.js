// core.js - Alp Framework Core Module
// Loaded by alp.js with version cache-busting

const VERSION = window.__alp?.version || '';
const versionSuffix = VERSION ? `?v=${VERSION}` : '';

// Helper to build versioned import URLs
const BASE = (() => {
  // Try to determine base from import.meta.url
  try {
    const url = new URL(import.meta.url);
    url.search = ''; // Remove query params
    return url.href.replace(/[^/]+$/, '');
  } catch {
    return '';
  }
})();

const v = (path) => `${BASE}${path}${versionSuffix}`;

// === CSS LOADING ===
const el = (t, a) => Object.assign(document.createElement(t), a);
const css = href => document.head.appendChild(el('link', { rel: 'stylesheet', href }));
css('https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/tabulator-tables/dist/css/tabulator_simple.min.css');

// === CDN LOADING ===
const js = src => new Promise((ok, err) => document.head.appendChild(el('script', { src, onload: ok, onerror: err })));
await js('https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web,npm/dexie@4,npm/tabulator-tables');
console.log('📦 Alp deps loaded');

// === IMPORT LOCAL MODULES WITH VERSIONING ===
const { fills } = await import(v('utils/fills.js'));
const { kit } = await import(v('utils/kit.js'));
const { parsePath, buildPath, buildFullPath, path, DEFAULT_DB, DEFAULT_STORE } = await import(v('utils/path.js'));
const { dbManager } = await import(v('utils/db-manager.js'));
const { isIndexedDBAvailable, MemoryDb } = await import(v('utils/memory-db.js'));

// === CONSOLE CAPTURE ===
const consoleLogs = [];
const MAX = 100;
const orig = Object.fromEntries(['log', 'warn', 'error', 'info'].map(k => [k, console[k].bind(console)]));
const fmt = a => {
  try { return (a && typeof a === 'object') ? JSON.stringify(a, null, 2) : String(a); }
  catch { return String(a); }
};
['log', 'warn', 'error', 'info'].forEach(k => {
  console[k] = (...args) => {
    consoleLogs.push({ type: k, time: new Date().toLocaleTimeString(), args: args.map(fmt).join(' ') });
    consoleLogs.length > MAX && consoleLogs.shift();
    orig[k](...args);
  };
});

// === DATABASE SETUP ===
let db;
const indexedDBAvailable = await isIndexedDBAvailable();

if (indexedDBAvailable) {
  db = new Dexie(DEFAULT_DB);
  db.version(1).stores({ [DEFAULT_STORE]: 'name' });
  dbManager.registerDb(DEFAULT_DB, db, [DEFAULT_STORE]);
} else {
  dbManager.setPersistent(false);
  console.warn('⚠️ IndexedDB not available - using in-memory storage. Data will not persist across page refreshes.');
  db = new MemoryDb(DEFAULT_DB);
  db.version(1).stores({ [DEFAULT_STORE]: 'name' });
  await db.open();
  dbManager.registerDb(DEFAULT_DB, db, [DEFAULT_STORE]);
}

// === PATH REGISTRY ===
const pathRegistry = Object.create(null);

const canonicalPath = (p) => {
  const { db, store, record } = parsePath(p);
  return buildFullPath(db, store, record);
};

const reg = (p, x) => {
  const key = canonicalPath(p);
  (pathRegistry[key] ||= new Set).add(x);
  return x;
};

const unreg = (p, x) => {
  const key = canonicalPath(p);
  const s = pathRegistry[key];
  if (!s) return;
  s.delete(x);
  if (!s.size) delete pathRegistry[key];
};

const ping = (p, data, occasion = 'data') => {
  const key = canonicalPath(p);
  const s = pathRegistry[key];
  if (s) {
    s.forEach(x => x.onPing?.(occasion, data));
  }

  if (occasion === 'save-record' || occasion === 'delete-record') {
    const inspector = globalFind('alp-inspector');
    if (inspector?.onPing) {
      inspector.onPing(occasion, { path: p, data });
    }
  }
};

// === COMPONENT PROXY SYSTEM ===
const pendingProxies = new WeakMap();
const readyPromises = new WeakMap();

const createComponentProxy = (el) => {
  let queue = pendingProxies.get(el);
  if (!queue) {
    queue = [];
    pendingProxies.set(el, queue);
  }

  return new Proxy({}, {
    get(_, method) {
      if (method === 'then') {
        return (resolve, reject) => getReadyPromise(el).then(resolve, reject);
      }
      return (...args) => {
        if (el.data?._isReady) {
          const fn = el.data[method];
          return typeof fn === 'function' ? fn.apply(el.data, args) : fn;
        }
        queue.push({ method, args });
      };
    }
  });
};

const getReadyPromise = (el) => {
  if (!el) return Promise.resolve(null);

  if (el.tagName.startsWith('ALP-')) {
    if (el.data?._isReady) return Promise.resolve(el.data);

    let entry = readyPromises.get(el);
    if (!entry) {
      let resolve;
      const promise = new Promise(r => resolve = r);
      entry = { promise, resolve };
      readyPromises.set(el, entry);
    }
    return entry.promise;
  }
  return Promise.resolve(el);
};

// === DATA OPERATIONS ===
const load = async (filter = {}) => {
  const result = {};
  const dbsToCheck = filter.db ? [filter.db] : dbManager.listDbs();

  for (const dbName of dbsToCheck) {
    const storesToCheck = filter.store ? [filter.store] : dbManager.listStores(dbName);

    for (const storeName of storesToCheck) {
      if (!dbManager.hasStore(dbName, storeName)) continue;

      const table = dbManager.getStore(dbName, storeName);
      const records = await table.toArray();

      const groupKey = `${dbName}/${storeName}`;
      result[groupKey] = records.map(({ name, data }) => {
        const [namespace, ...rest] = name.split('.');
        return {
          key: name,
          fullPath: buildPath(dbName, storeName, name),
          namespace,
          sig: rest.join('.'),
          data
        };
      });
    }
  }

  return result;
};

const loadRecord = async (fullPath) => {
  const { db: dbName, store, record } = parsePath(fullPath);

  if (!dbManager.has(dbName, store)) {
    throw new Error(
      !dbManager.hasDb(dbName)
        ? `Database '${dbName}' not found. Use alp.createDb('${dbName}', ['${store}']) to create it.`
        : `Store '${store}' not found in database '${dbName}'. Use alp.createStore('${dbName}', '${store}') to create it.`
    );
  }

  const table = dbManager.getStore(dbName, store);
  const r = await table.get(record);
  return r?.data;
};

const saveRecord = async (fullPath, data) => {
  const { db: dbName, store, record } = parsePath(fullPath);

  if (!dbManager.has(dbName, store)) {
    throw new Error(
      !dbManager.hasDb(dbName)
        ? `Database '${dbName}' not found. Use alp.createDb('${dbName}', ['${store}']) to create it.`
        : `Store '${store}' not found in database '${dbName}'. Use alp.createStore('${dbName}', '${store}') to create it.`
    );
  }

  const table = dbManager.getStore(dbName, store);
  await table.put({ name: record, data });

  const displayFullPath = buildPath(dbName, store, record);
  console.log(`💾 ${displayFullPath}:`, data);
  ping(fullPath, data, 'save-record');
};

const deleteRecord = async (fullPath) => {
  const { db: dbName, store, record } = parsePath(fullPath);

  if (!dbManager.has(dbName, store)) {
    throw new Error(
      !dbManager.hasDb(dbName)
        ? `Database '${dbName}' not found. Use alp.createDb('${dbName}', ['${store}']) to create it.`
        : `Store '${store}' not found in database '${dbName}'. Use alp.createStore('${dbName}', '${store}') to create it.`
    );
  }

  const table = dbManager.getStore(dbName, store);
  await table.delete(record);

  const displayFullPath = buildPath(dbName, store, record);
  console.log(`🗑️ ${displayFullPath}`);
  ping(fullPath, null, 'delete-record');
};

const isValidPath = (fullPath) => {
  const { db: dbName, store } = parsePath(fullPath);
  return dbManager.has(dbName, store);
};

const safeStore = (s, map) => map[s] ? s : (Object.keys(map)[0] || DEFAULT_STORE);

// === ALP BASE CLASS ===
class Alp extends HTMLElement {
  connectedCallback() {
    const render = () => {
      this.innerHTML = this.tpl();
      Alpine.initTree(this);
    };
    window.Alpine ? render() : document.addEventListener('alpine:init', render, { once: 1 });
  }

  tpl() { return ''; }

  disconnectedCallback() {
    const d = this.data;
    d && unreg(d._path, d);
    this.data = null;
  }
}

// === COMPONENT DEFINITIONS ===
const defs = Object.create(null);

const mk = (tagEnd, initState = {}) => {
  const defaultPath = `alp.${tagEnd}`;
  return {
    ...initState,
    tagEnd,
    el: null,
    host: null,
    defaultPath,
    _path: defaultPath,

    get path() { return this._path; },
    set path(p) {
      p = (p ?? '').trim() || this.defaultPath;
      if (p === this._path) {
        this.onPing?.('path');
        return;
      }
      unreg(this._path, this);
      this._path = p;
      reg(this._path, this);
      this.onPing?.('path');
    },

    _isReady: false,

    find(s) {
      const el = this.el?.querySelector(s);
      if (!el) return null;
      if (el.tagName.startsWith('ALP-')) {
        if (el.data?._isReady) return el.data;
        return createComponentProxy(el);
      }
      return el;
    },

    declareReady() {
      if (this._isReady) return;
      this._isReady = true;

      if (this.host) {
        const queue = pendingProxies.get(this.host);
        if (queue) {
          pendingProxies.delete(this.host);
          queue.forEach(({ method, args }) => {
            const fn = this[method];
            if (typeof fn === 'function') fn.apply(this, args);
          });
        }

        const entry = readyPromises.get(this.host);
        if (entry) {
          readyPromises.delete(this.host);
          entry.resolve(this);
        }

        const attrs = {};
        for (const attr of this.host.attributes) {
          attrs[attr.name] = attr.value;
        }
        ping(this._path, attrs, 'ready');
      }
    },
    save(d) { return saveRecord(this._path, d); },
    load() { return loadRecord(this._path); },
    del() { return deleteRecord(this._path); },

    async mount(el) {
      this.el = el;
      this.host = el.closest(`alp-${tagEnd}`);
      this.host?.classList.add('block', 'h-full');
      const p = this.host?.getAttribute('path')?.trim();
      if (p) this._path = p;
      reg(this._path, this);
      if (this.host) this.host.data = this;

      await this.onPing?.('mount');

      if (!this._isReady) this.declareReady();
    }
  };
};

const define = (tagEnd, tplFn, initState = {}) => {
  defs[tagEnd] = { initState, tplFn };

  class C extends Alp {
    tpl() {
      return `<div x-data="alp.mk('${tagEnd}')" x-init="mount($el)" class="h-full overflow-hidden">${tplFn('path')}</div>`;
    }
  }

  customElements.define(`alp-${tagEnd}`, C);
};

const globalFind = (s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  if (el.tagName.startsWith('ALP-')) {
    if (el.data?._isReady) return el.data;
    return createComponentProxy(el);
  }
  return el;
};

// === CORE API ===
const core = {
  db,
  pathRegistry,
  consoleLogs,
  load,
  loadRecord,
  saveRecord,
  deleteRecord,
  safeStore,
  define,
  ping,
  isValidPath
};

// === PUBLIC API ===
export const alp = {
  ...core,
  fills,
  kit,
  find: globalFind,
  mk: (tagEnd) => mk(tagEnd, defs[tagEnd]?.initState || {}),

  path,
  parsePath,
  buildPath,

  createDb: dbManager.createDb,
  createStore: dbManager.createStore,
  listDbs: dbManager.listDbs,
  listStores: dbManager.listStores,
  hasDb: dbManager.hasDb,
  hasStore: dbManager.hasStore,
  deleteDb: dbManager.deleteDb,

  get persistent() { return dbManager.isPersistent(); }
};

// === BIND PROXIES ===
window.alp.bind(alp);
window.alp.kit.bind(alp.kit);
window.alp.fills.bind(alp.fills);

if (alp.persistent) {
  console.log('✅ Alp Core loaded');
} else {
  console.log('✅ Alp Core loaded (memory mode)');
}

// === SOURCE STORAGE ===
const coreSrc = ['alp.js', 'core.js', 'utils/fills.js', 'utils/kit.js'];
const storeSources = async (componentFiles) => {
  const ns = 'alp-src';
  const all = [...coreSrc, ...componentFiles.map(c => `components/${c}`)];
  await db[DEFAULT_STORE].where('name').startsWith(`${ns}.`).delete();
  await Promise.all(all.map(f =>
    fetch(v(f)).then(r => r.text()).then(src =>
      db[DEFAULT_STORE].put({ name: `${ns}.${f.replace(/\//g, '.')}`, data: src })
    )
  ));
  console.log(`📄 Stored ${all.length} source files`);
};

// === COMPONENT LOADING ===
const { components } = await import(v('components/index.js'));
console.log('✅ components/index.js imported', components);

for (const c of components) {
  try {
    console.log(`⏳ Loading ${c}...`);
    await import(v(`components/${c}`));
    console.log(`✅ ${c} loaded`);
  } catch (err) {
    console.error(`❌ ${c} failed:`, err);
  }
}

await storeSources(components);

console.log('📍 About to load Alpine');
await js('https://unpkg.com/alpinejs@3');
console.log('🎨 Alpine.js loaded');

// === ALPINE.JS LOADING ===
await js('https://unpkg.com/alpinejs@3');
console.log('🎨 Alpine.js loaded');

// End of core.js
try {
  await js('https://unpkg.com/alpinejs@3');
  console.log('🎨 Alpine.js loaded');
} catch (err) {
  console.error('❌ Alpine failed to load:', err);
}
