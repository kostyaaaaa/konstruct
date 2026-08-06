import type { ReactNode } from 'react';

export type PanelProps = {
  title: string;
  action?: ReactNode;
  /** Drop the body padding when the content provides its own. */
  flush?: boolean;
  children: ReactNode;
};
