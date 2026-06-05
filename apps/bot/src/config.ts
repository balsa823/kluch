export interface Config {
  botToken: string;
  databaseUrl: string;
  operatorChatId: number;
  deeplApiKey: string;
  deeplApiUrl: string;
  port: number;
}

type Env = Record<string, string | undefined>;

/** Loads and validates configuration, failing fast with a clear message. */
export function loadConfig(env: Env = process.env): Config {
  const required = (key: string): string => {
    const value = env[key];
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
  };

  const operatorChatId = Number(required("OPERATOR_CHAT_ID"));
  if (Number.isNaN(operatorChatId)) {
    throw new Error("OPERATOR_CHAT_ID must be a number (the operator group's chat id)");
  }

  return {
    botToken: required("BOT_TOKEN"),
    databaseUrl: required("DATABASE_URL"),
    operatorChatId,
    deeplApiKey: required("DEEPL_API_KEY"),
    deeplApiUrl: env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate",
    port: Number(env.PORT ?? 8080),
  };
}
