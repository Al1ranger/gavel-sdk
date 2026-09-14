import { hashJSON } from '../evidence/normalizer.ts';
export type LifecycleEvent = { sequence: number; type: string; timestamp: number; data: unknown; previousHash: string; hash: string };
export function appendEvent(events: readonly LifecycleEvent[], type: string, timestamp: number, data: unknown): LifecycleEvent {
  const event = { sequence: events.length, type, timestamp, data: structuredClone(data), previousHash: events.at(-1)?.hash ?? 'GENESIS' };
  return { ...event, hash: hashJSON(event) };
}
export function verifyEventLog(events: readonly LifecycleEvent[]): boolean {
  return events.every((event, index) => { const { hash, ...body } = event; return event.sequence === index && event.previousHash === (events[index - 1]?.hash ?? 'GENESIS') && hashJSON(body) === hash; });
}
