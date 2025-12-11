// components/jse.js - Generalized JSON Editor wrapper component
// Provides a reusable JSON editor with paginated record navigation

import { alp } from '../core.js';

alp.define('jse', _ => `
  <div class="flex flex-col h-full bg-base-100 overflow-hidden">
    <!-- Editor Container -->
    <div class="flex-1 overflow-hidden relative">
      <div name="jse" class="absolute inset-0"></div>
    </div>

    <!-- Footer with pagination controls -->
    <template x-if="showFooter">
      <div class="flex bg-base-300 text-xs flex-shrink-0 p-2 items-center gap-2 border-t border-base-200">
        <!-- Namespace/Category selector -->
        <template x-if="namespaces.length > 1 || config.alwaysShowNamespace">
          <select class="select select-xs w-auto min-w-0"
                  @change="goNs($event.target.value)"
                  x-model="currentNs">
            <template x-for="n in namespaces" :key="n">
              <option :value="n" x-text="n"></option>
            </template>
          </select>
        </template>

        <!-- Record pagination buttons -->
        <div class="flex-1 overflow-x-auto min-w-0">
          <div class="flex gap-0.5 whitespace-nowrap">
            <template x-for="r in currentRecords" :key="r.key">
              <button class="btn btn-xs"
                      @click="goRecord(r)"
                      :class="selectedKey === r.key ? 'btn-primary' : 'btn-ghost'">
                <span x-text="r.label || r.sig || r.key"></span>
              </button>
            </template>
          </div>
        </div>

        <!-- Page navigation for many records -->
        <template x-if="totalPages > 1">
          <div class="flex gap-1 items-center">
            <button class="btn btn-xs btn-ghost" @click="prevPage()" :disabled="currentPage <= 0">
              <i class="ph ph-caret-left"></i>
            </button>
            <span x-text="(currentPage + 1) + '/' + totalPages"></span>
            <button class="btn btn-xs btn-ghost" @click="nextPage()" :disabled="currentPage >= totalPages - 1">
              <i class="ph ph-caret-right"></i>
            </button>
          </div>
        </template>

        <!-- Control buttons -->
        <div class="flex gap-1">
          <template x-if="config.showModeSwitch !== false">
            <select class="select select-xs w-auto" x-model="mode" @change="setMode(mode)">
              <option value="tree">Tree</option>
              <option value="text">Text</option>
              <option value="table">Table</option>
            </select>
          </template>
          <template x-if="config.showClear !== false">
            <button class="btn btn-xs btn-error btn-outline" @click="clearCurrent()">
              <i class="ph ph-trash"></i>
            </button>
          </template>
          <template x-if="config.showAdd !== false">
            <button class="btn btn-xs btn-success btn-outline" @click="addRecord()">
              <i class="ph ph-plus"></i>
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
`, {
  // State
  jse: null,
  config: {},
  mode: 'tree',

  // Footer visibility
  showFooter: true,

  // Data source
  dataSource: null,
  records: [],

  // Namespace/pagination state
  namespaces: [],
  currentNs: '',
  allRecords: {},
  currentRecords: [],
  selectedKey: '',
  selectedRecord: null,

  // Pagination
  currentPage: 0,
  pageSize: 20,
  totalPages: 1,

  // Change tracking
  pendingChange: null,
  autoSave: true,

  // Initialize component
  async nav() {
    // Load saved config
    const saved = await this.load();
    if (saved?.config) {
      this.config = { ...this.config, ...saved.config };
    }
    if (saved?.mode) {
      this.mode = saved.mode;
    }

    // Read config from host element
    const hostConfig = this.host?.dataset?.config;
    if (hostConfig) {
      try {
        this.config = { ...this.config, ...JSON.parse(hostConfig) };
      } catch (e) {
        console.warn('Invalid config JSON:', e);
      }
    }

    // Initialize JSE if not done
    if (!this.jse) {
      await this.initEditor();
    }

    // Apply saved state
    if (saved?.selectedKey) {
      this.selectedKey = saved.selectedKey;
    }
    if (saved?.currentNs) {
      this.currentNs = saved.currentNs;
    }

    // If we have records from loadRecords, show them
    if (this.records.length && !this.currentRecords.length) {
      this.setRecords(this.records);
    }
  },

  // Initialize JSON Editor
  async initEditor() {
    this.jse = await alp.kit.jse({
      target: this.find('[name="jse"]'),
      props: {
        mode: this.mode,
        content: { json: {} },
        onChange: content => this.handleChange(content)
      }
    });

    // Fire ready event
    this.host?.dispatchEvent(new CustomEvent('jse-ready', {
      detail: { editor: this.jse, component: this }
    }));
  },

  // Handle JSON changes
  async handleChange(content) {
    this.pendingChange = content;

    if (this.autoSave && this.selectedRecord) {
      // Debounced save
      clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => this.saveCurrentRecord(), 300);
    }

    // Emit change event
    this.host?.dispatchEvent(new CustomEvent('jse-change', {
      detail: {
        content,
        key: this.selectedKey,
        record: this.selectedRecord,
        component: this
      }
    }));
  },

  // Save current record back to data source
  async saveCurrentRecord() {
    if (!this.pendingChange || !this.selectedRecord) return;

    const json = this.pendingChange.json ?? this.pendingChange.text;

    // Update in records array
    this.selectedRecord.data = json;

    // Save to data source
    if (this.dataSource) {
      if (this.dataSource.type === 'dexie') {
        await this.dataSource.db.put(this.selectedKey, json);
      } else if (this.dataSource.type === 'callback' && this.dataSource.onSave) {
        await this.dataSource.onSave(this.selectedKey, json, this.selectedRecord);
      }
    }

    // Emit save event
    this.host?.dispatchEvent(new CustomEvent('jse-save', {
      detail: {
        key: this.selectedKey,
        data: json,
        record: this.selectedRecord,
        component: this
      }
    }));
  },

  // Configure the editor
  configure(cfg) {
    this.config = { ...this.config, ...cfg };
    this.showFooter = cfg.showFooter !== false;
    if (cfg.pageSize) this.pageSize = cfg.pageSize;
    if (cfg.autoSave !== undefined) this.autoSave = cfg.autoSave;
  },

  // Set editor mode
  async setMode(mode) {
    this.mode = mode;
    if (this.jse) {
      await this.jse.updateProps({ mode });
    }
    await this.save({ ...await this.load(), mode });
  },

  // Load records from array (not tied to IndexedDB)
  // records: [{ key: 'unique-id', label: 'Display Name', data: {...}, ns: 'category' }, ...]
  setRecords(records, opts = {}) {
    this.records = records;
    this.allRecords = {};

    // Group by namespace if present
    records.forEach(r => {
      const ns = r.ns || 'default';
      (this.allRecords[ns] ||= []).push({
        ...r,
        sig: r.sig || r.label || r.key
      });
    });

    this.namespaces = Object.keys(this.allRecords);
    this.currentNs = opts.defaultNs || this.namespaces[0] || 'default';
    this.updatePagination();

    // Select first record or specified key
    if (opts.selectKey) {
      const rec = records.find(r => r.key === opts.selectKey);
      if (rec) this.goRecord(rec);
    } else if (this.allRecords[this.currentNs]?.length) {
      this.goRecord(this.allRecords[this.currentNs][0]);
    }
  },

  // Add a single record
  addRecordToList(record) {
    const ns = record.ns || 'default';
    const rec = { ...record, sig: record.sig || record.label || record.key };

    this.records.push(rec);
    (this.allRecords[ns] ||= []).push(rec);

    if (!this.namespaces.includes(ns)) {
      this.namespaces.push(ns);
    }

    this.updatePagination();
  },

  // Remove a record
  removeRecord(key) {
    const idx = this.records.findIndex(r => r.key === key);
    if (idx >= 0) this.records.splice(idx, 1);

    for (const ns of this.namespaces) {
      const arr = this.allRecords[ns];
      const i = arr?.findIndex(r => r.key === key);
      if (i >= 0) arr.splice(i, 1);
    }

    this.updatePagination();

    // Select next record if current was removed
    if (this.selectedKey === key) {
      const records = this.allRecords[this.currentNs] || [];
      if (records.length) {
        this.goRecord(records[0]);
      } else {
        this.setJson({});
        this.selectedKey = '';
        this.selectedRecord = null;
      }
    }
  },

  // Update pagination after records change
  updatePagination() {
    const records = this.allRecords[this.currentNs] || [];
    this.totalPages = Math.ceil(records.length / this.pageSize) || 1;
    this.currentPage = Math.min(this.currentPage, this.totalPages - 1);
    this.currentRecords = records.slice(
      this.currentPage * this.pageSize,
      (this.currentPage + 1) * this.pageSize
    );
  },

  // Navigate to namespace
  goNs(ns) {
    this.currentNs = ns;
    this.currentPage = 0;
    this.updatePagination();

    // Select first record in namespace
    const records = this.allRecords[ns] || [];
    if (records.length) {
      this.goRecord(records[0]);
    } else {
      this.setJson({});
      this.selectedKey = '';
      this.selectedRecord = null;
    }
  },

  // Navigate to record
  async goRecord(record) {
    this.selectedKey = record.key;
    this.selectedRecord = record;

    // Load data if not present
    let data = record.data;
    if (data === undefined && this.dataSource) {
      if (this.dataSource.type === 'dexie') {
        data = await this.dataSource.db.get(record.key);
      } else if (this.dataSource.type === 'callback' && this.dataSource.onLoad) {
        data = await this.dataSource.onLoad(record.key, record);
      }
      record.data = data;
    }

    await this.setJson(data || {});

    // Emit navigate event
    this.host?.dispatchEvent(new CustomEvent('jse-navigate', {
      detail: { key: record.key, record, data, component: this }
    }));
  },

  // Page navigation
  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updatePagination();
    }
  },

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.updatePagination();
    }
  },

  // Set JSON content directly
  async setJson(json) {
    if (this.jse) {
      await this.jse.set({ json });
    }
  },

  // Get current JSON content
  getJson() {
    if (!this.jse) return null;
    const content = this.jse.get();
    return content.json ?? JSON.parse(content.text);
  },

  // Clear current record
  async clearCurrent() {
    if (!this.selectedRecord) return;

    if (confirm(`Delete "${this.selectedRecord.label || this.selectedKey}"?`)) {
      // Delete from data source
      if (this.dataSource) {
        if (this.dataSource.type === 'dexie') {
          await this.dataSource.db.del(this.selectedKey);
        } else if (this.dataSource.type === 'callback' && this.dataSource.onDelete) {
          await this.dataSource.onDelete(this.selectedKey, this.selectedRecord);
        }
      }

      this.removeRecord(this.selectedKey);

      // Emit delete event
      this.host?.dispatchEvent(new CustomEvent('jse-delete', {
        detail: { key: this.selectedKey, component: this }
      }));
    }
  },

  // Add new record
  async addRecord() {
    const key = prompt('Enter record key/name:');
    if (!key) return;

    const record = {
      key,
      label: key,
      ns: this.currentNs,
      data: {}
    };

    // Save to data source
    if (this.dataSource) {
      if (this.dataSource.type === 'dexie') {
        await this.dataSource.db.put(key, {});
      } else if (this.dataSource.type === 'callback' && this.dataSource.onAdd) {
        await this.dataSource.onAdd(key, record);
      }
    }

    this.addRecordToList(record);
    this.goRecord(record);

    // Emit add event
    this.host?.dispatchEvent(new CustomEvent('jse-add', {
      detail: { key, record, component: this }
    }));
  },

  // Connect to dexie kit for data persistence
  async connectDexie(dexieDb, opts = {}) {
    this.dataSource = { type: 'dexie', db: dexieDb };

    // Load all records from database
    const grouped = await dexieDb.grouped();
    const records = [];

    for (const [ns, items] of Object.entries(grouped)) {
      for (const item of items) {
        records.push({
          key: item.key,
          label: item.sig,
          sig: item.sig,
          ns,
          data: item.data
        });
      }
    }

    this.setRecords(records, opts);
  },

  // Connect with callbacks for custom data sources
  connectCallbacks({ onLoad, onSave, onDelete, onAdd }) {
    this.dataSource = { type: 'callback', onLoad, onSave, onDelete, onAdd };
  },

  // Persist component state
  async persist() {
    await this.save({
      config: this.config,
      mode: this.mode,
      selectedKey: this.selectedKey,
      currentNs: this.currentNs
    });
  }
});

console.log('📝 Alp JSE (JSON Editor) component loaded');
