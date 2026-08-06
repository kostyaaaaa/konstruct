/**
 * Links out of the console.
 *
 * The dashboard lives somewhere different per environment, the same way the
 * dashboard's own card links do. It is a public URL rather than a secret, so
 * the defaults live here in code — but `DASHBOARD_URL` overrides them, which
 * means a domain change can be a variable rather than a redeploy.
 */

const DEFAULTS: Record<string, string> = {
  dev: 'http://localhost:3000',
  prod: 'https://konstruct-dashboard.vercel.app',
};

export function dashboardUrl(): string {
  if (process.env.DASHBOARD_URL) {
    return process.env.DASHBOARD_URL;
  }

  const env = process.env.ENV ?? 'dev';
  return DEFAULTS[env] ?? DEFAULTS.dev!;
}
