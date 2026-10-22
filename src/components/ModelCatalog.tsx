import { useEffect, useState } from 'react';
import { filterCatalog, type CatalogCard } from '../lib/catalog-view';
import { formatBytes } from '../lib/presentation';
export default function ModelCatalog({ cards }: { cards: CatalogCard[] }) {
  const [search, setSearch] = useState('');
  const [sort,setSort]=useState('name');
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
  const visible = [...filterCatalog(cards, search)].sort((a,b)=>sort==='size' ? (a.bytes??Infinity)-(b.bytes??Infinity)||a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  return <section aria-label="Model catalog">
    <div className="toolbar"><label htmlFor="catalog-search">Search all models and configurations</label>
      <input id="catalog-search" type="search" disabled={!ready} value={search} onChange={e => choose(e.target.value)} placeholder="Name, quantization, publisher or status"/>
      <button disabled={!ready || !search} onClick={() => choose('')}>Clear model search</button></div>
    <label>Sort models <select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Name</option><option value="size">Download size</option></select></label><p role="status">{visible.length} of {cards.length} checkpoints{visible.length ? '' : ' · No matching models'}</p>
    <div className="catalog-list">{visible.map(card => <article className="catalog-row" key={card.id}>
      <div><h2><a href={`/models/${card.slug}/`}>{card.name}</a></h2><p>{card.formats.join(' · ')}</p>
      <small>{card.formats.length} weight format{card.formats.length === 1 ? '' : 's'} · {card.configurations.length} configuration{card.configurations.length === 1 ? '' : 's'}</small></div>
      <p className="catalog-size">{formatBytes(card.bytes)}<small style={{display:'block'}}>baseline download, not RAM</small></p>
      <p className="catalog-status">{[...new Set(card.configurations.map(config => config.status))].map(status => <span className="badge" data-status={status} key={status}>{status === 'partial' ? 'Qualified or partial results' : status === 'completed' ? 'Fully scored' : status.replaceAll('_', ' ')}</span>)}</p>
      <details open={Boolean(search)}><summary>Configurations and status</summary><ul>{card.configurations.map(config => <li key={config.id}>
        <a href={`/models/${card.slug}/?configuration=${encodeURIComponent(config.id)}`}>{config.name}</a><small>{config.status.replaceAll('_', ' ')}</small>
      </li>)}</ul></details>
    </article>)}</div>
  </section>;
}
