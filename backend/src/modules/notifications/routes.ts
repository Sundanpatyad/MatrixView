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
    email: req.auth.email,
    role: req.auth.role,
  };
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

router.get('/notifications', async (req, res, next) => {
  try {
    const q = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
        unreadOnly: z
          .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
          .optional(),
      })
      .parse(req.query);

    const data = await notifications.listNotifications(actorFrom(req as AuthedRequest), {
      limit: q.limit,
      cursor: q.cursor,
      unreadOnly: q.unreadOnly === '1' || q.unreadOnly === 'true',
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/unread-count', async (req, res, next) => {
  try {
    const count = await notifications.countUnread(actorFrom(req as AuthedRequest).sub);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/:id', async (req, res, next) => {
  try {
    const notification = await notifications.getNotification(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
    );
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read', async (req, res, next) => {
  try {
    const body = z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body);
    const data = await notifications.markRead(actorFrom(req as AuthedRequest), body.ids);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', async (req, res, next) => {
  try {
    const data = await notifications.markAllRead(actorFrom(req as AuthedRequest));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/notifications/:id', async (req, res, next) => {
  try {
    const data = await notifications.removeNotification(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
