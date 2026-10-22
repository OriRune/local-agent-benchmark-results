// Presentation policy only: immutable editions, grades and evidence are retained.
// Use source identities so new bank versions inherit the retirement decision.
export function retiredQuestion(question: { source_id: string }): string | null {
  return question.source_id === 'real_linux2-R5'
    ? 'This sheet-music organization task was retired because its requirements were too ambiguous for a consistent comparison. It does not contribute to scores or rankings.'
    : null;
}

export function currentScoringDescription(suite: { family_id: string; scoring: string }): string {
  if (suite.family_id !== 'real_linux2') return suite.scoring;
  return suite.scoring.replace(/R5 subjective layout judging is deferred; objective checks are still reported but excluded from the primary pass score when the judge is required\. No paid model judge\./,
    'The sheet-music organization task is retired and excluded from scores because its requirements were too ambiguous.');
}
