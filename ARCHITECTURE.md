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
| `find(selector)` | querySelector within el |
| `save(data)` | Save to current path |
| `load()` | Load from current path |
| `del()` | Delete current path |
| `onPing(occasion, data)` | Override: unified handler for all lifecycle events |
| `declareReady()` | Signals initialization complete |

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
