import type { APIRoute } from 'astro';
import { currentData } from '../lib/data';
import { aggregateCsv } from '../lib/csv';
export const GET: APIRoute = async () => {
  const { release, index } = await currentData();
  return new Response(aggregateCsv(index, release.release_id), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="results.csv"' } });
};
