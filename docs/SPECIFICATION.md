# JSON Visualizer & Editor Web App — Phase 1 Specification (React-only)

## 1. Purpose

Create a client-only React web app that allows users to paste or import JSON, visualize it as an editable hierarchy, make edits safely, and generate a live output JSON that can be copied/exported. All data is stored locally in the browser.

## 2. In Scope

* Paste/type JSON input, parse and validate.
* Visualize JSON as a navigable hierarchy (tree view).
* Edit JSON in the tree (keys/values), add/remove nodes, reorder arrays (optional).
* Live output JSON (pretty and minified) reflecting current state.
* Copy-to-clipboard and download/export `.json`.
* Client-side persistence (local snippets + last-opened document).
* Utilities: format, minify, sort keys, expand/collapse, search/filter.
* Undo/redo.

## 3. Out of Scope

* Authentication/accounts.
* Server-side persistence.
* Sharing/collaboration.
* Database hosting or querying.

## 4. Personas & Core Use Cases

### Personas

* Developer inspecting/editing API payloads.
* Support/ops user cleaning JSON quickly.

### Core Use Cases

1. Paste JSON → parse → view/edit tree → copy output.
2. Import a `.json` file → edit → export `.json`.
3. Fix invalid JSON with guided parse errors.
4. Save/reopen local snippets and resume last session.

## 5. Functional Requirements

## 5.1 Input & Parsing

### Input sources

* Text input area (paste/type).
* File import (`.json`, optionally `.txt`).

### Parsing behavior

* Parse standard JSON into an in-memory model.
* Supported types: object, array, string, number, boolean, null.
* On parse failure:

  * Show error message.
  * Provide line/column when available.
  * Do not overwrite the last valid document state.

### Formatting

* Pretty print with configurable indentation (2/4 spaces).
* Minify output.

## 5.2 Visualization (Tree View)

* Tree view representing object/array hierarchy.
* Node display:

  * Object nodes: key/value entries.
  * Array nodes: indexed elements.
  * Primitive leaf nodes: string/number/bool/null.
* Expand/collapse per node.
* Global controls:

  * Expand all
  * Collapse all
* Visual indicators:

  * Type badge (object/array/string/number/bool/null)
  * Child counts (object key count, array length)

## 5.3 Editing

Edits apply to the internal document model and immediately update live output.

### Supported edit operations

* **Primitive edits**

  * Edit string, number, boolean, null.
  * Validate number input to be JSON-compliant.
* **Object key edits**

  * Rename a key.
  * Enforce uniqueness within the containing object.
* **Add nodes**

  * Add property to object.
  * Add element to array (append; insert-at-index optional).
* **Delete nodes**

  * Remove object property.
  * Remove array element.
* **Reorder**

  * Reorder array elements (buttons or drag/drop; drag/drop optional).
* **Utilities**

  * Sort object keys A→Z (per object or entire document; choose one or both).

### Validation rules

* Object keys must be unique within a single object.
* Numbers must parse to valid JSON numbers.
* Tree edits must never produce invalid JSON state.

## 5.4 Live Output

* Output panel shows:

  * Pretty JSON (default)
  * Minified JSON (toggle)
* Actions:

  * Copy to clipboard (with success/failure feedback)
  * Download `.json` file
  * Optional “Copy minified” separate action

## 5.5 Search & Navigation

* Search by:

  * Key substring
  * Value substring (stringified for primitives; for objects/arrays search within descendants optional)
* Match UX:

  * Show match count.
  * Next/previous navigation.
  * Auto-expand ancestors of current match.
  * Optional “filter mode” to show only matches + ancestors.

## 5.6 Undo/Redo

* Undo/redo across tree edit operations.
* Minimum capacity: 50 operations (configurable).
* UI controls:

  * Toolbar buttons
  * Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)

## 5.7 Client-Side Persistence

### What to persist

* Last-opened document state (autosave).
* Snippet library:

  * Name
  * Updated time
  * Content

### Storage strategy

* LocalStorage for metadata (snippet list, settings).
* IndexedDB for snippet content (recommended), to support larger JSON.

### Snippet operations

* Create snippet from current document.
* Rename snippet.
* Overwrite/update snippet from current document.
* Delete snippet.
* Load snippet into editor.

## 6. Non-Functional Requirements

### Performance

* Target JSON size: 1–5 MB usable on modern browsers.
* Tree rendering must avoid freezing:

  * Virtualize rendering for large trees (preferred).
  * If virtualization isn’t implemented in MVP, show warnings and degrade gracefully (e.g., limit auto-expand).

### Accessibility

* Keyboard navigation support for tree:

  * Arrow keys: move/expand/collapse
  * Enter: edit
  * Delete: remove node (confirm optional)
* ARIA roles for tree semantics.
* Focus management for inline editors.

### Security & Privacy

* No network dependency required.
* Never execute user content.
* Provide “Clear local data” action.

## 7. Architecture (Phase 1)

## 7.1 Module Overview (React-only)

* **Parser/Formatter**

  * `parseJson(text) -> { ok, value | error }`
  * `formatJson(value, indent) -> string`
  * `minifyJson(value) -> string`
* **Document Model & Operations**

  * Tree-based internal representation with stable node IDs.
  * Operations: edit/add/delete/move/rename.
* **State Management**

  * Single source of truth for document state + UI state.
  * Reducer-based approach recommended (`useReducer` or store library).

## 7.2 Suggested Internal JSON Representation

Use a normalized node store to support stable selection and efficient updates:

* `rootId: string`
* `nodesById: Record<string, Node>`
* `Node`:

  * `id: string`
  * `type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'`
  * `value`:

    * object: ordered `{ key: string, childId: string }[]`
    * array: ordered `childId[]`
    * primitive: `string | number | boolean | null`

UI state (separate from document):

* `expandedNodeIds: Set<string>`
* `selectedNodeId?: string`
* `searchQuery`, `searchMatches[]`, `activeMatchIndex`
* `undoStack[]`, `redoStack[]`

## 7.3 Raw Text Editor Mode (Recommended)

Provide two synchronized modes:

* Raw JSON editor (text)
* Tree editor

Rules:

* If raw JSON parses successfully: replace document model with parsed model.
* If raw JSON is invalid: show error and keep last valid document model.
* Tree edits update the output panel (and optionally update raw editor text in “pretty” form).

## 8. UI Requirements

### Layout

* Three-pane layout (responsive):

  * Left: Input / Snippets
  * Center: Tree editor
  * Right: Output + Tools
* Mobile: panes become tabs or stacked sections.

### Core Components

* `JsonTextInput` (paste/type, optional auto-parse toggle)
* `ParseErrorBanner` (message + line/col)
* `TreeView`

  * `TreeNodeRow`
  * Inline editors for key/value
  * Context actions (add/delete)
* `Toolbar`

  * Format, Minify toggle, Sort keys, Expand/Collapse, Undo/Redo
* `SearchPanel`
* `OutputPanel` (copy, download)
* `LocalSnippetManager` (list/create/load/delete)

## 9. Error Handling

### Parsing

* Display parse error with best-available location (line/column).
* Provide non-destructive behavior (don’t destroy the last valid state).
* Optional guidance (no automatic “fixing” unless explicitly invoked).

### Editing

* Prevent duplicate object keys and show inline error.
* Reject invalid numbers and show inline error.

## 10. Testing & Acceptance Criteria

### Unit Tests

* Parse/format/minify correctness.
* Document operations:

  * add/remove/rename/edit
  * undo/redo correctness
* Search match logic and ancestor expansion.

### UI Tests

* Paste/parse/edit/copy flow.
* Import/export flow.
* Large JSON smoke test (ensure no crash).

### Acceptance Criteria

* Paste valid JSON → tree displays correctly.
* Tree edits (value/key/add/remove) update output immediately.
* Copy and download work.
* Invalid JSON shows useful error without losing last valid document.
* Search navigates matches and expands ancestors.
* Undo/redo works for edits.
* Snippets save and reload locally.
