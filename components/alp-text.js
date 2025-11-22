// Text component - simple textarea with path-based persistence
import { alp } from '../core/alp-core.js';

export function defineTextComponent() {
  alp.define("text",
    x => `
      <div class="flex justify-between items-center mb-2">
        <div class="text-sm font-semibold">text</div>
        ${alp.fill('pathInput')}
      </div>
      <textarea
        x-model="text"
        @blur="save({text})"
        class="textarea textarea-bordered w-full h-24"
        placeholder="text..."></textarea>
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
