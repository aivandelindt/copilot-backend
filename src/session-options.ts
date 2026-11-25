import type { CreateSessionOptions } from "@microsoft/copilot-sdk";

export interface SessionOptionInput {
  model: string;
  openaiBaseUrl: string;
  gitHubToken?: string;
  openaiApiKey?: string;
}

const toolRejection = {
  kind: "reject",
  feedback: "This server does not allow tool execution.",
} as const;

export function buildSessionOptions(input: SessionOptionInput): CreateSessionOptions {
  const byok = input.openaiApiKey !== undefined;
  const options: CreateSessionOptions = {
    model: byok ? "openai/chat" : input.model,
    clientName: "copilot-backend",
    tools: { availableTools: ["custom:*"] },
    permissions: { onRequest: () => toolRejection },
    state: {
      skipEmbeddingRetrieval: true,
      embeddingCacheStorage: "in-memory",
    },
    git: { enableHostGitOperations: false },
  };

  if (input.gitHubToken !== undefined && byok) {
    options.github = {
      token: input.gitHubToken,
      capi: { enabled: false },
    };
  } else if (input.gitHubToken !== undefined) {
    options.github = { token: input.gitHubToken };
  } else if (byok) {
    options.github = { capi: { enabled: false } };
  }

  if (input.openaiApiKey !== undefined) {
    options.inference = {
      providers: [
        {
          name: "openai",
          type: "openai",
          baseUrl: input.openaiBaseUrl,
          apiKey: input.openaiApiKey,
        },
      ],
      models: [
        {
          provider: "openai",
          id: "chat",
          wireModel: input.model,
        },
      ],
    };
  }

  return options;
}
