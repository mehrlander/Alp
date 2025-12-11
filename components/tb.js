// components/tb.js - Generalized Tabulator wrapper component
// Provides a reusable table with filtering, downloads, and row count

import { alp } from '../core.js';

alp.define('tb', _ => `
  <div class="flex flex-col h-full bg-base-100 p-2 gap-2 text-sm">
    <!-- Filter Row (customizable via slots) -->
    <div name="filters" class="flex items-center gap-4 text-xs flex-wrap">
      <template x-if="showFilters">
        <div class="flex items-center gap-4 flex-wrap flex-1">
          <!-- Text search filter -->
          <template x-if="config.searchField">
            <label class="flex items-center gap-1">
              <span class="font-semibold">Search:</span>
              <input type="text" class="input input-xs w-32"
                     x-model="searchText"
                     @input="applyFilters()"
                     placeholder="Type to filter...">
            </label>
          </template>

          <!-- Checkbox filters (rendered dynamically) -->
          <template x-for="(filter, key) in checkboxFilters" :key="key">
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" class="checkbox checkbox-xs"
                     x-model="checkboxFilters[key]"
                     @change="applyFilters()">
              <span x-text="key"></span>
            </label>
          </template>

          <!-- Numeric range filter -->
          <template x-if="config.rangeField">
            <label class="flex items-center gap-1">
              <span x-text="config.rangeLabel || config.rangeField"></span>
              <span>&gt;</span>
              <input type="number" class="input input-xs w-16"
                     x-model.number="rangeValue"
                     @input="applyFilters()"
                     :placeholder="config.rangePlaceholder || ''">
            </label>
          </template>
        </div>
      </template>
    </div>

    <!-- Table Container -->
    <div name="table" class="flex-1"></div>

    <!-- Footer Controls -->
    <div class="flex justify-between items-center text-xs">
      <div class="flex items-center gap-2">
        <span x-text="rowCount + ' rows'"></span>
        <template x-if="config.showClear !== false">
          <button class="btn btn-xs btn-error btn-outline" @click="clearAll()">Clear</button>
        </template>
      </div>
      <div class="flex gap-2">
        <template x-if="config.showDownloadJson !== false">
          <button class="btn btn-xs btn-secondary" @click="downloadData()">Download JSON</button>
        </template>
        <template x-if="config.zipMapper">
          <button class="btn btn-xs btn-primary"
                  @click="downloadZip()"
                  :disabled="downloading"
                  x-text="downloadText">Download Zip</button>
        </template>
        <!-- Custom buttons slot -->
        <template x-for="btn in (config.customButtons || [])" :key="btn.label">
          <button class="btn btn-xs"
                  :class="btn.class || 'btn-accent'"
                  @click="handleCustomButton(btn)"
                  :disabled="btn.loading && customButtonLoading[btn.label]"
                  x-text="customButtonLoading[btn.label] ? btn.loadingText || 'Loading...' : btn.label">
          </button>
        </template>
      </div>
    </div>
  </div>
`, {
  // State
  table: null,
  config: {},

  // Filter state
  showFilters: true,
  searchText: '',
  checkboxFilters: {},
  rangeValue: null,

  // Row count
  rowCount: 0,

  // Download state
  downloading: false,
  downloadText: 'Download Zip',
  customButtonLoading: {},

  // Data source (can be set externally)
  dataSource: null,

  // Initialize component
  async nav() {
    // Load config from host element attributes or saved state
    const saved = await this.load();
    if (saved?.config) {
      this.config = { ...this.config, ...saved.config };
    }

    // Read config from host element data attributes
    const hostConfig = this.host?.dataset?.config;
    if (hostConfig) {
      try {
        this.config = { ...this.config, ...JSON.parse(hostConfig) };
      } catch (e) {
        console.warn('Invalid config JSON:', e);
      }
    }

    // Initialize table if not done
    if (!this.table) {
      await this.initTable();
    }

    // Load saved data
    if (saved?.tableData) {
      this.table.setData(saved.tableData);
    }

    // Initialize checkbox filters from config
    if (this.config.checkboxFilters) {
      this.checkboxFilters = { ...this.config.checkboxFilters };
    }

    // Initialize range value
    if (saved?.rangeValue !== undefined) {
      this.rangeValue = saved.rangeValue;
    }
  },

  // Initialize Tabulator instance
  async initTable() {
    const columns = this.config.columns || [];

    this.table = await alp.kit.tb({
      target: this.find('[name="table"]'),
      layout: this.config.layout || 'fitData',
      height: this.config.height || '300px',
      columns: typeof columns[0] === 'string'
        ? alp.kit.tb.buildColumns(columns)
        : columns,
      ...(this.config.tabulator || {})
    });

    // Set up row count tracking
    this.table.on('dataFiltered', (filters, rows) => this.rowCount = rows.length);
    this.table.on('dataLoaded', data => this.rowCount = data.length);

    // Fire ready event
    this.host?.dispatchEvent(new CustomEvent('tb-ready', { detail: { table: this.table, component: this } }));
  },

  // Apply all filters
  applyFilters() {
    if (!this.table) return;

    this.table.setFilter(row => {
      // Text search filter
      if (this.searchText && this.config.searchField) {
        const val = String(row[this.config.searchField] || '').toLowerCase();
        if (!val.includes(this.searchText.toLowerCase())) return false;
      }

      // Checkbox filters (field must match one of the checked values)
      if (this.config.checkboxFilterField) {
        const field = this.config.checkboxFilterField;
        const activeFilters = Object.entries(this.checkboxFilters)
          .filter(([k, v]) => v)
          .map(([k]) => k);
        if (activeFilters.length && !activeFilters.includes(row[field])) {
          return false;
        }
      }

      // Range filter
      if (this.rangeValue !== null && this.rangeValue !== '' && this.config.rangeField) {
        if (row[this.config.rangeField] <= this.rangeValue) return false;
      }

      // Custom filter function
      if (this.config.customFilter) {
        if (!this.config.customFilter(row, this)) return false;
      }

      return true;
    });
  },

  // Configure the table (called externally)
  configure(cfg) {
    this.config = { ...this.config, ...cfg };
    if (cfg.checkboxFilters) {
      this.checkboxFilters = { ...cfg.checkboxFilters };
    }
    this.showFilters = cfg.showFilters !== false;
  },

  // Set columns dynamically
  setColumns(columns) {
    if (!this.table) return;
    const cols = typeof columns[0] === 'string'
      ? alp.kit.tb.buildColumns(columns)
      : columns;
    this.table.setColumns(cols);
  },

  // Data operations
  setData(data) {
    this.table?.setData(data);
  },

  addData(data) {
    this.table?.addData(data);
  },

  getData() {
    return this.table?.getData() || [];
  },

  getVisibleData() {
    return this.table?.getRows('visible').map(r => r.getData()) || [];
  },

  getVisibleRows() {
    return this.table?.getRows('visible') || [];
  },

  updateRow(rowOrIndex, data) {
    if (typeof rowOrIndex === 'number') {
      const rows = this.table.getRows();
      rows[rowOrIndex]?.update(data);
    } else {
      rowOrIndex.update(data);
    }
  },

  // Clear all data
  async clearAll() {
    this.table?.setData([]);
    this.searchText = '';
    this.rangeValue = null;
    if (this.config.checkboxFilters) {
      Object.keys(this.checkboxFilters).forEach(k => this.checkboxFilters[k] = true);
    }
    await this.del();
    this.host?.dispatchEvent(new CustomEvent('tb-cleared', { detail: { component: this } }));
  },

  // Persist current state
  async persist() {
    await this.save({
      tableData: this.table?.getData() || [],
      config: this.config,
      rangeValue: this.rangeValue
    });
  },

  // Download data as JSON
  downloadData() {
    alp.kit.tb.downloadJson(this.table, {
      filename: this.config.downloadFilename || 'table-data',
      timestamp: true
    });
  },

  // Download files as ZIP
  async downloadZip() {
    if (!this.config.zipMapper) return;

    const rows = this.table.getRows('visible');
    if (!rows.length) {
      alert('No files to download');
      return;
    }

    this.downloading = true;
    this.downloadText = 'Preparing...';

    try {
      await alp.kit.tb.downloadZip(this.table, {
        filename: this.config.zipFilename || 'download.zip',
        fileMapper: this.config.zipMapper,
        onProgress: (current, total, data) => {
          this.downloadText = data
            ? `Downloading ${current + 1}/${total}`
            : 'Generating zip...';
        }
      });
    } finally {
      this.downloading = false;
      this.downloadText = 'Download Zip';
    }
  },

  // Handle custom button clicks
  async handleCustomButton(btn) {
    if (btn.handler) {
      this.customButtonLoading[btn.label] = true;
      try {
        await btn.handler(this);
      } finally {
        this.customButtonLoading[btn.label] = false;
      }
    }
  },

  // Connect to a dexie kit database for data persistence
  async connectDexie(dexieDb, key) {
    this.dataSource = { type: 'dexie', db: dexieDb, key };
    const data = await dexieDb.get(key);
    if (data) this.setData(data);
  },

  // Save to connected dexie
  async saveToDexie() {
    if (this.dataSource?.type === 'dexie') {
      await this.dataSource.db.put(this.dataSource.key, this.getData());
    }
  }
});

console.log('📊 Alp TB (Tabulator) component loaded');
