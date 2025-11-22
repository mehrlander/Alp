// Console component - displays captured console messages on page
import { alp } from '../core/alp-core.js';

export function defineConsoleComponent() {
  alp.define("console",
    x => `
      <div class="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div class="flex justify-between items-center px-2 py-1 bg-base-300">
          <span class="text-xs font-semibold">Console</span>
          <div class="flex gap-1">
            <button @click="refresh()" class="btn btn-xs btn-ghost">↻</button>
            <button @click="clear()" class="btn btn-xs btn-ghost">✕</button>
          </div>
        </div>
        <div name="logs" class="h-48 overflow-y-auto p-2 font-mono text-xs space-y-1">
          <template x-for="(log, i) in logs" :key="i">
            <div class="flex gap-2" :class="{
              'text-warning': log.type === 'warn',
              'text-error': log.type === 'error',
              'text-info': log.type === 'info',
              'text-base-content/70': log.type === 'log'
            }">
              <span class="text-base-content/50 shrink-0" x-text="log.time"></span>
              <span class="break-all whitespace-pre-wrap" x-text="log.args"></span>
            </div>
          </template>
          <div x-show="!logs.length" class="text-base-content/50 italic">No logs yet</div>
        </div>
      </div>
    `,
    {
      logs: [],

      nav() {
        this.refresh();
        // Auto-refresh every second
        setInterval(() => this.refresh(), 1000);
      },

      refresh() {
        this.logs = [...alp.consoleLogs].reverse();
        this.$nextTick(() => {
          const el = this.find('[name="logs"]');
          if (el) el.scrollTop = 0;
        });
      },

      clear() {
        alp.consoleLogs.length = 0;
        this.logs = [];
      }
    }
  );
}
