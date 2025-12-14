import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'

type NodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

type ObjectEntry = { key: string; childId: string }

type JsonNode =
  | { id: string; type: 'object'; entries: ObjectEntry[] }
  | { id: string; type: 'array'; items: string[] }
  | { id: string; type: 'string'; value: string }
  | { id: string; type: 'number'; value: number }
  | { id: string; type: 'boolean'; value: boolean }
  | { id: string; type: 'null'; value: null }

type DocumentState = {
  rootId: string
  nodes: Record<string, JsonNode>
}

type ParseError = { message: string; line?: number; column?: number }
type Notice = { type: 'success' | 'error' | 'info'; message: string }

type SnippetMeta = { id: string; name: string; updatedAt: number }

type HistoryEntry = {
  doc: DocumentState | null
  rawText: string
  expanded: string[]
  selectedId?: string
}

type EditorState = {
  rawText: string
  lastValidText: string
  doc: DocumentState | null
  parseError?: ParseError
  expanded: Set<string>
  selectedId?: string
  searchQuery: string
  searchMatches: string[]
  activeMatch: number
  outputMode: 'pretty' | 'minified'
  indent: number
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  autoParse: boolean
  snippets: SnippetMeta[]
  snippetContents: Record<string, string>
  notice?: Notice
}

type Action =
  | { type: 'SET_RAW_TEXT'; text: string }
  | { type: 'PARSE_TEXT' }
  | { type: 'LOAD_TEXT'; text: string }
  | { type: 'EDIT_PRIMITIVE'; nodeId: string; value: string | number | boolean | null; newType?: NodeType }
  | { type: 'RENAME_KEY'; parentId: string; childId: string; newKey: string }
  | { type: 'ADD_NODE'; parentId: string; parentType: 'object' | 'array'; key?: string; newType: NodeType }
  | { type: 'DELETE_NODE'; parentId: string; childId: string }
  | { type: 'SET_SELECTED'; nodeId?: string }
  | { type: 'TOGGLE_EXPANDED'; nodeId: string }
  | { type: 'EXPAND_ALL' }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'MOVE_MATCH'; direction: 1 | -1 }
  | { type: 'SET_OUTPUT_MODE'; mode: 'pretty' | 'minified' }
  | { type: 'SET_INDENT'; indent: number }
  | { type: 'SORT_KEYS'; scope: 'selected' | 'all' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_AUTOPARSE'; enabled: boolean }
  | { type: 'SAVE_SNIPPET'; name: string }
  | { type: 'LOAD_SNIPPET'; id: string }
  | { type: 'RENAME_SNIPPET'; id: string; name: string }
  | { type: 'DELETE_SNIPPET'; id: string }
  | { type: 'CLEAR_LOCAL' }
  | { type: 'SET_NOTICE'; notice?: Notice }

const DEFAULT_JSON = {
  profile: {
    name: 'Avery Analyst',
    team: 'Product',
    active: true,
  },
  features: ['search', 'edit', 'undo'],
  stats: { saves: 12, snippets: 3, lastEdited: 'today' },
}

const SAMPLE_TEXT = JSON.stringify(DEFAULT_JSON, null, 2)
const LAST_DOC_KEY = 'json-editor:last-doc'
const SNIPPETS_KEY = 'json-editor:snippets'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Math.random().toString(16).slice(2)}`
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: ParseError } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse JSON'
    const positionMatch = message.match(/position (\d+)/i)
    if (positionMatch) {
      const index = Number(positionMatch[1])
      const { line, column } = getLineColumn(text, index)
      return { ok: false, error: { message, line, column } }
    }
    return { ok: false, error: { message } }
  }
}

function getLineColumn(text: string, index: number) {
  const before = text.slice(0, index)
  const lines = before.split('\n')
  const line = lines.length
  const column = lines[lines.length - 1].length + 1
  return { line, column }
}

function buildDocumentFromValue(value: unknown): DocumentState {
  const nodes: Record<string, JsonNode> = {}
  const rootId = buildNode(value, nodes)
  return { rootId, nodes }
}

function buildNode(value: unknown, nodes: Record<string, JsonNode>): string {
  const id = createId()
  if (Array.isArray(value)) {
    const childIds = value.map((item) => buildNode(item, nodes))
    nodes[id] = { id, type: 'array', items: childIds }
    return id
  }
  if (value === null) {
    nodes[id] = { id, type: 'null', value: null }
    return id
  }
  if (typeof value === 'object') {
    const entries: ObjectEntry[] = Object.entries(value as Record<string, unknown>).map(([key, child]) => ({
      key,
      childId: buildNode(child, nodes),
    }))
    nodes[id] = { id, type: 'object', entries }
    return id
  }
  if (typeof value === 'number') {
    nodes[id] = { id, type: 'number', value }
    return id
  }
  if (typeof value === 'boolean') {
    nodes[id] = { id, type: 'boolean', value }
    return id
  }
  nodes[id] = { id, type: 'string', value: String(value) }
  return id
}

function documentToJson(doc: DocumentState): unknown {
  return buildValue(doc, doc.rootId)
}

function buildValue(doc: DocumentState, nodeId: string): unknown {
  const node = doc.nodes[nodeId]
  if (!node) return null
  if (node.type === 'object') {
    const obj: Record<string, unknown> = {}
    node.entries.forEach((entry) => {
      obj[entry.key] = buildValue(doc, entry.childId)
    })
    return obj
  }
  if (node.type === 'array') {
    return node.items.map((childId) => buildValue(doc, childId))
  }
  if (node.type === 'null') return null
  return node.value
}

function formatJson(value: unknown, indent: number) {
  return JSON.stringify(value, null, indent)
}

function minifyJson(value: unknown) {
  return JSON.stringify(value)
}

function snapshotState(state: EditorState): HistoryEntry {
  return {
    doc: state.doc ? structuredClone(state.doc) : null,
    rawText: state.rawText,
    expanded: Array.from(state.expanded),
    selectedId: state.selectedId,
  }
}

function buildParentMap(doc: DocumentState): Record<string, string | undefined> {
  const parents: Record<string, string | undefined> = {}
  const entries = Object.values(doc.nodes)
  entries.forEach((node) => {
    if (node.type === 'object') {
      node.entries.forEach((entry) => {
        parents[entry.childId] = node.id
      })
    }
    if (node.type === 'array') {
      node.items.forEach((childId) => {
        parents[childId] = node.id
      })
    }
  })
  return parents
}

function expandAncestors(targetId: string, parents: Record<string, string | undefined>, expanded: Set<string>) {
  let current: string | undefined = targetId
  while (current) {
    expanded.add(current)
    current = parents[current]
  }
}

function findSearchMatches(doc: DocumentState, query: string): string[] {
  const matches: string[] = []
  const lower = query.toLowerCase()
  const visit = (nodeId: string) => {
    const node = doc.nodes[nodeId]
    if (!node) return
    if (node.type === 'object') {
      node.entries.forEach((entry) => {
        if (entry.key.toLowerCase().includes(lower)) {
          matches.push(entry.childId)
        }
        visit(entry.childId)
      })
      return
    }
    if (node.type === 'array') {
      node.items.forEach(visit)
      return
    }
    const valueString = node.type === 'null' ? 'null' : String(node.value)
    if (valueString.toLowerCase().includes(lower)) {
      matches.push(node.id)
    }
  }
  visit(doc.rootId)
  return matches
}

function applySearch(state: EditorState, docOverride?: DocumentState | null): EditorState {
  const doc = docOverride ?? state.doc
  if (!doc || !state.searchQuery.trim()) {
    return { ...state, searchMatches: [], activeMatch: -1 }
  }
  const matches = findSearchMatches(doc, state.searchQuery.trim())
  const currentActiveId = state.searchMatches[state.activeMatch]
  const nextActiveIndex = currentActiveId ? matches.indexOf(currentActiveId) : -1
  const activeMatch = nextActiveIndex >= 0 ? nextActiveIndex : matches.length ? 0 : -1
  const expanded = new Set(state.expanded)
  const parents = buildParentMap(doc)
  if (matches[activeMatch]) {
    expandAncestors(matches[activeMatch], parents, expanded)
  }
  return { ...state, searchMatches: matches, activeMatch, expanded }
}

function addNodeToDocument(
  state: EditorState,
  parentId: string,
  parentType: 'object' | 'array',
  key: string | undefined,
  newType: NodeType,
): EditorState {
  if (!state.doc) return state
  const doc = structuredClone(state.doc)
  const parent = doc.nodes[parentId]
  if (!parent) return state
  if (parentType === 'object') {
    if (parent.type !== 'object') return state
    if (!key || !key.trim()) {
      return { ...state, notice: { type: 'error', message: 'Key is required for object properties.' } }
    }
    const duplicate = parent.entries.find((entry) => entry.key === key.trim())
    if (duplicate) {
      return { ...state, notice: { type: 'error', message: 'Duplicate key inside this object.' } }
    }
  }
  const childId = createId()
  let newNode: JsonNode
  switch (newType) {
    case 'object':
      newNode = { id: childId, type: 'object', entries: [] }
      break
    case 'array':
      newNode = { id: childId, type: 'array', items: [] }
      break
    case 'string':
      newNode = { id: childId, type: 'string', value: '' }
      break
    case 'number':
      newNode = { id: childId, type: 'number', value: 0 }
      break
    case 'boolean':
      newNode = { id: childId, type: 'boolean', value: false }
      break
    default:
      newNode = { id: childId, type: 'null', value: null }
  }
  doc.nodes[childId] = newNode
  if (parentType === 'object') {
    const objectParent = parent.type === 'object' ? parent : undefined
    if (!objectParent) return state
    objectParent.entries.push({ key: key!.trim(), childId })
  } else {
    const arrayParent = parent.type === 'array' ? parent : undefined
    if (!arrayParent) return state
    arrayParent.items.push(childId)
  }
  return finalizeDocumentChange(state, doc, childId)
}

function deleteNode(state: EditorState, parentId: string, childId: string): EditorState {
  if (!state.doc) return state
  const doc = structuredClone(state.doc)
  const parent = doc.nodes[parentId]
  if (!parent) return state
  const removeSubtree = (id: string) => {
    const node = doc.nodes[id]
    if (!node) return
    if (node.type === 'object') {
      node.entries.forEach((entry) => removeSubtree(entry.childId))
    }
    if (node.type === 'array') {
      node.items.forEach(removeSubtree)
    }
    delete doc.nodes[id]
  }
  removeSubtree(childId)
  if (parent.type === 'object') {
    parent.entries = parent.entries.filter((entry) => entry.childId !== childId)
  }
  if (parent.type === 'array') {
    parent.items = parent.items.filter((id) => id !== childId)
  }
  return finalizeDocumentChange(state, doc, parentId)
}

function renameKey(state: EditorState, parentId: string, childId: string, newKey: string): EditorState {
  if (!state.doc) return state
  const trimmed = newKey.trim()
  if (!trimmed) {
    return { ...state, notice: { type: 'error', message: 'Key cannot be empty.' } }
  }
  const doc = structuredClone(state.doc)
  const parent = doc.nodes[parentId]
  if (!parent || parent.type !== 'object') return state
  const duplicate = parent.entries.find((entry) => entry.key === trimmed && entry.childId !== childId)
  if (duplicate) {
    return { ...state, notice: { type: 'error', message: 'Keys must be unique within the object.' } }
  }
  const target = parent.entries.find((entry) => entry.childId === childId)
  if (!target) return state
  target.key = trimmed
  return finalizeDocumentChange(state, doc, childId)
}

function editPrimitive(
  state: EditorState,
  nodeId: string,
  value: string | number | boolean | null,
  newType?: NodeType,
): EditorState {
  if (!state.doc) return state
  const doc = structuredClone(state.doc)
  const node = doc.nodes[nodeId]
  if (!node || node.type === 'object' || node.type === 'array') return state
  const type = newType ?? node.type
  let nextNode: JsonNode
  switch (type) {
    case 'string':
      nextNode = { id: nodeId, type: 'string', value: String(value ?? '') }
      break
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return { ...state, notice: { type: 'error', message: 'Numbers must be valid JSON numbers.' } }
      }
      nextNode = { id: nodeId, type: 'number', value }
      break
    case 'boolean':
      nextNode = { id: nodeId, type: 'boolean', value: Boolean(value) }
      break
    case 'null':
      nextNode = { id: nodeId, type: 'null', value: null }
      break
    default:
      nextNode = node
  }
  doc.nodes[nodeId] = nextNode
  return finalizeDocumentChange(state, doc, nodeId)
}

function finalizeDocumentChange(state: EditorState, doc: DocumentState, focusId?: string): EditorState {
  const formatted = formatJson(documentToJson(doc), state.indent)
  const base = applySearch(
    {
      ...state,
      doc,
      rawText: formatted,
      lastValidText: formatted,
      parseError: undefined,
      selectedId: focusId ?? state.selectedId,
    },
    doc,
  )
  return withHistory(state, base, true)
}

function sortKeys(state: EditorState, scope: 'selected' | 'all'): EditorState {
  if (!state.doc) return state
  const doc = structuredClone(state.doc)
  const sortObject = (nodeId: string) => {
    const node = doc.nodes[nodeId]
    if (!node) return
    if (node.type === 'object') {
      node.entries.sort((a, b) => a.key.localeCompare(b.key))
      node.entries.forEach((entry) => sortObject(entry.childId))
    }
    if (node.type === 'array') {
      node.items.forEach(sortObject)
    }
  }
  if (scope === 'all') {
    sortObject(doc.rootId)
  } else if (scope === 'selected' && state.selectedId) {
    sortObject(state.selectedId)
  }
  return finalizeDocumentChange(state, doc, state.selectedId)
}

function applyParse(state: EditorState, text: string): EditorState {
  const parsed = parseJson(text)
  if (!parsed.ok) {
    return { ...state, parseError: parsed.error }
  }
  const doc = buildDocumentFromValue(parsed.value)
  const formatted = formatJson(parsed.value, state.indent)
  const expanded = new Set<string>([doc.rootId])
  const base: EditorState = {
    ...state,
    doc,
    parseError: undefined,
    rawText: formatted,
    lastValidText: formatted,
    expanded,
    selectedId: doc.rootId,
  }
  const withSearch = applySearch(base, doc)
  return withHistory(state, withSearch, true)
}

function withHistory(state: EditorState, next: EditorState, push: boolean): EditorState {
  if (!push) return next
  const undo = [snapshotState(state), ...state.undoStack].slice(0, 50)
  return { ...next, undoStack: undo, redoStack: [] }
}

function loadStoredState(): EditorState | null {
  try {
    const raw = localStorage.getItem(LAST_DOC_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const doc: DocumentState | null = parsed.doc ?? null
    const expandedSet: Set<string> = new Set(parsed.expanded ?? [])
    const indent = parsed.indent ?? 2
    const snippets: SnippetMeta[] = JSON.parse(localStorage.getItem(SNIPPETS_KEY) ?? '[]')
    const snippetContents: Record<string, string> = {}
    snippets.forEach((item) => {
      const content = localStorage.getItem(`${SNIPPETS_KEY}:${item.id}`)
      if (content) snippetContents[item.id] = content
    })
    const restored: EditorState = {
      rawText: parsed.rawText ?? SAMPLE_TEXT,
      lastValidText: parsed.lastValidText ?? SAMPLE_TEXT,
      doc,
      expanded: expandedSet,
      selectedId: parsed.selectedId,
      parseError: undefined,
      searchQuery: '',
      searchMatches: [],
      activeMatch: -1,
      outputMode: 'pretty',
      indent,
      undoStack: [],
      redoStack: [],
      autoParse: false,
      snippets,
      snippetContents,
      notice: undefined,
    }
    return restored
  } catch (error) {
    console.error('Unable to restore session', error)
    return null
  }
}

function buildInitialState(): EditorState {
  const restored = loadStoredState()
  if (restored) {
    return applySearch(restored, restored.doc)
  }
  const doc = buildDocumentFromValue(DEFAULT_JSON)
  return {
    rawText: SAMPLE_TEXT,
    lastValidText: SAMPLE_TEXT,
    doc,
    parseError: undefined,
    expanded: new Set([doc.rootId]),
    selectedId: doc.rootId,
    searchQuery: '',
    searchMatches: [],
    activeMatch: -1,
    outputMode: 'pretty',
    indent: 2,
    undoStack: [],
    redoStack: [],
    autoParse: false,
    snippets: [],
    snippetContents: {},
    notice: undefined,
  }
}

function saveToStorage(state: EditorState) {
  try {
    const payload = {
      rawText: state.rawText,
      lastValidText: state.lastValidText,
      doc: state.doc,
      expanded: Array.from(state.expanded),
      selectedId: state.selectedId,
      indent: state.indent,
    }
    localStorage.setItem(LAST_DOC_KEY, JSON.stringify(payload))
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(state.snippets))
    state.snippets.forEach((meta) => {
      const content = state.snippetContents[meta.id]
      if (content !== undefined) {
        localStorage.setItem(`${SNIPPETS_KEY}:${meta.id}`, content)
      }
    })
  } catch (error) {
    console.error('Unable to persist data', error)
  }
}

function editorReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_RAW_TEXT': {
      const next = { ...state, rawText: action.text, parseError: undefined }
      return state.autoParse ? applyParse(next, action.text) : next
    }
    case 'PARSE_TEXT':
      return applyParse(state, state.rawText)
    case 'LOAD_TEXT':
      return applyParse(state, action.text)
    case 'EDIT_PRIMITIVE':
      return editPrimitive(state, action.nodeId, action.value, action.newType)
    case 'RENAME_KEY':
      return renameKey(state, action.parentId, action.childId, action.newKey)
    case 'ADD_NODE':
      return addNodeToDocument(state, action.parentId, action.parentType, action.key, action.newType)
    case 'DELETE_NODE':
      return deleteNode(state, action.parentId, action.childId)
    case 'SET_SELECTED':
      return { ...state, selectedId: action.nodeId }
    case 'TOGGLE_EXPANDED': {
      const expanded = new Set(state.expanded)
      if (expanded.has(action.nodeId)) {
        expanded.delete(action.nodeId)
      } else {
        expanded.add(action.nodeId)
      }
      return { ...state, expanded }
    }
    case 'EXPAND_ALL': {
      if (!state.doc) return state
      const expanded = new Set(Object.keys(state.doc.nodes))
      return { ...state, expanded }
    }
    case 'COLLAPSE_ALL':
      return state.doc ? { ...state, expanded: new Set([state.doc.rootId]) } : state
    case 'SET_SEARCH_QUERY': {
      const next = { ...state, searchQuery: action.query }
      return applySearch(next)
    }
    case 'MOVE_MATCH': {
      if (!state.searchMatches.length) return state
      const nextIndex =
        (state.activeMatch + action.direction + state.searchMatches.length) % state.searchMatches.length
      const expanded = new Set(state.expanded)
      if (state.doc) {
        const parents = buildParentMap(state.doc)
        expandAncestors(state.searchMatches[nextIndex], parents, expanded)
      }
      return { ...state, activeMatch: nextIndex, expanded, selectedId: state.searchMatches[nextIndex] }
    }
    case 'SET_OUTPUT_MODE':
      return { ...state, outputMode: action.mode }
    case 'SET_INDENT': {
      if (!state.doc) return { ...state, indent: action.indent }
      const formatted = formatJson(documentToJson(state.doc), action.indent)
      return { ...state, indent: action.indent, rawText: formatted, lastValidText: formatted }
    }
    case 'SORT_KEYS':
      return sortKeys(state, action.scope)
    case 'UNDO': {
      const previous = state.undoStack[0]
      if (!previous) return state
      const remaining = state.undoStack.slice(1)
      const redo = snapshotState(state)
      const restored: EditorState = {
        ...state,
        doc: previous.doc,
        rawText: previous.rawText,
        expanded: new Set(previous.expanded),
        selectedId: previous.selectedId,
        undoStack: remaining,
        redoStack: [redo, ...state.redoStack].slice(0, 50),
        parseError: undefined,
      }
      return applySearch(restored, restored.doc)
    }
    case 'REDO': {
      const nextEntry = state.redoStack[0]
      if (!nextEntry) return state
      const remaining = state.redoStack.slice(1)
      const undo = snapshotState(state)
      const restored: EditorState = {
        ...state,
        doc: nextEntry.doc,
        rawText: nextEntry.rawText,
        expanded: new Set(nextEntry.expanded),
        selectedId: nextEntry.selectedId,
        redoStack: remaining,
        undoStack: [undo, ...state.undoStack].slice(0, 50),
        parseError: undefined,
      }
      return applySearch(restored, restored.doc)
    }
    case 'SET_AUTOPARSE':
      return { ...state, autoParse: action.enabled }
    case 'SAVE_SNIPPET': {
      if (!state.doc) return { ...state, notice: { type: 'error', message: 'Load or parse JSON first.' } }
      const id = createId()
      const snippet: SnippetMeta = { id, name: action.name || 'Untitled snippet', updatedAt: Date.now() }
      const snippetContents = { ...state.snippetContents, [id]: state.rawText }
      const snippets = [snippet, ...state.snippets]
      return {
        ...state,
        snippets,
        snippetContents,
        notice: { type: 'success', message: 'Snippet saved locally.' },
      }
    }
    case 'LOAD_SNIPPET': {
      const text = state.snippetContents[action.id]
      if (!text) return state
      return applyParse(state, text)
    }
    case 'RENAME_SNIPPET': {
      const snippets = state.snippets.map((s) =>
        s.id === action.id ? { ...s, name: action.name, updatedAt: Date.now() } : s,
      )
      return { ...state, snippets }
    }
    case 'DELETE_SNIPPET': {
      const snippets = state.snippets.filter((s) => s.id !== action.id)
      const { [action.id]: _, ...rest } = state.snippetContents
      return { ...state, snippets, snippetContents: rest }
    }
    case 'CLEAR_LOCAL': {
      localStorage.removeItem(LAST_DOC_KEY)
      state.snippets.forEach((item) => localStorage.removeItem(`${SNIPPETS_KEY}:${item.id}`))
      localStorage.removeItem(SNIPPETS_KEY)
      return buildInitialState()
    }
    case 'SET_NOTICE':
      return { ...state, notice: action.notice }
    default:
      return state
  }
}

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

type TreeNodeProps = {
  doc: DocumentState
  nodeId: string
  label: string
  expanded: Set<string>
  selectedId?: string
  searchMatches: string[]
  activeMatchId?: string
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onRename: (parentId: string, childId: string, newKey: string) => void
  onEditPrimitive: (nodeId: string, value: string | number | boolean | null, newType?: NodeType) => void
  onAdd: (parentId: string, parentType: 'object' | 'array', key: string | undefined, type: NodeType) => void
  onDelete: (parentId: string, childId: string) => void
  parentId?: string
  parentType?: 'object' | 'array'
}

function TreeNode({
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
  parentId,
  parentType,
}: TreeNodeProps) {
  const node = doc.nodes[nodeId]
  const isExpanded = expanded.has(nodeId)
  const isSelected = selectedId === nodeId
  const isMatch = searchMatches.includes(nodeId)
  const isActiveMatch = activeMatchId === nodeId

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

  return (
    <div className="tree-node">
      <div
        className={`node-row ${isSelected ? 'selected' : ''} ${isMatch ? 'match' : ''} ${
          isActiveMatch ? 'active-match' : ''
        }`}
        onClick={() => onSelect(nodeId)}
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
          {node.entries.map((entry) => (
            <div key={entry.childId} className="object-child">
              <TreeNode
                doc={doc}
                nodeId={entry.childId}
                label={entry.key}
                expanded={expanded}
                selectedId={selectedId}
                searchMatches={searchMatches}
                activeMatchId={activeMatchId}
                onToggle={onToggle}
                onSelect={onSelect}
                onRename={onRename}
                onEditPrimitive={onEditPrimitive}
                onAdd={onAdd}
                onDelete={onDelete}
                parentId={node.id}
                parentType="object"
              />
            </div>
          ))}
          <AddRow parentId={node.id} parentType="object" onAdd={(key, type) => onAdd(node.id, 'object', key, type)} />
        </div>
      ) : null}

      {node.type === 'array' && isExpanded ? (
        <div className="node-children">
          {node.items.map((childId, index) => (
            <div key={childId} className="object-child">
              <span className="index-chip">[{index}]</span>
              <TreeNode
                doc={doc}
                nodeId={childId}
                label={`[${index}]`}
                expanded={expanded}
                selectedId={selectedId}
                searchMatches={searchMatches}
                activeMatchId={activeMatchId}
                onToggle={onToggle}
                onSelect={onSelect}
                onRename={onRename}
                onEditPrimitive={onEditPrimitive}
                onAdd={onAdd}
                onDelete={onDelete}
                parentId={node.id}
                parentType="array"
              />
            </div>
          ))}
          <AddRow parentId={node.id} parentType="array" onAdd={(key, type) => onAdd(node.id, 'array', key, type)} />
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, buildInitialState)
  const activeMatchId = state.searchMatches[state.activeMatch]
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [ioTab, setIoTab] = useState<'input' | 'output'>('input')

  useEffect(() => {
    saveToStorage(state)
  }, [state.doc, state.rawText, state.expanded, state.selectedId, state.snippets, state.snippetContents, state.indent])

  useEffect(() => {
    if (!state.notice) return
    const timeout = setTimeout(() => dispatch({ type: 'SET_NOTICE', notice: undefined }), 2400)
    return () => clearTimeout(timeout)
  }, [state.notice])

  const outputText = useMemo(() => {
    if (!state.doc) return ''
    const value = documentToJson(state.doc)
    return state.outputMode === 'pretty' ? formatJson(value, state.indent) : minifyJson(value)
  }, [state.doc, state.outputMode, state.indent])

  const importFile = async (file: File) => {
    const text = await file.text()
    dispatch({ type: 'LOAD_TEXT', text })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
      dispatch({ type: 'SET_NOTICE', notice: { type: 'success', message: 'Copied output to clipboard.' } })
    } catch {
      dispatch({ type: 'SET_NOTICE', notice: { type: 'error', message: 'Clipboard unavailable in this browser.' } })
    }
  }

  const handleDownload = () => {
    const blob = new Blob([outputText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'json-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadSnippet = (id: string) => dispatch({ type: 'LOAD_SNIPPET', id })

  const renderParseError = () => {
    if (!state.parseError) return null
    return (
      <div className="banner error">
        <div>{state.parseError.message}</div>
        {state.parseError.line ? (
          <div className="muted">
            Line {state.parseError.line}, column {state.parseError.column}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">Workspace</p>
          <h1>JSON Visualizer</h1>
          <p className="muted">Parse, explore, and edit JSON safely with live output and snippets.</p>
          <div className="pill-row">
            <span className="pill">Client only</span>
            <span className="pill">Undo / Redo ready</span>
            <span className="pill">Snippets {state.snippets.length}</span>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-note">Use the space below to shape JSON, keep it synced, and ship clean exports.</div>
          <div className="hero-actions">
            <button className="primary" onClick={() => dispatch({ type: 'PARSE_TEXT' })}>
              Parse now
            </button>
            <button className="ghost" onClick={handleCopy} disabled={!outputText}>
              Copy output
            </button>
          </div>
        </div>
      </header>

      <div className="control-bar">
        <div className="control-group">
          <span className="control-label">History</span>
          <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!state.undoStack.length}>
            Undo
          </button>
          <button onClick={() => dispatch({ type: 'REDO' })} disabled={!state.redoStack.length}>
            Redo
          </button>
        </div>
        <div className="control-group">
          <span className="control-label">Structure</span>
          <button onClick={() => dispatch({ type: 'EXPAND_ALL' })} disabled={!state.doc}>
            Expand all
          </button>
          <button onClick={() => dispatch({ type: 'COLLAPSE_ALL' })} disabled={!state.doc}>
            Collapse all
          </button>
          <button onClick={() => dispatch({ type: 'SORT_KEYS', scope: 'selected' })} disabled={!state.doc}>
            Sort keys (current)
          </button>
          <button onClick={() => dispatch({ type: 'SORT_KEYS', scope: 'all' })} disabled={!state.doc}>
            Sort all keys
          </button>
        </div>
      </div>

      <section className="panel io-panel">
        <div className="tab-header">
          <div className="tabs">
            <button className={ioTab === 'input' ? 'tab active' : 'tab'} onClick={() => setIoTab('input')}>
              Raw input
            </button>
            <button className={ioTab === 'output' ? 'tab active' : 'tab'} onClick={() => setIoTab('output')}>
              Live output
            </button>
          </div>
          {ioTab === 'output' ? (
            <div className="tab-actions">
              <button onClick={() => dispatch({ type: 'SET_OUTPUT_MODE', mode: 'pretty' })} className={state.outputMode === 'pretty' ? 'primary' : ''}>
                Pretty
              </button>
              <button onClick={() => dispatch({ type: 'SET_OUTPUT_MODE', mode: 'minified' })} className={state.outputMode === 'minified' ? 'primary' : ''}>
                Minified
              </button>
              <button onClick={handleCopy} disabled={!outputText}>
                Copy
              </button>
              <button onClick={handleDownload} disabled={!outputText}>
                Download .json
              </button>
            </div>
          ) : (
            <div className="tab-actions">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={state.autoParse}
                  onChange={(e) => dispatch({ type: 'SET_AUTOPARSE', enabled: e.target.checked })}
                />
                Auto-parse
              </label>
              <button onClick={() => dispatch({ type: 'PARSE_TEXT' })}>Parse</button>
            </div>
          )}
        </div>

        {ioTab === 'input' ? (
          <div className="io-body">
            <div className="panel-header no-border">
              <div>
                <h2>Raw JSON</h2>
                <p className="muted">Paste JSON, import a file, or load a snippet.</p>
              </div>
              <div className="input-actions">
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_OUTPUT_MODE', mode: 'pretty' })
                    if (state.doc) dispatch({ type: 'LOAD_TEXT', text: formatJson(documentToJson(state.doc), state.indent) })
                  }}
                  disabled={!state.doc}
                >
                  Format
                </button>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_OUTPUT_MODE', mode: 'minified' })
                    if (state.doc) dispatch({ type: 'LOAD_TEXT', text: minifyJson(documentToJson(state.doc)) })
                  }}
                  disabled={!state.doc}
                >
                  Minify
                </button>
                <div className="indent-control">
                  <label>Indent</label>
                  <select value={state.indent} onChange={(e) => dispatch({ type: 'SET_INDENT', indent: Number(e.target.value) })}>
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                  </select>
                </div>
              </div>
            </div>
            <textarea
              className="raw-input"
              value={state.rawText}
              onChange={(e) => dispatch({ type: 'SET_RAW_TEXT', text: e.target.value })}
              placeholder="Paste JSON here..."
            />
            {renderParseError()}
            <div className="file-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json,text/plain"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) importFile(file)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              />
              <button
                onClick={() => {
                  dispatch({ type: 'SAVE_SNIPPET', name: 'Snippet' })
                }}
                disabled={!state.doc}
              >
                Save snippet
              </button>
              <button className="ghost" onClick={() => dispatch({ type: 'CLEAR_LOCAL' })}>
                Clear local data
              </button>
            </div>
          </div>
        ) : (
          <div className="io-body">
            <div className="panel-header no-border">
              <div>
                <h2>Live output</h2>
                <p className="muted">Pretty or minified JSON ready to copy or download.</p>
              </div>
            </div>
            <textarea className="output-view" value={outputText} readOnly placeholder="Output JSON appears here." />
          </div>
        )}
      </section>

      <section className="panel tree-panel">
        <div className="panel-header">
          <div>
            <h2>Tree view</h2>
            <p className="muted">Inline edit, add, remove, and search the hierarchy.</p>
          </div>
          <div className="search-row">
            <input
              placeholder="Search keys or values"
              value={state.searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
            />
            <div className="match-info">
              {state.searchMatches.length
                ? `${state.activeMatch + 1} / ${state.searchMatches.length}`
                : '0 matches'}
            </div>
            <button onClick={() => dispatch({ type: 'MOVE_MATCH', direction: -1 })} disabled={!state.searchMatches.length}>
              Prev
            </button>
            <button onClick={() => dispatch({ type: 'MOVE_MATCH', direction: 1 })} disabled={!state.searchMatches.length}>
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
        <div className="tree-container">
          {state.doc ? (
            <TreeNode
              doc={state.doc}
              nodeId={state.doc.rootId}
              label="root"
              expanded={state.expanded}
              selectedId={state.selectedId}
              searchMatches={state.searchMatches}
              activeMatchId={activeMatchId}
              onToggle={(id) => dispatch({ type: 'TOGGLE_EXPANDED', nodeId: id })}
              onSelect={(id) => dispatch({ type: 'SET_SELECTED', nodeId: id })}
              onRename={(parentId, childId, newKey) => dispatch({ type: 'RENAME_KEY', parentId, childId, newKey })}
              onEditPrimitive={(nodeId, value, newType) => dispatch({ type: 'EDIT_PRIMITIVE', nodeId, value, newType })}
              onAdd={(parentId, parentType, key, type) =>
                dispatch({ type: 'ADD_NODE', parentId, parentType, key, newType: type })
              }
              onDelete={(parentId, childId) => dispatch({ type: 'DELETE_NODE', parentId, childId })}
            />
          ) : (
            <div className="placeholder">Parse JSON to start editing.</div>
          )}
        </div>
      </section>

      <section className="panel snippet-panel full-width">
        <div className="snippet-header">
          <div>
            <h3>Snippets</h3>
            <p className="muted small">Stored locally</p>
          </div>
          <div className="pill subtle">{state.snippets.length ? `${state.snippets.length} saved` : 'None yet'}</div>
        </div>
        {state.snippets.length === 0 ? (
          <p className="muted">No snippets yet.</p>
        ) : (
          state.snippets.map((snippet) => (
            <div key={snippet.id} className="snippet-row">
              <div>
                <input
                  value={snippet.name}
                  onChange={(e) => dispatch({ type: 'RENAME_SNIPPET', id: snippet.id, name: e.target.value })}
                />
                <div className="muted small">
                  Updated {new Date(snippet.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="snippet-actions">
                <button onClick={() => loadSnippet(snippet.id)}>Load</button>
                <button className="ghost danger" onClick={() => dispatch({ type: 'DELETE_SNIPPET', id: snippet.id })}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {state.notice ? <div className={`toast ${state.notice.type}`}>{state.notice.message}</div> : null}
    </div>
  )
}

export default App
