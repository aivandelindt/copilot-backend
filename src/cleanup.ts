export interface SessionRecord {
  sessionId: string;
  startTime: Date;
}

export function expiredSessionIds(
  sessions: readonly SessionRecord[],
  now: number,
  maxAgeMs: number,
): string[] {
  const expired: string[] = [];
  for (const session of sessions) {
    const started = session.startTime.getTime();
    if (Number.isNaN(started)) {
      continue;
    }
    if (now - started > maxAgeMs) {
      expired.push(session.sessionId);
    }
  }
  return expired;
}
