// Alp Framework - Standalone Alpine.js + IndexedDB Component System
// Single-file framework with all dependencies included
// Just source this file and start defining components!

(function() {
  'use strict';

  // ============================================================================
  // DEPENDENCY LOADER
  // ============================================================================

  const loadCSS = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return link;
  };

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Load all CSS dependencies immediately
  loadCSS('https://cdn.jsdelivr.net/npm/daisyui@5/themes.css');
  loadCSS('https://cdn.jsdelivr.net/npm/daisyui@5');
  loadCSS('https://cdn.jsdelivr.net/npm/tabulator-tables/dist/css/tabulator_simple.min.css');

  // Load all JS dependencies in order
  const initAlp = async () => {
    try {
      // Load dependencies in parallel where possible
      await Promise.all([
        loadScript('https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'),
        loadScript('https://cdn.jsdelivr.net/npm/@phosphor-icons/web'),
        loadScript('https://cdn.jsdelivr.net/npm/dexie@4'),
        loadScript('https://cdn.jsdelivr.net/npm/tabulator-tables')
      ]);

      console.log('📦 Alp dependencies loaded');

      // Now initialize the framework
      initializeFramework();

      // Load Alpine.js LAST (after framework is ready)
      await loadScript('https://unpkg.com/alpinejs@3');
      console.log('🎨 Alpine.js loaded');

    } catch (error) {
      console.error('❌ Failed to load Alp dependencies:', error);
    }
  };

  // ============================================================================
  // CORE FRAMEWORK
  // ============================================================================

  function initializeFramework() {
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

    const safeStore = (store, storeMap) =>
      storeMap[store] ? store : Object.keys(storeMap)[0] || 'alp';

    // Initialize Alpine stores when ready
    addEventListener("alpine:init", () => {
      Object.entries(state).forEach(([storeName, storeState]) => {
        Alpine.store(storeName, storeState);
      });
    }, { once: 1 });

    // ============================================================================
    // FILLS - Reusable UI Templates
    // ============================================================================

    const fills = {
      pathInput: () =>
        `<input x-model="path" @blur="nav()" @keydown.enter="$el.blur()" class="input input-xs input-ghost text-xs text-right w-48" placeholder="path">`,

      deleteButton: () =>
        `<button @click="del()" class="btn btn-xs btn-error btn-outline">
          <i class="ph ph-trash"></i>
        </button>`,

      saveIndicator: () =>
        `<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,

      toolbar: (...items) =>
        `<div class="flex gap-2 items-center justify-between mb-2">
          ${items.join('')}
        </div>`,

      btn: (label, click, icon = '', classes = 'btn-primary') =>
        `<button @click="${click}" class="btn btn-sm ${classes}">
          ${icon ? `<i class="ph ph-${icon}"></i>` : ''}
          <span>${label}</span>
        </button>`
    };

    // ============================================================================
    // INSTALLERS - Lazy Library Loaders
    // ============================================================================

    const installers = {
      jse: async (opts) => {
        const { createJSONEditor } = await import('https://unpkg.com/vanilla-jsoneditor/standalone.js');
        return createJSONEditor(opts);
      },

      tt: (opts) => {
        return new Promise(resolve => {
          const table = new Tabulator(opts.target, opts.props);
          table.on("tableBuilt", () => resolve(table));
        });
      }
    };

    // ============================================================================
    // MAIN ALP OBJECT
    // ============================================================================

    window.alp = {
      db,
      components,
      consoleLogs,

      // Data operations
      load,
      loadRecord,
      saveRecord,
      deleteRecord,
      safeStore,

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

    // ============================================================================
    // BUILT-IN INSPECTOR COMPONENT
    // ============================================================================

    window.alp.define("inspector",
      x => `
        <button @click="open()" class="text-primary">
          <i class="ph ph-gear-six text-4xl"></i>
        </button>
        <div x-show="show" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="show=0">
          <div class="bg-base-100 w-full max-w-[95%] h-[80vh] shadow-lg flex flex-col">
            <div name="jse" class="flex-1 overflow-hidden"></div>
            <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 justify-between items-center gap-2">
              <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
                <template x-for="s in stores">
                  <option :value="s.key" x-text="s.key"></option>
                </template>
              </select>
              <div class="flex-1 overflow-x-auto">
                <div class="flex gap-0.5 whitespace-nowrap">
                  <template x-for="it in pages">
                    <button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn'">
                      <i class="ph ph-database"></i>
                      <span x-text="it.sig"></span>
                    </button>
                  </template>
                </div>
              </div>
              <div class="flex gap-1">
                <button class="btn btn-xs btn-error btn-outline" @click="clear()">Clear</button>
              </div>
            </div>
          </div>
        </div>
      `,
      {
        show: 0,
        store: 'alp',
        stores: [],
        storeMap: {},
        page: '',
        pages: [],
        jse: null,

        // Inspector doesn't use standard nav pattern - it manages all paths
        async nav() {},

        async refresh() {
          this.storeMap = await alp.load();
          this.stores = Object.keys(this.storeMap).map(k => ({ key: k }));
          await this.goStore(alp.safeStore(this.store, this.storeMap));
        },

        async goStore(storeName) {
          this.store = storeName;
          this.pages = this.storeMap[this.store] || [];
          if (this.pages.length) {
            await this.goPage(this.pages[0].key);
          } else {
            this.jse?.set({ json: {} });
          }
        },

        async open() {
          this.show = 1;
          await Alpine.nextTick();
          this.jse ||= await alp.install('jse', {
            target: this.find('[name="jse"]'),
            props: {
              mode: "tree",
              content: { json: {} },
              onChange: (content) => this.handleChange(content)
            }
          });
          await this.refresh();
        },

        async handleChange(content) {
          await alp.saveRecord(this.page, content.json);
          const [storeName, sig] = this.page.split('.');
          if (storeName && sig && Alpine.store(storeName)?.[sig]) {
            Object.assign(Alpine.store(storeName)[sig], content.json);
          }
        },

        async goPage(k) {
          this.page = k;
          const data = await alp.loadRecord(k);
          console.log('goPage', k, data);
          await this.jse.set({ json: data || {} });
        },

        async clear() {
          console.log(this.page);
          await alp.deleteRecord(this.page);
          await this.refresh();
        }
      }
    );

    console.log('✅ Alp Framework initialized');
    console.log('📖 Use alp.define(name, template, state) to create components');
    console.log('🔍 Add <alp-inspector class="fixed bottom-4 right-4"></alp-inspector> for dev tools');
  }

  // ============================================================================
  // AUTO-INITIALIZE
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAlp);
  } else {
    initAlp();
  }

})();
