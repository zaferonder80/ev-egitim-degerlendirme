export function getRubricMaxScore(
  rubricScale: Record<string, string> | null | undefined,
): number {
  if (!rubricScale) return 5;

  const scores = Object.keys(rubricScale)
    .map(key => Number(key))
    .filter(value => Number.isInteger(value) && value > 0);

  return scores.length > 0 ? Math.max(...scores) : 5;
}

export function getRubricLabel(
  rubricScale: Record<string, string> | null | undefined,
  score: number,
): string {
  if (!rubricScale) return "";

  const label = rubricScale[String(score)];
  return label?.trim() ?? "";
}
