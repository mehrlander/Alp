// components/tb-nested.js - Simplest possible nested alp-tb example

import { alp } from '../core.js';

alp.define('tb-nested', _ => `
  <div class="flex flex-col h-full bg-base-100 p-4 gap-3 text-sm">
    <div class="text-lg font-semibold">Nested Table Example</div>
    <alp-tb x-ref="tb" class="flex-1 border rounded"></alp-tb>
  </div>
`, {
  async nav() {
    // Wait for nested component to be ready
    await this.$nextTick();

    const tbEl = this.$refs.tb;
    if (!tbEl?._x_dataStack) {
      console.log('tb-nested: nested tb not ready');
      return;
    }

    console.log('hello');
    const tb = tbEl._x_dataStack[0];
    tb.configure({
      columns: [
        { title: 'ID', field: 'id' },
        { title: 'Name', field: 'name' },
        { title: 'Value', field: 'value' }
      ],
      data: [
        { id: 1, name: 'Alpha', value: 100 },
        { id: 2, name: 'Beta', value: 200 },
        { id: 3, name: 'Gamma', value: 300 }
      ]
    });
  }
});

console.log('tb-nested loaded');
