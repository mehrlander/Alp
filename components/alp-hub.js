// Hub component - IndexedDB viewer with JSE, standard container layout
import { alp } from '../core/alp-core.js';

export function defineHubComponent() {
  alp.define("hub",
    x => `
      <div class="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div class="flex justify-between items-center px-2 py-1 bg-base-300">
          <span class="text-xs font-semibold">Hub</span>
          <div class="flex gap-1 items-center">
            ${alp.fill('storeSelector')}
            ${alp.fill('pagesButtons')}
            <button @click="clear()" class="btn btn-xs btn-ghost text-error">✕</button>
          </div>
        </div>
        <div name="jse" class="h-64 overflow-hidden"></div>
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
