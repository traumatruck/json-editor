type HeroProps = {
  snippetCount: number
  onParse: () => void
  onCopy: () => void
  disableCopy: boolean
}

export function Hero({ snippetCount, onParse, onCopy, disableCopy }: HeroProps) {
  return (
    <header className="hero">
      <div className="hero-text">
        <p className="eyebrow">Workspace</p>
        <h1>JSON Visualizer</h1>
        <p className="muted">Parse, explore, and edit JSON safely with live output and snippets.</p>
        <div className="pill-row">
          <span className="pill">Client only</span>
          <span className="pill">Undo / Redo ready</span>
          <span className="pill">Snippets {snippetCount}</span>
        </div>
      </div>
      <div className="hero-side">
        <div className="hero-note">Use the space below to shape JSON, keep it synced, and ship clean exports.</div>
        <div className="hero-actions">
          <button className="primary" onClick={onParse}>
            Parse now
          </button>
          <button className="ghost" onClick={onCopy} disabled={disableCopy}>
            Copy output
          </button>
        </div>
      </div>
    </header>
  )
}
