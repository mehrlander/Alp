// components/inspector.js - Alp Inspector Component

import { alp } from '../core.js';

alp.define('inspector', _ => `
  <button @click="open()" class="text-primary">
    <i class="ph ph-gear-six text-4xl"></i>
  </button>

  <dialog class="modal" @close="drawer=0">
    <div class="modal-box w-full max-w-[95%] h-[80vh] p-0 shadow-lg flex flex-col relative overflow-hidden rounded-lg">
      <div x-show="drawer" class="absolute inset-0 bg-black/30 z-20" @click="drawer=0"></div>

      <div class="flex-1 overflow-hidden relative z-10">
        <div name="jse" class="absolute inset-0"></div>
      </div>

      <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 items-center gap-2 relative z-10">
        <div class="flex items-center gap-2 flex-1 min-w-0" x-show="mode==='alp'">
          <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
            <template x-for="s in stores"><option :value="s.key" x-text="s.key"></option></template>
          </select>

          <div class="flex-1 overflow-x-auto min-w-0">
            <div class="flex gap-0.5 whitespace-nowrap">
              <template x-for="it in pages" :key="it.key">
                <button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn'">
                  <span x-text="it.sig"></span>
                </button>
              </template>
            </div>
          </div>

          <button class="btn btn-xs btn-error btn-outline" @click="clear()">Clear</button>
        </div>

        <div class="flex-1" x-show="mode!=='alp'"></div>

        <button class="btn btn-xs btn-ghost btn-circle" @click="drawer=!drawer">
          <i class="ph ph-list"></i>
        </button>
      </div>

      <aside :class="drawer ? 'translate-x-0' : 'translate-x-full'"
             class="absolute inset-y-0 right-0 w-72 bg-base-100 border-l border-base-300 z-30 flex flex-col transition-transform duration-200">
        <div class="p-3 border-b border-base-300 flex items-center gap-2">
          <span class="font-semibold text-primary/80 flex-1">View</span>
          <button class="btn btn-sm btn-ghost btn-circle" @click="drawer=0"><i class="ph ph-x"></i></button>
        </div>

        <ul class="menu p-2 flex-1 overflow-y-auto">
          <li><a @click="setMode('alp')" :class="mode==='alp'&&'active'">Alp</a></li>
          <li><a @click="setMode('logs')" :class="mode==='logs'&&'active'">Console Logs</a></li>
        </ul>
      </aside>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>
`, {
  drawer: 0,
  mode: 'alp',
  store: 'alp',
  stores: [],
  storeMap: {},
  page: '',
  pages: [],
  jse: null,

  async refresh() {
    this.storeMap = await alp.load();
    this.stores = Object.keys(this.storeMap).map(key => ({ key }));
    await this.goStore(alp.safeStore(this.store, this.storeMap));
  },

  async goStore(storeName) {
    this.store = storeName;
    this.pages = this.storeMap[this.store] || [];
    this.pages.length ? await this.goPage(this.pages[0].key) : this.jse?.set({ json: {} });
  },

  async open() {
    this.find('dialog').showModal();
    this.drawer = 0;
    await Alpine.nextTick();
    this.jse ||= await alp.install('jse', {
      target: this.find('[name="jse"]'),
      props: { mode: 'tree', content: { json: {} }, onChange: c => this.handleChange(c) }
    });
    await this.refresh();
    await this.setMode(this.mode);
  },

  async setMode(m) {
    this.mode = m;
    this.drawer = 0;
    await Alpine.nextTick();
    if (m === 'logs') return this.jse?.set({ json: alp.consoleLogs });
    if (m === 'alp') {
      if (!this.page) {
        const first = this.storeMap?.[alp.safeStore(this.store, this.storeMap)]?.[0]?.key;
        this.page = first || '';
      }
      return this.page ? this.goPage(this.page) : this.jse?.set({ json: {} });
    }
  },

  async handleChange({ json }) {
    if (this.mode === 'alp') await alp.saveRecord(this.page, json);
  },

  async goPage(k) {
    this.page = k;
    const data = await alp.loadRecord(k);
    console.log('goPage', k, data);
    await this.jse.set({ json: data || {} });
  },

  async clear() {
    await alp.deleteRecord(this.page);
    await this.refresh();
  }
});

// Auto-mount inspector to DOM
const el = (t, a) => Object.assign(document.createElement(t), a);
document.body.appendChild(el('alp-inspector', { className: 'fixed bottom-4 right-4 z-50' }));

console.log('🔧 Alp Inspector loaded');
