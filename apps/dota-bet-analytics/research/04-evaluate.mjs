/**
 * Step 4 — score every strategy over the whole history.
 *
 * Reported per strategy:
 *
 * - **accuracy** — how often the pick won. The number to beat is
 *   always-radiant, not 50%.
 * - **by margin** — accuracy restricted to confident calls. This is the one
 *   that matters for betting: a strategy is only useful if it gets *better*
 *   as it gets more confident.
 *
 * The first months are skipped. Every player starts this dataset with an empty
 * record, so early predictions are made on almost no history and would
 * flatter or punish a strategy for the wrong reason.
 */
import { readFileSync } from 'node:fs';

import { scoreSide, strategies } from './strategies.mjs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

/** Six months of warm-up before anything counts. */
const WARMUP_SECONDS = 182 * 24 * 3600;
const cutoff = rows[0].start_time + WARMUP_SECONDS;
const scored = rows.filter((r) => r.start_time >= cutoff);

const MARGINS = [0, 2, 5, 10, 20];

console.log(`${rows.length} matches, ${scored.length} after warm-up\n`);
console.log(
  'strategy'.padEnd(22) + MARGINS.map((m) => `≥${m}%`.padStart(14)).join('') + '   picks radiant',
);
console.log('-'.repeat(22 + MARGINS.length * 14 + 16));

const ci = (right, total) => (total ? 1.96 * Math.sqrt(0.25 / total) * 100 : 0);

for (const strategy of strategies) {
  const buckets = MARGINS.map(() => ({ right: 0, total: 0 }));
  let radiantPicks = 0;

  for (const row of scored) {
    const r = scoreSide(row.radiant, strategy.params, true);
    const d = scoreSide(row.dire, strategy.params, false);
    if (r === d) {
      continue;
    }

    const picksRadiant = r > d;
    const correct = picksRadiant === row.radiant_win;
    const larger = Math.max(Math.abs(r), Math.abs(d));
    const marginPercent = larger > 0 ? (Math.abs(r - d) / larger) * 100 : 0;
    radiantPicks += picksRadiant ? 1 : 0;

    MARGINS.forEach((threshold, i) => {
      if (marginPercent >= threshold) {
        buckets[i].total += 1;
        buckets[i].right += correct ? 1 : 0;
      }
    });
  }

  const cells = buckets
    .map(({ right, total }) =>
      total < 50
        ? 'n/a'.padStart(14)
        : `${((100 * right) / total).toFixed(1)}% (${total})`.padStart(14),
    )
    .join('');
  const share = ((100 * radiantPicks) / buckets[0].total).toFixed(0);
  console.log(strategy.name.padEnd(22) + cells + `   ${share}%`);
}

console.log(
  '\n95% confidence is roughly ±' + ci(0, scored.length).toFixed(1) + '% at full sample,',
);
console.log('±4.4% at n=500, ±9.8% at n=100 — small buckets prove very little.\n');
for (const s of strategies) {
  console.log(`  ${s.name.padEnd(22)} ${s.idea}`);
}
