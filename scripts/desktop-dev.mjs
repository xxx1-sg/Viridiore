/** 桌面端开发模式：启动 Vite Dev Server + Electron */
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const server = await createServer({ server: { port: 5173 } });
await server.listen();
server.printUrls();

const url = server.resolvedUrls?.local?.[0] || 'http://127.0.0.1:5173';

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url }
});

child.on('close', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  child.kill();
  await server.close();
  process.exit(0);
});
