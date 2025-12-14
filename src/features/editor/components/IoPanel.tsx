import { useRef } from 'react'
import type { ParseError } from '../state'

type IoPanelProps = {
  tab: 'input' | 'output'
  rawText: string
  parseError?: ParseError
  outputMode: 'pretty' | 'minified'
  outputText: string
  autoParse: boolean
  indent: number
  autoSaveEnabled: boolean
  canFormat: boolean
  canMinify: boolean
  canSaveSnippet: boolean
  onTabChange: (tab: 'input' | 'output') => void
  onRawTextChange: (value: string) => void
  onOutputModeChange: (mode: 'pretty' | 'minified') => void
  onCopy: () => void
  onDownload: () => void
  onToggleAutoParse: (enabled: boolean) => void
  onParse: () => void
  onFormat: () => void
  onMinify: () => void
  onIndentChange: (indent: number) => void
  onToggleAutoSave: (enabled: boolean) => void
  onSaveSnippet: () => void
  onClearLocal: () => void
  onImportFile: (file: File) => void
}

export function IoPanel({
  tab,
  rawText,
  parseError,
  outputMode,
  outputText,
  autoParse,
  indent,
  autoSaveEnabled,
  canFormat,
  canMinify,
  canSaveSnippet,
  onTabChange,
  onRawTextChange,
  onOutputModeChange,
  onCopy,
  onDownload,
  onToggleAutoParse,
  onParse,
  onFormat,
  onMinify,
  onIndentChange,
  onToggleAutoSave,
  onSaveSnippet,
  onClearLocal,
  onImportFile,
}: IoPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const renderParseError = () => {
    if (!parseError) return null
    return (
      <div className="banner error">
        <div>{parseError.message}</div>
        {parseError.line ? (
          <div className="muted">
            Line {parseError.line}, column {parseError.column}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section className="panel io-panel">
      <div className="tab-header">
        <div className="tabs">
          <button className={tab === 'input' ? 'tab active' : 'tab'} onClick={() => onTabChange('input')}>
            Raw input
          </button>
          <button className={tab === 'output' ? 'tab active' : 'tab'} onClick={() => onTabChange('output')}>
            Live output
          </button>
        </div>
        {tab === 'output' ? (
          <div className="tab-actions">
            <button
              onClick={() => onOutputModeChange('pretty')}
              className={outputMode === 'pretty' ? 'primary' : ''}
            >
              Pretty
            </button>
            <button
              onClick={() => onOutputModeChange('minified')}
              className={outputMode === 'minified' ? 'primary' : ''}
            >
              Minified
            </button>
            <button onClick={onCopy} disabled={!outputText}>
              Copy
            </button>
            <button onClick={onDownload} disabled={!outputText}>
              Download .json
            </button>
          </div>
        ) : (
          <div className="tab-actions">
            <label className="toggle">
              <input type="checkbox" checked={autoParse} onChange={(e) => onToggleAutoParse(e.target.checked)} />
              Auto-parse
            </label>
            <button onClick={onParse}>Parse</button>
          </div>
        )}
      </div>

      {tab === 'input' ? (
        <div className="io-body">
          <div className="panel-header no-border">
            <div>
              <h2>Raw JSON</h2>
              <p className="muted">Paste JSON, import a file, or load a snippet.</p>
            </div>
            <div className="input-actions">
              <button onClick={onFormat} disabled={!canFormat}>
                Format
              </button>
              <button onClick={onMinify} disabled={!canMinify}>
                Minify
              </button>
              <div className="indent-control">
                <label>Indent</label>
                <select value={indent} onChange={(e) => onIndentChange(Number(e.target.value))}>
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                </select>
              </div>
            </div>
          </div>
          <textarea
            className="raw-input"
            value={rawText}
            onChange={(e) => onRawTextChange(e.target.value)}
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
                if (file) onImportFile(file)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => onToggleAutoSave(e.target.checked)}
              />
              Autosave last document
            </label>
            <button onClick={onSaveSnippet} disabled={!canSaveSnippet}>
              Save snippet
            </button>
            <button className="ghost" onClick={onClearLocal}>
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
  )
}
