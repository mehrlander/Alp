// Generic modal component - overlay with backdrop and click-outside-to-close
// Includes alp-hub and alp-pages as nested components
import { alp } from '../core/alp-core.js';

export function defineModalComponent() {
  alp.define("modal",
    x => `
      <template x-teleport="body">
        <div x-show="show" x-transition.opacity class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="close()">
          <div x-show="show" x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100" class="bg-base-100 w-full max-w-[95%] h-[80vh] shadow-lg flex flex-col" @click.stop>
            <alp-hub></alp-hub>
            <alp-pages></alp-pages>
          </div>
        </div>
      </template>
    `,
    {
      show: 0,

      async nav() {},

      async open() {
        this.show = 1;
        await Alpine.nextTick();
        // Initialize hub and trigger pages refresh
        const hub = Alpine.store('alp')?.hub;
        const pages = Alpine.store('alp')?.pages;
        await hub?.init();
        await pages?.refresh();
      },

      close() {
        this.show = 0;
        this.$dispatch('modal-close');
      },

      toggle() {
        this.show ? this.close() : this.open();
      }
    }
  );
}
