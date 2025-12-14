type ControlBarProps = {
  canUndo: boolean
  canRedo: boolean
  canExpandAll: boolean
  canCollapseAll: boolean
  canSort: boolean
  expandAllDisabledReason?: string
  onUndo: () => void
  onRedo: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onSortCurrent: () => void
  onSortAll: () => void
}

export function ControlBar({
  canUndo,
  canRedo,
  canExpandAll,
  canCollapseAll,
  canSort,
  expandAllDisabledReason,
  onUndo,
  onRedo,
  onExpandAll,
  onCollapseAll,
  onSortCurrent,
  onSortAll,
}: ControlBarProps) {
  return (
    <div className="control-bar">
      <div className="control-group">
        <span className="control-label">History</span>
        <button onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      </div>
      <div className="control-group">
        <span className="control-label">Structure</span>
        <button onClick={onExpandAll} disabled={!canExpandAll} title={expandAllDisabledReason}>
          Expand all
        </button>
        <button onClick={onCollapseAll} disabled={!canCollapseAll}>
          Collapse all
        </button>
        <button onClick={onSortCurrent} disabled={!canSort}>
          Sort keys (current)
        </button>
        <button onClick={onSortAll} disabled={!canSort}>
          Sort all keys
        </button>
      </div>
    </div>
  )
}
