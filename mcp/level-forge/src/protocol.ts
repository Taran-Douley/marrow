import { ArgumentError } from './game';
import { TOOLS, type Tool } from './tools';

// The Model Context Protocol over standard input and output: one JSON message per line. Only what a
// tools-only server needs: initialize, ping, tools/list and tools/call. Everything else is answered with
// the standard "method not found" error, and nothing is ever written to stdout except protocol messages.

export const SERVER_INFO = { name: 'marrow-level-forge', version: '0.1.0' } as const;
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

interface Message {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

type Id = string | number | null;
export interface Response {
  jsonrpc: '2.0';
  id: Id;
  result?: unknown;
  error?: { code: number; message: string };
}

const ok = (id: Id, result: unknown): Response => ({ jsonrpc: '2.0', id, result });
const fail = (id: Id, code: number, message: string): Response => ({ jsonrpc: '2.0', id, error: { code, message } });

const isId = (v: unknown): v is string | number => typeof v === 'string' || typeof v === 'number';

/** Answer one message. Returns nothing for a notification, which has no reply. */
export function handle(message: unknown, tools: readonly Tool[] = TOOLS): Response | undefined {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return fail(null, -32600, 'Invalid request: expected a JSON object.');
  }
  const m = message as Message;
  const hasId = isId(m.id);
  if (typeof m.method !== 'string') return hasId ? fail(m.id as Id, -32600, "Invalid request: missing 'method'.") : undefined;
  if (!hasId) return undefined; // a notification, such as notifications/initialized: no reply
  const id = m.id as Id;
  const params = (typeof m.params === 'object' && m.params !== null ? m.params : {}) as Record<string, unknown>;

  switch (m.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const version = (SUPPORTED_VERSIONS as readonly string[]).includes(asked) ? asked : SUPPORTED_VERSIONS[0];
      return ok(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Level Forge builds, proves and playtests Marrow levels. Use prove_level or prove_many before serving any level, and simulate_persona to estimate how likely real players are to clear it. A level that fails the proof must not be served.',
      });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const name = params.name;
      const tool = tools.find((t) => t.name === name);
      if (typeof name !== 'string' || !tool) return fail(id, -32602, `Unknown tool '${String(name)}'.`);
      const args = (typeof params.arguments === 'object' && params.arguments !== null && !Array.isArray(params.arguments) ? params.arguments : {}) as Record<string, unknown>;
      try {
        const out = tool.run(args);
        return ok(id, {
          content: [{ type: 'text', text: `${out.text}\n\n${JSON.stringify(out.data, null, 2)}` }],
          structuredContent: out.data,
          isError: false,
        });
      } catch (error) {
        // A bad argument is the caller's to fix, so it goes back as a tool error they can read. Anything else is ours.
        const bad = error instanceof ArgumentError;
        return ok(id, {
          content: [{ type: 'text', text: bad ? (error as Error).message : `Level Forge failed: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        });
      }
    }
    default:
      return fail(id, -32601, `Method not found: ${m.method}`);
  }
}

/** Read lines from `input`, answer each on `output`. Returns when the input ends. */
export async function serve(input: AsyncIterable<string | Buffer>, write: (line: string) => void, tools: readonly Tool[] = TOOLS): Promise<void> {
  let buffer = '';
  const answer = (line: string): void => {
    const text = line.trim();
    if (text === '') return;
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      write(JSON.stringify(fail(null, -32700, 'Parse error: that line is not JSON.')));
      return;
    }
    const batch = Array.isArray(message) ? message : [message];
    for (const one of batch) {
      const reply = handle(one, tools);
      if (reply) write(JSON.stringify(reply));
    }
  };
  for await (const chunk of input) {
    buffer += chunk.toString();
    let at: number;
    while ((at = buffer.indexOf('\n')) >= 0) {
      answer(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
    }
  }
  answer(buffer);
}
