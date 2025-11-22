// Text component - simple textarea with path-based persistence
import { alp } from '../core/alp-core.js';

export function defineTextComponent() {
  alp.define("text",
    x => `
      <div class="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div class="flex justify-between items-center px-2 py-1 bg-base-300">
          <span class="text-xs font-semibold">Text</span>
          <div class="flex gap-1 items-center">
          </div>
        </div>
        <textarea
          x-model="text"
          @blur="save({text})"
          class="textarea w-full h-32 text-sm rounded-none border-0 focus:outline-none"
          placeholder="text..."></textarea>
        <div class="flex justify-between items-center px-2 py-1 bg-base-300 text-xs gap-2">
          ${alp.fill('codeModal', 'text')}
          <div class="flex-1"></div>
          ${alp.fill('pathInput')}
        </div>
      </div>
    `,
    {
      text: '',

      async nav() {
        const data = await this.load();
        if (data && !data.hasOwnProperty('text')) {
          alert('Path contains incompatible data (expected text property)');
          this.path = this.defaultPath;
          return;
        }
        this.text = data?.text || '';
      }
    }
  );
}
