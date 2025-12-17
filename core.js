// core.js - Alp Framework Core Module

import { fills } from './utils/fills.js';
import { kit } from './utils/kit.js';

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

// Dexie setup
const db = new Dexie('AlpDB');
db.version(1).stores({ alp: 'name' });

// Path registry for reactive updates
const pathRegistry = Object.create(null);
const reg = (p, x) => ((pathRegistry[p] ||= new Set).add(x), x);
const unreg = (p, x) => {
  const s = pathRegistry[p];
  if (!s) return;
  s.delete(x);
  if (!s.size) delete pathRegistry[p];
};
const ping = (p, data, occasion = 'data') => {
  const s = pathRegistry[p];
  if (!s) return;
  s.forEach(x => {
    x.sync?.();
    if (occasion === 'save-record') x.savedCallback?.(data);
    else if (occasion === 'delete-record') x.deletedCallback?.();
    x.onPing?.(occasion, data);
  });

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

// Data operations
const load = () => db.alp.toArray().then(rs => rs.reduce((m, { name, data }) => {
  const [store, ...rest] = name.split('.');
  (m[store] ||= []).push({ key: name, sig: rest.join('.'), data });
  return m;
}, {}));

const loadRecord = name => db.alp.get(name).then(r => r?.data);

const saveRecord = (name, data) => db.alp.put({ name, data }).then(() => {
  console.log(`💾 ${name}:`, data);
  ping(name, data, 'save-record');
});

const deleteRecord = name => db.alp.delete(name).then(() => {
  console.log(`🗑️ ${name}`);
  ping(name, null, 'delete-record');
});

const safeStore = (s, map) => map[s] ? s : (Object.keys(map)[0] || 'alp');

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
        this.sync?.();
        return;
      }
      unreg(this._path, this);
      this._path = p;
      reg(this._path, this);
      this.sync?.();
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
      await this.sync?.();
      // Auto-ready if component didn't call declareReady() explicitly
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
const core = { db, pathRegistry, consoleLogs, load, loadRecord, saveRecord, deleteRecord, safeStore, define, ping };

// Public API
export const alp = {
  ...core,
  fills,
  kit,
  find: globalFind,
  mk: (tagEnd) => mk(tagEnd, defs[tagEnd]?.initState || {})
};

console.log('✅ Alp Core loaded');
