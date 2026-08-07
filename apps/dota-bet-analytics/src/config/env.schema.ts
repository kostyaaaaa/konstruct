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
  /* OpenDota, for league tier and post-match backfill. No key needed. */
  OPENDOTA_API_URL: z.string().url().default('https://api.opendota.com/api'),
  /* League ids to track regardless of tier, comma separated.

     OpenDota's `excluded` tier is a judgement, and an uneven one: it holds
     FACEIT pickup games and real tournaments side by side. Tracking the whole
     tier would multiply the snapshot archive by roughly seventeen, most of it
     unnamed pub teams. This is the escape hatch for the handful worth having,
     and it is a variable so adding one needs no deploy. */
  EXTRA_LEAGUE_IDS: z.string().optional(),

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
