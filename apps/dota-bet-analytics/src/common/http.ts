/**
 * Strips a query-string API key from a URL.
 *
 * **This lives here, not at the logging call site, because the URL escapes
 * through error messages as well as through fields.** Steam puts its key in
 * the query string, so every string built from a URL — a thrown message, a
 * `reason` handed to an observer — carries the key unless it is removed at the
 * point the string is made. Redacting only the `url` field leaks it through
 * `reason`, which is what happened.
 */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:key|api_key|token)=)[^&]+/gi, '$1REDACTED');
}

/** Thrown for a response we should not retry — the request itself was wrong. */
export class HttpClientError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} from ${redactUrl(url)}`);
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
  /** Default `GET`. */
  method?: string;
  /** Serialised as JSON, with the matching content type. */
  body?: unknown;
  headers?: Record<string, string>;
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
 *
 * **A retried write can arrive twice.** A request that times out may still
 * have been carried out by the other side, so anything not a `GET` should
 * carry whatever idempotency key its API offers.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 10_000, retries = 3, observer, method = 'GET', body, headers } = options;
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
      const response = await fetch(url, {
        method,
        headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} from ${redactUrl(url)}`);
        continue;
      }

      if (!response.ok) {
        throw new HttpClientError(response.status, url);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpClientError) {
        throw error;
      }
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  observer?.onGiveUp?.({ url, attempts: retries + 1, reason });

  throw new Error(`Request failed after ${retries + 1} attempts: ${redactUrl(url)}`, {
    cause: lastError,
  });
}
