// Hub component - JSON Schema Editor display
import { alp } from '../core/alp-core.js';

export function defineHubComponent() {
  alp.define("hub",
    x => `
      <div name="jse" class="flex-1 overflow-hidden"></div>
    `,
    {
      jse: null,
      currentKey: null,
      mode: 'tree',

      async nav() {},

      async init() {
        if (this.jse) return this.jse;
        await Alpine.nextTick();
        this.jse = await alp.install('jse', {
          target: this.find('[name="jse"]'),
          props: {
            mode: this.mode,
            content: { json: {} },
            onChange: (content) => this.handleChange(content)
          }
        });
        return this.jse;
      },

      async set(key, data) {
        await this.init();
        this.currentKey = key;
        await this.jse.set({ json: data || {} });
      },

      async handleChange(content) {
        if (!this.currentKey) return;
        await alp.saveRecord(this.currentKey, content.json);
        // Sync with Alpine stores if they exist
        const [storeName, sig] = this.currentKey.split('.');
        if (storeName && sig && Alpine.store(storeName)?.[sig]) {
          Object.assign(Alpine.store(storeName)[sig], content.json);
        }
        this.$dispatch('hub-change', { key: this.currentKey, data: content.json });
      },

      clear() {
        this.jse?.set({ json: {} });
        this.currentKey = null;
      }
    }
  );
}
