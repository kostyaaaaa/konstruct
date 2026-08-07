/**
 * OpenDota's SQL explorer.
 *
 * `/api/explorer` runs read-only SQL against OpenDota's own database, which is
 * how this dataset is built with a few dozen queries instead of tens of
 * thousands of REST calls — and, more importantly, why point-in-time features
 * are possible at all: we get every match in time order and compute the
 * history ourselves.
 */

const ENDPOINT = 'https://api.opendota.com/api/explorer';

/** Free public service. Slow enough to stay welcome. */
const DELAY_MS = 2_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function query(sql, { retries = 3 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await sleep(DELAY_MS * 2 ** attempt);
    }

    try {
      const url = `${ENDPOINT}?sql=${encodeURIComponent(sql)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      const body = await response.json();
      if (body.err) {
        // A SQL error will fail identically every time — do not retry it.
        throw new Error(`SQL error: ${JSON.stringify(body.err).slice(0, 300)}`);
      }
      return body.rows ?? [];
    } catch (error) {
      if (String(error.message).startsWith('SQL error')) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new Error(`explorer query failed after ${retries + 1} attempts`, { cause: lastError });
}

/** Month boundaries from `from` up to now, as unix seconds. */
export function monthWindows(fromIso) {
  const windows = [];
  const cursor = new Date(fromIso);
  const now = new Date();

  while (cursor < now) {
    const start = Math.floor(cursor.getTime() / 1000);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    windows.push({
      start,
      end: Math.floor(cursor.getTime() / 1000),
      label: new Date(start * 1000).toISOString().slice(0, 7),
    });
  }

  return windows;
}

export const politeDelay = () => sleep(DELAY_MS);
