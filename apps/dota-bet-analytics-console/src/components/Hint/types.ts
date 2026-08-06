import type { ReactNode } from 'react';

export type HintProps = {
  /** The explanation, shown by the browser on hover. */
  text: string;
  className?: string;
  children: ReactNode;
};
