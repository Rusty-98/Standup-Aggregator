/** Pure digest quiet-day rule (no DB). */
export function computeDigestEligibility(
  activeMemberCount: number,
  submittedCount: number
): { needed: number; eligible: boolean } {
  const needed = Math.min(2, Math.max(0, activeMemberCount));
  return {
    needed,
    eligible: activeMemberCount <= 0 ? false : submittedCount >= needed
  };
}
