// Modal component - global modal for displaying content/files
// Place once in HTML, trigger via $store.alp.modal.openWith(src, title)
import { alp } from '../core/alp-core.js';

export function defineModalComponent() {
  alp.define("modal",
    x => `
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

      async nav() {},

      async openWith(src, title) {
        this.src = src;
        this.title = title || src;
        this.content = '';
        this.error = '';
        this.show = true;
        this.loading = true;

        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
          this.content = await res.text();
        } catch (e) {
          this.error = 'Failed to load: ' + e.message;
        }
        this.loading = false;
      },

      close() {
        this.show = false;
      }
    }
  );
}
