// Inspector component - developer tool for viewing/editing all IndexedDB data
import { alp } from '../core/alp-core.js';

export function defineInspectorComponent() {
  alp.define("inspector",
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
        this.goStore(alp.safeStore(this.store, this.storeMap));
      },

      goStore(storeName) {
        this.store = storeName;
        this.pages = this.storeMap[this.store] || [];
        this.pages.length ? this.goPage(this.pages[0].key) : this.jse?.set({ json: {} });
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
        this.jse.set({ json: data || {} });
      },

      async clear() {
        console.log(this.page);
        await alp.deleteRecord(this.page);
        await this.refresh();
      }
    }
  );
}
