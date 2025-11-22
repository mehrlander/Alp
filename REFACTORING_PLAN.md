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
- Installer system for lazy-loading libraries
- Standard UI elements library

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
│   ├── alp-base.js           # Base component patterns/mixins
│   └── alp-std.js            # Standard UI elements
├── components/
│   ├── alp-text.js           # Text component
│   ├── alp-rows.js           # Table component
│   └── alp-inspector.js      # Inspector component
├── utils/
│   └── installers.js         # Library installers
└── index.html                # Demo page
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
  define()         // Component factory
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

### File: `core/alp-std.js`

**Exports**:
```javascript
export const std = {
  pathInput: () => `...`,
  // Future additions:
  // deleteButton: () => `...`,
  // saveButton: () => `...`,
  // toolbar: (items) => `...`
}
```

**Responsibilities**:
- Reusable UI element templates
- Consistent styling
- Common interaction patterns

### File: `utils/installers.js`

**Exports**:
```javascript
export const installer = {
  jse: opts => ...,
  tt: opts => ...,
  // Future: codemirror, ace, etc.
}
```

**Responsibilities**:
- Lazy loading of heavy dependencies
- Promise-based initialization
- Consistent API across installers

## Phase 2: Extract Components

### File: `components/alp-text.js`

**Structure**:
```javascript
import { alp } from '../core/alp-core.js';
import { std } from '../core/alp-std.js';

export function defineTextComponent() {
  alp.define("text",
    x => `...template...`,
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
import { std } from '../core/alp-std.js';
import { installer } from '../utils/installers.js';

export function defineRowsComponent() {
  alp.define("rows",
    x => `...template...`,
    {
      tt: null,
      dataSchema: '{ rows: Array }',

      validateData(data) {
        return data.hasOwnProperty('rows');
      },

      async onNavigate(data) {
        await this.loadTable();
      },

      async loadTable() { ... },
      savedCallback(data) { ... },
      addRow() { ... },

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
import { installer } from '../utils/installers.js';

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
  <!-- CDN links -->
</head>
<body>
  <div class="max-w mx-auto p-2">
    <alp-text class="m-2"></alp-text>
    <alp-rows class="m-2"></alp-rows>
  </div>

  <alp-inspector class="fixed bottom-4 right-4"></alp-inspector>

  <script type="module">
    import { alp } from './core/alp-core.js';
    import './core/alp-std.js';
    import './utils/installers.js';

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
import { std } from '../core/alp-std.js';
import { installer } from '../utils/installers.js';

export function defineJsonComponent() {
  alp.define("json",
    x => `
      <div class="flex justify-between items-center mb-2">
        <div class="text-sm font-semibold">JSON Editor</div>
        ${std.pathInput()}
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
          this.editor = await installer.jse({
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
