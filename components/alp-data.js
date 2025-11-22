// Data component - IndexedDB viewer with JSE, standard container layout
import { alp } from '../core/alp-core.js';

export function defineDataComponent() {
  alp.define("data",
    x => `
      <div class="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div class="flex justify-between items-center px-2 py-1 bg-base-300">
          <div class="flex items-center gap-1">
            <span class="text-xs font-semibold">Data</span>
            ${alp.fill('codeModal', 'data')}
          </div>
          <div class="flex gap-1 items-center">
            <button @click="refresh()" class="btn btn-xs btn-ghost">↻</button>
            <button @click="clear()" class="btn btn-xs btn-ghost text-error">✕</button>
          </div>
        </div>
        <div name="jse" class="h-64 overflow-hidden"></div>
        <div class="flex justify-between items-center px-2 py-1 bg-base-300 text-xs gap-2">
          <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
            <template x-for="s in stores">
              <option :value="s.key" x-text="s.key"></option>
            </template>
          </select>
          <div class="flex gap-0.5 overflow-x-auto flex-1">
            <template x-for="it in pages">
              <button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn-ghost'">
                <span x-text="it.sig" class="truncate max-w-24"></span>
              </button>
            </template>
          </div>
        </div>
      </div>
    `,
    {
      jse: null,
      store: 'alp',
      stores: [],
      storeMap: {},
      page: '',
      pages: [],

      async nav() {
        await this.initJse();
        await this.refresh();
      },

      async initJse() {
        if (this.jse) return this.jse;
        await Alpine.nextTick();
        this.jse = await alp.install('jse', {
          target: this.find('[name="jse"]'),
          props: {
            mode: 'tree',
            content: { json: {} },
            onChange: (content) => this.handleChange(content)
          }
        });
        return this.jse;
      },

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

      async goPage(k) {
        this.page = k;
        const data = await alp.loadRecord(k);
        await this.jse?.set({ json: data || {} });
      },

      async handleChange(content) {
        if (!this.page) return;
        await alp.saveRecord(this.page, content.json);
        const [storeName, sig] = this.page.split('.');
        if (storeName && sig && Alpine.store(storeName)?.[sig]) {
          Object.assign(Alpine.store(storeName)[sig], content.json);
        }
      },

      async clear() {
        if (!this.page) return;
        await alp.deleteRecord(this.page);
        await this.refresh();
      }
    }
  );
}
