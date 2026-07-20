import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { AuthError } from '../auth/errors.js';
import * as notifications from './service.js';

const router = Router();
router.use(requireAuth);

function actorFrom(req: AuthedRequest) {
  if (!req.auth) throw new AuthError('Unauthorized', 401);
  return {
    sub: req.auth.sub,
    orgId: req.auth.orgId,
  };
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

router.get('/notifications', async (req, res, next) => {
  try {
    const unreadOnly =
      req.query.unread === '1' ||
      req.query.unread === 'true' ||
      req.query.unreadOnly === '1';
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const data = await notifications.listForUser(actorFrom(req as AuthedRequest), {
      unreadOnly,
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/unread-count', async (req, res, next) => {
  try {
    const data = await notifications.getUnreadCount(actorFrom(req as AuthedRequest));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    z.object({}).parse(req.body ?? {});
    const notification = await notifications.markRead(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
    );
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', async (req, res, next) => {
  try {
    const result = await notifications.markAllRead(actorFrom(req as AuthedRequest));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
