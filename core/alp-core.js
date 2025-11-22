// Core Alpine IndexedDB Component System
import { fills } from '../utils/fills.js';
import { installers } from '../utils/installers.js';

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
const load = async () =>
  (await db.alp.toArray())
    .reduce((m, { name, data }) => (
      ([s, ...p] = name.split('.')),
      (m[s] ||= []).push({ key: name, sig: p.join('.'), data }),
      m
    ), {});

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
