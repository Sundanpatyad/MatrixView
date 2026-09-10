import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { initSocket } from './gateway/socket.js';
import { startSessionExpiryJob } from './modules/activity/expiryJob.js';

async function main() {
  await connectDb();
  startSessionExpiryJob();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`[api] DockX backend listening on http://localhost:${config.port}`);
    console.log(`[api] Socket.io ready on /socket.io`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
