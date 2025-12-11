// components/jse-demo.js - Demo component showcasing alp-jse usage
// Shows how to nest and configure the generalized JSON Editor component

import { alp } from '../core.js';

alp.define('jse-demo', _ => `
  <div class="flex flex-col h-full bg-base-200 p-4 gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold">JSE Demo - JSON Editor with Pagination</h2>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-accent" @click="loadSampleRecords()">Load Samples</button>
        <button class="btn btn-sm btn-info" @click="loadFromApi()">Load from API</button>
        <button class="btn btn-sm btn-secondary" @click="connectToDexie()">Connect Dexie</button>
      </div>
    </div>

    <!-- Current record info -->
    <div class="flex items-center gap-4 text-sm bg-base-100 p-2 rounded">
      <span class="font-semibold">Current:</span>
      <span x-text="currentKey || '(none)'" class="font-mono text-primary"></span>
      <span x-show="lastSaved" class="text-success text-xs">Saved!</span>
    </div>

    <!-- Nested alp-jse component -->
    <div class="flex-1 border border-base-300 rounded-lg overflow-hidden" style="min-height: 300px;">
      <alp-jse
        @jse-ready="onEditorReady($event.detail)"
        @jse-navigate="onNavigate($event.detail)"
        @jse-save="onSave($event.detail)"
        @jse-change="onChange($event.detail)">
      </alp-jse>
    </div>

    <!-- Info panel -->
    <div class="text-xs text-base-content/60">
      <span>This demo shows alp-jse with paginated record navigation. </span>
      <span x-show="editorReady" class="text-success">Editor ready!</span>
      <span x-show="recordCount > 0" class="ml-2">Records: <span x-text="recordCount"></span></span>
    </div>
  </div>
`, {
  // State
  jseComponent: null,
  editorReady: false,
  currentKey: '',
  recordCount: 0,
  lastSaved: false,

  async nav() {
    // Component initialization
  },

  // Handle editor ready event
  onEditorReady({ editor, component }) {
    this.jseComponent = component;
    this.editorReady = true;

    // Configure the editor
    this.jseComponent.configure({
      showModeSwitch: true,
      showClear: true,
      showAdd: true,
      pageSize: 10,
      autoSave: true
    });
  },

  // Handle navigation to a record
  onNavigate({ key, record, data }) {
    this.currentKey = key;
    this.lastSaved = false;
    console.log('Navigated to:', key, data);
  },

  // Handle save event
  onSave({ key, data }) {
    this.lastSaved = true;
    setTimeout(() => this.lastSaved = false, 2000);
    console.log('Saved:', key);
  },

  // Handle change event
  onChange({ content, key }) {
    this.lastSaved = false;
  },

  // Load sample records
  loadSampleRecords() {
    const records = [
      // Configuration records
      { key: 'config.app', label: 'App Config', ns: 'config', data: { name: 'My App', version: '1.0.0', debug: true } },
      { key: 'config.theme', label: 'Theme', ns: 'config', data: { primary: '#3B82F6', mode: 'dark' } },
      { key: 'config.api', label: 'API Settings', ns: 'config', data: { baseUrl: 'https://api.example.com', timeout: 5000 } },

      // User records
      { key: 'users.1', label: 'User 1', ns: 'users', data: { id: 1, name: 'John Doe', email: 'john@example.com', roles: ['admin', 'user'] } },
      { key: 'users.2', label: 'User 2', ns: 'users', data: { id: 2, name: 'Jane Smith', email: 'jane@example.com', roles: ['user'] } },
      { key: 'users.3', label: 'User 3', ns: 'users', data: { id: 3, name: 'Bob Wilson', email: 'bob@example.com', roles: ['guest'] } },

      // Data records
      { key: 'data.products', label: 'Products', ns: 'data', data: { items: [{ id: 1, name: 'Widget' }, { id: 2, name: 'Gadget' }] } },
      { key: 'data.orders', label: 'Orders', ns: 'data', data: { pending: 5, completed: 12, cancelled: 1 } },
      { key: 'data.metrics', label: 'Metrics', ns: 'data', data: { visitors: 1234, pageViews: 5678, bounceRate: 0.32 } },

      // Many items for pagination demo
      ...Array.from({ length: 15 }, (_, i) => ({
        key: `logs.entry-${i + 1}`,
        label: `Log ${i + 1}`,
        ns: 'logs',
        data: {
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
          level: ['info', 'warn', 'error'][i % 3],
          message: `Log message ${i + 1}`,
          details: { line: i * 10, file: `module${i % 5}.js` }
        }
      }))
    ];

    this.jseComponent.setRecords(records, { defaultNs: 'config' });
    this.recordCount = records.length;
  },

  // Load data from public API
  async loadFromApi() {
    try {
      const [users, posts, todos] = await Promise.all([
        fetch('https://jsonplaceholder.typicode.com/users').then(r => r.json()),
        fetch('https://jsonplaceholder.typicode.com/posts?_limit=10').then(r => r.json()),
        fetch('https://jsonplaceholder.typicode.com/todos?_limit=10').then(r => r.json())
      ]);

      const records = [
        ...users.map(u => ({
          key: `api-users.${u.id}`,
          label: u.name,
          ns: 'api-users',
          data: u
        })),
        ...posts.map(p => ({
          key: `api-posts.${p.id}`,
          label: `Post ${p.id}`,
          ns: 'api-posts',
          data: p
        })),
        ...todos.map(t => ({
          key: `api-todos.${t.id}`,
          label: `Todo ${t.id}`,
          ns: 'api-todos',
          data: t
        }))
      ];

      this.jseComponent.setRecords(records, { defaultNs: 'api-users' });
      this.recordCount = records.length;
    } catch (e) {
      console.error('Failed to load from API:', e);
      alert('Failed to load data from API');
    }
  },

  // Connect to dexie kit
  async connectToDexie() {
    try {
      // Create a dexie database using the kit
      const dexieDb = alp.kit.dexie.create('JSEDemoDb', 'records');

      // Seed some sample data if empty
      const count = await dexieDb.count();
      if (count === 0) {
        await dexieDb.bulkPut([
          ['demo.settings', { theme: 'dark', language: 'en' }],
          ['demo.profile', { name: 'Demo User', avatar: '👤' }],
          ['demo.preferences', { notifications: true, autoSave: true }]
        ]);
      }

      // Connect the JSE component to dexie
      await this.jseComponent.connectDexie(dexieDb);
      this.recordCount = await dexieDb.count();

      console.log('Connected to Dexie database');
    } catch (e) {
      console.error('Failed to connect to Dexie:', e);
      alert('Failed to connect to Dexie database');
    }
  },

  // Get the nested JSE component
  getEditor() {
    return this.jseComponent;
  }
});

console.log('📝 Alp JSE Demo component loaded');
