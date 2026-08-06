/**
 * Runs tasks with a cap on how many are in flight.
 *
 * The old app fired twenty OpenDota requests at once per match, which is a
 * third of the free tier's per-minute budget in one burst. This keeps the same
 * work inside the limit.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) {
        continue;
      }
      results[index] = await task(item, index);
    }
  });

  await Promise.all(workers);
  return results;
}
