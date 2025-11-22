# Refactoring Plan: Base and Derived Components

## Goal

Extract reusable patterns from the monolithic HTML file into:
1. **Base Component System**: Core infrastructure and patterns
2. **Derived Component Library**: Specific component implementations
3. **Clear Separation**: Each component in its own module

## Current State Analysis

### What's Reusable (Base)

From the current implementation, these patterns are universal:

**Core Infrastructure**:
- Database setup and connection
- State registration system
- Component registry
- CRUD operations (load/loadRecord/saveRecord/deleteRecord)

**Utils** (expandable helpers):
- Fills: Reusable UI template snippets
- Installers: Lazy-loading for heavy libraries

**Base Component Class**:
- `Alp` HTMLElement extension
- Template rendering lifecycle
- Alpine.js initialization

**Base Component State** (README.md:96-104):
- `el`, `path`, `defaultPath`
- `find()`, `save()`, `load()`, `del()`
- Path navigation pattern

**Patterns**:
- Path-based data routing
- Data validation before use
- savedCallback lifecycle hook
- Blur/enter handlers for path input

### What's Specific (Derived)

Each component adds:
- Unique template structure
- Component-specific state properties
- Custom `nav()` implementation
- Data structure schema
- UI interaction handlers

## Proposed Architecture

```
alp/
├── core/
│   ├── alp-core.js           # Core system (db, define, base class)
│   └── alp-base.js           # Base component patterns/mixins
├── components/
│   ├── alp-text.js           # Text component
│   ├── alp-rows.js           # Table component
│   └── alp-inspector.js      # Inspector component
├── utils/
│   ├── fills.js              # Reusable UI template fills
│   └── installers.js         # Library installers
└── index.html                # Demo page
```

### Utils Concept

Both `fills` and `installers` follow a similar expandable pattern - they provide reusable pieces that components can pull in:

- **fills**: Template snippets that "fill in" common UI patterns
- **installers**: Lazy-loaded library initializers

Accessed via unified API:
```javascript
alp.fill('pathInput')           // Returns HTML string
alp.fill('toolbar', items)      // Can accept arguments
alp.install('jse', opts)        // Returns Promise<instance>
alp.install('tt', opts)         // Returns Promise<instance>
```

## Phase 1: Extract Core System

### File: `core/alp-core.js`

**Exports**:
```javascript
export const alp = {
  db,              // Dexie instance
  components,      // Registry
  load(),
  loadRecord(),
  saveRecord(),
  deleteRecord(),
  safeStore(),
  define(),        // Component factory
  fill(name, ...args),    // Get UI template fill
  install(name, opts)     // Lazy-load library
}
```

**Responsibilities**:
- Database initialization
- Record CRUD operations
- Component registration
- State management
- Base `Alp` class definition

**Key Changes**:
- Convert IIFE to ES module
- Export public API
- Keep component lifecycle management

### File: `core/alp-base.js`

**Exports**:
```javascript
export const baseComponentMixin = {
  el: null,
  defaultPath: null,
  path: null,
  find(s) { ... },
  save(data) { ... },
  load() { ... },
  del() { ... },

  // New: standardized nav pattern
  async navigate() {
    const data = await this.load();
    if (data && !this.validateData(data)) {
      alert(`Path contains incompatible data (expected ${this.dataSchema})`);
      this.path = this.defaultPath;
      return;
    }
    await this.onNavigate(data);
  },

  // To be implemented by derived components
  validateData(data) { return true; },
  onNavigate(data) { },
  dataSchema: 'unknown structure'
}
```

**Responsibilities**:
- Standard component state
- Navigation pattern with validation
- Template methods for customization

### File: `utils/fills.js`

**Exports**:
```javascript
export const fills = {
  pathInput: () => `<input x-model="path" @blur="nav()" @keydown.enter="$el.blur()"
    class="input input-xs input-ghost text-xs text-right w-48" placeholder="path">`,

  // Future additions:
  deleteButton: () => `<button @click="del()" class="btn btn-xs btn-error">Delete</button>`,
  saveIndicator: () => `<span x-show="saving" class="loading loading-spinner loading-xs"></span>`,
  toolbar: (items) => `<div class="flex gap-1">${items.map(i => fills[i]?.() || '').join('')}</div>`
}
```

**Responsibilities**:
- Reusable UI template snippets
- Consistent styling across components
- Composable via toolbar pattern

### File: `utils/installers.js`

**Exports**:
```javascript
export const installers = {
  jse: opts => import('https://unpkg.com/vanilla-jsoneditor/standalone.js')
    .then(({createJSONEditor}) => createJSONEditor(opts)),

  tt: opts => new Promise(resolve => {
    const table = new Tabulator(opts.target, opts.props);
    table.on("tableBuilt", () => resolve(table));
  }),

  // Future: codemirror, ace, monaco, etc.
}
```

**Responsibilities**:
- Lazy loading of heavy dependencies
- Promise-based initialization
- Consistent API across installers

### Integration in `alp-core.js`

```javascript
import { fills } from '../utils/fills.js';
import { installers } from '../utils/installers.js';

// In alp object:
fill(name, ...args) {
  const fn = fills[name];
  if (!fn) throw new Error(`Unknown fill: ${name}`);
  return fn(...args);
},

install(name, opts) {
  const fn = installers[name];
  if (!fn) throw new Error(`Unknown installer: ${name}`);
  return fn(opts);
}
```

## Phase 2: Extract Components

### File: `components/alp-text.js`

**Structure**:
```javascript
import { alp } from '../core/alp-core.js';

export function defineTextComponent() {
  alp.define("text",
    x => `
      <div class="flex justify-between items-center mb-2">
        <div class="text-sm font-semibold">text</div>
        ${alp.fill('pathInput')}
      </div>
      <textarea x-model="text" @blur="save({text})"
        class="textarea textarea-bordered w-full h-24"
        placeholder="text..."></textarea>
    `,
    {
      text: '',
      dataSchema: '{ text: string }',

      validateData(data) {
        return data.hasOwnProperty('text');
      },

      async onNavigate(data) {
        this.text = data?.text || '';
      },

      nav() {
        this.navigate(); // Use base implementation
      }
    }
  );
}
```

**Benefits**:
- Self-contained
- Clear dependencies
- Uses base patterns
- Easy to test in isolation

### File: `components/alp-rows.js`

**Structure**:
```javascript
import { alp } from '../core/alp-core.js';

export function defineRowsComponent() {
  alp.define("rows",
    x => `
      <div class="flex justify-between items-center mb-3">
        <button @click="addRow()" class="btn btn-primary btn-sm">Add Row</button>
        ${alp.fill('pathInput')}
      </div>
      <div name="rows-table"></div>
    `,
    {
      tt: null,
      dataSchema: '{ rows: Array }',

      validateData(data) {
        return data.hasOwnProperty('rows');
      },

      async onNavigate(data) {
        await this.loadTable();
      },

      async loadTable() {
        const loaded = await this.load();
        const data = loaded?.rows || [];
        // ... column detection logic
        if (this.tt) {
          this.tt.setColumns(cols);
          this.tt.setData(data);
        } else {
          this.tt = await alp.install('tt', {
            target: this.find('[name="rows-table"]'),
            props: { data, layout: "fitColumns", columns: cols }
          });
          // ... event bindings
        }
      },
      savedCallback(data) { this.loadTable(); },
      addRow() { this.tt?.addRow({}); },

      nav() {
        this.navigate();
      }
    }
  );
}
```

### File: `components/alp-inspector.js`

**Structure**:
```javascript
import { alp } from '../core/alp-core.js';

export function defineInspectorComponent() {
  alp.define("inspector",
    x => `...template...`,
    {
      // Inspector doesn't use standard nav pattern
      // as it manages all paths, not just one
      show: 0,
      store: 'alp',
      // ... rest of state
      async refresh() { ... },
      goStore() { ... },
      // ... rest of methods
    }
  );
}
```

**Note**: Inspector is special - it doesn't follow the standard single-path pattern since it manages all data.

## Phase 3: Create Demo Page

### File: `index.html`

**Structure**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Alpine IndexedDB Components</title>
  <!-- CDN links for Tailwind, DaisyUI, Dexie, Tabulator, Phosphor -->
</head>
<body>
  <div class="max-w mx-auto p-2">
    <alp-text class="m-2"></alp-text>
    <alp-rows class="m-2"></alp-rows>
  </div>

  <alp-inspector class="fixed bottom-4 right-4"></alp-inspector>

  <script type="module">
    // Core system (includes fills and installers)
    import { alp } from './core/alp-core.js';

    // Components
    import { defineTextComponent } from './components/alp-text.js';
    import { defineRowsComponent } from './components/alp-rows.js';
    import { defineInspectorComponent } from './components/alp-inspector.js';

    // Make alp available globally for Alpine
    window.alp = alp;

    // Register components
    defineTextComponent();
    defineRowsComponent();
    defineInspectorComponent();
  </script>

  <script defer src="https://unpkg.com/alpinejs"></script>
</body>
</html>
```

Note: `alp-core.js` imports and exposes fills and installers internally, so components only need the single `alp` import.

## Benefits of This Refactoring

### 1. Modularity
- Each component is self-contained
- Easy to add/remove components
- Clear dependencies

### 2. Reusability
- Base patterns extracted
- Standard UI elements shared
- Installer system reusable

### 3. Testability
- Components can be tested in isolation
- Mock data easily injected
- Clear interfaces

### 4. Maintainability
- One file per concern
- Easy to locate code
- Reduced cognitive load

### 5. Extensibility
- New components follow clear pattern
- Base system provides scaffolding
- Standard elements grow over time

## Creating New Components

After refactoring, creating a new component would follow this pattern:

```javascript
// components/alp-json.js
import { alp } from '../core/alp-core.js';

export function defineJsonComponent() {
  alp.define("json",
    x => `
      <div class="flex justify-between items-center mb-2">
        <div class="text-sm font-semibold">JSON Editor</div>
        ${alp.fill('pathInput')}
      </div>
      <div name="json-editor" class="h-64"></div>
    `,
    {
      editor: null,
      dataSchema: '{ json: any }',

      validateData(data) {
        return data.hasOwnProperty('json');
      },

      async onNavigate(data) {
        if (!this.editor) {
          this.editor = await alp.install('jse', {
            target: this.find('[name="json-editor"]'),
            props: {
              mode: "tree",
              content: { json: data?.json || {} },
              onChange: (content) => this.save({ json: content.json })
            }
          });
        } else {
          this.editor.set({ json: data?.json || {} });
        }
      },

      nav() {
        this.navigate();
      }
    }
  );
}
```

### Key Pattern

Components only need to import `alp` - everything else flows through it:
- `alp.fill(name, ...args)` for UI template snippets
- `alp.install(name, opts)` for lazy-loaded libraries
- `alp.define()` for component registration
- `this.save()`, `this.load()`, `this.del()` for data operations

## Migration Path

### Option A: Big Bang
1. Create all new files
2. Update index.html
3. Test everything
4. Replace README.md with new version

### Option B: Incremental (Recommended)
1. Create `core/alp-core.js` (keep as IIFE initially)
2. Create `components/alp-text.js` (import and call define)
3. Test that text component works
4. Repeat for other components
5. Convert core to module once all components migrated
6. Update index.html last

## Next Steps

1. ✅ Review and approve this plan
2. ⏳ Choose migration path (A or B)
3. ⏳ Create directory structure
4. ⏳ Extract core system
5. ⏳ Extract first component (alp-text)
6. ⏳ Test and iterate
7. ⏳ Extract remaining components
8. ⏳ Update documentation
9. ⏳ Create examples/tutorials

## Questions to Resolve

1. **Module System**: Use ES modules or keep as IIFE with globals?
2. **File Organization**: The proposed structure, or something different?
3. **Backward Compatibility**: Keep README.md as working example?
4. **Testing**: Add test framework now or later?
5. **Build Step**: Keep as raw files or add bundling?
6. **TypeScript**: Add type definitions?
7. **NPM Package**: Package for distribution?
