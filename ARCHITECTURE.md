# Alp

Create utilities to store and work with data in the browser.

## Core Concepts

**Data** — Data arrives from clipboard, file, API, user input. Storage is handled through IndexedDB.

**Paths** — A path is an address in your data layer to an IndexedDB record. Paths can span multiple databases and stores. Components bind to a path and can watch activity on it.

**Components** — A template for UI and data. Name, HTML string, initial state, methods.

**Ping** — How you nudge components by path. `alp.ping(path, data, occasion)` notifies whatever's bound there. Receiver handles it via `onPing(occasion, data)`.

**Queues** — Proxy-based queues smooth over async timing. Call things before they're ready; calls queue and replay.

**Kits** — Adapter layer for external libraries or common functionality. Shared setup available everywhere.

---

## Defining Components

Components are defined with a name, template function, and initial state:

```js
alp.define('counter', pathAttr => `
  <div>
    <button @click="count++">+</button>
    <span x-text="count"></span>
    <button @click="save({ count })">Save</button>
  </div>
`, {
  count: 0,
  async onPing(occasion) {
    if (occasion === 'mount' || occasion === 'path') {
      const data = await this.load();
      if (data) this.count = data.count;
    }
  }
});
```

Use in HTML:
```html
<alp-counter></alp-counter>
<alp-counter path="custom.path"></alp-counter>
```

The component name becomes `<alp-{name}>`. Default path is `alp.{name}`, override with `path` attribute.

---

## Working with Data

### Component-Scoped Operations

Inside a component, use `this.save()`, `this.load()`, `this.del()` to work with the component's current path:

```js
// Save to current path
await this.save({ count: 42 });

// Load from current path
const data = await this.load();

// Delete current path
await this.del();
```

### Global Operations

Use `alp.saveRecord()`, `alp.loadRecord()`, `alp.deleteRecord()` to work with any path:

```js
// Save to specific path
await alp.saveRecord('bills.electric-jan', { amount: 120 });

// Load from specific path
const data = await alp.loadRecord('bills.electric-jan');

// Delete specific path
await alp.deleteRecord('bills.electric-jan');

// Load all records, grouped by namespace
const catalog = await alp.load();
// Returns: { bills: [...], alp: [...], ... }
```

Records are stored with a `name` key following the convention `namespace.identifier`. The framework groups records by the first segment (namespace) when loading all data.

---

## Multi-Database Paths

Paths support multiple databases and stores using a qualified format:

```
[database/][store:]recordPath
```

### Path Formats

| Format | Example | Resolves To |
|--------|---------|-------------|
| Record only | `bills.jan` | AlpDB → alp → bills.jan |
| Store-qualified | `data:bills.jan` | AlpDB → data → bills.jan |
| Fully qualified | `Work/data:bills.jan` | Work → data → bills.jan |
| DB with default store | `Work/:bills.jan` | Work → alp → bills.jan |

### Path Terminology

- **Record Path**: Just the identifier (`bills.jan`)
- **Qualified Path**: Store + record (`data:bills.jan`)
- **Full Path**: Database + store + record (`Work/data:bills.jan`)

### Creating Databases and Stores

Databases and stores must be explicitly created before use:

```js
// Create a new database with stores
await alp.createDb('Work', ['invoices', 'expenses']);

// Add a store to an existing database
await alp.createStore('AlpDB', 'archive');

// List available databases
alp.listDbs();  // ['AlpDB', 'Work']

// List stores in a database
alp.listStores('Work');  // ['invoices', 'expenses']
```

### Working with Multi-DB Paths

```js
// Save to different store in default database
await alp.saveRecord('archive:bills.old', data);

// Save to different database
await alp.saveRecord('Work/invoices:2024.jan', data);

// Load from qualified path
const invoice = await alp.loadRecord('Work/invoices:2024.jan');

// Load all records (grouped by db/store)
const all = await alp.load();
// { 'AlpDB/alp': [...], 'AlpDB/archive': [...], 'Work/invoices': [...] }

// Filter by database or store
const workRecords = await alp.load({ db: 'Work' });
const archiveRecords = await alp.load({ store: 'archive' });
```

### Path Validation

Referencing a non-existent database or store throws a descriptive error:

```js
await alp.saveRecord('Unknown/store:record', data);
// Error: Database 'Unknown' not found. Use alp.createDb('Unknown', ['store']) to create it.

await alp.saveRecord('newStore:record', data);
// Error: Store 'newStore' not found in database 'AlpDB'. Use alp.createStore('AlpDB', 'newStore') to create it.
```

### Path Utilities

```js
// Parse a path into components
alp.parsePath('Work/data:bills.jan');
// { db: 'Work', store: 'data', record: 'bills.jan', full: 'Work/data:bills.jan', isDefaultDb: false, isDefaultStore: false }

// Build a path from components (omits defaults)
alp.buildPath('AlpDB', 'alp', 'bills.jan');  // 'bills.jan'
alp.buildPath('AlpDB', 'data', 'bills.jan'); // 'data:bills.jan'
alp.buildPath('Work', 'data', 'bills.jan');  // 'Work/data:bills.jan'

// Check if path is valid (db/store exist)
alp.isValidPath('Work/data:bills.jan');  // true/false
```

### Component Paths

Components can bind to any valid path:

```html
<!-- Default: AlpDB/alp -->
<alp-counter></alp-counter>

<!-- Different store -->
<alp-counter path="archive:counters.main"></alp-counter>

<!-- Different database -->
<alp-counter path="Work/data:counters.work"></alp-counter>
```

The ping system normalizes paths internally, so `bills.jan` and `AlpDB/alp:bills.jan` both notify the same registered components.

---

## The Ping System

All component lifecycle and communication flows through `onPing(occasion, data)`. This creates a unified event model:

```js
async onPing(occasion, data) {
  switch (occasion) {
    case 'mount':
      // Component initialized (awaited)
      this.widget = await this.createWidget();
      break;
    case 'path':
      // Path changed, reload data
      const record = await this.load();
      this.applyData(record);
      break;
    case 'save-record':
      // Another component saved to our path
      this.applyData(data);
      break;
    case 'delete-record':
      // Record at our path was deleted
      this.clear();
      break;
  }
}
```

### Common Occasions

| Occasion | When | Awaited? |
|----------|------|----------|
| `'mount'` | Component initialization | Yes |
| `'path'` | Path changed | No |
| `'save-record'` | Record saved at path | No |
| `'delete-record'` | Record deleted at path | No |
| `'data'` | Custom ping (default) | No |

Only `'mount'` is awaited because initialization must complete before the component declares ready. Everything else is fire-and-forget notification.

### External Pings

Send data to any component by path:

```js
// Default occasion is 'data'
alp.ping('my.path', { key: 'value' });

// Custom occasion
alp.ping('my.path', { key: 'value' }, 'refresh');
```

---

## Component Lifecycle

Components go through a specific initialization sequence:

1. **Connected** — Web component connects to DOM
2. **Render** — Template rendered with Alpine directives
3. **Mount** — `x-init` calls `mount($el)`, sets up component
4. **onPing('mount')** — Awaited initialization hook
5. **declareReady()** — Flushes queued calls, fires `onPing('ready')`

### Finding Components

Use `this.find(selector)` within a component or `alp.find(selector)` globally:

```js
// Inside a component
const child = this.find('alp-child');
child.doSomething();  // Queued if not ready, immediate if ready

// Await to ensure ready
const child = await this.find('alp-child');
console.log(child.path);  // Safe - component is ready

// Global find
const inspector = alp.find('alp-inspector');
inspector.refresh();
```

Both return a thenable proxy for components not yet ready. Method calls are queued and replayed once the component declares ready. This eliminates race conditions during initialization.

---

## Fills (Template Helpers)

Pre-built UI snippets using DaisyUI classes:

```js
const { btn, modal, toolbar, tip, pathInput } = alp.fills;

// Button with icon
btn(['sm', 'primary'], 'Save', 'save()', 'ph-floppy-disk')

// Modal wrapper
modal(`<div>content</div>`)

// Tooltip
tip(['bottom', 'xs'], '<button>Hover</button>', 'Tip text')

// Path input field
pathInput()
```

Modifier arrays support size (`xs/sm/md/lg/xl`), color (`primary/secondary/error`), and positioning.

---

## Kits (Utility Loaders)

Async loaders for third-party libraries:

```js
// JSON editor
const editor = await alp.kit.jse({
  target: el,
  props: { mode: 'tree', content: { json: {} } }
});

// Tabulator table
const table = await alp.kit.tb({
  target: el,
  data: [],
  columns: []
});

// Compression
const compressed = await alp.kit.brotli.compress(data);

// Text utilities
const hash = await alp.kit.text.sha256(str);
```

Kits handle CDN loading, initialization, and provide a consistent API.

---

## Boot Sequence

```
alp.js (entry)
  └─ Create proxy queues (window.alp, alp.kit, alp.fills)
  └─ Load CDN deps (Tailwind, DaisyUI, Dexie, Tabulator, Phosphor icons)
  └─ Import core.js → bind real alp to proxy
  └─ Import components/index.js → load each component
  └─ Load Alpine.js last (triggers alpine:init)
```

The proxy queue allows calling methods before implementations load. Calls are queued and replayed once bound. This lets you reference `alp.kit.jse()` in component definitions even though the kit loader hasn't loaded yet.

---

## Debug & Internals

### Console Capture

Core.js intercepts console methods and stores the last 100 entries in `alp.consoleLogs`:

```js
alp.consoleLogs
// [{ type: 'log', time: '10:32:15 AM', args: '...' }, ...]
```

Useful for building in-app debug panels or capturing errors before devtools opened.

### Inspector

The framework includes an inspector component that auto-mounts a settings icon in the bottom-right corner. Click to browse all stored records, edit data with a JSON editor, and monitor saves/deletes in real-time.

### Direct Database Access

The default Dexie instance is exposed for advanced queries:

```js
// Get all records from default store
await alp.db.alp.toArray()

// Query by prefix
await alp.db.alp.where('name').startsWith('bills.').toArray()
```

For multi-database access, use the database management API:

```js
// Check what databases/stores exist
alp.listDbs();           // ['AlpDB', 'Work']
alp.listStores('Work');  // ['invoices', 'expenses']

// Check existence
alp.hasDb('Work');              // true
alp.hasStore('Work', 'invoices'); // true
```

---

## Example: Counter Component

Here's a complete example showing common patterns:

```js
alp.define('counter', pathAttr => `
  <div class="card p-4">
    <div class="flex gap-2 items-center">
      <button @click="count--" class="btn">-</button>
      <div x-text="count" class="text-xl"></div>
      <button @click="count++" class="btn">+</button>
    </div>
    <div class="mt-2">
      <button @click="save({ count })" class="btn btn-primary">Save</button>
      <button @click="load().then(d => d && (count = d.count))" class="btn">Load</button>
    </div>
    <div class="text-xs" x-text="_path"></div>
  </div>
`, {
  count: 0,

  async onPing(occasion) {
    if (occasion === 'mount' || occasion === 'path') {
      const data = await this.load();
      if (data) this.count = data.count;
    }
    if (occasion === 'save-record') {
      this.count = data.count;
    }
  }
});
```

This counter:
- Increments/decrements a count
- Saves/loads from IndexedDB at its path
- Reloads when path changes
- Updates when another component saves to its path
- Shows current path for debugging
