# Alp Framework - Standalone Library

A single-file JavaScript framework for building reactive, data-persistent components using Alpine.js and IndexedDB.

## Features

- **Zero Configuration**: Just source one file and start building
- **Auto-Loading**: All dependencies loaded automatically (Tailwind, Alpine.js, DaisyUI, Dexie, etc.)
- **Path-Based Data**: Navigate between different data contexts
- **Automatic Persistence**: All component data saved to IndexedDB
- **Reactive State**: Powered by Alpine.js for minimal boilerplate
- **Built-in Dev Tools**: Inspector component for viewing/editing all data
- **Lightweight API**: Simple `alp.define()` for creating components

## Quick Start

### 1. Source from GitHub

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/alp.js"></script>
</head>
<body>
  <alp-hello></alp-hello>
  <alp-inspector class="fixed bottom-4 right-4"></alp-inspector>
</body>
</html>
```

### 2. Define Your Component

```html
<script>
window.addEventListener('load', () => {
  alp.define("hello",
    // Template (x is the component path, e.g., "alp.hello")
    x => `
      <input x-model="message" @input="save({message})" class="input">
      <p x-text="message"></p>
    `,
    // Initial state
    {
      message: '',
      // nav() is called when component mounts or path changes
      async nav() {
        const data = await this.load();
        this.message = data?.message || '';
      }
    }
  );
});
</script>
```

### 3. That's It!

Your component is now reactive and all data is automatically persisted to IndexedDB. Refresh the page - your data is still there!

## Core API

### `alp.define(name, template, state)`

Define a new component.

**Parameters:**
- `name` (string): Component name (will become `<alp-{name}>`)
- `template` (function): Returns HTML template string
- `state` (object): Component state and methods

**Base State (automatically provided):**
```javascript
{
  el: null,              // DOM element reference
  path: 'alp.{name}',   // Current data path
  defaultPath: '...',    // Original path
  find(selector),        // querySelector helper
  save(data),            // Save to current path
  load(),                // Load from current path
  del(),                 // Delete current path
  nav()                  // Your navigation handler (required)
}
```

### `alp.fill(name, ...args)`

Use pre-built UI templates.

**Available fills:**
- `pathInput()` - Path navigation input
- `deleteButton()` - Delete button
- `saveIndicator()` - Loading spinner
- `toolbar(...items)` - Compose toolbar
- `btn(label, click, icon, classes)` - Button with icon

**Example:**
```javascript
alp.fill('btn', 'Save', 'save()', 'floppy-disk', 'btn-primary')
// → <button @click="save()" class="btn btn-sm btn-primary">
//     <i class="ph ph-floppy-disk"></i>
//     <span>Save</span>
//   </button>
```

### `alp.install(name, opts)`

Lazy-load heavy libraries.

**Available installers:**
- `jse` - vanilla-jsoneditor (JSON tree editor)
- `tt` - Tabulator (data tables)

**Example:**
```javascript
this.editor = await alp.install('jse', {
  target: this.find('[name="editor"]'),
  props: {
    mode: 'tree',
    content: { json: {} },
    onChange: (content) => this.save(content.json)
  }
});
```

### Data Operations

```javascript
// Load all records, grouped by store
const storeMap = await alp.load();
// → { alp: [{ key: 'alp.text', sig: 'text', data: {...} }] }

// Load single record
const data = await alp.loadRecord('alp.text');

// Save record (triggers callbacks)
await alp.saveRecord('alp.text', { text: 'hello' });

// Delete record
await alp.deleteRecord('alp.text');
```

## Built-in Components

### `<alp-inspector>`

Developer tool for viewing and editing all IndexedDB data.

**Usage:**
```html
<alp-inspector class="fixed bottom-4 right-4"></alp-inspector>
```

**Features:**
- Browse all stores and records
- Edit data with JSON tree editor
- Live sync with components
- Delete records

## Styling

The framework auto-loads:
- **Tailwind CSS** - Utility-first CSS
- **DaisyUI** - Component library (based on Tailwind)
- **Phosphor Icons** - Icon library (use `<i class="ph ph-{icon-name}">`)

**Example:**
```html
<div class="card bg-base-200 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Title</h2>
    <button class="btn btn-primary">
      <i class="ph ph-check"></i>
      Click me
    </button>
  </div>
</div>
```

## Advanced Patterns

### Path Navigation

Components can switch between different data paths:

```javascript
alp.define("text",
  x => `
    ${alp.fill('pathInput')}
    <textarea x-model="text" @blur="save({text})"></textarea>
  `,
  {
    text: '',
    async nav() {
      const data = await this.load(); // Loads from this.path
      this.text = data?.text || '';
    }
  }
);
```

Change the path input to switch data contexts (e.g., `alp.text` → `alp.text.draft`).

### Reactive Callbacks

Components can react to external changes:

```javascript
{
  savedCallback(data) {
    // Called when this component's data is saved from elsewhere
    // (e.g., from the inspector)
    this.text = data?.text || '';
  }
}
```

### Component Communication

Access other components via the global registry:

```javascript
// In one component
await alp.saveRecord('alp.shared', { value: 42 });

// In another component
const sharedData = await alp.loadRecord('alp.shared');
```

### Custom Fills

Extend the fill system:

```javascript
// Not directly exposed, but you can create helper functions
function myCustomFill() {
  return `<div class="custom">...</div>`;
}

alp.define("mycomp",
  x => `${myCustomFill()}`,
  { ... }
);
```

## Examples

See the included example files:
- `minimal-example.html` - Simplest possible component
- `example.html` - Full demo with text editor, counter, and todo list

## Dependencies

All automatically loaded via CDN:
- Alpine.js 3.x
- Dexie 4.x (IndexedDB wrapper)
- Tailwind CSS (browser mode)
- DaisyUI 5.x
- Phosphor Icons
- Tabulator Tables
- vanilla-jsoneditor

## Browser Support

Requires modern browsers with:
- ES6+ JavaScript
- Custom Elements v1
- IndexedDB
- CSS Grid/Flexbox

## License

MIT

## Credits

Built with:
- [Alpine.js](https://alpinejs.dev/) - Reactive framework
- [Dexie](https://dexie.org/) - IndexedDB wrapper
- [Tailwind CSS](https://tailwindcss.com/) - Utility CSS
- [DaisyUI](https://daisyui.com/) - Component library
- [Phosphor Icons](https://phosphoricons.com/) - Icon set
