import type { DocumentState, NodeType } from '../state'
import { TreeNode } from './TreeNode'

type TreePanelProps = {
  doc: DocumentState | null
  expanded: Set<string>
  selectedId?: string
  searchQuery: string
  searchFilterOnly: boolean
  searchMatches: string[]
  activeMatch: number
  activeMatchId?: string
  visibleSet?: Set<string>
  largeJson: boolean
  nodeCount: number
  onToggleNode: (id: string) => void
  onSelectNode: (id: string) => void
  onRename: (parentId: string, childId: string, newKey: string) => void
  onEditPrimitive: (nodeId: string, value: string | number | boolean | null, newType?: NodeType) => void
  onAddNode: (parentId: string, parentType: 'object' | 'array', key: string | undefined, type: NodeType) => void
  onDeleteNode: (parentId: string, childId: string) => void
  onMoveInArray: (parentId: string, childId: string, direction: -1 | 1) => void
  onSearchChange: (query: string) => void
  onToggleFilterMode: (enabled: boolean) => void
  onMoveMatch: (direction: 1 | -1) => void
}

export function TreePanel({
  doc,
  expanded,
  selectedId,
  searchQuery,
  searchFilterOnly,
  searchMatches,
  activeMatch,
  activeMatchId,
  visibleSet,
  largeJson,
  nodeCount,
  onToggleNode,
  onSelectNode,
  onRename,
  onEditPrimitive,
  onAddNode,
  onDeleteNode,
  onMoveInArray,
  onSearchChange,
  onToggleFilterMode,
  onMoveMatch,
}: TreePanelProps) {
  return (
    <section className="panel tree-panel">
      <div className="panel-header">
        <div>
          <h2>Tree view</h2>
          <p className="muted">Inline edit, add, remove, and search the hierarchy.</p>
        </div>
        <div className="search-row">
          <input
            placeholder="Search keys or values"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={searchFilterOnly}
              disabled={!searchQuery.trim()}
              onChange={(e) => onToggleFilterMode(e.target.checked)}
            />
            Filter matches only
          </label>
          <div className="match-info">
            {searchMatches.length ? `${activeMatch + 1} / ${searchMatches.length}` : '0 matches'}
          </div>
          <button onClick={() => onMoveMatch(-1)} disabled={!searchMatches.length}>
            Prev
          </button>
          <button onClick={() => onMoveMatch(1)} disabled={!searchMatches.length}>
            Next
          </button>
        </div>
      </div>
      <div className="tree-guide">
        <div>
          <div className="helper-label">How to explore</div>
          <p className="muted small">
            Expand objects and arrays with the caret, click a row to focus it, and edit values inline. Use the add
            controls beneath each branch to grow the tree.
          </p>
        </div>
        <div className="legend-row">
          <span className="legend-pill object">Object · grouped keys</span>
          <span className="legend-pill array">Array · ordered items</span>
          <span className="legend-pill value">Value · text / number / boolean / null</span>
        </div>
      </div>
      {largeJson ? (
        <div className="banner warning">
          Large JSON detected ({nodeCount} nodes). Expand-all is disabled; use search and filter mode to stay fast.
        </div>
      ) : null}
      <div className="tree-container" role="tree" aria-label="JSON tree">
        {doc ? (
          <TreeNode
            doc={doc}
            nodeId={doc.rootId}
            label="root"
            expanded={expanded}
            selectedId={selectedId}
            searchMatches={searchMatches}
            activeMatchId={activeMatchId}
            visibleSet={visibleSet}
            onToggle={onToggleNode}
            onSelect={onSelectNode}
            onRename={onRename}
            onEditPrimitive={onEditPrimitive}
            onAdd={onAddNode}
            onDelete={onDeleteNode}
            onMoveInArray={onMoveInArray}
          />
        ) : (
          <div className="placeholder">Parse JSON to start editing.</div>
        )}
      </div>
    </section>
  )
}
