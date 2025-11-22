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

// Branch swapping state
let activeBranchSuffix = null;
const branchComponents = {}; // Track components defined per branch suffix

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
  },

  // Define component with branch suffix (for branch swapping)
  defineWithSuffix(tagEnd, tpl, initialState = {}, suffix) {
    if (!state.alp) state.alp = {};

    const suffixedTagEnd = `${tagEnd}-${suffix}`;
    const path = `alp.${suffixedTagEnd}`;

    // Check if already defined
    if (customElements.get('alp-' + suffixedTagEnd)) {
      console.log(`⏭️ Component alp-${suffixedTagEnd} already defined`);
      return;
    }

    const def = class extends Alp {
      tpl() {
        return `<div x-data="$store.${path}" x-init="el = $el; nav()">${tpl(path)}</div>`;
      }
    };

    Object.assign(def.prototype, { tagEnd: suffixedTagEnd, path, originalTagEnd: tagEnd });

    state.alp[suffixedTagEnd] = {
      ...initialState,
      el: null,
      defaultPath: path,
      path: path,
      find(s) { return this.el?.querySelector(s); },
      async save(data) { await saveRecord(this.path, data); },
      async load() { return await loadRecord(this.path); },
      async del() { await deleteRecord(this.path); }
    };

    customElements.define('alp-' + suffixedTagEnd, def);

    // Track which components are defined for this suffix
    if (!branchComponents[suffix]) branchComponents[suffix] = [];
    branchComponents[suffix].push(tagEnd);

    // Register with Alpine if already initialized
    if (window.Alpine?.store) {
      Alpine.store('alp')[suffixedTagEnd] = state.alp[suffixedTagEnd];
      components[path] = Alpine.store('alp')[suffixedTagEnd];
    }

    console.log(`🌿 Defined alp-${suffixedTagEnd} for branch`);
  },

  // Get/set active branch suffix
  getActiveBranch() { return activeBranchSuffix; },

  async setActiveBranch(suffix) {
    activeBranchSuffix = suffix;
    await saveRecord('alp.activeBranch', { suffix });
    console.log(`🌿 Active branch set to: ${suffix || 'default'}`);
  },

  async loadActiveBranch() {
    const data = await loadRecord('alp.activeBranch');
    activeBranchSuffix = data?.suffix || null;
    return activeBranchSuffix;
  },

  // Swap all alp-* elements to use branch-suffixed versions
  swapToSuffix(suffix) {
    const elements = document.querySelectorAll('[class*="alp-"]');
    const alpElements = Array.from(document.querySelectorAll('*'))
      .filter(el => el.tagName.toLowerCase().startsWith('alp-') &&
                    !el.tagName.toLowerCase().includes('-' + suffix));

    console.log(`🔄 Swapping ${alpElements.length} elements to suffix: ${suffix}`);

    alpElements.forEach(el => {
      const tagName = el.tagName.toLowerCase();
      // Extract base component name (e.g., 'alp-text' -> 'text')
      const baseName = tagName.replace('alp-', '').split('-')[0];
      const newTagName = `alp-${baseName}-${suffix}`;

      // Check if the suffixed component is defined
      if (!customElements.get(newTagName)) {
        console.warn(`⚠️ Component ${newTagName} not defined, skipping`);
        return;
      }

      // Create new element with same attributes
      const newEl = document.createElement(newTagName);
      Array.from(el.attributes).forEach(attr => {
        newEl.setAttribute(attr.name, attr.value);
      });

      // Replace in DOM
      el.parentNode.replaceChild(newEl, el);

      // Initialize Alpine on the new element
      if (window.Alpine) {
        Alpine.initTree(newEl);
      }

      console.log(`✅ Swapped ${tagName} -> ${newTagName}`);
    });
  },

  // Swap back to default (unsuffixed) components
  swapToDefault() {
    const alpElements = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const tag = el.tagName.toLowerCase();
        return tag.startsWith('alp-') && tag.split('-').length > 2;
      });

    console.log(`🔄 Swapping ${alpElements.length} elements back to default`);

    alpElements.forEach(el => {
      const tagName = el.tagName.toLowerCase();
      // Extract base component name (e.g., 'alp-text-abc123' -> 'alp-text')
      const parts = tagName.split('-');
      const newTagName = `${parts[0]}-${parts[1]}`;

      // Create new element with same attributes
      const newEl = document.createElement(newTagName);
      Array.from(el.attributes).forEach(attr => {
        newEl.setAttribute(attr.name, attr.value);
      });

      // Replace in DOM
      el.parentNode.replaceChild(newEl, el);

      // Initialize Alpine on the new element
      if (window.Alpine) {
        Alpine.initTree(newEl);
      }

      console.log(`✅ Swapped ${tagName} -> ${newTagName}`);
    });

    activeBranchSuffix = null;
  },

  // Get list of component names defined for a branch suffix
  getBranchComponents(suffix) {
    return branchComponents[suffix] || [];
  }
};
