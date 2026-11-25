import type { Config } from "./config.js";
import { expiredSessionIds, type SessionRecord } from "./cleanup.js";
import { readAssistantContent } from "./content.js";
import { safeMessage } from "./errors.js";
import { withSessionLock } from "./lock.js";

export interface ChatSession {
  sendAndWait(prompt: string, timeoutMs: number): Promise<unknown>;
  disconnect(): Promise<void>;
}

export interface CopilotRuntime {
  getStatus(): Promise<unknown>;
  listSessions(): Promise<readonly SessionRecord[]>;
  deleteSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string, gitHubToken: string | undefined): Promise<ChatSession>;
  createSession(sessionId: string, gitHubToken: string | undefined): Promise<ChatSession>;
}

export interface ChatInput {
  sessionId: string;
  message: string;
  gitHubToken: string | undefined;
}

export interface JobInput {
  id: string;
  prompt: string;
  gitHubToken: string | undefined;
}

export interface Backend {
  health(): Promise<unknown>;
  chat(input: ChatInput): Promise<string>;
  job(input: JobInput): Promise<string>;
  cleanup(now?: number): Promise<readonly string[]>;
}

export function createBackend(
  runtime: CopilotRuntime,
  config: Pick<Config, "chatTimeoutMs" | "sessionMaxAgeMs">,
): Backend {
  return {
    health() {
      return runtime.getStatus();
    },

    chat(input) {
      return withSessionLock(input.sessionId, async () => {
        const session = await openSession(runtime, input.sessionId, input.gitHubToken);
        try {
          const response = await session.sendAndWait(input.message, config.chatTimeoutMs);
          return readAssistantContent(response);
        } finally {
          await release(session);
        }
      });
    },

    job(input) {
      const sessionId = `job-${input.id}`;
      return withSessionLock(sessionId, async () => {
        const session = await runtime.createSession(sessionId, input.gitHubToken);
        try {
          const response = await session.sendAndWait(input.prompt, config.chatTimeoutMs);
          return readAssistantContent(response);
        } finally {
          await release(session);
        }
      });
    },

    async cleanup(now = Date.now()) {
      const sessions = await runtime.listSessions();
      const ids = expiredSessionIds(sessions, now, config.sessionMaxAgeMs);
      for (const sessionId of ids) {
        await runtime.deleteSession(sessionId);
      }
      return ids;
    },
  };
}

async function openSession(
  runtime: CopilotRuntime,
  sessionId: string,
  gitHubToken: string | undefined,
): Promise<ChatSession> {
  try {
    return await runtime.resumeSession(sessionId, gitHubToken);
  } catch {
    return runtime.createSession(sessionId, gitHubToken);
  }
}

async function release(session: ChatSession): Promise<void> {
  try {
    await session.disconnect();
  } catch (error) {
    console.error(`session disconnect failed: ${safeMessage(error)}`);
  }
}
