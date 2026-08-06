import type { PredictionPlayer } from '@/lib/api';

export type TeamRosterProps = {
  side: 'radiant' | 'dire';
  teamName?: string;
  score: number;
  players: PredictionPlayer[];
  favoured: boolean;
};
