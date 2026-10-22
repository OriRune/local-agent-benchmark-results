import { readBounded } from './read-bounded';
import { assertObjectAvailable } from './withdrawal-client';
export type PagePreview = {
  version: 1; release_id: string; question_id: string; attempt_id: string;
  evidence_object_ids: string[]; status: 'available' | 'unavailable'; reason: string | null; rendered_at: string;
  files: { filename: string; html: string; sha256: string; redaction_rule_ids: string[];
    views: { name: 'desktop' | 'mobile'; width: number; height: number; cropped: boolean; png_base64: string; sha256: string; blocked_requests: number; script_errors: number }[] }[];
};
export const READING_PAGE_QUESTION = 'q-bc4a880703cbea599dac4f30';
export async function checkPreviewEvidence(value: PagePreview) {
  for (const id of value.evidence_object_ids) await assertObjectAvailable(id);
}
async function bytes(url: string, limit: number): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw Error('The saved-page preview could not be loaded.');
  return readBounded(response.body, limit);
}
export async function sha256(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function loadPagePreview(attemptId: string, questionId: string, releaseId: string, evidenceIds: string[]): Promise<PagePreview | null> {
  const index = JSON.parse(new TextDecoder().decode(await bytes('/previews/index.json', 256 * 1024)));
  if (index.version !== 1 || index.release_id !== releaseId || index.question_id !== questionId) return null;
  const ref = index.previews.find((r: { attempt_id: string }) => r.attempt_id === attemptId);
  if (!ref) return null;
  if (!/^[a-f0-9]{64}$/.test(ref.sha256) || !Number.isSafeInteger(ref.bytes) || ref.bytes > 20 * 1024 ** 2 || ref.bytes < 1) throw Error('Invalid saved-page preview reference.');
  const raw = await bytes(`/previews/${ref.sha256}.json`, ref.bytes);
  if (raw.length !== ref.bytes || await sha256(raw) !== ref.sha256) throw Error('Saved-page preview checksum mismatch.');
  const value: PagePreview = JSON.parse(new TextDecoder().decode(raw));
  if (value.version !== 1 || value.attempt_id !== attemptId || value.question_id !== questionId || value.release_id !== releaseId || (value.status !== 'unavailable' && !value.evidence_object_ids.length) || !value.evidence_object_ids.every(id => evidenceIds.includes(id))) throw Error('Saved-page preview does not match this recorded answer.');
  await checkPreviewEvidence(value);
  return value;
}
