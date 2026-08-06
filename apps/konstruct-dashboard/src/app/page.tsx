import { Dashboard } from '@/components/Dashboard';
import { apps, resolveHref, type AppEnv } from '@/data/apps';

/**
 * URLs depend on where this dashboard is running, so they are resolved here —
 * on the server, where `ENV` exists. The browser only ever receives the one
 * URL that applies.
 *
 * Rendered per request rather than prerendered, because `ENV` is injected at
 * run time by Infisical rather than baked in at build time. A static build
 * would freeze whichever environment happened to build it.
 */
export const dynamic = 'force-dynamic';

function currentEnv(): AppEnv {
  const env = process.env.ENV;
  return env === 'prod' || env === 'staging' ? env : 'dev';
}

export default function Page() {
  const env = currentEnv();
  const entries = apps.map((app) => ({ app, href: resolveHref(app, env) }));

  return <Dashboard entries={entries} />;
}
