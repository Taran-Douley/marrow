import { describe, expect, it } from 'vitest';
import { createEventBus, createEventRegistry } from '../src/events';
import type { SemanticEvent } from '../src/types';

describe('event bus (Req 3a.1)', () => {
  it('delivers an event to listeners of its type and to wildcard listeners', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.on('hurt', (e) => seen.push(`hurt:${e.type}`));
    bus.on('*', (e) => seen.push(`any:${e.type}`));
    bus.emit({ type: 'hurt', at: 1 });
    bus.emit({ type: 'cleared', at: 2 });
    expect(seen).toEqual(['hurt:hurt', 'any:hurt', 'any:cleared']);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus();
    let count = 0;
    const off = bus.on('hurt', () => count++);
    bus.emit({ type: 'hurt', at: 0 });
    off();
    bus.emit({ type: 'hurt', at: 1 });
    expect(count).toBe(1);
  });

  it('is safe when a listener unsubscribes during emit', () => {
    const bus = createEventBus();
    const order: number[] = [];
    const off = bus.on('x', () => {
      order.push(1);
      off();
    });
    bus.on('x', () => order.push(2));
    bus.emit({ type: 'x', at: 0 });
    bus.emit({ type: 'x', at: 1 });
    expect(order).toEqual([1, 2, 2]);
  });
});

describe('event registry', () => {
  it('records declared types and builds events with data only', () => {
    const reg = createEventRegistry();
    const approaching = reg.define('obstacle-approaching');
    reg.define('hurt');
    const e: SemanticEvent = approaching(3.2, { object: 'grave' });
    expect(e).toEqual({ type: 'obstacle-approaching', at: 3.2, data: { object: 'grave' } });
    expect(reg.list()).toEqual(['obstacle-approaching', 'hurt']);
    expect(reg.has('hurt')).toBe(true);
    expect(reg.has('nope')).toBe(false);
  });

  it('omits data when none is given and rejects empty names', () => {
    const reg = createEventRegistry();
    expect(reg.define('cleared')(1)).toEqual({ type: 'cleared', at: 1 });
    expect(() => reg.define('  ')).toThrow();
  });
});
