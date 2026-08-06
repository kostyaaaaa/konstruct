import type { NetWorthChartProps } from './types';

const WIDTH = 720;
const HEIGHT = 180;
const PADDING = 8;

/**
 * Net worth difference over the match, drawn as inline SVG.
 *
 * The x axis is **in-game time**, not wall clock. Pauses are frequent in pro
 * play, and plotting against wall clock would stretch those gaps into slopes
 * that never happened.
 */
export function NetWorthChart({ points }: NetWorthChartProps) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">Not enough snapshots yet — the graph needs at least two.</p>
    );
  }

  const diffs = points.map((point) => point.radiantNetWorth - point.direNetWorth);
  const times = points.map((point) => point.gameTime);

  const maxAbs = Math.max(...diffs.map(Math.abs), 1000);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = Math.max(maxTime - minTime, 1);

  const x = (time: number) => PADDING + ((time - minTime) / timeSpan) * (WIDTH - PADDING * 2);
  const y = (diff: number) => HEIGHT / 2 - (diff / maxAbs) * (HEIGHT / 2 - PADDING);

  const line = points
    .map(
      (point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.gameTime)} ${y(diffs[index] ?? 0)}`,
    )
    .join(' ');

  const area = `${line} L ${x(maxTime)} ${HEIGHT / 2} L ${x(minTime)} ${HEIGHT / 2} Z`;
  const last = diffs[diffs.length - 1] ?? 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Net worth difference over time. Currently ${Math.abs(last)} gold ahead for ${last >= 0 ? 'Radiant' : 'Dire'}.`}
      >
        <line
          x1={PADDING}
          y1={HEIGHT / 2}
          x2={WIDTH - PADDING}
          y2={HEIGHT / 2}
          stroke="currentColor"
          className="text-line"
          strokeDasharray="3 3"
        />
        <path d={area} className={last >= 0 ? 'fill-radiant/10' : 'fill-dire/10'} />
        <path
          d={line}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={last >= 0 ? 'stroke-radiant' : 'stroke-dire'}
        />
      </svg>

      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>{Math.round(minTime / 60)}m</span>
        <span>
          <span className={last >= 0 ? 'text-radiant' : 'text-dire'}>
            {last >= 0 ? 'Radiant' : 'Dire'} +{Math.abs(last).toLocaleString()}
          </span>{' '}
          gold · {points.length} snapshots
        </span>
        <span>{Math.round(maxTime / 60)}m</span>
      </div>
    </div>
  );
}
