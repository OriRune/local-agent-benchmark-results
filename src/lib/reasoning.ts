/** Saved requests stay intact; observations never establish a verified toggle. */
type Control = { reasoning_requested: string; verification?: string; observed_reasoning?: string; presentation_included?: boolean };
export function displayedMode(c: Control): string {
  return c.observed_reasoning === 'enabled' ? 'on' : c.reasoning_requested;
}
export function conditionLabel(c: Control): string {
  if (c.verification === 'native_reasoning') return 'Thinking / Reasoning version';
  return c.observed_reasoning === 'enabled' ? 'Reasoning enabled (observed; requested off)' : `Thinking ${c.reasoning_requested}`;
}
export function visibleCondition(c: Control): boolean {
  return c.presentation_included !== false;
}
