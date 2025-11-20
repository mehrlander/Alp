# Alpine IndexedDB Components - Current Implementation Documentation

## Overview

This is a proof-of-concept framework for creating data-centric Alpine.js components with automatic IndexedDB persistence. Components can navigate between different data paths, and all state is automatically persisted and synchronized.

## Architecture

### Core System (`window.alp`)

The global `alp` object provides the foundation for the component system:

#### Database Layer
- **Database**: Dexie-based IndexedDB named `AlpDB`
- **Schema**: Single object store `alp` with primary key `name`
- **Record Format**: `{ name: string, data: any }`
  - `name`: Path-based identifier (e.g., "alp.text", "alp.rows.users")
  - `data`: Component-specific data structure

#### Core Functions

**Data Operations** (README.md:60-73):
- `load()`: Loads all records and groups by store prefix
- `loadRecord(name)`: Retrieves a single record by path
- `saveRecord(name, data)`: Persists data and triggers callbacks
- `deleteRecord(name)`: Removes a record and triggers callbacks

**Component Definition** (README.md:85-111):
- `define(tagEnd, tpl, initialState)`: Creates a new component type
  - Registers custom element as `alp-{tagEnd}`
  - Creates Alpine store at `alp.{tagEnd}`
  - Merges initialState with base component methods

**Utilities**:
- `installer`: Lazy loaders for heavy libraries (JSON Editor, Tabulator)
- `std`: Standard UI elements (currently just `pathInput`)
- `safeStore()`: Fallback for missing stores

### Base Component Class (`Alp`)

**HTMLElement Extension** (README.md:48-58):
```javascript
class Alp extends HTMLElement {
  connectedCallback() { ... }
  tpl() { return "" }
}
```

**Lifecycle**:
1. Element added to DOM → `connectedCallback()`
2. Waits for `alpine:init` event
3. Calls `tpl()` to get HTML template
4. Initializes Alpine.js on the element

### Component State Pattern

Each component defined via `alp.define()` receives this base state (README.md:96-104):

```javascript
{
  el: null,                    // Reference to DOM element
  defaultPath: path,           // Original path (e.g., "alp.text")
  path: path,                  // Current navigation path
  find(s) { ... },            // querySelector helper
  save(data) { ... },         // Save to current path
  load() { ... },             // Load from current path
  del() { ... },              // Delete current path
  nav() { ... }               // Component-specific navigation handler
}
```

## Implemented Components

### 1. alp-text (README.md:115-137)

**Purpose**: Simple text editor with path-based persistence

**Data Structure**: `{ text: string }`

**State**:
- `text`: Current text content

**Behavior**:
- `nav()`: Loads data from path, validates structure
- Auto-saves on textarea blur

**UI**:
- Path input (top-right)
- Textarea with blur-to-save

### 2. alp-rows (README.md:139-185)

**Purpose**: Dynamic table editor using Tabulator

**Data Structure**: `{ rows: Array<Record<string, any>> }`

**State**:
- `tt`: Tabulator instance
- `rows`: Array of row objects

**Behavior**:
- `nav()`: Loads data and validates structure
- `loadTable()`: Creates/updates Tabulator with dynamic columns
- `savedCallback()`: Refreshes table when data changes externally
- Auto-saves on cell edit, row add, row delete

**Features**:
- Dynamic column detection from data
- Inline editing
- Add/delete rows
- Default columns: `key`, `value`

### 3. alp-inspector (README.md:187-256)

**Purpose**: Developer tool for viewing/editing all IndexedDB data

**UI Components**:
- Floating gear icon trigger
- Modal overlay with JSON editor
- Store selector dropdown
- Page navigation buttons
- Clear button

**State**:
- `show`: Modal visibility
- `store`: Current store name
- `storeMap`: All data grouped by store
- `page`: Current path being edited
- `jse`: JSON editor instance

**Behavior**:
- `open()`: Shows modal, initializes editor, refreshes data
- `refresh()`: Reloads all data from IndexedDB
- `goStore()`: Switches to a different store namespace
- `goPage()`: Loads specific path into editor
- `handleChange()`: Saves edits and syncs to Alpine stores
- `clear()`: Deletes current page

## Key Concepts

### Path-based Navigation

Components use a path string to determine which data to load/save:
- Default: `alp.{componentType}` (e.g., "alp.text")
- Can navigate to: `alp.{componentType}.{suffix}` (e.g., "alp.text.greeting")
- Path input allows runtime navigation
- Invalid path data shows alert and reverts to default

### Data Type Safety

Components validate that loaded data has expected properties:
```javascript
if (data && !data.hasOwnProperty('text')) {
  alert('Path contains incompatible data');
  this.path = this.defaultPath;
}
```

### Component Communication

The `savedCallback()` pattern allows components to react to external data changes:
- Inspector saves data → triggers callback on component
- Component reloads/refreshes its UI

### Automatic Persistence

All saves are logged and stored:
```javascript
console.log(`💾 ${name}:`, data);
```

## Dependencies

- **Alpine.js**: Reactive framework
- **Dexie**: IndexedDB wrapper
- **Tabulator**: Table component (lazy-loaded)
- **vanilla-jsoneditor**: JSON editor (lazy-loaded)
- **Tailwind CSS**: Styling
- **DaisyUI**: Component styles
- **Phosphor Icons**: Icon set

## Data Flow

```
User Interaction
    ↓
Alpine.js State Change
    ↓
Component save() method
    ↓
alp.saveRecord()
    ↓
IndexedDB (Dexie)
    ↓
savedCallback() (if registered)
    ↓
Component UI refresh
```

## Current Strengths

1. **Minimal Boilerplate**: Define components with just template + state
2. **Automatic Persistence**: No manual DB code in components
3. **Path Navigation**: Dynamic data routing within component types
4. **Type Safety**: Basic validation of data structure
5. **Developer Tools**: Inspector provides full DB visibility
6. **Lazy Loading**: Heavy libraries only load when needed
