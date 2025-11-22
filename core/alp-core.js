// Core Alpine IndexedDB Component System
import { fills } from '../utils/fills.js';
import { installers } from '../utils/installers.js';

// Console capture - as early as possible
const consoleLogs = [];
const maxLogs = 100;
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console)
};

const captureConsole = (type, ...args) => {
  const entry = {
    type,
    time: new Date().toLocaleTimeString(),
    args: args.map(a => {
      try {
        return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);
      } catch { return String(a); }
    }).join(' ')
  };
  consoleLogs.push(entry);
  if (consoleLogs.length > maxLogs) consoleLogs.shift();
  originalConsole[type](...args);
};

console.log = (...args) => captureConsole('log', ...args);
console.warn = (...args) => captureConsole('warn', ...args);
console.error = (...args) => captureConsole('error', ...args);
console.info = (...args) => captureConsole('info', ...args);

// Database setup
const db = new Dexie('AlpDB');
db.version(1).stores({ alp: 'name' });

// State and component registries
const state = {};
const components = {};

// Base HTMLElement class for all alp components
class Alp extends HTMLElement {
  connectedCallback() {
    addEventListener("alpine:init", () => {
      const html = this.tpl();
      this.innerHTML = html;
      Alpine.initTree(this);
    }, { once: 1 });
  }

  tpl() { return ""; }
}

// Data operations
const load = async () => {
  const records = await db.alp.toArray();
  return records.reduce((m, { name, data }) => {
    const [store, ...rest] = name.split('.');
    (m[store] ||= []).push({ key: name, sig: rest.join('.'), data });
    return m;
  }, {});
};

const loadRecord = async name => (await db.alp.get(name))?.data;

const saveRecord = async (name, data) => {
  await db.alp.put({ name, data });
  console.log(`💾 ${name}:`, data);
  components[name]?.savedCallback?.(data);
};

const deleteRecord = async name => {
  await db.alp.delete(name);
  console.log(`🗑️ ${name}`);
  components[name]?.savedCallback?.();
};

// Initialize Alpine stores when ready
addEventListener("alpine:init", () => {
  Object.entries(state).forEach(([storeName, storeState]) => {
    Alpine.store(storeName, storeState);
  });
}, { once: 1 });

// Main alp object
export const alp = {
  db,
  components,
  consoleLogs,

  // Data operations
  load,
  loadRecord,
  saveRecord,
  deleteRecord,
  safeStore: (store, storeMap) => storeMap[store] ? store : Object.keys(storeMap)[0] || 'alp',

  // Utils access
  fill(name, ...args) {
    const fn = fills[name];
    if (!fn) throw new Error(`Unknown fill: ${name}`);
    return fn(...args);
  },

  install(name, opts) {
    const fn = installers[name];
    if (!fn) throw new Error(`Unknown installer: ${name}`);
    return fn(opts);
  },

  // Component definition
  define(tagEnd, tpl, initialState = {}) {
    if (!state.alp) state.alp = {};

    const path = `alp.${tagEnd}`;
    const def = class extends Alp {
      tpl() {
        return `<div x-data="$store.${path}" x-init="el = $el; nav()">${tpl(path)}</div>`;
      }
    };

    Object.assign(def.prototype, { tagEnd, path });

    state.alp[tagEnd] = {
      ...initialState,
      el: null,
      defaultPath: path,
      path: path,
      find(s) { return this.el?.querySelector(s); },
      async save(data) { await saveRecord(this.path, data); },
      async load() { return await loadRecord(this.path); },
      async del() { await deleteRecord(this.path); }
    };

    customElements.define('alp-' + tagEnd, def);

    addEventListener("alpine:init", () => {
      components[path] = Alpine.store('alp')[tagEnd];
    }, { once: 1 });
  }
};
