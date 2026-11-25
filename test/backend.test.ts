import assert from "node:assert/strict";
import test from "node:test";
import { createBackend, type ChatSession, type CopilotRuntime } from "../src/backend.ts";

interface Recorded {
  calls: string[];
  resumeFails: boolean;
}

function runtime(recorded: Recorded, content = "answer"): CopilotRuntime {
  const session = (label: string): ChatSession => ({
    async sendAndWait(prompt) {
      recorded.calls.push(`${label}:send:${prompt}`);
      if (prompt === "explode") {
        throw new Error("model failed");
      }
      return { data: { content } };
    },
    async disconnect() {
      recorded.calls.push(`${label}:disconnect`);
    },
  });

  return {
    async getStatus() {
      return { version: "1.0.115" };
    },
    async listSessions() {
      return [
        { sessionId: "old", startTime: new Date(0) },
        { sessionId: "new", startTime: new Date() },
      ];
    },
    async deleteSession(sessionId) {
      recorded.calls.push(`delete:${sessionId}`);
    },
    async resumeSession(sessionId, gitHubToken) {
      recorded.calls.push(`resume:${sessionId}:${gitHubToken ?? ""}`);
      if (recorded.resumeFails) {
        throw new Error("missing");
      }
      return session("resume");
    },
    async createSession(sessionId, gitHubToken) {
      recorded.calls.push(`create:${sessionId}:${gitHubToken ?? ""}`);
      return session("create");
    },
  };
}

test("chat resumes a session, creates it when resume fails, and disconnects", async () => {
  const recorded: Recorded = { calls: [], resumeFails: true };
  const backend = createBackend(runtime(recorded), { chatTimeoutMs: 1000, sessionMaxAgeMs: 10 });
  const content = await backend.chat({
    sessionId: "user-1",
    message: "Hello",
    gitHubToken: "gho_user",
  });

  assert.equal(content, "answer");
  assert.deepEqual(recorded.calls, [
    "resume:user-1:gho_user",
    "create:user-1:gho_user",
    "create:send:Hello",
    "create:disconnect",
  ]);
});

test("chat disconnects when the model request fails", async () => {
  const recorded: Recorded = { calls: [], resumeFails: false };
  const backend = createBackend(runtime(recorded), { chatTimeoutMs: 1000, sessionMaxAgeMs: 10 });
  await assert.rejects(
    backend.chat({ sessionId: "user-2", message: "explode", gitHubToken: undefined }),
    /model failed/,
  );
  assert.deepEqual(recorded.calls, ["resume:user-2:", "resume:send:explode", "resume:disconnect"]);
});

test("a job uses a job session id and releases it", async () => {
  const recorded: Recorded = { calls: [], resumeFails: false };
  const backend = createBackend(runtime(recorded), { chatTimeoutMs: 1000, sessionMaxAgeMs: 10 });
  const content = await backend.job({ id: "42", prompt: "Summarize", gitHubToken: undefined });
  assert.equal(content, "answer");
  assert.deepEqual(recorded.calls, ["create:job-42:", "create:send:Summarize", "create:disconnect"]);
});

test("cleanup deletes only expired sessions", async () => {
  const recorded: Recorded = { calls: [], resumeFails: false };
  const backend = createBackend(runtime(recorded), { chatTimeoutMs: 1000, sessionMaxAgeMs: 1000 });
  const deleted = await backend.cleanup(60_000);
  assert.deepEqual(deleted, ["old"]);
  assert.deepEqual(recorded.calls, ["delete:old"]);
});
