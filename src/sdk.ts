import { CopilotClient, RuntimeConnection } from "@microsoft/copilot-sdk";
import type { Config } from "./config.js";
import type { ChatSession, CopilotRuntime } from "./backend.js";
import { buildSessionOptions, type SessionOptionInput } from "./session-options.js";

export interface SdkRuntime extends CopilotRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createSdkRuntime(config: Config): SdkRuntime {
  const client = new CopilotClient({
    mode: "empty",
    runtime:
      config.connectionToken === undefined
        ? RuntimeConnection.forTcp(config.cliHost, config.cliPort)
        : RuntimeConnection.forTcp(config.cliHost, config.cliPort, {
            connectionToken: config.connectionToken,
          }),
  });

  function optionsFor(gitHubToken: string | undefined): SessionOptionInput {
    const input: SessionOptionInput = {
      model: config.model,
      openaiBaseUrl: config.openaiBaseUrl,
    };
    if (gitHubToken !== undefined) {
      input.gitHubToken = gitHubToken;
    }
    if (config.openaiApiKey !== undefined) {
      input.openaiApiKey = config.openaiApiKey;
    }
    return input;
  }

  function wrap(session: {
    sendAndWait(options: { prompt: string }, timeout?: number): Promise<unknown>;
    disconnect(): Promise<void>;
  }): ChatSession {
    return {
      sendAndWait(prompt, timeoutMs) {
        return session.sendAndWait({ prompt }, timeoutMs);
      },
      disconnect() {
        return session.disconnect();
      },
    };
  }

  return {
    start() {
      return client.start();
    },
    async stop() {
      await client.stop();
    },
    getStatus() {
      return client.getStatus();
    },
    async listSessions() {
      const sessions = await client.listSessions();
      return sessions.map((session) => ({
        sessionId: session.sessionId,
        startTime: session.startTime,
      }));
    },
    deleteSession(sessionId) {
      return client.deleteSession(sessionId);
    },
    async resumeSession(sessionId, gitHubToken) {
      const session = await client.resumeSession(sessionId, buildSessionOptions(optionsFor(gitHubToken)));
      return wrap(session);
    },
    async createSession(sessionId, gitHubToken) {
      const session = await client.createSession({
        ...buildSessionOptions(optionsFor(gitHubToken)),
        sessionId,
      });
      return wrap(session);
    },
  };
}
