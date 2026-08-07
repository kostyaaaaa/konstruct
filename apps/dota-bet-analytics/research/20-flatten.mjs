/**
 * Turns the fitted model back into a plain weighted sum.
 *
 * The fit standardises each param — `(gap − mean) / sd` — which is what makes
 * the coefficients comparable while fitting. But it is only algebra:
 *
 *   c × (gap − mean) / sd   =   (c / sd) × gap   −   (c × mean / sd)
 *
 * The first part is a plain weight per param. The second is a constant, the
 * same for every match, so it folds into the side bonus and changes nothing
 * about which side scores higher.
 *
 * So a simple sum can carry exactly the same model, with a margin that means
 * what it looks like.
 */
import { readFileSync } from 'node:fs';

const FITTED = {
  heroWinRate: { c: 0.3314, mean: -0.0037, sd: 5.8007 },
  heroMatchup: { c: 0.1598, mean: 0.0098, sd: 2.715 },
  heroGames: { c: 0.0544, mean: -0.0768, sd: 27.9203 },
};
const INTERCEPT = 0.0759;

/** Chosen so scores land near 50-60, like the numbers this replaced. */
const SCALE = 10;

const weights = {};
let constant = INTERCEPT;
for (const [param, { c, mean, sd }] of Object.entries(FITTED)) {
  weights[param] = (c / sd) * SCALE;
  constant -= (c * mean) / sd;
}

console.log('  WEIGHTS = {');
for (const [p, w] of Object.entries(weights)) {
  console.log(`    ${p}: ${w.toFixed(4)},`);
}
console.log(`  }\n  RADIANT_BONUS = ${(constant * SCALE).toFixed(4)}\n`);

/* Prove the two forms pick the same side on every held-out match. */
const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const test = rows.filter((r) => r.start_time >= Date.parse('2025-01-01') / 1000);

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
let same = 0;
let right = 0;

for (const r of test) {
  let z = INTERCEPT;
  for (const [param, { c, mean, sd }] of Object.entries(FITTED)) {
    const key = param === 'heroWinRate' ? 'heroWinRateShrunk' : param;
    z += c * ((r.radiant[key] - r.dire[key] - mean) / sd);
  }
  const oldPick = sigmoid(z) > 0.5;

  const score = (side, isRadiant) =>
    weights.heroWinRate * side.heroWinRateShrunk +
    weights.heroMatchup * side.heroMatchup +
    weights.heroGames * side.heroGames +
    (isRadiant ? constant * SCALE : 0);
  const newPick = score(r.radiant, true) > score(r.dire, false);

  if (oldPick === newPick) {
    same += 1;
  }
  right += newPick === r.radiant_win ? 1 : 0;
}

console.log(
  `  same pick as the fitted model: ${same}/${test.length} (${((100 * same) / test.length).toFixed(2)}%)`,
);
console.log(`  accuracy of the flat version : ${((100 * right) / test.length).toFixed(1)}%`);

const example = test[Math.floor(test.length / 2)];
const s = (side, isR) =>
  weights.heroWinRate * side.heroWinRateShrunk +
  weights.heroMatchup * side.heroMatchup +
  weights.heroGames * side.heroGames +
  (isR ? constant * SCALE : 0);
const r = s(example.radiant, true);
const d = s(example.dire, false);
console.log(`\n  example match: radiant ${r.toFixed(1)}, dire ${d.toFixed(1)},`);
console.log(`  margin ${((Math.abs(r - d) / Math.max(r, d)) * 100).toFixed(2)}%`);
