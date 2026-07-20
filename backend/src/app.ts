import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './modules/auth/routes.js';
import workspaceRoutes from './modules/workspace/routes.js';
import activityRoutes from './modules/activity/routes.js';
import orgRoutes from './modules/org/routes.js';
import chatRoutes from './modules/chat/routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { uploadsDir } from './storage/paths.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'dockx-api' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', workspaceRoutes);
  app.use('/api', activityRoutes);
  app.use('/api', orgRoutes);
  app.use('/api', chatRoutes);

  app.use(errorHandler);
  return app;
}
