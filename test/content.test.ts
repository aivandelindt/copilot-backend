import assert from "node:assert/strict";
import test from "node:test";
import { readAssistantContent } from "../src/content.ts";
import { safeMessage } from "../src/errors.ts";

test("reads assistant message content", () => {
  assert.equal(readAssistantContent({ data: { content: "hello" } }), "hello");
  assert.equal(readAssistantContent(undefined), "");
  assert.equal(readAssistantContent({ data: {} }), "");
});

test("redacts credentials from error text", () => {
  const error = new Error("auth failed for gho_secret and sk-secret");
  const message = safeMessage(error);
  assert.equal(message.includes("gho_secret"), false);
  assert.equal(message.includes("sk-secret"), false);
  assert.match(message, /\[redacted\]/);
});
