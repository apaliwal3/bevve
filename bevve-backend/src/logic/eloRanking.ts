export interface Comparison {
  id: string;
  winner_bar_id: string;
  loser_bar_id: string;
  created_at: string;
}
export function calculateRankings(comparisons: Comparison[]) {
  const scores = new Map<string, number>();
  const counts = new Map<string, number>();
  const ordered = [...comparisons].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  for (const match of ordered) {
    const w = match.winner_bar_id, l = match.loser_bar_id;
    if (w === l) throw new Error('Choose two different bars');
    const winner = scores.get(w) ?? 1000, loser = scores.get(l) ?? 1000;
    const change = 32 * (1 - 1 / (1 + 10 ** ((loser - winner) / 400)));
    scores.set(w, winner + change); scores.set(l, loser - change);
    counts.set(w, (counts.get(w) ?? 0) + 1); counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return [...scores].map(([bar_id, score]) => ({ bar_id, score, comparisons: counts.get(bar_id)! }))
    .sort((a, b) => b.score - a.score || a.bar_id.localeCompare(b.bar_id));
}
