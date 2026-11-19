import { serve } from './protocol';

// Run with: node dist/main.js   (after `npm run build --workspace mcp/level-forge`)
// Speaks the Model Context Protocol on standard input and output. Logs go to standard error only.
process.stdin.setEncoding('utf8');
serve(process.stdin, (line) => process.stdout.write(`${line}\n`)).catch((error) => {
  process.stderr.write(`Level Forge stopped: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
