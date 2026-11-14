import { createServer } from 'node:http';

function redact(message: string): string {
  return message
    .replace(/((?:mongodb(?:\+srv)?|rediss?|postgres(?:ql)?):\/\/)[^\s,)]+/gi, '$1<redacted>')
    .replace(/\b[A-Z0-9_]*(?:PEPPER|KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*=\S+/g, (match) => `${match.split('=')[0]}=<redacted>`)
    .slice(0, 1200);
}

function startDiagnostic(error: unknown): void {
  const message = redact(error instanceof Error ? error.message : String(error));
  const configured = Number(process.env.PORT ?? 80);
  const port = Number.isInteger(configured) && configured > 0 ? configured : 80;
  const body = JSON.stringify({ error: { code: 'BOOT_FAILED', message } });
  const server = createServer((_req, res) => {
    res.writeHead(500, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(body);
  });
  server.on('error', (listenError) => {
    console.error(`fatal boot error: ${message}`);
    console.error(`diagnostic server failed: ${listenError.message}`);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    console.error(`fatal boot error: ${message}`);
  });
}

void import('./boot.js')
  .then(({ boot }) => boot())
  .catch((error) => {
    startDiagnostic(error);
  });
