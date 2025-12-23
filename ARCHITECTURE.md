# Alp Framework Architecture

## Overview

Alp is a lightweight frontend framework combining Alpine.js, Web Components, and Dexie (IndexedDB). It provides reactive data binding tied to persistent storage paths.

## Boot Sequence

```
alp.js (entry)
  └─ Creates proxy queues for window.alp, alp.kit, alp.fills
  └─ Loads CDN deps (Tailwind, DaisyUI, Dexie, Tabulator, Phosphor icons)
  └─ Imports core.js → binds real alp to proxy
  └─ Imports components/index.js → loads each component
  └─ Loads Alpine.js last (triggers alpine:init)
```

The proxy queue allows calling `alp.kit.jse()` before the real implementation loads - calls are queued and replayed once bound.

## Core Concepts

### Paths & Storage

All data lives in Dexie with a single `name` key. Convention: `namespace.identifier`

```js
alp.saveRecord('bills.electric-jan', { amount: 120 })
alp.loadRecord('bills.electric-jan')  // → { amount: 120 }
alp.deleteRecord('bills.electric-jan')
```

#### Data Operations Reference

| Method | Scope | Returns |
|--------|-------|---------|
| `this.load()` | Component | Record at component's `path` |
| `this.save(data)` | Component | Saves to component's `path` |
| `this.del()` | Component | Deletes component's `path` |
| `alp.loadRecord(name)` | Global | Record at specific path |
| `alp.saveRecord(name, data)` | Global | Saves to specific path |
| `alp.deleteRecord(name)` | Global | Deletes specific path |
| `alp.load()` | Global | **All** records grouped by namespace |

The `alp.load()` function returns the entire database grouped by namespace prefix:

```js
const catalog = await alp.load();
// {
//   bills: [
//     { key: 'bills.electric-jan', sig: 'electric-jan', data: { amount: 120 } },
//     { key: 'bills.water-jan', sig: 'water-jan', data: { amount: 45 } }
//   ],
//   alp: [
//     { key: 'alp.inspector', sig: 'inspector', data: {...} }
//   ]
// }
```

This is used by inspector-type components that need to browse all stored data.

### Path Registry

Components subscribe to paths for reactive updates:

```js
reg(path, subscriber)    // Subscribe
unreg(path, subscriber)  // Unsubscribe
ping(path, data, occasion?)  // Triggers onPing(occasion, data) - occasion defaults to 'data'
```

### Ping System (Unified Event Model)

All component lifecycle and data events flow through a single `onPing(occasion, data)` handler. This eliminates the need for separate lifecycle methods and creates a unified communication model.

```js
// Component handles all events via onPing
async onPing(occasion, data) {
  switch (occasion) {
    case 'mount':
      // Initialize component (awaited by mount())
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
    case 'ready':
      // Component declared ready, configure from attrs
      this.configureFromAttrs(data);
      break;
  }
}
```

#### Occasion Reference

| Occasion | Source | Data | Awaited? |
|----------|--------|------|----------|
| `'mount'` | `mount()` | - | Yes |
| `'path'` | path setter | - | No |
| `'save-record'` | `saveRecord` → `ping` | saved record | No |
| `'delete-record'` | `deleteRecord` → `ping` | - | No |
| `'ready'` | `declareReady` → `ping` | host attrs | No |
| `'data'` | `alp.ping()` default | anything | No |
| custom | `alp.ping()` | anything | No |

**Key insight**: `'mount'` is the only awaited occasion because initialization must complete before `declareReady()`. Everything else is fire-and-forget notification.

#### External Pings

```js
// Send data to a component
alp.ping('my.path', { key: 'value' });  // occasion defaults to 'data'
alp.ping('my.path', { key: 'value' }, 'custom');  // custom occasion
```

## Defining Components

```js
// components/my-thing.js
import { alp } from '../core.js';

alp.define('my-thing', path => `
  <div>
    <input x-model="value" @blur="save({ value })">
    <button @click="doStuff()">Go</button>
  </div>
`, {
  // Initial state
  value: '',

  // Unified event handler - called for all lifecycle events
  async onPing(occasion) {
    if (occasion === 'mount' || occasion === 'path') {
      const data = await this.load();
      if (data) this.value = data.value;
    }
  },

  doStuff() {
    console.log(this.value);
  }
});
```

Register in `components/index.js`:
```js
export const components = ['inspector.js', 'bill-table.js', 'my-thing.js'];
```

Use in HTML:
```html
<alp-my-thing path="custom.path"></alp-my-thing>
```

### Component Data Object (from `mk()`)

| Property/Method | Description |
|----------------|-------------|
| `el` | The Alpine root element |
| `host` | The `<alp-*>` custom element |
| `path` | Current storage path (getter/setter - setting triggers `onPing('path')`) |
| `_path` | Internal path storage |
| `_isReady` | Boolean indicating if component has completed initialization |
| `find(selector)` | querySelector within el (returns thenable proxy for nested alp components) |
| `save(data)` | Save to current path |
| `load()` | Load record from current path |
| `del()` | Delete current path |
| `onPing(occasion, data)` | Override: unified handler for all lifecycle events |
| `mount(el)` | Called by x-init; sets up component, awaits `onPing('mount')`, then `declareReady()` |
| `declareReady()` | Signals initialization complete, flushes queued calls, fires `onPing('ready')` |

### Global Find

`alp.find(selector)` searches the entire document (vs `this.find()` which searches within a component):

```js
// Get a component anywhere in the document
const inspector = alp.find('alp-inspector');
inspector.refresh();
```

### Thenable Proxy Pattern

Both `this.find()` and `alp.find()` return a thenable proxy for alp components that aren't yet ready. This allows safe interaction with components during initialization:

```js
// Method calls are queued until component is ready
const child = this.find('alp-child');
child.doSomething();  // Queued if not ready, executed immediately if ready

// Await to get the actual component data object
const child = await this.find('alp-child');
console.log(child.path);  // Safe - component is definitely ready
```

The proxy queues method calls and flushes them once `declareReady()` is called. This eliminates race conditions when parent components interact with children during mount.

## Fills (Template Helpers)

Pre-built UI snippets using DaisyUI classes:

```js
const { btn, modal, toolbar, tip, pathInput } = alp.fills;

// Button with icon
btn(['sm', 'primary'], 'Save', 'save()', 'ph-floppy-disk')

// Modal wrapper
modal(`<div>content</div>`)

// Tooltip
tip(['bottom', 'xs'], '<button>Hover me</button>', 'Tooltip text')
```

Modifier arrays support: `xs/sm/md/lg/xl`, `primary/secondary/error`, positioning, etc.

## Kits (Utility Loaders)

Async loaders for third-party libs:

```js
// JSON editor
const editor = await alp.kit.jse({ target: el, props: { mode: 'tree', content: { json: {} } } });

// Tabulator table
const table = await alp.kit.tb({ target: el, data: [], columns: [] });

// Compression
const compressed = await alp.kit.brotli.compress(data);
const original = await alp.kit.brotli.decompress(compressed);

// Text utilities
const hash = await alp.kit.text.sha256(str);
```

## Debug & Internals

### Console Capture

Core.js intercepts console methods (`log`, `warn`, `error`, `info`) and stores the last 100 entries in `alp.consoleLogs`:

```js
alp.consoleLogs
// [
//   { type: 'log', time: '10:32:15 AM', args: '📦 Alp deps loaded' },
//   { type: 'error', time: '10:32:16 AM', args: 'Something went wrong' },
//   ...
// ]
```

Useful for building in-app debug panels or capturing errors that occurred before devtools opened.

### Inspector Auto-Notification

The `ping()` function automatically notifies `alp-inspector` (if present) whenever records are saved or deleted:

```js
// In core.js ping():
if (occasion === 'save-record' || occasion === 'delete-record') {
  const inspector = globalFind('alp-inspector');
  inspector?.onPing(occasion, { path: p, data });
}
```

This allows the inspector to refresh its catalog view without manual subscription to every path.

### Direct Database Access

The Dexie database instance is exposed for advanced operations:

```js
alp.db.alp.toArray()           // Get all records
alp.db.alp.where('name').startsWith('bills.').toArray()  // Query by prefix
```

## File Structure

```
alp.js          # Entry point, proxy setup, boot
core.js         # Alp class, define(), data ops, path registry
utils/
  fills.js      # Template helpers
  kit.js        # Kit exports
  kits/*.js     # Individual kit loaders
components/
  index.js      # Component manifest
  *.js          # Component definitions
```
