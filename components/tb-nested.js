// components/tb-nested.js - Simple example of nesting alp-tb component

import { alp } from '../core.js';

alp.define('tb-nested', _ => `
  <div class="flex flex-col h-full bg-base-100 p-4 gap-3 text-sm">
    <div class="text-lg font-semibold">Nested Table Example</div>
    <p class="text-xs text-base-content/70">This component demonstrates nesting an alp-tb component inside another alp component.</p>

    <!-- Controls -->
    <div class="flex items-center gap-2 text-xs">
      <button class="btn btn-xs btn-primary" @click="loadSampleData()">Load Sample Data</button>
      <button class="btn btn-xs btn-secondary" @click="addRow()">Add Row</button>
      <button class="btn btn-xs btn-error" @click="clearData()">Clear</button>
      <span class="ml-auto text-base-content/70" x-text="'Total: ' + rowCount + ' rows'"></span>
    </div>

    <!-- Nested alp-tb Component -->
    <alp-tb x-ref="tb" class="flex-1 border rounded"></alp-tb>
  </div>
`, {
  tbRef: null,
  rowCount: 0,

  async nav() {
    // Wait for Alpine to process the nested component
    await this.$nextTick();

    // Get reference to the nested tb component
    const tbEl = this.$refs.tb;
    if (tbEl && tbEl._x_dataStack) {
      this.tbRef = tbEl._x_dataStack[0];

      // Configure with simple columns
      this.tbRef.configure({
        columns: [
          { title: 'ID', field: 'id' },
          { title: 'Name', field: 'name' },
          { title: 'Value', field: 'value' }
        ]
      });

      // Track row count changes
      if (this.tbRef.table) {
        this.tbRef.table.on('dataLoaded', d => this.rowCount = d.length);
        this.tbRef.table.on('dataChanged', () => this.rowCount = this.tbRef.getData().length);
      }
    }

    // Load any persisted data
    const saved = await this.load();
    if (saved?.data && this.tbRef) {
      this.tbRef.setData(saved.data);
    }
  },

  loadSampleData() {
    if (!this.tbRef) return;
    const sampleData = [
      { id: 1, name: 'Alpha', value: 100 },
      { id: 2, name: 'Beta', value: 200 },
      { id: 3, name: 'Gamma', value: 300 },
      { id: 4, name: 'Delta', value: 400 }
    ];
    this.tbRef.setData(sampleData);
    this.rowCount = sampleData.length;
    this.persist();
  },

  addRow() {
    if (!this.tbRef?.table) return;
    const data = this.tbRef.getData();
    const newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
    this.tbRef.table.addData([{ id: newId, name: 'New Row', value: 0 }]);
    this.rowCount = this.tbRef.getData().length;
    this.persist();
  },

  clearData() {
    if (!this.tbRef) return;
    this.tbRef.setData([]);
    this.rowCount = 0;
    this.del();
  },

  async persist() {
    await this.save({ data: this.tbRef?.getData() || [] });
  }
});

console.log('📦 Alp TB Nested example loaded');
