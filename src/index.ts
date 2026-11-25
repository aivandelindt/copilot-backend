import { createApp } from "./app.js";
import { createBackend } from "./backend.js";
import { loadConfig } from "./config.js";
import { safeMessage } from "./errors.js";
import { listen } from "./listen.js";
import { createSdkRuntime } from "./sdk.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const sdk = createSdkRuntime(config);
  await connectRuntime(sdk.start.bind(sdk), config.startAttempts);

  const backend = createBackend(sdk, config);
  const server = await listen(createApp(backend), config.host, config.port);
  const address = server.address();
  const port = address !== null && typeof address !== "string" ? address.port : config.port;
  console.log(`listening on ${config.host}:${port}; copilot runtime ${config.cliHost}:${config.cliPort}`);

  const runCleanup = () => {
    void backend.cleanup().catch((error: unknown) => {
      console.error(`session cleanup failed: ${safeMessage(error)}`);
    });
  };
  runCleanup();
  const timer = setInterval(runCleanup, config.cleanupIntervalMs);
  timer.unref();

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log(`received ${signal}`);
    clearInterval(timer);
    server.close(() => {
      void sdk.stop().finally(() => {
        process.exit(0);
      });
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function connectRuntime(start: () => Promise<void>, attempts: number): Promise<void> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await start();
      return;
    } catch (error) {
      last = error;
      console.error(`copilot runtime not ready (${attempt}/${attempts}): ${safeMessage(error)}`);
      if (attempt < attempts) {
        await delay(1000);
      }
    }
  }
  throw last instanceof Error ? last : new Error("Copilot runtime did not become ready");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error: unknown) => {
  console.error(safeMessage(error));
  process.exit(1);
});
