import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  DocumentState,
  JsonNode,
  NodeType,
  ObjectEntry,
} from '../state'

type PrimitiveEditorProps = {
  node: Extract<JsonNode, { type: 'string' | 'number' | 'boolean' | 'null' }>
  onCommit: (value: string | number | boolean | null, newType?: NodeType) => void
}

function PrimitiveEditor({ node, onCommit }: PrimitiveEditorProps) {
  const [draft, setDraft] = useState(() => (node.type === 'null' ? '' : String(node.value)))
  const [type, setType] = useState<NodeType>(node.type)
  useEffect(() => {
    setDraft(node.type === 'null' ? '' : String(node.value))
    setType(node.type)
  }, [node.type, node.value])

  const commit = () => {
    if (type === 'string') return onCommit(draft, type)
    if (type === 'number') {
      const num = Number(draft)
      if (Number.isNaN(num)) return
      return onCommit(num, type)
    }
    if (type === 'boolean') {
      return onCommit(draft === 'true', type)
    }
    return onCommit(null, 'null')
  }

  return (
    <div className="primitive-editor">
      <select value={type} onChange={(e) => setType(e.target.value as NodeType)}>
        <option value="string">string</option>
        <option value="number">number</option>
        <option value="boolean">boolean</option>
        <option value="null">null</option>
      </select>
      {type === 'boolean' ? (
        <select value={draft} onChange={(e) => setDraft(e.target.value)}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : type === 'null' ? (
        <input value="null" disabled />
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
        />
      )}
      {type === 'boolean' || type === 'null' ? (
        <button type="button" className="ghost" onClick={commit}>
          Apply
        </button>
      ) : null}
    </div>
  )
}

type AddRowProps = {
  parentId: string
  parentType: 'object' | 'array'
  onAdd: (key: string | undefined, type: NodeType) => void
}

function AddRow({ parentId, parentType, onAdd }: AddRowProps) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [type, setType] = useState<NodeType>('string')
  useEffect(() => {
    setKey('')
    setType('string')
  }, [parentId])
  const submit = () => {
    onAdd(parentType === 'object' ? key : undefined, type)
    setOpen(false)
    setKey('')
    setType('string')
  }
  const helperText =
    parentType === 'object'
      ? 'Add a new key/value inside this object.'
      : 'Add a new item to this array.'
  return (
    <div className="add-row">
      <div className="add-row-hint">{helperText}</div>
      {open ? (
        <div className="add-row-form">
          {parentType === 'object' ? (
            <input
              placeholder="Key name (required)"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          ) : null}
          <select value={type} onChange={(e) => setType(e.target.value as NodeType)}>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="null">null</option>
            <option value="object">object</option>
            <option value="array">array</option>
          </select>
          <button type="button" onClick={submit}>
            Add
          </button>
          <button type="button" className="ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="ghost" onClick={() => setOpen(true)}>
          + Add {parentType === 'object' ? 'property' : 'item'}
        </button>
      )}
    </div>
  )
}

export type TreeNodeProps = {
  doc: DocumentState
  nodeId: string
  label: string
  expanded: Set<string>
  selectedId?: string
  searchMatches: string[]
  activeMatchId?: string
  visibleSet?: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onRename: (parentId: string, childId: string, newKey: string) => void
  onEditPrimitive: (nodeId: string, value: string | number | boolean | null, newType?: NodeType) => void
  onAdd: (parentId: string, parentType: 'object' | 'array', key: string | undefined, type: NodeType) => void
  onDelete: (parentId: string, childId: string) => void
  onMoveInArray?: (parentId: string, childId: string, direction: -1 | 1) => void
  parentId?: string
  parentType?: 'object' | 'array'
  indexInParent?: number
  level?: number
}

export function TreeNode({
  doc,
  nodeId,
  label,
  expanded,
  selectedId,
  searchMatches,
  activeMatchId,
  onToggle,
  onSelect,
  onRename,
  onEditPrimitive,
  onAdd,
  onDelete,
  onMoveInArray,
  parentId,
  parentType,
  indexInParent,
  visibleSet,
  level = 1,
}: TreeNodeProps) {
  const node = doc.nodes[nodeId]
  if (visibleSet && !visibleSet.has(nodeId)) return null
  const isExpanded = expanded.has(nodeId)
  const isSelected = selectedId === nodeId
  const isMatch = searchMatches.includes(nodeId)
  const isActiveMatch = activeMatchId === nodeId
  const rowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isSelected) {
      rowRef.current?.focus()
    }
  }, [isSelected])

  const isPrimitive =
    node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null'
  const humanLabel =
    {
      object: 'Object',
      array: 'Array',
      string: 'Text',
      number: 'Number',
      boolean: 'Boolean',
      null: 'Null',
    }[node.type]
  const childCount =
    node.type === 'object'
      ? `${node.entries.length} ${node.entries.length === 1 ? 'property' : 'properties'}`
      : node.type === 'array'
        ? `${node.items.length} ${node.items.length === 1 ? 'item' : 'items'}`
        : ''
  const rawPreview =
    node.type === 'string'
      ? `"${node.value}"`
      : node.type === 'number'
        ? String(node.value)
        : node.type === 'boolean'
          ? node.value
            ? 'true'
            : 'false'
          : node.type === 'null'
            ? 'null'
            : ''
  const valuePreview = rawPreview.length > 40 ? `${rawPreview.slice(0, 37)}...` : rawPreview
  const badgeSuffix = childCount || (isPrimitive ? 'Value' : '')
  const typeBadge = (
    <span className={`type-badge type-${node.type}`}>
      {humanLabel}
      {badgeSuffix ? ` · ${badgeSuffix}` : ''}
    </span>
  )
  const labelControl =
    parentType === 'object' && parentId ? (
      <input
        className="node-label-input"
        value={label}
        aria-label="Property name"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onRename(parentId, nodeId, e.target.value)}
      />
    ) : (
      <span className="node-label">{label}</span>
    )

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && (node.type === 'object' || node.type === 'array')) {
      event.preventDefault()
      onToggle(nodeId)
      return
    }
    if (event.key === 'ArrowRight' && (node.type === 'object' || node.type === 'array')) {
      event.preventDefault()
      if (!isExpanded) {
        onToggle(nodeId)
      } else {
        const nextId =
          node.type === 'object' ? node.entries[0]?.childId : node.type === 'array' ? node.items[0] : undefined
        if (nextId) onSelect(nextId)
      }
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (isExpanded && (node.type === 'object' || node.type === 'array')) {
        onToggle(nodeId)
      } else if (parentId) {
        onSelect(parentId)
      }
      return
    }
    if (event.key === 'Delete' && parentId) {
      event.preventDefault()
      onDelete(parentId, nodeId)
    }
  }

  return (
    <div className="tree-node">
      <div
        className={`node-row ${isSelected ? 'selected' : ''} ${isMatch ? 'match' : ''} ${
          isActiveMatch ? 'active-match' : ''
        }`}
        ref={rowRef}
        tabIndex={isSelected ? 0 : -1}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={node.type === 'object' || node.type === 'array' ? isExpanded : undefined}
        aria-posinset={indexInParent !== undefined ? indexInParent + 1 : undefined}
        aria-level={level}
        onClick={() => {
          onSelect(nodeId)
          rowRef.current?.focus()
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="node-main">
          {node.type === 'object' || node.type === 'array' ? (
            <button
              className="node-toggle"
              aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
              onClick={(e) => {
                e.stopPropagation()
                onToggle(nodeId)
              }}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="node-toggle placeholder" aria-hidden="true">
              •
            </span>
          )}
          <div className="node-body">
            <div className="node-topline">
              <div className="node-title">
                {labelControl}
                <span className="node-subtitle">
                  {node.type === 'object' || node.type === 'array' ? 'Container' : 'Editable value'}
                </span>
              </div>
              {typeBadge}
            </div>
            <div className="node-meta-row">
              {childCount ? (
                <span className="node-meta-chip">{childCount}</span>
              ) : (
                <span className="node-meta-chip">Value</span>
              )}
              {valuePreview ? <span className="value-pill">{valuePreview}</span> : null}
              <span className="node-hint">
                {node.type === 'object' || node.type === 'array'
                  ? 'Use the caret to open and explore items.'
                  : 'Change the type or value with the controls here.'}
              </span>
            </div>
          </div>
        </div>
        <div className="node-actions">
          {isPrimitive ? (
            <div className="node-editor">
              <div className="mini-label">Value</div>
              <PrimitiveEditor node={node} onCommit={(value, t) => onEditPrimitive(nodeId, value, t)} />
            </div>
          ) : null}
          {parentId ? (
            <button
              className="ghost danger"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(parentId, nodeId)
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {node.type === 'object' && isExpanded ? (
        <div className="node-children">
          {(visibleSet ? node.entries.filter((entry) => visibleSet.has(entry.childId)) : node.entries).map(
            (entry: ObjectEntry) => (
              <div key={entry.childId} className="object-child">
                <TreeNode
                  doc={doc}
                  nodeId={entry.childId}
                  label={entry.key}
                  expanded={expanded}
                  selectedId={selectedId}
                  searchMatches={searchMatches}
                  activeMatchId={activeMatchId}
                  visibleSet={visibleSet}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onRename={onRename}
                  onEditPrimitive={onEditPrimitive}
                  onAdd={onAdd}
                  onDelete={onDelete}
                  onMoveInArray={onMoveInArray}
                  parentId={node.id}
                  parentType="object"
                  level={level + 1}
                />
              </div>
            ),
          )}
          <AddRow parentId={node.id} parentType="object" onAdd={(key, type) => onAdd(node.id, 'object', key, type)} />
        </div>
      ) : null}

      {node.type === 'array' && isExpanded ? (
        <div className="node-children">
          {node.items.map((childId, index) =>
            visibleSet && !visibleSet.has(childId) ? null : (
              <div key={childId} className="object-child array-child">
                <div className="array-controls">
                  <span className="index-chip">[{index}]</span>
                  <div className="reorder-buttons">
                    <button
                      className="ghost icon-only"
                      title="Move up"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        onMoveInArray?.(node.id, childId, -1)
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="ghost icon-only"
                      title="Move down"
                      disabled={index === node.items.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        onMoveInArray?.(node.id, childId, 1)
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <TreeNode
                  doc={doc}
                  nodeId={childId}
                  label={`[${index}]`}
                  expanded={expanded}
                  selectedId={selectedId}
                  searchMatches={searchMatches}
                  activeMatchId={activeMatchId}
                  visibleSet={visibleSet}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onRename={onRename}
                  onEditPrimitive={onEditPrimitive}
                  onAdd={onAdd}
                  onDelete={onDelete}
                  onMoveInArray={onMoveInArray}
                  parentId={node.id}
                  parentType="array"
                  indexInParent={index}
                  level={level + 1}
                />
              </div>
            ),
          )}
          <AddRow parentId={node.id} parentType="array" onAdd={(key, type) => onAdd(node.id, 'array', key, type)} />
        </div>
      ) : null}
    </div>
  )
}
