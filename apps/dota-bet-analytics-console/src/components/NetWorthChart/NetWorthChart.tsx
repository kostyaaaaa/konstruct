import type { NetWorthChartProps } from './types';

const WIDTH = 720;
const HEIGHT = 180;
const PADDING = 8;

interface Sample {
  time: number;
  diff: number;
}

/** A run of samples on one side of the zero line, drawn in that side's colour. */
interface Segment {
  radiantAhead: boolean;
  samples: Sample[];
}

/**
 * Splits the series wherever it crosses zero.
 *
 * The crossing point is interpolated and given to both runs, so the two
 * coloured paths meet exactly on the zero line instead of leaving a gap or
 * overshooting by a whole sample.
 */
function toSegments(samples: Sample[]): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = {
    radiantAhead: (samples[0]?.diff ?? 0) >= 0,
    samples: samples.slice(0, 1),
  };

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const sample = samples[index]!;
    const radiantAhead = sample.diff >= 0;

    if (radiantAhead === current.radiantAhead) {
      current.samples.push(sample);
      continue;
    }

    /* Where the line meets zero between the two samples. The denominator
       cannot be zero: the sign changed, so the two differ. */
    const ratio = previous.diff / (previous.diff - sample.diff);
    const crossing: Sample = {
      time: previous.time + ratio * (sample.time - previous.time),
      diff: 0,
    };

    current.samples.push(crossing);
    segments.push(current);
    current = { radiantAhead, samples: [crossing, sample] };
  }

  segments.push(current);
  return segments;
}

/**
 * Net worth difference over the match, drawn as inline SVG.
 *
 * The x axis is **in-game time**, not wall clock. Pauses are frequent in pro
 * play, and plotting against wall clock would stretch those gaps into slopes
 * that never happened.
 *
 * Colour follows who led at each moment, not who leads at the end: the stretch
 * where Radiant was ahead stays green even in a match Dire went on to win.
 * Colouring the whole line by the final value makes an even game look
 * one-sided from the first minute.
 */
export function NetWorthChart({ points }: NetWorthChartProps) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">Not enough snapshots yet — the graph needs at least two.</p>
    );
  }

  const samples: Sample[] = points.map((point) => ({
    time: point.gameTime,
    diff: point.radiantNetWorth - point.direNetWorth,
  }));

  const maxAbs = Math.max(...samples.map((sample) => Math.abs(sample.diff)), 1000);
  const minTime = Math.min(...samples.map((sample) => sample.time));
  const maxTime = Math.max(...samples.map((sample) => sample.time));
  const timeSpan = Math.max(maxTime - minTime, 1);

  const x = (time: number) => PADDING + ((time - minTime) / timeSpan) * (WIDTH - PADDING * 2);
  const y = (diff: number) => HEIGHT / 2 - (diff / maxAbs) * (HEIGHT / 2 - PADDING);

  const segments = toSegments(samples);
  const last = samples[samples.length - 1]?.diff ?? 0;

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

        {segments.map((segment, index) => {
          const line = segment.samples
            .map(
              (sample, position) =>
                `${position === 0 ? 'M' : 'L'} ${x(sample.time)} ${y(sample.diff)}`,
            )
            .join(' ');

          const first = segment.samples[0]!;
          const final = segment.samples[segment.samples.length - 1]!;
          const area = `${line} L ${x(final.time)} ${HEIGHT / 2} L ${x(first.time)} ${HEIGHT / 2} Z`;

          return (
            <g key={index}>
              <path
                d={area}
                className={segment.radiantAhead ? 'fill-radiant/10' : 'fill-dire/10'}
              />
              <path
                d={line}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={segment.radiantAhead ? 'stroke-radiant' : 'stroke-dire'}
              />
            </g>
          );
        })}
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
