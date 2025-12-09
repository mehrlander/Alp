// components/inspector.js - Alp Inspector Component

import { alp } from '../core.js';

alp.define('inspector', _ => alp.fill('modal', `
  <div class="flex-1 overflow-hidden relative">
    <div name="jse" class="absolute inset-0"></div>
  </div>

  <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 items-center gap-2">
    <select class="select select-xs w-auto min-w-0" @change="goNs($event.target.value)" x-model="ns">
      <template x-for="n in namespaces"><option :value="n" x-text="n"></option></template>
    </select>

    <div class="flex-1 overflow-x-auto min-w-0">
      <div class="flex gap-0.5 whitespace-nowrap">
        <template x-for="r in records" :key="r.key">
          <button class="btn btn-xs" @click="goRecord(r.key)" :class="selected===r.key?'btn-primary':'btn'">
            <span x-text="r.sig"></span>
          </button>
        </template>
      </div>
    </div>

    <button class="btn btn-xs btn-error btn-outline" @click="clear()">Clear</button>
  </div>
`), {
  ns: 'alp',
  catalog: {},
  namespaces: [],
  records: [],
  selected: '',
  jse: null,

  async refresh() {
    this.catalog = await alp.load();
    this.namespaces = Object.keys(this.catalog);
    await this.goNs(this.catalog[this.ns] ? this.ns : (this.namespaces[0] || 'alp'));
  },

  async goNs(n) {
    this.ns = n;
    this.records = this.catalog[this.ns] || [];
    this.records.length ? await this.goRecord(this.records[0].key) : this.jse?.set({ json: {} });
  },

  async open() {
    this.find('dialog').showModal();
    await Alpine.nextTick();
    this.jse ||= await alp.kit.jse({
      target: this.find('[name="jse"]'),
      props: { mode: 'tree', content: { json: {} }, onChange: c => this.handleChange(c) }
    });
    await this.refresh();
  },

  async handleChange({ json }) {
    if (this.selected) await alp.saveRecord(this.selected, json);
  },

  async goRecord(k) {
    this.selected = k;
    const data = await alp.loadRecord(k);
    await this.jse.set({ json: data || {} });
  },

  async clear() {
    await alp.deleteRecord(this.selected);
    await this.refresh();
  }
});

// Auto-mount
const el = (t, a) => Object.assign(document.createElement(t), a);
const wrap = el('div', { className: 'fixed bottom-4 right-4 z-50' });
wrap.innerHTML = `
  <button class="text-primary" onclick="this.nextElementSibling.data.open()">
    <i class="ph ph-gear-six text-4xl"></i>
  </button>
  <alp-inspector></alp-inspector>
`;
document.body.appendChild(wrap);

console.log('🔧 Alp Inspector loaded');
