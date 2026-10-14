import type { OverviewData } from './public-types';
export type CatalogCard = { id: string; slug: string; name: string; formats: string[]; publishers: string[]; bytes: number | null; configurations: { id: string; name: string; status: string }[] };
export function catalogCards(data: Pick<OverviewData, 'checkpoints' | 'artifacts' | 'configurations'>): CatalogCard[] {
  return data.checkpoints.map(checkpoint => {
    const artifacts = data.artifacts.filter(a => a.checkpoint_id === checkpoint.id);
    return { id: checkpoint.id, slug: checkpoint.slug, name: checkpoint.name,
      formats: artifacts.map(a => a.quantization), publishers: artifacts.flatMap(a => a.publisher ? [a.publisher] : []),
      bytes: artifacts.find(a => a.id === checkpoint.baseline_artifact_id)?.total_bytes ?? null,
      configurations: data.configurations.filter(c => artifacts.some(a => a.id === c.artifact_id)).map(c => ({ id: c.id, name: c.name, status: c.status })) };
  });
}
export function filterCatalog(cards: CatalogCard[], search: string): CatalogCard[] {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter(card => {
    const text = [card.name, ...card.formats, ...card.publishers, ...card.configurations.flatMap(c => [c.id, c.name, c.status])].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
