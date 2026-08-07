/**
 * Are the fitted weights actually right?
 *
 * The fit is hand-written gradient descent, so "it converged" is not something
 * to take on trust. This tries deliberately wrong weights on the held-out
 * matches. If the fitted ones are near-optimal, distorting them should make
 * accuracy fall — and if they were arbitrary, distorting them would not matter.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const test = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.start_time >= Date.parse('2025-01-01') / 1000);

const run = (name, w, bonus = 0.7568) => {
  const score = (s, isR) =>
    w.heroWinRate * s.heroWinRateShrunk +
    w.heroMatchup * s.heroMatchup +
    w.heroGames * s.heroGames +
    (isR ? bonus : 0);
  let right = 0;
  for (const r of test) {
    right += score(r.radiant, true) > score(r.dire, false) === r.radiant_win ? 1 : 0;
  }
  console.log(`  ${name.padEnd(34)} ${((100 * right) / test.length).toFixed(2)}%`);
};

const FITTED = { heroWinRate: 0.5713, heroMatchup: 0.5886, heroGames: 0.0195 };

console.log(`  ${test.length} held-out matches\n`);
run('FITTED weights', FITTED);
console.log('');
run('all three equal (1, 1, 1)', { heroWinRate: 1, heroMatchup: 1, heroGames: 1 });
run('hero win rate only', { heroWinRate: 1, heroMatchup: 0, heroGames: 0 });
run('matchup only', { heroWinRate: 0, heroMatchup: 1, heroGames: 0 });
run('games only', { heroWinRate: 0, heroMatchup: 0, heroGames: 1 });
console.log('');
run('win rate weight halved', { ...FITTED, heroWinRate: FITTED.heroWinRate / 2 });
run('win rate weight doubled', { ...FITTED, heroWinRate: FITTED.heroWinRate * 2 });
run('matchup weight halved', { ...FITTED, heroMatchup: FITTED.heroMatchup / 2 });
run('matchup weight doubled', { ...FITTED, heroMatchup: FITTED.heroMatchup * 2 });
run('games weight x20', { ...FITTED, heroGames: FITTED.heroGames * 20 });
console.log('');
run('no Radiant bonus', FITTED, 0);
run('always Radiant (baseline)', { heroWinRate: 0, heroMatchup: 0, heroGames: 0 }, 1);
