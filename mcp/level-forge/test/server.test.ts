import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { handle, serve, type Response } from '../src/protocol';

let nextId = 1;
const call = (name: string, args: Record<string, unknown> = {}): { text: string; data: Record<string, any>; isError: boolean } => {
  const reply = handle({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } }) as Response;
  expect(reply.error).toBeUndefined();
  const result = reply.result as { content: { text: string }[]; structuredContent?: Record<string, any>; isError: boolean };
  return { text: result.content[0]!.text, data: result.structuredContent ?? {}, isError: result.isError };
};

describe('the protocol', () => {
  it('answers initialize with its tools capability and agrees on a version it knows', () => {
    const r = handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })!.result as Record<string, any>;
    expect(r.protocolVersion).toBe('2025-03-26');
    expect(r.capabilities.tools).toBeDefined();
    expect(r.serverInfo.name).toBe('marrow-level-forge');
    const other = handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })!.result as Record<string, any>;
    expect(other.protocolVersion).toBe('2025-06-18');
  });

  it('gives no reply to a notification, and answers ping', () => {
    expect(handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    expect(handle({ jsonrpc: '2.0', id: 3, method: 'ping' })!.result).toEqual({});
  });

  it('lists every tool with a description and a schema', () => {
    const tools = (handle({ jsonrpc: '2.0', id: 4, method: 'tools/list' })!.result as { tools: { name: string; description: string; inputSchema: { type: string } }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(['generate_level', 'prove_level', 'prove_many', 'simulate_persona', 'review_level', 'a11y_report', 'prove_house', 'advise_game', 'sound_palette', 'quality_report']);
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('uses standard errors for a missing method, an unknown tool and a bad request', () => {
    expect(handle({ jsonrpc: '2.0', id: 5, method: 'resources/list' })!.error?.code).toBe(-32601);
    expect(handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope' } })!.error?.code).toBe(-32602);
    expect(handle('hello')!.error?.code).toBe(-32600);
  });

  it('reads lines from a stream and writes one reply per request, and a parse error for junk', async () => {
    const input = new PassThrough();
    const out: string[] = [];
    const done = serve(input, (line) => out.push(line));
    input.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\nnot json\n');
    input.write('{"jsonrpc":"2.0","id":2,"method":"tools/list"}'); // no newline at the end
    input.end();
    await done;
    const replies = out.map((l) => JSON.parse(l) as Response);
    expect(replies).toHaveLength(3);
    expect(replies[0]).toMatchObject({ id: 1, result: {} });
    expect(replies[1]!.error?.code).toBe(-32700);
    expect((replies[2]!.result as { tools: unknown[] }).tools).toHaveLength(10);
  });
});

describe('generate_level', () => {
  it('is the same level for the same seed, with a window in ms at each speed', () => {
    const a = call('generate_level', { seed: 12 });
    const b = call('generate_level', { seed: 12 });
    expect(a.data).toEqual(b.data);
    expect(a.data.obstacles).toHaveLength(12);
    const first = a.data.obstacles[0];
    expect(first.windowMs.slow).toBeGreaterThanOrEqual(650);
    expect(first.windowMs.fast).toBeGreaterThanOrEqual(400);
    expect(a.text).toMatch(/^Level 12: 12 obstacles/);
  });

  it('builds a lesson level with numbers, and some obstacles to let pass', () => {
    const r = call('generate_level', { seed: 3, game: { obstacles: [{ name: 'stone', width: [0.16, 0.3] }], lesson: { rule: 'prime', values: [2, 50] } } });
    const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
    for (const o of r.data.obstacles) expect(o.jump).toBe(primes.has(o.value));
    expect(r.data.obstacles.some((o: { jump: boolean }) => !o.jump)).toBe(true);
  });
});

describe('prove_level', () => {
  it('passes a generated level, in plain words', () => {
    const r = call('prove_level', { seed: 5 });
    expect(r.data.passed).toBe(true);
    expect(r.text).toMatch(/^Level 5 passes all \d+ properties\. It can be finished with one switch\./);
  });

  it('turns red with a counterexample when an obstacle is too wide (the crypt demo)', () => {
    const r = call('prove_level', {
      level: { seed: 17, obstacles: [{ kind: 'grave', start: 6.5, width: 0.2 }, { kind: 'crypt', start: 10, width: 1.0 }] },
      game: { obstacles: [{ name: 'grave', width: [0.16, 0.3] }, { name: 'crypt', width: [1.0, 1.0] }] },
    });
    expect(r.data.passed).toBe(false);
    expect(r.text).toMatch(/FAILS/);
    expect(r.text).toMatch(/must not be served/);
    expect(JSON.stringify(r.data.results)).toMatch(/crypt/);
  });

  it('turns green again when the width is fixed', () => {
    const r = call('prove_level', {
      level: { seed: 17, obstacles: [{ kind: 'grave', start: 6.5, width: 0.2 }, { kind: 'crypt', start: 10, width: 0.3 }] },
      game: { obstacles: [{ name: 'grave', width: [0.16, 0.3] }, { name: 'crypt', width: [0.2, 0.3] }] },
    });
    expect(r.data.passed).toBe(true);
  });

  it('says what is wrong with a bad argument, as a tool error the caller can fix', () => {
    const r = call('prove_level', { seed: -1 });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/'seed' must be at least 0/);
    expect(call('prove_level', { seed: 1, game: { obstacles: [] } }).text).toMatch(/at least one obstacle/);
    expect(call('prove_level', { seed: 1, game: { lesson: { rule: 'multiples', values: [1, 10] } } }).text).toMatch(/needs 'tables'/);
  });
});

describe('prove_many', () => {
  it('proves 200 levels and gives the hard numbers', () => {
    const r = call('prove_many', { count: 200 });
    expect(r.data.levels).toBe(200);
    expect(r.data.passing).toBe(200);
    expect(r.data.narrowestWindowMs.slow).toBeGreaterThanOrEqual(650);
    expect(r.data.narrowestWindowMs.fast).toBeGreaterThanOrEqual(400);
    expect(r.text).toMatch(/^200 of 200 levels/);
  });

  it('lists the failing seeds when a game cannot be finished', () => {
    const r = call('prove_many', { count: 5, game: { obstacles: [{ name: 'wall', width: [1.5, 1.5] }] } });
    expect(r.data.passing).toBe(0);
    expect(r.data.failing[0].counterexample).toMatch(/wall/);
  });
});

describe('simulate_persona', () => {
  it('reports the default players at every speed, and a perfect player never falls', () => {
    const r = call('simulate_persona', { count: 20 });
    expect(r.data.rows).toHaveLength(15);
    const perfect = r.data.rows.filter((row: { persona: string }) => row.persona === 'perfect one-switch');
    expect(perfect.every((row: { clearRate: number }) => row.clearRate === 100)).toBe(true);
    const slow = r.data.rows.find((row: { persona: string; speed: string }) => row.persona.includes('250') && row.speed === 'slow');
    const fast = r.data.rows.find((row: { persona: string; speed: string }) => row.persona.includes('250') && row.speed === 'fast');
    expect(slow.clearRate).toBeGreaterThan(fast.clearRate);
  });

  it('takes its own players and speeds, and refuses nonsense', () => {
    const r = call('simulate_persona', { count: 10, speeds: ['slow'], personas: [{ kind: 'noisy', sigmaMs: 180 }] });
    expect(r.data.rows).toHaveLength(1);
    expect(call('simulate_persona', { personas: [{ kind: 'wizard' }] }).isError).toBe(true);
    expect(call('simulate_persona', { speeds: ['warp'] }).isError).toBe(true);
  });
});

describe('prove_house', () => {
  it('proves houses of different sizes, and refuses a house that cannot be built', () => {
    for (const [seed, width, height] of [[1, 6, 6], [2, 8, 8], [3, 10, 10]] as const) {
      expect(call('prove_house', { seed, width, height }).data.passed).toBe(true);
    }
    expect(call('prove_house', { seed: 1, width: 4, height: 4, minGhostStart: 60 }).isError).toBe(true);
    const ritual = call('prove_house', { seed: 2, relics: 3 });
    expect(ritual.data.passed).toBe(true);
    expect(ritual.data.results.map((r: { id: number }) => r.id)).toEqual([201, 202, 203, 204, 205, 206]);
  });

  it('proves the run length (207) when asked: some 12 by 10 houses fit 5 to 8 minutes at every speed and dwell, and a small house does not', () => {
    const ids = (r: { data: Record<string, any> }): number[] => r.data.results.map((x: { id: number }) => x.id);
    let fits = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = call('prove_house', { seed, width: 12, height: 10, relics: 3, runLength: true });
      expect(ids(r)).toEqual([201, 202, 203, 204, 205, 206, 207]);
      const length = r.data.results.find((x: { id: number }) => x.id === 207);
      // The other six properties hold for every house; only the length decides.
      expect(r.data.results.filter((x: { id: number; pass: boolean }) => x.id !== 207).every((x: { pass: boolean }) => x.pass)).toBe(true);
      expect(r.data.passed).toBe(length.pass);
      if (length.pass) fits += 1;
    }
    expect(fits).toBeGreaterThan(0);
    expect(fits).toBeLessThan(40);
    const small = call('prove_house', { seed: 2, width: 8, height: 8, relics: 3, runLength: true });
    expect(small.data.passed).toBe(false);
    expect(small.text).toMatch(/Run length fits/);
    expect(call('prove_house', { seed: 2, relics: 3, runLength: 'yes' }).isError).toBe(true);
  });
});

describe('review_level', () => {
  it('finds nothing in the default game at Slow', () => {
    const r = call('review_level', { seed: 1, count: 30 });
    expect(r.data.clean).toBe(30);
    expect(r.text).toMatch(/^30 of 30 levels have no findings\./);
  });

  it('reports a player who struggles at Fast and offers them a slower speed, not an easier level', () => {
    const r = call('review_level', { seed: 4, speed: 'fast', personas: [{ kind: 'noisy', sigmaMs: 250 }] });
    expect(r.data.passed).toBe(false);
    const f = r.data.findings[0];
    expect(f.cause).toMatch(/^one-switch, 250 ms timing error, level 4, obstacle \d+/);
    expect(['speed', 'none']).toContain(f.repair.change);
  });

  it('finds the gap when a game has no captions or markers, for the deaf reviewer', () => {
    const r = call('review_level', { seed: 2, personas: [{ kind: 'deaf' }], game: { omitChannels: ['captions', 'indicator'] } });
    expect(r.data.passed).toBe(false);
    expect(r.text).toMatch(/deaf player \(sight only\)/);
  });

  it('refuses a bad reviewer or speed', () => {
    expect(call('review_level', { seed: 1, personas: [{ kind: 'wizard' }] }).isError).toBe(true);
    expect(call('review_level', { seed: 1, speed: 'warp' }).isError).toBe(true);
  });
});

describe('a11y_report', () => {
  it('lists supported tags with the reasons, never says fully accessible, and gives Markdown', () => {
    const r = call('a11y_report', { name: 'Test game', levels: 20 });
    const supported = r.data.supported.map((e: { tag: string }) => e.tag);
    expect(supported).toEqual(expect.arrayContaining(['Mono Sound', 'Narrated Menus', 'Playable without Button Holds', 'Playable with Keyboard Only']));
    expect(r.data.markdown).toMatch(/^# Accessibility features: Test game/);
    expect(`${r.text}${r.data.markdown}`).not.toMatch(/fully accessible/i);
    expect(r.data.supported.length + r.data.toConfirm.length + r.data.notClaimed.length).toBe(24);
  });

  it('drops a tag when its channel is off', () => {
    const r = call('a11y_report', { levels: 10, game: { omitChannels: ['speech'] } });
    expect(r.data.supported.map((e: { tag: string }) => e.tag)).not.toContain('Narrated Menus');
  });

  it('claims surround sound only for a game with directional sound, and uses the house proof for navigation', () => {
    const plain = call('a11y_report', { levels: 10 });
    expect(plain.data.supported.map((e: { tag: string }) => e.tag)).not.toContain('Surround Sound');
    const nav = call('a11y_report', { levels: 10, navigation: true, directionalSound: true, spatialEvents: true, cameraMotion: true });
    expect(nav.data.supported.map((e: { tag: string }) => e.tag)).toContain('Surround Sound');
    expect(nav.data.proof.map((p: { id: number }) => p.id)).toEqual(expect.arrayContaining([201, 202, 203, 204]));
    expect(nav.data.toConfirm.map((e: { tag: string }) => e.tag)).toContain('Camera Comfort');
  });

  it('claims no input tag when the game cannot be finished', () => {
    const r = call('a11y_report', { levels: 5, game: { obstacles: [{ name: 'wall', width: [1.5, 1.5] }] } });
    expect(r.data.supported.map((e: { tag: string }) => e.tag)).not.toContain('Playable with Keyboard Only');
    expect(r.text).toMatch(/Failing proof properties/);
  });
});
describe('the advisor tools', () => {
  const brief = 'Name: Star Hopper\nGenre: platformer\nTheme: space\nEngine: Godot\nFeatures:\n- a boss\n- coins';
  it('advise_game: suggestions for any engine, in the theme, with what is by hand', () => {
    const r = call('advise_game', { brief });
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/^Star Hopper \(platformer, space\): \d+ suggestions\. 0 are built into Marrow/);
    expect(r.data.markdown).toMatch(/a falling alarm sweep/);
    const again = call('advise_game', { brief: brief.replace('- a boss\n', ''), plan: r.data.markdown.replace(/- \[ \] `boss-warning`/, '- [x] `boss-warning`') });
    expect(again.text).toMatch(/No longer fit \(kept\): boss-warning/);
  });
  it('advise_game: a brief with no name is refused in plain words', () => {
    const r = call('advise_game', { brief: 'Genre: runner' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/needs a name/);
  });
  it('sound_palette and quality_report', () => {
    expect(call('sound_palette', { theme: 'forest' }).text).toMatch(/a bird call[\s\S]*Palette proof: passed/);
    expect(call('quality_report', { count: 5 }).text).toMatch(/^5 of 5 levels proved\. Slow good/);
  });
});
