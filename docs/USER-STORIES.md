1. JSON input + parsing foundation

* As a user, I can paste/type JSON and trigger parsing so I can load data into the app.
  Acceptance criteria:
* Text input panel with Parse action (and optional “auto-parse” toggle).
* Valid JSON loads into app state.
* Invalid JSON shows error message and line/column when available.
* Invalid parse does not overwrite last valid document state.

2. Document model + core edit operations

* As a user, I can edit JSON in a structured way so I can make safe changes without breaking JSON.
  Acceptance criteria:
* Internal normalized node model with stable IDs (object/array/primitives).
* Operations implemented: edit primitive, add object property, add array element, delete node, rename object key.
* Enforces unique keys within an object and valid number input.
* All operations update the document state deterministically.

3. Tree viewer (read-only) with expand/collapse

* As a user, I can browse the JSON hierarchy so I can understand the structure quickly.
  Acceptance criteria:
* Tree renders objects/arrays/primitives with type indicators and counts.
* Per-node expand/collapse and global expand/collapse.
* Selection highlighting for the active node.
* Handles nested data without crashing.

4. Tree editing UI (inline editors + actions)

* As a user, I can edit keys/values and add/remove nodes directly in the tree so I can work efficiently.
  Acceptance criteria:
* Inline editing for keys and primitive values.
* Add/remove actions available via buttons or context menu.
* Validation feedback inline (duplicate key, invalid number).
* Editing commits/cancels predictably (Enter/Escape) and maintains focus.

5. Live output panel (pretty/minified) + copy/download

* As a user, I can see the live JSON output and easily copy/export it.
  Acceptance criteria:
* Output updates immediately after any tree edit.
* Pretty/minified toggle.
* Copy-to-clipboard with success/failure feedback.
* Download current JSON as `.json`.

6. Search + match navigation in tree

* As a user, I can search for keys/values and jump between results so I can find what I need in large JSON.
  Acceptance criteria:
* Search by key substring and value substring.
* Shows match count and next/previous navigation.
* Auto-expands ancestors of current match and scrolls it into view.
* Clear search returns tree to prior expand state (or reasonable default).

7. Undo/redo

* As a user, I can undo and redo changes so I can experiment safely.
  Acceptance criteria:
* Undo/redo works for all edit operations (edit/add/delete/rename).
* Toolbar buttons + Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z.
* Stack depth at least 50 operations.
* Undo restores both data and necessary UI selection state.

8. Local persistence + snippet management

* As a user, I can save and reload snippets locally so I can reuse JSON later.
  Acceptance criteria:
* Autosave last-opened document (toggle optional).
* Snippet list with create, rename, delete, load, overwrite/update.
* Stores metadata in LocalStorage and content in IndexedDB (or a single storage strategy if simpler).
* “Clear local data” action.

9. Import/export workflows + utilities polish

* As a user, I can import/export JSON files and apply common formatting utilities.
  Acceptance criteria:
* File import loads JSON and shows parse errors if invalid.
* Export/download works from toolbar and/or output panel.
* Utility actions: format (indent 2/4), minify, sort keys (scope defined: current object or entire doc).
* Reasonable handling/warnings for very large JSON (e.g., disable expand-all, show “large file” banner).

If you want these to fit in 8 units instead of 9, merge (9) into (5) and/or merge (3) + (4) into a single “Tree view + editing UI” story.
