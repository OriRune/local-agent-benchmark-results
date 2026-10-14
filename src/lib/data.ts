import { validateWithdrawals } from './withdrawals.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { OverviewData, QuestionData } from './public-types';
import type { PublicResultsReleaseV1 } from './public-release';
import type { PublicBenchmarkSummaryV1 } from './public-summary';
import { summaryView, type SummaryPacket } from './summary-view';
import type { QuantPacket, QuantView } from './quant-view';
import type { PublicCheckpointQuantSummaryV1 } from './public-quant-summary';

type Manifest = PublicResultsReleaseV1;
const root = join(process.cwd(), 'public/data');
let cache: Promise<{ release: Manifest; index: OverviewData }> | undefined;
export async function currentData() {
  return cache ??= (async () => {
    const { release_id } = JSON.parse(await readFile(join(root, 'latest.json'), 'utf8'));
    if (!/^release-[a-f0-9]{64}$/.test(release_id)) throw new Error('Invalid release');
    const release = JSON.parse(await readFile(join(root, 'releases', release_id, 'release.json'), 'utf8')) as Manifest;
    const index = await loadObject<OverviewData>(release, release.index_object_id);
    return { release, index };
  })();
}
export async function loadObject<T>(release: Manifest, id: string): Promise<T> {
  const object = release.objects.find(o => o.id === id);
  if (!object || !/^objects\/sha256\/[a-f0-9]{64}\.(json|txt)(\.gz)?$/.test(object.path)) throw new Error('Missing public object');
  const bytes = await readFile(join(root, object.path));
  return JSON.parse((object.encoding === 'gzip' ? gunzipSync(bytes) : bytes).toString('utf8')) as T;
}
export async function questionData(id: string) { const { release } = await currentData(); return loadObject<QuestionData>(release, release.question_objects[id]!); }
export async function modelSummaries(checkpointId: string) {
  const { release, index } = await currentData();
  const artifacts = new Set(index.artifacts.filter(a => a.checkpoint_id === checkpointId).map(a => a.id));
  const configurations = new Set(index.configurations.filter(c => artifacts.has(c.artifact_id)).map(c => c.id));
  return Promise.all(release.summary_objects.filter(ref => configurations.has(ref.configuration_id)).map(async ref => {
    const [summary, packet] = await Promise.all([loadObject<PublicBenchmarkSummaryV1>(release, ref.object_id), loadObject<SummaryPacket>(release, ref.facts_object_id)]);
    return summaryView(summary, packet, { releaseId: release.release_id, checkpointId });
  }));
}
export async function quantSummary(checkpointId:string):Promise<QuantView|null> {
  const {release}=await currentData(),ref=release.quant_summary_objects?.find(r=>r.checkpoint_id===checkpointId);
  if(!ref)return null;
  const [summary,packet]=await Promise.all([loadObject<PublicCheckpointQuantSummaryV1>(release,ref.object_id),loadObject<QuantPacket>(release,ref.facts_object_id)]);
  return {summary,packet};
}

export async function retainedEditions(): Promise<Manifest[]> {
  const names = (await readdir(join(root, 'releases'))).filter(name => /^release-[a-f0-9]{64}$/.test(name));
  return Promise.all(names.sort().map(async name => JSON.parse(await readFile(join(root, 'releases', name, 'release.json'), 'utf8')) as Manifest));
}

export async function withdrawnEditions(): Promise<[string, { reason: string; withdrawn_at: string }][]> {
  try { return Object.entries(validateWithdrawals(JSON.parse(await readFile(join(root, 'withdrawals.json'), 'utf8'))).editions); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
