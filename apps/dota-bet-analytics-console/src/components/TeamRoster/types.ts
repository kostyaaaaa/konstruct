import type { PredictionPlayer } from '@/lib/api';

export type TeamRosterProps = {
  side: 'radiant' | 'dire';
  teamName?: string;
  score: number;
  /** This side's draft strength against the other five heroes, 0-100. */
  matchup?: number;
  players: PredictionPlayer[];
  favoured: boolean;
};
