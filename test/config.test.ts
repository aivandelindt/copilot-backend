import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, parseCliEndpoint } from "../src/config.ts";

const argv = ["node", "index"];

test("defaults bind the API to every interface and the runtime to localhost:4321", () => {
  const config = loadConfig({}, argv);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 3000);
  assert.equal(config.cliHost, "localhost");
  assert.equal(config.cliPort, 4321);
  assert.equal(config.model, "gpt-5.4");
  assert.equal(config.openaiApiKey, undefined);
});

test("--host and --port override the environment", () => {
  const config = loadConfig({ HOST: "127.0.0.1", PORT: "3000" }, ["node", "index", "--host", "0.0.0.0", "--port", "8080"]);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 8080);
});

test("CLI_URL accepts host:port and a URL", () => {
  assert.deepEqual(parseCliEndpoint("copilot-cli:4321"), { host: "copilot-cli", port: 4321 });
  assert.deepEqual(parseCliEndpoint("http://localhost:4321"), { host: "localhost", port: 4321 });
  assert.deepEqual(parseCliEndpoint("http://[::1]:4321"), { host: "::1", port: 4321 });
});

test("CLI_URL rejects a missing port", () => {
  assert.throws(() => parseCliEndpoint("localhost"), /host and port/);
});

test("a blank OpenAI key stays unset", () => {
  const config = loadConfig({ OPENAI_API_KEY: "   " }, argv);
  assert.equal(config.openaiApiKey, undefined);
});

test("the CLI connection token is optional and trimmed", () => {
  assert.equal(loadConfig({}, argv).connectionToken, undefined);
  assert.equal(loadConfig({ COPILOT_CONNECTION_TOKEN: "  abc123  " }, argv).connectionToken, "abc123");
});
