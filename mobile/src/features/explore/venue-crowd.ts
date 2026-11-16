import type { Venue } from '../../types/venue.ts';
import { aggregateCrowdReports, crowdClassificationLabels, type SessionCrowdReport } from '../contributions/contribution-state.ts';

export type EffectiveVenueCrowd = {
  source: 'demo' | 'session';
  level: number | null;
  label: string | null;
  isQuiet: boolean;
};

// Session reports supersede fictional snapshots. Expired or insufficient session
// data stays unknown rather than reviving a demo level as current information.
export function selectVenueCrowd(venue: Venue, reports: readonly SessionCrowdReport[] = [], now = Date.now()): EffectiveVenueCrowd {
  if (reports.some((report) => report.bar_id === venue.id.toLowerCase())) {
    const summary = aggregateCrowdReports(reports, venue.id, now);
    return {
      source: 'session',
      level: summary.classification === null ? null : summary.score,
      label: summary.classification === null ? null : crowdClassificationLabels[summary.classification],
      isQuiet: summary.classification === 'quiet',
    };
  }
  return {
    source: 'demo',
    level: venue.crowd?.level ?? null,
    label: venue.crowd?.label ?? null,
    isQuiet: venue.crowd !== null && venue.crowd.level <= 2,
  };
}
