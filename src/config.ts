export interface Config {
  host: string;
  port: number;
  cliHost: string;
  cliPort: number;
  model: string;
  sessionMaxAgeMs: number;
  cleanupIntervalMs: number;
  chatTimeoutMs: number;
  startAttempts: number;
  openaiBaseUrl: string;
  openaiApiKey?: string;
  connectionToken?: string;
}

export interface CliEndpoint {
  host: string;
  port: number;
}

export function parseCliEndpoint(value: string): CliEndpoint {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("CLI_URL must include a host and port, for example localhost:4321");
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
  } catch {
    throw new Error("CLI_URL must include a host and port, for example localhost:4321");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "" || url.port === "") {
    throw new Error("CLI_URL must include a host and port, for example localhost:4321");
  }

  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("CLI_URL port must be between 1 and 65535");
  }

  return { host, port };
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv,
): Config {
  const endpoint = parseCliEndpoint(env.CLI_URL ?? "localhost:4321");
  const openaiApiKey = blankToUndefined(env.OPENAI_API_KEY);
  const connectionToken = blankToUndefined(env.COPILOT_CONNECTION_TOKEN);
  const config: Config = {
    host: flag(argv, "host") ?? blankToUndefined(env.HOST) ?? "0.0.0.0",
    port: integer(flag(argv, "port") ?? env.PORT, "PORT", 3000, 1, 65535),
    cliHost: endpoint.host,
    cliPort: endpoint.port,
    model: blankToUndefined(env.MODEL) ?? "gpt-5.4",
    sessionMaxAgeMs: integer(env.SESSION_MAX_AGE_MS, "SESSION_MAX_AGE_MS", 24 * 60 * 60 * 1000, 1, Number.MAX_SAFE_INTEGER),
    cleanupIntervalMs: integer(env.CLEANUP_INTERVAL_MS, "CLEANUP_INTERVAL_MS", 60 * 60 * 1000, 1, Number.MAX_SAFE_INTEGER),
    chatTimeoutMs: integer(env.CHAT_TIMEOUT_MS, "CHAT_TIMEOUT_MS", 120_000, 1, Number.MAX_SAFE_INTEGER),
    startAttempts: integer(env.START_ATTEMPTS, "START_ATTEMPTS", 30, 1, 300),
    openaiBaseUrl: blankToUndefined(env.OPENAI_BASE_URL) ?? "https://api.openai.com/v1",
  };

  if (openaiApiKey !== undefined) {
    config.openaiApiKey = openaiApiKey;
  }
  if (connectionToken !== undefined) {
    config.connectionToken = connectionToken;
  }

  return config;
}

function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`--${name} requires a value`);
  }
  return value;
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function integer(
  value: string | undefined,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}
