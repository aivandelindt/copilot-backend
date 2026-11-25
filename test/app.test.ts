import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../src/app.ts";
import type { Backend, ChatInput, JobInput } from "../src/backend.ts";
import { listen } from "../src/listen.ts";

function backend(overrides: Partial<Backend> = {}): Backend & { chats: ChatInput[]; jobs: JobInput[] } {
  const chats: ChatInput[] = [];
  const jobs: JobInput[] = [];
  return {
    chats,
    jobs,
    async health() {
      return { version: "1.0.115", protocolVersion: 4 };
    },
    async chat(input) {
      chats.push(input);
      return `echo:${input.message}`;
    },
    async job(input) {
      jobs.push(input);
      return `job:${input.prompt}`;
    },
    async cleanup() {
      return [];
    },
    ...overrides,
  };
}

async function withServer(appBackend: Backend, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = await listen(createApp(appBackend), "0.0.0.0", 0);
  const address = server.address() as AddressInfo;
  try {
    assert.equal(address.address, "0.0.0.0");
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("serves health and chat on 0.0.0.0 and forwards the bearer token", async () => {
  const appBackend = backend();
  await withServer(appBackend, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      cli: { version: "1.0.115", protocolVersion: 4 },
    });

    const chat = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer gho_user",
      },
      body: JSON.stringify({ sessionId: "user-1-chat", message: "Hello" }),
    });
    assert.equal(chat.status, 200);
    assert.deepEqual(await chat.json(), { sessionId: "user-1-chat", content: "echo:Hello" });
    assert.deepEqual(appBackend.chats, [
      { sessionId: "user-1-chat", message: "Hello", gitHubToken: "gho_user" },
    ]);
  });
});

test("reports CLI outage and invalid chat bodies", async () => {
  const appBackend = backend({
    async health() {
      throw new Error("connect ECONNREFUSED");
    },
  });
  await withServer(appBackend, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 503);
    assert.deepEqual(await health.json(), { ok: false });

    const missing = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    assert.equal(missing.status, 400);

    const badAuth = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic abc",
      },
      body: JSON.stringify({ sessionId: "user-1", message: "Hello" }),
    });
    assert.equal(badAuth.status, 400);
  });
});

test("runs a background job and hides runtime failures", async () => {
  const appBackend = backend({
    async job() {
      throw new Error("runtime down gho_secret");
    },
  });
  await withServer(appBackend, async (baseUrl) => {
    const failed = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "42", prompt: "Summarize" }),
    });
    assert.equal(failed.status, 502);
    const body = (await failed.json()) as { error: string };
    assert.equal(body.error, "Copilot request failed.");
    assert.equal(body.error.includes("gho_secret"), false);
  });
});
