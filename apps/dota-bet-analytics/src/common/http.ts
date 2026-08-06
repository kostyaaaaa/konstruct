/** Thrown for a response we should not retry — the request itself was wrong. */
export class HttpClientError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} from ${url}`);
    this.name = 'HttpClientError';
  }
}

/** Told about each retry and each final failure, so they are not invisible. */
export interface FetchObserver {
  onRetry?: (info: { url: string; attempt: number; reason: string; waitMs: number }) => void;
  onGiveUp?: (info: { url: string; attempts: number; reason: string }) => void;
}

export interface FetchJsonOptions {
  /** Abort a single attempt after this long. Default 10s. */
  timeoutMs?: number;
  /** Extra attempts after the first. Default 3. */
  retries?: number;
  observer?: FetchObserver;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fetch` with a timeout and bounded retries, for the three external APIs.
 *
 * Retries on 429, 5xx and network failure with exponential backoff plus
 * jitter — the jitter matters because several matches are polled together and
 * lockstep retries would hit the same rate limit again.
 *
 * A 4xx other than 429 is not retried: the request is wrong and repeating it
 * only burns quota.
 *
 * Retries are reported through `observer` rather than logged here, so this
 * stays a plain function with no dependency on Nest's container. Without it a
 * rate-limit storm would be completely silent — the caller only ever sees the
 * final result.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 10_000, retries = 3, observer } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      const waitMs = Math.min(2 ** attempt * 250, 8_000) + Math.random() * 250;
      observer?.onRetry?.({
        url,
        attempt,
        reason: lastError instanceof Error ? lastError.message : String(lastError),
        waitMs: Math.round(waitMs),
      });
      await sleep(waitMs);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} from ${url}`);
        continue;
      }

      if (!response.ok) {
        throw new HttpClientError(response.status, url);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpClientError) throw error;
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  observer?.onGiveUp?.({ url, attempts: retries + 1, reason });

  throw new Error(`Request failed after ${retries + 1} attempts: ${url}`, { cause: lastError });
}
