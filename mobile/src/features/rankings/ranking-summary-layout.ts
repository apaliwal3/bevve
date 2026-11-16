export function rankingBadgeSize(fontScale: number) {
  const diameter = 67 * Math.max(1, fontScale);
  return { width: diameter, height: diameter };
}
