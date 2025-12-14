import { useEffect, useMemo, useReducer, useState } from 'react'
import './App.css'
import {
  buildInitialState,
  buildParentMap,
  documentToJson,
  editorReducer,
  formatJson,
  minifyJson,
  saveToStorage,
} from './features/editor/state'
import { ControlBar } from './features/editor/components/ControlBar'
import { Hero } from './features/editor/components/Hero'
import { IoPanel } from './features/editor/components/IoPanel'
import { SnippetsPanel } from './features/editor/components/SnippetsPanel'
import { TreePanel } from './features/editor/components/TreePanel'

function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, buildInitialState)
  const [ioTab, setIoTab] = useState<'input' | 'output'>('input')
  const activeMatchId = state.searchMatches[state.activeMatch]
  const anchorRootId = state.doc ? state.anchorPath[state.anchorPath.length - 1] ?? state.doc.rootId : undefined

  useEffect(() => {
    saveToStorage(state)
  }, [
    state.doc,
    state.rawText,
    state.expanded,
    state.selectedId,
    state.snippets,
    state.snippetContents,
    state.indent,
    state.searchFilterOnly,
    state.autoSaveEnabled,
    state.anchorPath,
  ])

  useEffect(() => {
    if (!state.notice) return
    const timeout = setTimeout(() => dispatch({ type: 'SET_NOTICE', notice: undefined }), 2400)
    return () => clearTimeout(timeout)
  }, [state.notice, dispatch])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (isMeta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatch({ type: event.shiftKey ? 'REDO' : 'UNDO' })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])

  const outputText = useMemo(() => {
    if (!state.doc) return ''
    const value = documentToJson(state.doc)
    return state.outputMode === 'pretty' ? formatJson(value, state.indent) : minifyJson(value)
  }, [state.doc, state.outputMode, state.indent])

  const anchorCrumbs = useMemo(() => {
    if (!state.doc || !state.anchorPath.length) return []
    const crumbs = [{ id: state.doc.rootId, label: 'root' }]
    for (let i = 1; i < state.anchorPath.length; i += 1) {
      const parentId = state.anchorPath[i - 1]
      const childId = state.anchorPath[i]
      const parent = state.doc.nodes[parentId]
      if (!parent) break
      let label = childId
      if (parent.type === 'object') {
        const entry = parent.entries.find((item) => item.childId === childId)
        label = entry ? entry.key : label
      } else if (parent.type === 'array') {
        const index = parent.items.indexOf(childId)
        label = index >= 0 ? `[${index}]` : label
      }
      crumbs.push({ id: childId, label })
    }
    return crumbs
  }, [state.doc, state.anchorPath])

  const visibleSet = useMemo(() => {
    if (!state.doc || !state.searchFilterOnly || !state.searchQuery.trim()) return undefined
    const parents = buildParentMap(state.doc)
    const rootId = anchorRootId ?? state.doc.rootId
    const visible = new Set<string>([rootId])
    state.anchorPath.forEach((id) => visible.add(id))
    state.searchMatches.forEach((id) => {
      let current: string | undefined = id
      while (current) {
        visible.add(current)
        current = parents[current]
      }
    })
    return visible
  }, [state.doc, state.searchFilterOnly, state.searchMatches, state.searchQuery])

  const nodeCount = state.doc ? Object.keys(state.doc.nodes).length : 0
  const largeJson = nodeCount > 800

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

  return (
    <div className="app-shell">
      <Hero
        snippetCount={state.snippets.length}
        onParse={() => dispatch({ type: 'PARSE_TEXT' })}
        onCopy={handleCopy}
        disableCopy={!outputText}
      />

      <ControlBar
        canUndo={!!state.undoStack.length}
        canRedo={!!state.redoStack.length}
        canExpandAll={!!state.doc && !largeJson}
        canCollapseAll={!!state.doc}
        canSort={!!state.doc}
        expandAllDisabledReason={largeJson ? 'Disabled for large documents to avoid slowdowns.' : undefined}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onExpandAll={() => dispatch({ type: 'EXPAND_ALL' })}
        onCollapseAll={() => dispatch({ type: 'COLLAPSE_ALL' })}
        onSortCurrent={() => dispatch({ type: 'SORT_KEYS', scope: 'selected' })}
        onSortAll={() => dispatch({ type: 'SORT_KEYS', scope: 'all' })}
      />

      <IoPanel
        tab={ioTab}
        rawText={state.rawText}
        parseError={state.parseError}
        outputMode={state.outputMode}
        outputText={outputText}
        autoParse={state.autoParse}
        indent={state.indent}
        autoSaveEnabled={state.autoSaveEnabled}
        canFormat={!!state.doc}
        canMinify={!!state.doc}
        canSaveSnippet={!!state.doc}
        onTabChange={setIoTab}
        onRawTextChange={(value) => dispatch({ type: 'SET_RAW_TEXT', text: value })}
        onOutputModeChange={(mode) => dispatch({ type: 'SET_OUTPUT_MODE', mode })}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onToggleAutoParse={(enabled) => dispatch({ type: 'SET_AUTOPARSE', enabled })}
        onParse={() => dispatch({ type: 'PARSE_TEXT' })}
        onFormat={() => {
          dispatch({ type: 'SET_OUTPUT_MODE', mode: 'pretty' })
          if (state.doc) dispatch({ type: 'LOAD_TEXT', text: formatJson(documentToJson(state.doc), state.indent) })
        }}
        onMinify={() => {
          dispatch({ type: 'SET_OUTPUT_MODE', mode: 'minified' })
          if (state.doc) dispatch({ type: 'LOAD_TEXT', text: minifyJson(documentToJson(state.doc)) })
        }}
        onIndentChange={(indent) => dispatch({ type: 'SET_INDENT', indent })}
        onToggleAutoSave={(enabled) => dispatch({ type: 'SET_AUTOSAVE', enabled })}
        onSaveSnippet={() => dispatch({ type: 'SAVE_SNIPPET', name: 'Snippet' })}
        onClearLocal={() => dispatch({ type: 'CLEAR_LOCAL' })}
        onImportFile={importFile}
      />

      <TreePanel
        doc={state.doc}
        expanded={state.expanded}
        selectedId={state.selectedId}
        searchQuery={state.searchQuery}
        searchFilterOnly={state.searchFilterOnly}
        searchMatches={state.searchMatches}
        activeMatch={state.activeMatch}
        activeMatchId={activeMatchId}
        visibleSet={visibleSet}
        largeJson={largeJson}
        nodeCount={nodeCount}
        anchorCrumbs={anchorCrumbs}
        anchorRootId={anchorRootId}
        onToggleNode={(id) => dispatch({ type: 'TOGGLE_EXPANDED', nodeId: id })}
        onSelectNode={(id) => dispatch({ type: 'SET_SELECTED', nodeId: id })}
        onRename={(parentId, childId, newKey) => dispatch({ type: 'RENAME_KEY', parentId, childId, newKey })}
        onEditPrimitive={(nodeId, value, newType) => dispatch({ type: 'EDIT_PRIMITIVE', nodeId, value, newType })}
        onAddNode={(parentId, parentType, key, type) =>
          dispatch({ type: 'ADD_NODE', parentId, parentType, key, newType: type })
        }
        onDeleteNode={(parentId, childId) => dispatch({ type: 'DELETE_NODE', parentId, childId })}
        onMoveInArray={(parentId, childId, direction) =>
          dispatch({ type: 'MOVE_ARRAY_ITEM', parentId, childId, direction })
        }
        onSearchChange={(query) => dispatch({ type: 'SET_SEARCH_QUERY', query })}
        onToggleFilterMode={(enabled) => dispatch({ type: 'TOGGLE_FILTER_MODE', enabled })}
        onMoveMatch={(direction) => dispatch({ type: 'MOVE_MATCH', direction })}
        onAnchor={(nodeId) => dispatch({ type: 'ANCHOR_TO', nodeId })}
      />

      <SnippetsPanel
        snippets={state.snippets}
        canOverwrite={!!state.doc}
        onLoad={loadSnippet}
        onOverwrite={(id) => dispatch({ type: 'OVERWRITE_SNIPPET', id })}
        onRename={(id, name) => dispatch({ type: 'RENAME_SNIPPET', id, name })}
        onDelete={(id) => dispatch({ type: 'DELETE_SNIPPET', id })}
      />

      {state.notice ? <div className={`toast ${state.notice.type}`}>{state.notice.message}</div> : null}
    </div>
  )
}

export default App
