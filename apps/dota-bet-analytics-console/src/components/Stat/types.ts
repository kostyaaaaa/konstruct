import type { ReactNode } from 'react';

export type StatTone = 'neutral' | 'ok' | 'warn' | 'bad';

export type StatProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
};
