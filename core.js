// core.js - Alp Framework Core Module

import { fills } from './utils/fills.js';
import { kit } from './utils/kit.js';
import { parsePath, buildPath, buildFullPath, path, DEFAULT_DB, DEFAULT_STORE } from './utils/path.js';
import { dbManager } from './utils/db-manager.js';

// Console capture
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

// Dexie setup - create default database and register with manager
const db = new Dexie(DEFAULT_DB);
db.version(1).stores({ [DEFAULT_STORE]: 'name' });
dbManager.registerDb(DEFAULT_DB, db, [DEFAULT_STORE]);

// Path registry for reactive updates
// Uses canonical full paths (db/store:record) as keys for consistent lookup
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

  // Notify inspector on record changes
  if (occasion === 'save-record' || occasion === 'delete-record') {
    const inspector = globalFind('alp-inspector');
    if (inspector?.onPing) {
      inspector.onPing(occasion, { path: p, data });
    }
  }
};

// Pending proxy queues for not-yet-ready alp components
const pendingProxies = new WeakMap();

// Promises waiting for components to be ready
const readyPromises = new WeakMap();

// Create a thenable proxy that queues method calls until component is ready
const createComponentProxy = (el) => {
  // Reuse existing queue if present
  let queue = pendingProxies.get(el);
  if (!queue) {
    queue = [];
    pendingProxies.set(el, queue);
  }

  return new Proxy({}, {
    get(_, method) {
      // Make proxy thenable for await support
      if (method === 'then') {
        return (resolve, reject) => getReadyPromise(el).then(resolve, reject);
      }
      // Return a function that queues the call
      return (...args) => {
        // Check if component is now ready
        if (el.data?._isReady) {
          // Execute directly
          const fn = el.data[method];
          return typeof fn === 'function' ? fn.apply(el.data, args) : fn;
        }
        // Queue for later execution
        queue.push({ method, args });
      };
    }
  });
};

// Get or create a promise that resolves when component is ready
const getReadyPromise = (el) => {
  if (!el) return Promise.resolve(null);

  if (el.tagName.startsWith('ALP-')) {
    // Already ready - resolve immediately
    if (el.data?._isReady) return Promise.resolve(el.data);

    // Create or return existing promise
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

// Data operations with multi-db/store support

/**
 * Load all records, optionally filtered by db/store
 * @param {{ db?: string, store?: string }} [filter] - Optional filter
 * @returns {Promise<Object>} Records grouped by 'db/store' key
 */
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

/**
 * Load a single record by full path
 * @param {string} fullPath - Full path (e.g., 'Work/data:bills.jan' or 'bills.jan')
 * @returns {Promise<any>} The record data or undefined
 */
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

/**
 * Save a record by full path
 * @param {string} fullPath - Full path
 * @param {any} data - Data to save
 * @returns {Promise<void>}
 */
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

/**
 * Delete a record by full path
 * @param {string} fullPath - Full path
 * @returns {Promise<void>}
 */
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

/**
 * Check if a path's db/store exist
 * @param {string} fullPath - Full path to validate
 * @returns {boolean}
 */
const isValidPath = (fullPath) => {
  const { db: dbName, store } = parsePath(fullPath);
  return dbManager.has(dbName, store);
};

const safeStore = (s, map) => map[s] ? s : (Object.keys(map)[0] || DEFAULT_STORE);

// Alp base class
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

// Component definitions registry
const defs = Object.create(null);

// Create component data object
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
      this.onPing?.('path');  // fire-and-forget, internal
    },

    _isReady: false,

    find(s) {
      const el = this.el?.querySelector(s);
      if (!el) return null;
      // Check if it's an alp component
      if (el.tagName.startsWith('ALP-')) {
        // If ready, return the component data
        if (el.data?._isReady) return el.data;
        // Not ready yet, return a thenable queuing proxy
        return createComponentProxy(el);
      }
      return el;
    },

    declareReady() {
      if (this._isReady) return;
      this._isReady = true;

      if (this.host) {
        // Flush pending proxy queue
        const queue = pendingProxies.get(this.host);
        if (queue) {
          pendingProxies.delete(this.host);
          queue.forEach(({ method, args }) => {
            const fn = this[method];
            if (typeof fn === 'function') fn.apply(this, args);
          });
        }

        // Resolve any waiting promises
        const entry = readyPromises.get(this.host);
        if (entry) {
          readyPromises.delete(this.host);
          entry.resolve(this);
        }

        // Auto-ping with host attributes on ready
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

      await this.onPing?.('mount');  // awaited - init must complete

      if (!this._isReady) this.declareReady();
    }
  };
};

// Define a new alp component
const define = (tagEnd, tplFn, initState = {}) => {
  defs[tagEnd] = { initState, tplFn };

  class C extends Alp {
    tpl() {
      return `<div x-data="alp.mk('${tagEnd}')" x-init="mount($el)" class="h-full overflow-hidden">${tplFn('path')}</div>`;
    }
  }

  customElements.define(`alp-${tagEnd}`, C);
};

// Global find function (searches document instead of component)
const globalFind = (s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  // Check if it's an alp component
  if (el.tagName.startsWith('ALP-')) {
    // If ready, return the component data
    if (el.data?._isReady) return el.data;
    // Not ready yet, return a thenable queuing proxy
    return createComponentProxy(el);
  }
  return el;
};

// Core API
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

// Public API
export const alp = {
  ...core,
  fills,
  kit,
  find: globalFind,
  mk: (tagEnd) => mk(tagEnd, defs[tagEnd]?.initState || {}),

  // Path utilities
  path,
  parsePath,
  buildPath,

  // Database management
  createDb: dbManager.createDb,
  createStore: dbManager.createStore,
  listDbs: dbManager.listDbs,
  listStores: dbManager.listStores,
  hasDb: dbManager.hasDb,
  hasStore: dbManager.hasStore,
  deleteDb: dbManager.deleteDb
};

console.log('✅ Alp Core loaded');
