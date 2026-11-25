import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionOptions } from "../src/session-options.ts";

test("empty mode sessions allow only custom tools and keep GitHub auth per session", () => {
  const options = buildSessionOptions({
    model: "gpt-5.4",
    openaiBaseUrl: "https://api.openai.com/v1",
    gitHubToken: "gho_user",
  });

  assert.equal(options.model, "gpt-5.4");
  assert.deepEqual(options.tools?.availableTools, ["custom:*"]);
  assert.equal(options.github?.token, "gho_user");
  assert.equal(options.state?.skipEmbeddingRetrieval, true);
  assert.equal(options.state?.embeddingCacheStorage, "in-memory");
  assert.equal(options.git?.enableHostGitOperations, false);
  assert.equal(options.inference, undefined);
});

test("BYOK selects the named OpenAI model and disables Copilot API routing", () => {
  const options = buildSessionOptions({
    model: "gpt-5.4",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiApiKey: "sk-test",
  });

  assert.equal(options.model, "openai/chat");
  assert.equal(options.github?.capi?.enabled, false);
  assert.equal(options.inference?.providers?.[0]?.name, "openai");
  assert.equal(options.inference?.providers?.[0]?.apiKey, "sk-test");
  assert.equal(options.inference?.models?.[0]?.wireModel, "gpt-5.4");
});
