import type { EventPresentation, SemanticEvent } from '../types';

export type EventListener = (event: SemanticEvent) => void;

export interface EventBus {
  /** Listen to one event type, or '*' for every event. Returns an unsubscribe. */
  on(type: string, listener: EventListener): () => void;
  emit(event: SemanticEvent): void;
}

/** Listeners for a type run before '*' listeners, each in subscription order. */
export function createEventBus(): EventBus {
  const listeners = new Map<string, EventListener[]>();

  return {
    on(type, listener) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
      return () => {
        const current = listeners.get(type);
        if (!current) return;
        const i = current.indexOf(listener);
        if (i >= 0) current.splice(i, 1);
      };
    },
    emit(event) {
      for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
      for (const fn of [...(listeners.get('*') ?? [])]) fn(event);
    },
  };
}

/**
 * Games declare every event type up front, and say how it should be presented.
 * The proof reads this list to check that each event reaches two senses
 * (property 8) without playing the game.
 */
export interface EventRegistry {
  define(
    type: string,
    presentation?: EventPresentation,
  ): (at: number, data?: Record<string, unknown>) => SemanticEvent;
  list(): string[];
  has(type: string): boolean;
  /** How a declared event is presented, or undefined if it was declared without one. */
  presentation(type: string): EventPresentation | undefined;
}

function checkPresentation(type: string, p: EventPresentation): void {
  for (const field of ['say', 'caption'] as const) {
    const text = p[field];
    if (text !== undefined && text.trim() === '') throw new Error(`Event '${type}' has an empty ${field}.`);
  }
  // Noise has no pitch, so a noise sound may give 0. A tone needs a pitch above zero.
  const pitchOk = p.sound === undefined || (Number.isFinite(p.sound.hz) && (p.sound.shape?.noise ? p.sound.hz >= 0 : p.sound.hz > 0));
  if (!pitchOk) {
    throw new Error(`Event '${type}' needs a sound pitch above zero.`);
  }
}

export function createEventRegistry(): EventRegistry {
  const types = new Set<string>();
  const presentations = new Map<string, EventPresentation>();
  return {
    define(type, presentation) {
      if (type.trim() === '') throw new Error('An event needs a name.');
      if (presentation !== undefined) {
        checkPresentation(type, presentation);
        presentations.set(type, presentation);
      }
      types.add(type);
      return (at, data) => (data === undefined ? { type, at } : { type, at, data });
    },
    list: () => [...types],
    has: (type) => types.has(type),
    presentation: (type) => presentations.get(type),
  };
}
