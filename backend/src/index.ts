import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { initSocket } from './gateway/socket.js';
import { ensureSeedUser } from './modules/auth/service.js';

async function main() {
  await connectDb();
  await ensureSeedUser(config.seedEmail, config.seedPassword);

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`[api] DockX backend listening on http://localhost:${config.port}`);
    console.log(`[api] Socket.io ready on /socket.io`);
    console.log(`[api] Demo login: ${config.seedEmail} / ${config.seedPassword}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
