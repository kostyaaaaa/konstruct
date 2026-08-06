import type { ReactNode } from 'react';

export type PanelProps = {
  title: string;
  /** Rendered on the right of the header — a button or a status pill. */
  action?: ReactNode;
  children: ReactNode;
};
