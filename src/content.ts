export function readAssistantContent(response: unknown): string {
  if (typeof response !== "object" || response === null || !("data" in response)) {
    return "";
  }
  const data = response.data;
  if (typeof data !== "object" || data === null || !("content" in data)) {
    return "";
  }
  return typeof data.content === "string" ? data.content : "";
}
