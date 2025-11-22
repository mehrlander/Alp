// Modal component - button that triggers a modal, can display any content or fetch a file
import { alp } from '../core/alp-core.js';

export function defineModalComponent() {
  alp.define("modal",
    x => `
      <button @click="open()" class="btn btn-xs btn-ghost" :class="btnClass">
        <span x-text="label"></span>
      </button>
      <template x-teleport="body">
        <div x-show="show" x-transition.opacity class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="show=false">
          <div class="bg-base-100 w-full max-w-4xl max-h-[85vh] shadow-xl rounded-lg flex flex-col m-4" @click.stop>
            <div class="flex justify-between items-center px-3 py-2 bg-base-300 rounded-t-lg">
              <span class="text-sm font-semibold" x-text="title"></span>
              <button @click="show=false" class="btn btn-xs btn-ghost">✕</button>
            </div>
            <div class="flex-1 overflow-auto p-3">
              <div x-show="loading" class="text-center py-8">
                <span class="loading loading-spinner loading-md"></span>
              </div>
              <div x-show="error" class="text-error text-sm" x-text="error"></div>
              <pre x-show="content && !loading" class="text-xs bg-base-200 p-3 rounded overflow-auto max-h-[70vh]"><code x-text="content"></code></pre>
            </div>
          </div>
        </div>
      </template>
    `,
    {
      show: false,
      loading: false,
      error: '',
      content: '',
      src: '',
      title: 'Modal',
      label: '</>',
      btnClass: '',

      async nav() {
        // Read attributes from element
        const el = this.el?.parentElement;
        this.src = el?.getAttribute('src') || '';
        this.title = el?.getAttribute('title') || this.src || 'Modal';
        this.label = el?.getAttribute('label') || '</>';
        this.btnClass = el?.getAttribute('btn-class') || '';
      },

      async open() {
        this.show = true;
        this.error = '';

        if (this.src && !this.content) {
          this.loading = true;
          try {
            const res = await fetch(this.src);
            if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
            this.content = await res.text();
          } catch (e) {
            this.error = 'Failed to load: ' + e.message;
          }
          this.loading = false;
        }
      }
    }
  );
}
