export function formatScoreValue(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const normalized = Number(value);
  const formatted = Number.isInteger(normalized)
    ? normalized.toString()
    : normalized.toFixed(digits).replace(/\.0+$/, "");

  return `${formatted} / 100`;
}
