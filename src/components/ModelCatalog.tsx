import { useEffect, useState } from 'react';
import { filterCatalog, type CatalogCard } from '../lib/catalog-view';
import { formatBytes } from '../lib/presentation';
export default function ModelCatalog({ cards }: { cards: CatalogCard[] }) {
  const [search, setSearch] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = () => setSearch(new URLSearchParams(location.search).get('q') ?? '');
    restore(); setReady(true); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function choose(value: string) {
    const url = new URL(location.href);
    if (value) url.searchParams.set('q', value); else url.searchParams.delete('q');
    history.replaceState(null, '', url); setSearch(value);
  }
  const visible = filterCatalog(cards, search);
  return <section aria-label="Model catalog">
    <div className="toolbar"><label htmlFor="catalog-search">Search all models and configurations</label>
      <input id="catalog-search" type="search" disabled={!ready} value={search} onChange={e => choose(e.target.value)} placeholder="Name, quantization, publisher or status"/>
      <button disabled={!ready || !search} onClick={() => choose('')}>Clear model search</button></div>
    <p role="status">{visible.length} of {cards.length} checkpoints{visible.length ? '' : ' · No matching models'}</p>
    <div className="grid">{visible.map(card => <article className="card" key={card.id}>
      <h2><a href={`/models/${card.slug}/`}>{card.name}</a></h2><p>{card.formats.join(' · ')}</p>
      <small>{card.formats.length} weight format{card.formats.length === 1 ? '' : 's'} · {card.configurations.length} configuration{card.configurations.length === 1 ? '' : 's'}</small>
      <p>{formatBytes(card.bytes)} · baseline weights</p>
      <p>{[...new Set(card.configurations.map(config => config.status))].map(status => <span className="badge" key={status}>{status.replaceAll('_', ' ')}</span>)}</p>
      <details open={Boolean(search)}><summary>Configurations and status</summary><ul>{card.configurations.map(config => <li key={config.id}>
        <a href={`/models/${card.slug}/?configuration=${encodeURIComponent(config.id)}`}>{config.name}</a><small>{config.status.replaceAll('_', ' ')}</small>
      </li>)}</ul></details>
    </article>)}</div>
  </section>;
}
