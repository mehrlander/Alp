// Pages component - store selector, page tabs, and actions footer
import { alp } from '../core/alp-core.js';

export function definePagesComponent() {
  alp.define("pages",
    x => `
      <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 justify-between items-center gap-2">
        <select class="select select-xs w-auto min-w-0" @change="goStore($event.target.value)" x-model="store">
          <template x-for="s in stores">
            <option :value="s.key" x-text="s.key"></option>
          </template>
        </select>
        <div class="flex-1 overflow-x-auto">
          <div class="flex gap-0.5 whitespace-nowrap">
            <template x-for="it in pages">
              <button class="btn btn-xs" @click="goPage(it.key)" :class="page===it.key?'btn-primary':'btn-ghost'">
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
    `,
    {
      store: 'alp',
      stores: [],
      storeMap: {},
      page: '',
      pages: [],
      hubTarget: 'alp.hub',  // which hub to update

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
          this.getHub()?.clear();
        }
      },

      async goPage(k) {
        this.page = k;
        const data = await alp.loadRecord(k);
        const hub = this.getHub();
        if (hub) {
          await hub.init();
          await hub.set(k, data);
        }
        this.$dispatch('pages-change', { key: k, data });
      },

      async clear() {
        if (!this.page) return;
        await alp.deleteRecord(this.page);
        await this.refresh();
      },

      getHub() {
        const [store, key] = this.hubTarget.split('.');
        return Alpine.store(store)?.[key];
      }
    }
  );
}
