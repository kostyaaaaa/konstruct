/**
 * Does dropping team strength find more value, or just more ignorance?
 *
 * The argument for dropping it: a bookmaker already prices team strength, so a
 * model that includes it mostly agrees with the favourite and earns short odds.
 *
 * The argument against: knowing team strength is how you work out the *fair*
 * probability. Bet where your number differs from the price. A model that does
 * not know a team is weak will back underdogs often — but because it is blind,
 * not because it knows something.
 *
 * This settles it by measuring both against the same calibrated price.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const usable = rows.filter(
  (r) =>
    r.start_time >= rows[0].start_time + 182 * 24 * 3600 &&
    r.radiant.teamGames > 20 &&
    r.dire.teamGames > 20,
);
const SPLIT = Date.parse('2025-01-01') / 1000;
const train = usable.filter((r) => r.start_time < SPLIT);
const test = usable.filter((r) => r.start_time >= SPLIT);
const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function fit(params) {
  const rawDiff = (row) => params.map((p) => row.radiant[p] - row.dire[p]);
  const base = train.map(rawDiff);
  const means = params.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const stds = params.map(
    (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - means[i]) ** 2, 0) / base.length) || 1,
  );
  const encode = (row) => [...rawDiff(row).map((v, i) => (v - means[i]) / stds[i]), 1];
  const X = train.map(encode);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = new Array(params.length + 1).fill(0);
  for (let e = 0; e < 600; e += 1) {
    const g = new Array(w.length).fill(0);
    for (let i = 0; i < X.length; i += 1) {
      const err = sigmoid(X[i].reduce((s, v, j) => s + v * w[j], 0)) - y[i];
      for (let j = 0; j < w.length; j += 1) {
        g[j] += err * X[i][j];
      }
    }
    for (let j = 0; j < w.length; j += 1) {
      w[j] -= 0.5 * (g[j] / X.length + 1e-4 * w[j]);
    }
  }
  return test.map((r) => sigmoid(encode(r).reduce((s, v, j) => s + v * w[j], 0)));
}

const withElo = fit(['heroWinRateShrunk', 'heroGames', 'teamElo', 'heroMatchup']);
const withoutElo = fit(['heroWinRateShrunk', 'heroGames', 'heroMatchup']);

/** The honest price: Elo with the divisor that makes it calibrated. */
const price = test.map((r) => 1 / (1 + 10 ** ((r.dire.teamElo - r.radiant.teamElo) / 540)));

function report(name, probs) {
  const acc = (100 * probs.filter((p, i) => p > 0.5 === Boolean(testY[i])).length) / probs.length;

  /* Only the picks that go against the favourite — the ones that would pay. */
  let n = 0;
  let right = 0;
  let fair = 0;
  for (let i = 0; i < test.length; i += 1) {
    const backsRadiant = probs[i] > 0.5;
    const favouriteIsRadiant = price[i] > 0.5;
    if (backsRadiant === favouriteIsRadiant) {
      continue;
    }
    n += 1;
    right += backsRadiant === Boolean(testY[i]) ? 1 : 0;
    fair += backsRadiant ? price[i] : 1 - price[i];
  }
  const hit = (100 * right) / n;
  const fairPct = (100 * fair) / n;
  const ci = 1.96 * Math.sqrt(0.25 / n) * 100;
  console.log(
    `  ${name.padEnd(16)} overall ${acc.toFixed(1)}%  |  underdog picks: ${String(n).padStart(5)}` +
      `, right ${hit.toFixed(1)}%, fair ${fairPct.toFixed(1)}%, edge ${(hit - fairPct >= 0 ? '+' : '') + (hit - fairPct).toFixed(1)} ±${ci.toFixed(1)}`,
  );
}

console.log(`held-out matches: ${test.length}\n`);
report('with Elo', withElo);
report('without Elo', withoutElo);

console.log('\n  the same, but only where the model is confident (p >= 0.60):');
function confident(name, probs) {
  let n = 0;
  let right = 0;
  let fair = 0;
  for (let i = 0; i < test.length; i += 1) {
    if (Math.abs(probs[i] - 0.5) < 0.1) {
      continue;
    }
    const backsRadiant = probs[i] > 0.5;
    if (backsRadiant === price[i] > 0.5) {
      continue;
    }
    n += 1;
    right += backsRadiant === Boolean(testY[i]) ? 1 : 0;
    fair += backsRadiant ? price[i] : 1 - price[i];
  }
  if (n < 50) {
    console.log(`  ${name.padEnd(16)} too few (${n})`);
    return;
  }
  const hit = (100 * right) / n;
  const fairPct = (100 * fair) / n;
  const ci = 1.96 * Math.sqrt(0.25 / n) * 100;
  console.log(
    `  ${name.padEnd(16)} ${String(n).padStart(5)} bets, right ${hit.toFixed(1)}%, fair ${fairPct.toFixed(1)}%, edge ${(hit - fairPct >= 0 ? '+' : '') + (hit - fairPct).toFixed(1)} ±${ci.toFixed(1)}`,
  );
}
confident('with Elo', withElo);
confident('without Elo', withoutElo);

/**
 * The third option: keep Elo in the model, but choose bets by how far the
 * model's probability sits from the price — not by whether it picked the
 * underdog.
 *
 * Backing an underdog is a crude filter. It throws away a favourite priced at
 * 60% that the model thinks is 75%, which is just as much value and much safer.
 */
console.log('\n  keeping Elo, selecting by disagreement with the price:');
console.log('    gap     bets    right    fair    edge');
for (const gap of [0.03, 0.05, 0.08, 0.12]) {
  let n = 0,
    right = 0,
    fair = 0;
  for (let i = 0; i < test.length; i += 1) {
    const backRadiant = withElo[i] - price[i] > gap;
    const backDire = price[i] - withElo[i] > gap;
    if (!backRadiant && !backDire) {
      continue;
    }
    n += 1;
    right += (backRadiant ? testY[i] === 1 : testY[i] === 0) ? 1 : 0;
    fair += backRadiant ? price[i] : 1 - price[i];
  }
  if (n < 50) {
    continue;
  }
  const hit = (100 * right) / n,
    f = (100 * fair) / n;
  const ci = 1.96 * Math.sqrt(0.25 / n) * 100;
  console.log(
    `    >${(gap * 100).toFixed(0)}pp  ${String(n).padStart(6)}   ${hit.toFixed(1)}%   ${f.toFixed(1)}%   ${(hit - f >= 0 ? '+' : '') + (hit - f).toFixed(1)} ±${ci.toFixed(1)}`,
  );
}

console.log('\n  same selection, model WITHOUT Elo:');
console.log('    gap     bets    right    fair    edge');
for (const gap of [0.03, 0.05, 0.08, 0.12]) {
  let n = 0,
    right = 0,
    fair = 0;
  for (let i = 0; i < test.length; i += 1) {
    const backRadiant = withoutElo[i] - price[i] > gap;
    const backDire = price[i] - withoutElo[i] > gap;
    if (!backRadiant && !backDire) {
      continue;
    }
    n += 1;
    right += (backRadiant ? testY[i] === 1 : testY[i] === 0) ? 1 : 0;
    fair += backRadiant ? price[i] : 1 - price[i];
  }
  if (n < 50) {
    continue;
  }
  const hit = (100 * right) / n,
    f = (100 * fair) / n;
  const ci = 1.96 * Math.sqrt(0.25 / n) * 100;
  console.log(
    `    >${(gap * 100).toFixed(0)}pp  ${String(n).padStart(6)}   ${hit.toFixed(1)}%   ${f.toFixed(1)}%   ${(hit - f >= 0 ? '+' : '') + (hit - f).toFixed(1)} ±${ci.toFixed(1)}`,
  );
}
