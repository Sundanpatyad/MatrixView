import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireDesktop, type AuthedRequest } from '../auth/middleware.js';
import { AuthError } from '../auth/errors.js';
import * as activity from './service.js';

const router = Router();
router.use(requireAuth);

function actorFrom(req: AuthedRequest) {
  if (!req.auth) throw new AuthError('Unauthorized', 401);
  return { sub: req.auth.sub, orgId: req.auth.orgId, role: req.auth.role };
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

router.post('/activity/sessions/start', requireDesktop, async (req, res, next) => {
  try {
    const session = await activity.startSession(actorFrom(req as AuthedRequest));
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

router.get('/activity/sessions/current', async (req, res, next) => {
  try {
    const session = await activity.getCurrentSession(actorFrom(req as AuthedRequest));
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

/** Whether the current user is checked in (active tracking session in DB). */
router.get('/activity/attendance', async (req, res, next) => {
  try {
    const tzRaw = typeof req.query.tzOffset === 'string' ? Number(req.query.tzOffset) : undefined;
    const tzOffset = Number.isFinite(tzRaw) ? tzRaw : undefined;
    const status = await activity.getAttendanceStatus(
      actorFrom(req as AuthedRequest),
      tzOffset,
    );
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post('/activity/sessions/:sessionId/samples', requireDesktop, async (req, res, next) => {
  try {
    const body = z
      .object({
        samples: z
          .array(
            z.object({
              kind: z.enum(['app', 'site', 'away']).optional(),
              appName: z.string().max(200).optional(),
              processName: z.string().max(200).optional(),
              windowTitle: z.string().max(500).optional(),
              url: z.string().max(2000).optional(),
              host: z.string().max(300).optional(),
              durationMs: z.number().min(0).max(12 * 60 * 60 * 1000),
              awayKind: z.enum(['locked', 'sleep', 'lid_closed', 'away']).optional(),
              startedAt: z.string().datetime().optional(),
              endedAt: z.string().datetime().optional(),
            }),
          )
          .max(100),
      })
      .parse(req.body);

    const session = await activity.ingestSamples(
      actorFrom(req as AuthedRequest),
      param(req.params.sessionId),
      body.samples,
    );
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

router.post('/activity/sessions/stop', requireDesktop, async (req, res, next) => {
  try {
    const body = z
      .object({ sessionId: z.string().optional() })
      .parse(req.body ?? {});
    const result = await activity.stopSession(
      actorFrom(req as AuthedRequest),
      body.sessionId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/activity/today', async (req, res, next) => {
  try {
    const tzRaw = typeof req.query.tzOffset === 'string' ? Number(req.query.tzOffset) : undefined;
    const tzOffset = Number.isFinite(tzRaw) ? tzRaw : undefined;
    const summary = await activity.getTodaySummary(
      actorFrom(req as AuthedRequest),
      tzOffset,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/activity/org/today', async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const tzRaw = typeof req.query.tzOffset === 'string' ? Number(req.query.tzOffset) : undefined;
    const tzOffset = Number.isFinite(tzRaw) ? tzRaw : undefined;
    const summary = await activity.getOrgActivityByDate(
      actorFrom(req as AuthedRequest),
      date,
      tzOffset,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
