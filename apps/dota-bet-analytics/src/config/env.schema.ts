import { z } from 'zod';

/**
 * Every environment variable the API reads, in one place.
 *
 * Values come from Infisical (`/dota-bet-analytics`). This schema is the only
 * description of what the app needs to run — there is no `.env.example`.
 */
export const envSchema = z.object({
  ENV: z.enum(['dev', 'staging', 'prod']),
  /* Railway and most container hosts assign the port themselves, so this
     default only applies to a local run with nothing configured. */
  PORT: z.coerce.number().int().positive().default(4001),

  /* Mongo. Assembled into a connection string in MongoConfig. */
  DB_HOST: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  /* Live pro match discovery. */
  STEAM_API_KEY: z.string().min(1),
  /* OpenDota, for league metadata and post-match backfill. No key needed. */
  OPENDOTA_API_URL: z.string().url().default('https://api.opendota.com/api'),
  /* Smallest prize pool, in dollars, worth tracking.

     This is the whole filter between a usable feed and noise. A tier label was
     tried first and proved unreliable: OpenDota called four of eight
     Dotabuff-professional tournaments `excluded`. Prize money comes from Valve
     and cannot be applied inconsistently — on one evening's feed, every league
     with money was worth having and all twelve without were pickup games.

     The number is a dial, not a fact about Dota. At $10,000 it admitted the
     $10k-$20k band, which a 26,174-match backtest scored at 55.1% while every
     band above and below scored 58-65%. Raising it to $20,000 cuts the feed to
     roughly 30% of its former size, which is the trade. */
  MIN_PRIZE_POOL: z.coerce.number().int().min(0).default(20_000),

  /* The prediction report, posted to a Telegram channel.

     Not email: every provider requires a verified sending domain, and this
     app is deployed on subdomains whose DNS we do not control. */
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  /* Numeric id, or `@channelusername` for a public channel. */
  TELEGRAM_CHAT_ID: z.string().min(1),
  /* Where the report's "View match" link points. Optional: without it the
     report is still sent, just without a way through to the graph. */
  CONSOLE_URL: z.string().url().optional(),

  /* Logging. The logger reads these itself; they are listed so a missing one
     fails at startup rather than silently disabling Axiom. */
  AXIOM_DATASET: z.string().min(1),
  AXIOM_TOKEN: z.string().min(1),
  AXIOM_EDGE: z.string().min(1),
  /* Reading logs back needs a different token from writing them. Optional:
     without it the logs endpoint reports itself unavailable instead of
     failing, so the app still runs. */
  AXIOM_QUERY_TOKEN: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the environment at startup. Throws with every problem listed at
 * once, so a misconfigured deploy fails immediately instead of on first use.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }

  return result.data;
}
