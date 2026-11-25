const secretPattern = /(?:gho_|github_pat_|ghp_|sk-)[A-Za-z0-9_]+|Bearer\s+\S+/gi;

export function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.replace(secretPattern, "[redacted]").slice(0, 500);
}
