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

  /* Report email, sent through Resend's HTTP API rather than SMTP — Railway
     firewalls outbound SMTP below the Pro plan. */
  RESEND_API_KEY: z.string().min(1),
  /* The sender, as `Name <address>`. Until a domain is verified with Resend
     this has to be `onboarding@resend.dev`, and mail can only be delivered to
     the address the Resend account was registered with. A variable rather
     than a constant so moving to a real domain is a config change. */
  REPORT_FROM: z.string().min(1),
  EMAIL: z.string().email(),

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
