import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.ts";
import { createSdkRuntime } from "../src/sdk.ts";

test("builds an attached client for the headless CLI", () => {
  const config = loadConfig(
    { CLI_URL: "copilot-cli:4321", COPILOT_CONNECTION_TOKEN: "abc123" },
    ["node", "index"],
  );
  const runtime = createSdkRuntime(config);
  assert.equal(typeof runtime.start, "function");
  assert.equal(typeof runtime.stop, "function");
});
