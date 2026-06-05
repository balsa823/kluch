export interface Config {
  databaseUrl: string;
  baseDomain: string;
  port: number;
}

type Env = Record<string, string | undefined>;

/** Loads and validates configuration, failing fast with a clear message. */
export function loadConfig(env: Env = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing required env var: DATABASE_URL");

  return {
    databaseUrl,
    baseDomain: env.BASE_DOMAIN ?? "kluche.me",
    port: Number(env.PORT ?? 8080),
  };
}
