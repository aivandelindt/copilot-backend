const tails = new Map<string, Promise<void>>();

export function withSessionLock<T>(sessionId: string, action: () => Promise<T>): Promise<T> {
  const previous = tails.get(sessionId) ?? Promise.resolve();
  const run = previous.then(action, action);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(sessionId, settled);
  void settled.then(() => {
    if (tails.get(sessionId) === settled) {
      tails.delete(sessionId);
    }
  });
  return run;
}
