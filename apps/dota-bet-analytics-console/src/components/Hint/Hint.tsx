import type { HintProps } from './types';

/**
 * Explains a number on hover.
 *
 * **A native `title`, not a rendered tooltip.** A positioned tooltip needs to
 * measure and flip near the viewport edge, which means client JavaScript in an
 * app that otherwise ships none — and inside a panel with rounded corners it
 * gets clipped. The browser's own tooltip has neither problem and works before
 * hydration, which for a console whose whole job is displaying numbers is the
 * better trade.
 *
 * The dotted underline is the only signal that an explanation exists, so it
 * stays visible rather than appearing on hover.
 */
export function Hint({ text, className, children }: HintProps) {
  return (
    <span
      title={text}
      className={`cursor-help underline decoration-line-strong decoration-dotted underline-offset-4 ${
        className ?? ''
      }`}
    >
      {children}
    </span>
  );
}
