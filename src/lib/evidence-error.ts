// Why evidence could not be shown. Kinds stay separate so a withdrawal is never
// offered as a retryable network failure and a checksum failure is never shown.
export type EvidenceErrorKind = 'invalid' | 'missing' | 'network' | 'integrity' | 'withdrawn' | 'status';
export class EvidenceError extends Error {
  kind: EvidenceErrorKind;
  constructor(kind: EvidenceErrorKind, message: string) { super(message); this.kind = kind; }
}
export function evidenceErrorKind(error: unknown): EvidenceErrorKind {
  return error instanceof EvidenceError ? error.kind : 'network';
}
export const retryable = (kind: EvidenceErrorKind) => kind === 'network' || kind === 'integrity' || kind === 'status';
