import { useEffect, useState } from 'react';
import { checkPreviewEvidence, loadPagePreview, type PagePreview } from '../lib/page-preview';

export default function GeneratedPagePreview({ attemptId, questionId, releaseId, evidenceIds }: {
  attemptId: string; questionId: string; releaseId: string; evidenceIds: string[];
}) {
  const [packet, setPacket] = useState<PagePreview | null>(null), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop'), [expanded, setExpanded] = useState(false), [file, setFile] = useState(0), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPacket(null); setLoaded(false); setError(''); setFile(0); setExpanded(false);
    loadPagePreview(attemptId, questionId, releaseId, evidenceIds).then(value => { if (active) { setPacket(value); setLoaded(true); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attemptId, questionId, releaseId, retry]);
  const selected = packet?.files[file], view = selected?.views.find(v => v.name === mode);
  async function download() {
    if (!packet || !selected) return;
    try {
      await checkPreviewEvidence(packet);
      const url = URL.createObjectURL(new Blob([selected.html], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = selected.filename.split('/').pop()!; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); setPacket(null); }
  }
  return <section className="generated-page" aria-labelledby="generated-page-heading">
    <div className="generated-page-title"><div><p className="eyebrow">Visual output</p><h3 id="generated-page-heading">The page this model made</h3></div></div>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(retry + 1)}>Retry preview</button></p>
      : !loaded ? <p role="status">Loading the saved-page preview…</p>
      : !selected ? <p>{packet?.reason ?? 'A saved-page preview is not available for this recorded attempt.'} The answer and recorded checks remain below.</p>
      : <>
        <p>A screenshot of the saved HTML, including any unfinished layout. Switch screen sizes to inspect the design.</p>
        <div className="toolbar" role="group" aria-label="Page preview controls">
          <button type="button" aria-pressed={mode === 'desktop'} onClick={() => setMode('desktop')}>Desktop</button>
          <button type="button" aria-pressed={mode === 'mobile'} onClick={() => setMode('mobile')}>Mobile</button>
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Fit to column' : 'Inspect at full size'}</button>
          <button type="button" onClick={download}>Download saved HTML</button>
          {packet!.files.length > 1 && <label>Saved file <select value={file} onChange={e => setFile(Number(e.target.value))}>{packet!.files.map((f, i) => <option key={f.filename} value={i}>{f.filename}</option>)}</select></label>}
        </div>
        {view ? <figure>
          <div className={`generated-page-canvas${expanded ? ' expanded' : ''}`} tabIndex={0} role="region" aria-label={`${mode === 'desktop' ? 'Desktop' : 'Mobile'} screenshot of the saved page`}>
            <img src={`data:image/png;base64,${view.png_base64}`} width={view.width} height={view.height} alt={`${selected.filename}, the ${mode} layout produced by this model`} style={{ maxWidth: expanded ? 'none' : `${view.width}px` }}/>
          </div>
          <figcaption>{selected.filename} · {view.width} px wide · external resources blocked{view.cropped ? ' · first 12,000 pixels shown' : ''}{selected.redaction_rule_ids.length ? ' · private paths redacted' : ''}</figcaption>
        </figure> : <p>This screen-size preview could not be rendered. The saved HTML is still available to download.</p>}
        <details className="preview-note"><summary>About this preview</summary><p>Rendered from the exact saved workspace file{selected.redaction_rule_ids.length ? ' after privacy redactions' : ''}. This is a visual snapshot, not an interactive page or a new grade. Page scripts ran in an isolated capture browser; external fonts, images, libraries and other network requests were blocked, so pages relying on them may look incomplete. No model-generated script runs in this results page.</p>{view && view.script_errors > 0 && <p>The saved page raised {view.script_errors} JavaScript {view.script_errors === 1 ? 'error' : 'errors'} during capture.</p>}<p>Captured {packet!.rendered_at.slice(0, 10)}. Use the saved HTML download to inspect the original source or open it separately.</p></details>
      </>}
  </section>;
}
