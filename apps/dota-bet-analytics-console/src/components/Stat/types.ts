import type { ReactNode } from 'react';

export type StatTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'muted';

export type StatProps = {
  label: string;
  value: ReactNode;
  /** Replaces the label underneath when there is something better to say. */
  hint?: string;
  tone?: StatTone;
};

export type StatGridProps = { children: ReactNode };
