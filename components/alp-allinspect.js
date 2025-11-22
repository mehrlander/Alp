// AllInspect component - displays live HTML of the page
import { alp } from '../core/alp-core.js';

export function defineAllInspectComponent() {
  alp.define("allinspect",
    x => `
      <div class="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div class="flex justify-between items-center px-2 py-1 bg-base-300">
          <span class="text-xs font-semibold">HTML Inspector</span>
          <div class="flex gap-1 items-center">
            <label class="flex items-center gap-1 text-xs">
              <input type="checkbox" x-model="autoRefresh" class="checkbox checkbox-xs">
              <span>auto</span>
            </label>
            <span x-show="copyMsg" x-text="copyMsg" class="text-[10px] text-success"></span>
            <button @click="copyHtml()" class="btn btn-xs btn-ghost">copy</button>
            <button @click="refresh()" class="btn btn-xs btn-ghost">↻</button>
          </div>
        </div>
        <div class="p-2 space-y-2">
          <!-- Filter -->
          <input x-model="filter" @input="refresh()" class="input input-xs w-full" placeholder="Filter selector (e.g., body, .class, #id)">

          <!-- HTML Output -->
          <div class="max-h-64 overflow-auto">
            <pre class="text-xs bg-base-300 p-2 rounded overflow-x-auto whitespace-pre-wrap"><code x-text="html"></code></pre>
          </div>

          <!-- Stats -->
          <div class="text-xs text-base-content/50 flex gap-4">
            <span>Elements: <span x-text="elementCount"></span></span>
            <span>Size: <span x-text="formatSize(html.length)"></span></span>
          </div>
        </div>
      </div>
    `,
    {
      html: '',
      filter: 'body',
      autoRefresh: true,
      copyMsg: '',
      elementCount: 0,
      intervalId: null,

      nav() {
        this.refresh();
        this.intervalId = setInterval(() => {
          if (this.autoRefresh) this.refresh();
        }, 1000);
      },

      refresh() {
        try {
          const selector = this.filter.trim() || 'body';
          const el = document.querySelector(selector);

          if (!el) {
            this.html = `No element found for selector: ${selector}`;
            this.elementCount = 0;
            return;
          }

          // Get the outer HTML and format it
          const rawHtml = el.outerHTML;
          this.html = this.formatHtml(rawHtml);
          this.elementCount = el.querySelectorAll('*').length + 1;
        } catch (e) {
          this.html = `Error: ${e.message}`;
          this.elementCount = 0;
        }
      },

      formatHtml(html) {
        // Simple HTML formatting with indentation
        let formatted = '';
        let indent = 0;
        const tab = '  ';

        // Split by tags while preserving them
        const tokens = html.split(/(<[^>]+>)/g).filter(t => t.trim());

        for (const token of tokens) {
          if (token.startsWith('</')) {
            // Closing tag - decrease indent first
            indent = Math.max(0, indent - 1);
            formatted += tab.repeat(indent) + token + '\n';
          } else if (token.startsWith('<') && !token.startsWith('<!')) {
            // Opening tag
            formatted += tab.repeat(indent) + token;

            // Self-closing or void elements don't increase indent
            if (!token.endsWith('/>') && !this.isVoidElement(token)) {
              indent++;
            }
            formatted += '\n';
          } else if (token.trim()) {
            // Text content
            const trimmed = token.trim();
            if (trimmed.length > 100) {
              formatted += tab.repeat(indent) + trimmed.slice(0, 100) + '...\n';
            } else {
              formatted += tab.repeat(indent) + trimmed + '\n';
            }
          }
        }

        return formatted.trim();
      },

      isVoidElement(tag) {
        const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
        const tagName = tag.match(/<(\w+)/)?.[1]?.toLowerCase();
        return voidElements.includes(tagName);
      },

      async copyHtml() {
        try {
          await navigator.clipboard.writeText(this.html);
          this.copyMsg = 'copied!';
          setTimeout(() => this.copyMsg = '', 2000);
        } catch (e) {
          this.copyMsg = 'failed';
          setTimeout(() => this.copyMsg = '', 2000);
        }
      },

      formatSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
      }
    }
  );
}
