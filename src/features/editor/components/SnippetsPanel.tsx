import type { SnippetMeta } from '../state'

type SnippetsPanelProps = {
  snippets: SnippetMeta[]
  canOverwrite: boolean
  onLoad: (id: string) => void
  onOverwrite: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function SnippetsPanel({ snippets, canOverwrite, onLoad, onOverwrite, onRename, onDelete }: SnippetsPanelProps) {
  return (
    <section className="panel snippet-panel full-width">
      <div className="snippet-header">
        <div>
          <h3>Snippets</h3>
          <p className="muted small">Stored locally</p>
        </div>
        <div className="pill subtle">{snippets.length ? `${snippets.length} saved` : 'None yet'}</div>
      </div>
      {snippets.length === 0 ? (
        <p className="muted">No snippets yet.</p>
      ) : (
        snippets.map((snippet) => (
          <div key={snippet.id} className="snippet-row">
            <div>
              <input value={snippet.name} onChange={(e) => onRename(snippet.id, e.target.value)} />
              <div className="muted small">Updated {new Date(snippet.updatedAt).toLocaleString()}</div>
            </div>
            <div className="snippet-actions">
              <button onClick={() => onLoad(snippet.id)}>Load</button>
              <button onClick={() => onOverwrite(snippet.id)} disabled={!canOverwrite}>
                Overwrite
              </button>
              <button className="ghost danger" onClick={() => onDelete(snippet.id)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
