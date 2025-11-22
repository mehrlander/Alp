// Floating action button - fixed position corner button
import { alp } from '../core/alp-core.js';

export function defineFabComponent() {
  alp.define("fab",
    x => `
      <button @click="click()" class="btn btn-circle btn-lg shadow-lg" :class="btnClass">
        <i :class="icon + ' text-2xl'"></i>
      </button>
    `,
    {
      icon: 'ph ph-gear-six',
      btnClass: 'btn-primary',
      target: null,  // store path to toggle, e.g. 'alp.modal'

      async nav() {
        // Read attributes from element
        const el = this.el?.parentElement;
        this.icon = el?.getAttribute('icon') || this.icon;
        this.btnClass = el?.getAttribute('btn-class') || this.btnClass;
        this.target = el?.getAttribute('target') || this.target;
      },

      click() {
        if (this.target) {
          const [store, key] = this.target.split('.');
          if (Alpine.store(store)?.[key]) {
            Alpine.store(store)[key].show = 1;
            Alpine.store(store)[key].open?.();
          }
        }
        this.$dispatch('fab-click');
      }
    }
  );
}
