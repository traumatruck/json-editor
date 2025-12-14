export type NodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export type ObjectEntry = { key: string; childId: string }

export type JsonNode =
  | { id: string; type: 'object'; entries: ObjectEntry[] }
  | { id: string; type: 'array'; items: string[] }
  | { id: string; type: 'string'; value: string }
  | { id: string; type: 'number'; value: number }
  | { id: string; type: 'boolean'; value: boolean }
  | { id: string; type: 'null'; value: null }

export type DocumentState = {
  rootId: string
  nodes: Record<string, JsonNode>
}

export type ParseError = { message: string; line?: number; column?: number }
export type Notice = { type: 'success' | 'error' | 'info'; message: string }

export type SnippetMeta = { id: string; name: string; updatedAt: number }

export type HistoryEntry = {
  doc: DocumentState | null
  rawText: string
  expanded: string[]
  selectedId?: string
  preSearchExpanded?: string[]
  anchorPath: string[]
}

export type EditorState = {
  rawText: string
  lastValidText: string
  doc: DocumentState | null
  parseError?: ParseError
  expanded: Set<string>
  selectedId?: string
  searchQuery: string
  searchMatches: string[]
  activeMatch: number
  searchFilterOnly: boolean
  outputMode: 'pretty' | 'minified'
  indent: number
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  autoParse: boolean
  autoSaveEnabled: boolean
  snippets: SnippetMeta[]
  snippetContents: Record<string, string>
  notice?: Notice
  preSearchExpanded?: Set<string>
  anchorPath: string[]
}

export type Action =
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
  | { type: 'TOGGLE_FILTER_MODE'; enabled: boolean }
  | { type: 'SET_OUTPUT_MODE'; mode: 'pretty' | 'minified' }
  | { type: 'SET_INDENT'; indent: number }
  | { type: 'SORT_KEYS'; scope: 'selected' | 'all' }
  | { type: 'MOVE_ARRAY_ITEM'; parentId: string; childId: string; direction: -1 | 1 }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_AUTOPARSE'; enabled: boolean }
  | { type: 'SET_AUTOSAVE'; enabled: boolean }
  | { type: 'SAVE_SNIPPET'; name: string }
  | { type: 'LOAD_SNIPPET'; id: string }
  | { type: 'RENAME_SNIPPET'; id: string; name: string }
  | { type: 'DELETE_SNIPPET'; id: string }
  | { type: 'OVERWRITE_SNIPPET'; id: string }
  | { type: 'CLEAR_LOCAL' }
  | { type: 'SET_NOTICE'; notice?: Notice }
  | { type: 'ANCHOR_TO'; nodeId?: string }

const DEFAULT_JSON = {
  profile: {
    name: 'Avery Analyst',
    team: 'Product',
    active: true,
  },
  features: ['search', 'edit', 'undo'],
  stats: { saves: 12, snippets: 3, lastEdited: 'today' },
}

export const SAMPLE_TEXT = JSON.stringify(DEFAULT_JSON, null, 2)
const LAST_DOC_KEY = 'json-editor:last-doc'
const SNIPPETS_KEY = 'json-editor:snippets'
const SETTINGS_KEY = 'json-editor:settings'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Math.random().toString(16).slice(2)}`
}

function loadAutoSaveEnabled() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return settings?.autoSaveEnabled ?? true
  } catch {
    return true
  }
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

export function documentToJson(doc: DocumentState): unknown {
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

export function formatJson(value: unknown, indent: number) {
  return JSON.stringify(value, null, indent)
}

export function minifyJson(value: unknown) {
  return JSON.stringify(value)
}

function snapshotState(state: EditorState): HistoryEntry {
  return {
    doc: state.doc ? structuredClone(state.doc) : null,
    rawText: state.rawText,
    expanded: Array.from(state.expanded),
    selectedId: state.selectedId,
    preSearchExpanded: state.preSearchExpanded ? Array.from(state.preSearchExpanded) : undefined,
    anchorPath: state.anchorPath,
  }
}

export function buildParentMap(doc: DocumentState): Record<string, string | undefined> {
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

function collectSubtreeIds(doc: DocumentState, rootId: string, bucket = new Set<string>()) {
  const node = doc.nodes[rootId]
  if (!node) return bucket
  bucket.add(rootId)
  if (node.type === 'object') {
    node.entries.forEach((entry) => collectSubtreeIds(doc, entry.childId, bucket))
  } else if (node.type === 'array') {
    node.items.forEach((childId) => collectSubtreeIds(doc, childId, bucket))
  }
  return bucket
}

function buildAnchorPath(doc: DocumentState, targetId: string): string[] {
  const parents = buildParentMap(doc)
  const path: string[] = []
  let current: string | undefined = targetId
  while (current) {
    path.push(current)
    current = parents[current]
  }
  const result = path.reverse()
  if (!result.length || result[0] !== doc.rootId) return []
  return result
}

function resolveAnchorPath(doc: DocumentState, anchorPath: string[]): string[] {
  const targetId = anchorPath[anchorPath.length - 1]
  if (!targetId) return [doc.rootId]
  const path = buildAnchorPath(doc, targetId)
  return path.length ? path : [doc.rootId]
}

function findSearchMatches(doc: DocumentState, query: string, rootId: string): string[] {
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
  visit(rootId)
  return matches
}

function applySearch(state: EditorState, docOverride?: DocumentState | null, anchorOverride?: string[]): EditorState {
  const doc = docOverride ?? state.doc
  if (!doc || !state.searchQuery.trim()) {
    const nextAnchor = anchorOverride ?? state.anchorPath
    return { ...state, searchMatches: [], activeMatch: -1, anchorPath: nextAnchor }
  }
  const anchorPath = anchorOverride ?? state.anchorPath
  const anchorRoot = anchorPath[anchorPath.length - 1] ?? doc.rootId
  const matches = findSearchMatches(doc, state.searchQuery.trim(), anchorRoot)
  const currentActiveId = state.searchMatches[state.activeMatch]
  const nextActiveIndex = currentActiveId ? matches.indexOf(currentActiveId) : -1
  const activeMatch = nextActiveIndex >= 0 ? nextActiveIndex : matches.length ? 0 : -1
  const expanded = new Set(state.expanded)
  const parents = buildParentMap(doc)
  if (matches[activeMatch]) {
    expandAncestors(matches[activeMatch], parents, expanded)
  }
  anchorPath.forEach((id) => expanded.add(id))
  return { ...state, searchMatches: matches, activeMatch, expanded, anchorPath }
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

function moveArrayItem(state: EditorState, parentId: string, childId: string, direction: -1 | 1): EditorState {
  if (!state.doc) return state
  const doc = structuredClone(state.doc)
  const parent = doc.nodes[parentId]
  if (!parent || parent.type !== 'array') return state
  const index = parent.items.indexOf(childId)
  if (index === -1) return state
  const target = index + direction
  if (target < 0 || target >= parent.items.length) return state
  const items = [...parent.items]
  const [moved] = items.splice(index, 1)
  items.splice(target, 0, moved)
  parent.items = items
  return finalizeDocumentChange(state, doc, childId)
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
  const nextAnchorPath = resolveAnchorPath(doc, state.anchorPath)
  const base = applySearch(
    {
      ...state,
      doc,
      rawText: formatted,
      lastValidText: formatted,
      parseError: undefined,
      selectedId: focusId ?? state.selectedId,
      preSearchExpanded: state.preSearchExpanded,
      anchorPath: nextAnchorPath,
    },
    doc,
    nextAnchorPath,
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
    anchorPath: [doc.rootId],
    preSearchExpanded: state.searchQuery.trim() ? new Set([doc.rootId]) : undefined,
  }
  const withSearch = applySearch(base, doc, [doc.rootId])
  return withHistory(state, withSearch, true)
}

function withHistory(state: EditorState, next: EditorState, push: boolean): EditorState {
  if (!push) return next
  const undo = [snapshotState(state), ...state.undoStack].slice(0, 50)
  return { ...next, undoStack: undo, redoStack: [] }
}

function loadStoredState(autoSaveEnabled: boolean): EditorState | null {
  try {
    const snippets: SnippetMeta[] = JSON.parse(localStorage.getItem(SNIPPETS_KEY) ?? '[]')
    const snippetContents: Record<string, string> = {}
    snippets.forEach((item) => {
      const content = localStorage.getItem(`${SNIPPETS_KEY}:${item.id}`)
      if (content) snippetContents[item.id] = content
    })
    const raw = localStorage.getItem(LAST_DOC_KEY)
    if (!raw) {
      if (!snippets.length) return null
      const doc = buildDocumentFromValue(DEFAULT_JSON)
      return {
        rawText: SAMPLE_TEXT,
        lastValidText: SAMPLE_TEXT,
        doc,
        expanded: new Set([doc.rootId]),
        selectedId: doc.rootId,
        anchorPath: [doc.rootId],
        parseError: undefined,
        searchQuery: '',
        searchMatches: [],
        activeMatch: -1,
        searchFilterOnly: false,
        outputMode: 'pretty',
        indent: 2,
        undoStack: [],
        redoStack: [],
        autoParse: false,
        autoSaveEnabled,
        snippets,
        snippetContents,
        notice: undefined,
        preSearchExpanded: undefined,
      }
    }
    const parsed = JSON.parse(raw)
    const doc: DocumentState | null = parsed.doc ?? null
    const expandedSet: Set<string> = new Set(parsed.expanded ?? [])
    const indent = parsed.indent ?? 2
    const searchFilterOnly = parsed.searchFilterOnly ?? false
    const anchorPath: string[] = parsed.anchorPath && parsed.anchorPath.length ? parsed.anchorPath : doc ? [doc.rootId] : []
    const restored: EditorState = {
      rawText: parsed.rawText ?? SAMPLE_TEXT,
      lastValidText: parsed.lastValidText ?? SAMPLE_TEXT,
      doc,
      expanded: expandedSet,
      selectedId: parsed.selectedId,
      anchorPath,
      parseError: undefined,
      searchQuery: '',
      searchMatches: [],
      activeMatch: -1,
      searchFilterOnly,
      outputMode: 'pretty',
      indent,
      undoStack: [],
      redoStack: [],
      autoParse: false,
      autoSaveEnabled,
      snippets,
      snippetContents,
      notice: undefined,
      preSearchExpanded: undefined,
    }
    return restored
  } catch (error) {
    console.error('Unable to restore session', error)
    return null
  }
}

export function buildInitialState(): EditorState {
  const autoSaveEnabled = loadAutoSaveEnabled()
  const restored = loadStoredState(autoSaveEnabled)
  if (restored) {
    return applySearch(restored, restored.doc, restored.anchorPath)
  }
  const doc = buildDocumentFromValue(DEFAULT_JSON)
  return {
    rawText: SAMPLE_TEXT,
    lastValidText: SAMPLE_TEXT,
    doc,
    parseError: undefined,
    expanded: new Set([doc.rootId]),
    selectedId: doc.rootId,
    anchorPath: [doc.rootId],
    searchQuery: '',
    searchMatches: [],
    activeMatch: -1,
    searchFilterOnly: false,
    outputMode: 'pretty',
    indent: 2,
    undoStack: [],
    redoStack: [],
    autoParse: false,
    autoSaveEnabled,
    snippets: [],
    snippetContents: {},
    notice: undefined,
    preSearchExpanded: undefined,
  }
}

export function saveToStorage(state: EditorState) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autoSaveEnabled: state.autoSaveEnabled }))
    if (state.autoSaveEnabled) {
      const payload = {
        rawText: state.rawText,
        lastValidText: state.lastValidText,
        doc: state.doc,
        expanded: Array.from(state.expanded),
        selectedId: state.selectedId,
        indent: state.indent,
        searchFilterOnly: state.searchFilterOnly,
        anchorPath: state.anchorPath,
      }
      localStorage.setItem(LAST_DOC_KEY, JSON.stringify(payload))
    } else {
      localStorage.removeItem(LAST_DOC_KEY)
    }
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

export function editorReducer(state: EditorState, action: Action): EditorState {
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
      const anchorRoot = state.anchorPath[state.anchorPath.length - 1] ?? state.doc.rootId
      const expanded = collectSubtreeIds(state.doc, anchorRoot)
      state.anchorPath.forEach((id) => expanded.add(id))
      return { ...state, expanded }
    }
    case 'COLLAPSE_ALL':
      return state.doc
        ? { ...state, expanded: new Set(state.anchorPath.length ? state.anchorPath : [state.doc.rootId]) }
        : state
    case 'SET_SEARCH_QUERY': {
      const trimmed = action.query
      const enteringSearch = !state.searchQuery.trim() && !!trimmed.trim()
      const clearingSearch = !!state.searchQuery.trim() && !trimmed.trim()
      let expanded = state.expanded
      let preSearchExpanded = state.preSearchExpanded
      if (enteringSearch) {
        preSearchExpanded = new Set(state.expanded)
      }
      if (clearingSearch && state.preSearchExpanded) {
        expanded = new Set(state.preSearchExpanded)
        preSearchExpanded = undefined
      }
      const next = { ...state, searchQuery: trimmed, expanded, preSearchExpanded }
      return applySearch(next)
    }
    case 'TOGGLE_FILTER_MODE': {
      const next = { ...state, searchFilterOnly: action.enabled }
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
      state.anchorPath.forEach((id) => expanded.add(id))
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
    case 'MOVE_ARRAY_ITEM':
      return moveArrayItem(state, action.parentId, action.childId, action.direction)
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
        anchorPath: previous.anchorPath,
        undoStack: remaining,
        redoStack: [redo, ...state.redoStack].slice(0, 50),
        parseError: undefined,
        preSearchExpanded: previous.preSearchExpanded ? new Set(previous.preSearchExpanded) : undefined,
      }
      return applySearch(restored, restored.doc, restored.anchorPath)
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
        anchorPath: nextEntry.anchorPath,
        redoStack: remaining,
        undoStack: [undo, ...state.undoStack].slice(0, 50),
        parseError: undefined,
        preSearchExpanded: nextEntry.preSearchExpanded ? new Set(nextEntry.preSearchExpanded) : undefined,
      }
      return applySearch(restored, restored.doc, restored.anchorPath)
    }
    case 'SET_AUTOPARSE':
      return { ...state, autoParse: action.enabled }
    case 'SET_AUTOSAVE':
      return { ...state, autoSaveEnabled: action.enabled }
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
      localStorage.removeItem(`${SNIPPETS_KEY}:${action.id}`)
      return { ...state, snippets, snippetContents: rest }
    }
    case 'OVERWRITE_SNIPPET': {
      if (!state.doc) return { ...state, notice: { type: 'error', message: 'Load or parse JSON first.' } }
      const exists = state.snippets.find((s) => s.id === action.id)
      if (!exists) return state
      const snippetContents = { ...state.snippetContents, [action.id]: state.rawText }
      const snippets = state.snippets.map((s) =>
        s.id === action.id ? { ...s, updatedAt: Date.now() } : s,
      )
      return {
        ...state,
        snippets,
        snippetContents,
        notice: { type: 'success', message: 'Snippet updated.' },
      }
    }
    case 'CLEAR_LOCAL': {
      localStorage.removeItem(LAST_DOC_KEY)
      state.snippets.forEach((item) => localStorage.removeItem(`${SNIPPETS_KEY}:${item.id}`))
      localStorage.removeItem(SNIPPETS_KEY)
      localStorage.removeItem(SETTINGS_KEY)
      return buildInitialState()
    }
    case 'SET_NOTICE':
      return { ...state, notice: action.notice }
    case 'ANCHOR_TO': {
      if (!state.doc) return state
      const targetId = action.nodeId ?? state.doc.rootId
      const path = buildAnchorPath(state.doc, targetId)
      if (!path.length) return state
      const expanded = new Set(state.expanded)
      path.forEach((id) => expanded.add(id))
      const subtree = collectSubtreeIds(state.doc, path[path.length - 1])
      const selectedId = subtree.has(state.selectedId ?? '') ? state.selectedId : path[path.length - 1]
      const next = { ...state, anchorPath: path, expanded, selectedId }
      return applySearch(next, state.doc, path)
    }
    default:
      return state
  }
}
