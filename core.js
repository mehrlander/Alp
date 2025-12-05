// core.js - Alp Framework Core Module

import { fills } from './utils/fills.js';
import { installers } from './utils/installers.js';

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
const notify = (p, data, del = 0) => {
  const s = pathRegistry[p];
  if (!s) return;
  s.forEach(x => del
    ? (x.deletedCallback ? x.deletedCallback() : x.nav?.())
    : (x.savedCallback ? x.savedCallback(data) : x.nav?.())
  );
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
  notify(name, data, 0);
});

const deleteRecord = name => db.alp.delete(name).then(() => {
  console.log(`🗑️ ${name}`);
  notify(name, null, 1);
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
    path: defaultPath,
    _path: defaultPath,

    find(s) { return this.el?.querySelector(s); },
    save(d) { return saveRecord(this._path, d); },
    load() { return loadRecord(this._path); },
    del() { return deleteRecord(this._path); },

    usePath(p) {
      p = (p ?? '').trim() || this.defaultPath;
      this.path = p;
      if (p === this._path) return this.nav?.();
      unreg(this._path, this);
      this._path = p;
      reg(this._path, this);
      return this.nav?.();
    },

    mount(el) {
      this.el = el;
      this.host = el.closest(`alp-${tagEnd}`);
      const p = this.host?.getAttribute('path');
      if (p) { this.path = p; this._path = p; }
      reg(this._path, this);
      this.host && (this.host.data = this);
      return this.nav?.();
    }
  };
};

// Define a new alp component
const define = (tagEnd, tplFn, initState = {}) => {
  defs[tagEnd] = { initState, tplFn };

  class C extends Alp {
    tpl() {
      return `<div x-data="alp.mk('${tagEnd}')" x-init="mount($el)">${tplFn('path')}</div>`;
    }
  }

  customElements.define(`alp-${tagEnd}`, C);
};

// Core API
const core = { db, pathRegistry, consoleLogs, load, loadRecord, saveRecord, deleteRecord, safeStore, define };

// Public API
export const alp = {
  ...core,
  fill: (k, ...a) => {
    const parts = k.split(':');
    const key = parts[0];
    const mods = parts.slice(1);
    
    const f = fills[key];
    if (f) return f(...a, { mods });
    
    const [attrs = {}, inner = ''] = a;
    const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${key}${attrStr ? ' ' + attrStr : ''}>${inner}</${key}>`;
  },
  install: (k, o) => {
    const f = installers[k];
    if (!f) throw Error(`Unknown installer: ${k}`);
    return f(o);
  },
  mk: (tagEnd) => mk(tagEnd, defs[tagEnd]?.initState || {})
};

console.log('✅ Alp Core loaded');
