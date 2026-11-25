import express, { type ErrorRequestHandler } from "express";
import type { Backend } from "./backend.js";
import { safeMessage } from "./errors.js";

const idPattern = /^[A-Za-z0-9._:-]{1,200}$/;
const maxTextLength = 100_000;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function createApp(backend: Backend): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      service: "copilot-backend",
      health: "/health",
      chat: "/api/chat",
      jobs: "/api/jobs",
    });
  });

  app.get("/health", async (_req, res) => {
    try {
      const status = await backend.health();
      res.json({ ok: true, cli: status });
    } catch (error) {
      console.error(`cli health check failed: ${safeMessage(error)}`);
      res.status(503).json({ ok: false });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const body = parseChatBody(req.body);
    if (!body.ok) {
      res.status(400).json({ error: body.error });
      return;
    }
    const token = readGitHubToken(req.header("authorization"));
    if (!token.ok) {
      res.status(400).json({ error: token.error });
      return;
    }

    try {
      const content = await backend.chat({
        sessionId: body.value.sessionId,
        message: body.value.message,
        gitHubToken: token.token,
      });
      res.json({ sessionId: body.value.sessionId, content });
    } catch (error) {
      console.error(`chat failed: ${safeMessage(error)}`);
      res.status(502).json({ error: "Copilot request failed." });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    const body = parseJobBody(req.body);
    if (!body.ok) {
      res.status(400).json({ error: body.error });
      return;
    }
    const token = readGitHubToken(req.header("authorization"));
    if (!token.ok) {
      res.status(400).json({ error: token.error });
      return;
    }

    try {
      const content = await backend.job({
        id: body.value.id,
        prompt: body.value.prompt,
        gitHubToken: token.token,
      });
      res.json({ id: body.value.id, sessionId: `job-${body.value.id}`, content });
    } catch (error) {
      console.error(`job failed: ${safeMessage(error)}`);
      res.status(502).json({ error: "Copilot request failed." });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  const reportError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (isJsonError(error)) {
      res.status(400).json({ error: "Request body must be JSON." });
      return;
    }
    console.error(safeMessage(error));
    if (!res.headersSent) {
      res.status(500).json({ error: "Request failed." });
    }
  };
  app.use(reportError);

  return app;
}

function parseChatBody(body: unknown): Parsed<{ sessionId: string; message: string }> {
  const record = recordOf(body);
  if (record === undefined) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const sessionId = requiredId(record.sessionId, "sessionId");
  if (!sessionId.ok) {
    return sessionId;
  }
  const message = requiredText(record.message, "message");
  if (!message.ok) {
    return message;
  }
  return { ok: true, value: { sessionId: sessionId.value, message: message.value } };
}

function parseJobBody(body: unknown): Parsed<{ id: string; prompt: string }> {
  const record = recordOf(body);
  if (record === undefined) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const id = requiredId(record.id, "id");
  if (!id.ok) {
    return id;
  }
  const prompt = requiredText(record.prompt, "prompt");
  if (!prompt.ok) {
    return prompt;
  }
  return { ok: true, value: { id: id.value, prompt: prompt.value } };
}

function recordOf(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }
  return body as Record<string, unknown>;
}

function requiredId(value: unknown, name: string): Parsed<string> {
  if (typeof value !== "string" || !idPattern.test(value)) {
    return {
      ok: false,
      error: `${name} must be 1-200 characters of letters, numbers, dots, underscores, colons, or hyphens.`,
    };
  }
  return { ok: true, value };
}

function requiredText(value: unknown, name: string): Parsed<string> {
  if (typeof value !== "string" || value.trim() === "" || value.length > maxTextLength) {
    return { ok: false, error: `${name} must be a non-empty string up to ${maxTextLength} characters.` };
  }
  return { ok: true, value };
}

function readGitHubToken(
  header: string | undefined,
): { ok: true; token: string | undefined } | { ok: false; error: string } {
  if (header === undefined) {
    return { ok: true, token: undefined };
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const token = match?.[1];
  if (token === undefined) {
    return { ok: false, error: "Authorization must be a Bearer token." };
  }
  return { ok: true, token };
}

function isJsonError(error: unknown): boolean {
  return error instanceof SyntaxError && "status" in error && error.status === 400;
}
