// components/tb-demo.js - Demo component showcasing alp-tb usage
// Shows how to nest and configure the generalized Tabulator component

import { alp } from '../core.js';

alp.define('tb-demo', _ => `
  <div class="flex flex-col h-full bg-base-200 p-4 gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold">TB Demo - Sample Data Table</h2>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-accent" @click="loadSampleData()">Load Sample Data</button>
        <button class="btn btn-sm btn-info" @click="loadFromApi()">Load from API</button>
      </div>
    </div>

    <!-- Nested alp-tb component -->
    <div class="flex-1 border border-base-300 rounded-lg overflow-hidden">
      <alp-tb name="table"></alp-tb>
    </div>

    <!-- Info panel -->
    <div class="text-xs text-base-content/60">
      <span>This demo shows how to use alp-tb as a nested component. </span>
      <span x-show="tableReady" class="text-success">Table is ready!</span>
    </div>
  </div>
`, {
  // State
  tb: null,
  tableReady: false,

  async nav() {
    // Set up event listeners on the nested alp-tb component
    const tbEl = this.find('[name="table"]');
    tbEl.addEventListener('tb-ready', e => this.onTableReady(e.detail));
    tbEl.addEventListener('tb-cleared', () => this.onCleared());
  },

  // Handle table ready event
  onTableReady({ table, component }) {
    this.tb = component;
    this.tableReady = true;

    // Configure the table
    this.tb.configure({
      columns: [
        { title: 'ID', field: 'id', sorter: 'number' },
        { title: 'Name', field: 'name', sorter: 'string' },
        { title: 'Email', field: 'email' },
        { title: 'Department', field: 'department' },
        { title: 'Salary', field: 'salary', formatter: 'money', formatterParams: { thousand: ',', precision: 0 } },
        { title: 'Start Date', field: 'startDate', sorter: 'date' },
        { title: 'Status', field: 'status' }
      ],
      height: '100%',
      layout: 'fitColumns',

      // Enable search on name field
      searchField: 'name',

      // Checkbox filters for department
      checkboxFilterField: 'status',
      checkboxFilters: { Active: true, Inactive: true, 'On Leave': true },

      // Range filter for salary
      rangeField: 'salary',
      rangeLabel: 'Salary',
      rangePlaceholder: 'Min $',

      // Download filename
      downloadFilename: 'employees',

      // Custom buttons
      customButtons: [
        {
          label: 'Process All',
          class: 'btn-warning',
          loading: true,
          loadingText: 'Processing...',
          handler: async (tb) => {
            const data = tb.getVisibleData();
            console.log('Processing', data.length, 'records');
            await new Promise(r => setTimeout(r, 1000));
            alert(`Processed ${data.length} records!`);
          }
        }
      ]
    });
  },

  onCleared() {
    console.log('Table was cleared');
  },

  // Load sample data
  loadSampleData() {
    const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
    const statuses = ['Active', 'Inactive', 'On Leave'];
    const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];

    const data = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
      email: `user${i + 1}@example.com`,
      department: departments[Math.floor(Math.random() * departments.length)],
      salary: Math.floor(Math.random() * 100000) + 40000,
      startDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      status: statuses[Math.floor(Math.random() * statuses.length)]
    }));

    this.tb.setData(data);
  },

  // Load data from a public API
  async loadFromApi() {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      const users = await response.json();

      const data = users.map((u, i) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: ['Engineering', 'Sales', 'Marketing'][i % 3],
        salary: 50000 + (i * 5000),
        startDate: '2023-01-01',
        status: i % 2 === 0 ? 'Active' : 'Inactive'
      }));

      this.tb.setData(data);
    } catch (e) {
      console.error('Failed to load from API:', e);
      alert('Failed to load data from API');
    }
  },

  // Get the nested table component
  getTable() {
    return this.tb;
  }
});

console.log('📋 Alp TB Demo component loaded');
