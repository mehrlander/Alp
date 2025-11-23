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

// Branch source config (loaded from IDB)
let branchSource = null;

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

  // Branch source management
  getBranchSource() {
    return branchSource;
  },

  async loadBranchSource() {
    const data = await loadRecord('alp.branchSource');
    branchSource = data || null;
    return branchSource;
  },

  async setBranchSource(repo, branch, token = '') {
    branchSource = { repo, branch, token };
    await saveRecord('alp.branchSource', branchSource);
    console.log(`🌿 Branch source set: ${repo}@${branch}`);
    return branchSource;
  },

  async clearBranchSource() {
    branchSource = null;
    await deleteRecord('alp.branchSource');
    console.log('🌿 Branch source cleared, using local');
  },

  // Fetch file from GitHub
  async fetchFromGitHub(path) {
    if (!branchSource) throw new Error('No branch source configured');

    const { repo, branch, token } = branchSource;
    const headers = { 'Accept': 'application/vnd.github.v3.raw' };
    if (token) headers['Authorization'] = 'token ' + token;

    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`GitHub fetch failed: ${res.status}`);
    }

    return res.text();
  },

  // Load and execute a component from the configured branch
  async loadComponentFromBranch(componentName) {
    const filePath = `components/alp-${componentName}.js`;
    console.log(`📥 Loading ${filePath} from ${branchSource.repo}@${branchSource.branch}`);

    const source = await this.fetchFromGitHub(filePath);

    // Create a proxy alp that forwards to real alp
    const proxyAlp = {
      define: (tagEnd, tpl, initialState = {}) => {
        this.define(tagEnd, tpl, initialState);
      },
      fill: (...args) => this.fill(...args),
      install: (...args) => this.install(...args),
      load: this.load,
      loadRecord: this.loadRecord,
      saveRecord: this.saveRecord,
      deleteRecord: this.deleteRecord,
      db: this.db
    };

    // Remove import/export statements and wrap in function
    let cleanSource = source
      .replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/import\s+['"][^'"]+['"];?/g, '')
      .replace(/export\s+function\s+/g, 'function ')
      .replace(/export\s+\{[^}]*\};?/g, '');

    // Find the define function name
    const defineFnMatch = cleanSource.match(/function\s+(define\w+Component)\s*\(\)/);
    if (!defineFnMatch) {
      throw new Error(`No define function found in ${filePath}`);
    }

    const defineFnName = defineFnMatch[1];

    // Execute the source with proxy alp
    const wrappedCode = `
      (function(alp) {
        ${cleanSource}
        if (typeof ${defineFnName} === 'function') {
          ${defineFnName}();
        }
      })
    `;

    const fn = eval(wrappedCode);
    fn(proxyAlp);

    console.log(`✅ Loaded ${componentName} from branch`);
  },

  // Load multiple components - from branch if configured, otherwise import locally
  async loadComponents(componentNames, localImports) {
    // Check for branch source
    await this.loadBranchSource();

    const total = componentNames.length;
    let loaded = 0;
    let failed = 0;
    let fallback = 0;

    if (branchSource) {
      console.log(`🌿 Branch source configured in IndexedDB`);
      console.log(`   Repo: ${branchSource.repo}`);
      console.log(`   Branch: ${branchSource.branch}`);
      console.log(`   Token: ${branchSource.token ? 'provided' : 'none'}`);
      console.log(`📦 Loading ${total} components from branch...`);

      for (const name of componentNames) {
        try {
          await this.loadComponentFromBranch(name);
          loaded++;
        } catch (e) {
          failed++;
          console.error(`   ✗ ${name}: ${e.message}`);
          // Fall back to local
          if (localImports[name]) {
            localImports[name]();
            fallback++;
            console.log(`   ↩ ${name}: fell back to local`);
          }
        }
      }

      console.log(`✅ Component loading complete:`);
      console.log(`   From branch: ${loaded}/${total}`);
      if (fallback > 0) console.log(`   Fallback to local: ${fallback}`);
      if (failed > 0) console.log(`   Failed: ${failed - fallback}`);
    } else {
      console.log(`📦 No branch source configured in IndexedDB`);
      console.log(`   Loading ${total} components locally...`);

      for (const name of componentNames) {
        if (localImports[name]) {
          localImports[name]();
          loaded++;
        }
      }

      console.log(`✅ Loaded ${loaded}/${total} components locally`);
    }
  }
};
