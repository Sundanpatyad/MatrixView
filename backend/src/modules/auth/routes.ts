import { Router } from 'express';
import { z } from 'zod';
import * as authService from './service.js';
import { AuthError } from './errors.js';
import { requireAuth, type AuthedRequest } from './middleware.js';
import { upload } from '../workspace/upload.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  deviceType: z.enum(['web', 'desktop', 'mobile']).optional(),
  deviceId: z.string().max(128).optional(),
});

const registerSchema = credentialsSchema
  .extend({
    name: z.string().min(1).max(120),
    orgName: z.string().min(1).max(120).optional(),
    inviteToken: z.string().min(10).max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.inviteToken && !val.orgName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Organization name required',
        path: ['orgName'],
      });
    }
  });

function clientMeta(req: { ip?: string; headers: Record<string, unknown> }) {
  const ua = req.headers['user-agent'];
  return {
    ip: typeof req.ip === 'string' ? req.ip : undefined,
    userAgent: typeof ua === 'string' ? ua : undefined,
  };
}

router.get('/invites/:token', async (req, res, next) => {
  try {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const { getInvitePreview } = await import('../workspace/service.js');
    const invite = await getInvitePreview(token);
    res.json({ invite });
  } catch (err) {
    next(err);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register({
      ...body,
      ...clientMeta(req),
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = credentialsSchema.parse(req.body);
    const result = await authService.login({
      ...body,
      ...clientMeta(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const result = await authService.refresh({
      refreshToken: body.refreshToken,
      ...clientMeta(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const body = z
      .object({ refreshToken: z.string().optional() })
      .parse(req.body ?? {});
    const authReq = req as AuthedRequest;
    let sessionId: string | undefined;
    try {
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        const { verifyAccessToken } = await import('../../utils/tokens.js');
        sessionId = verifyAccessToken(header.slice(7)).sessionId;
      }
    } catch {
      /* ignore invalid access token on logout */
    }
    await authService.logout(body.refreshToken, sessionId ?? authReq.auth?.sessionId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthedRequest;
    if (!authReq.auth) throw new AuthError('Unauthorized', 401);
    await authService.logoutAll(authReq.auth.sub);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthedRequest;
    if (!authReq.auth) throw new AuthError('Unauthorized', 401);
    const user = await authService.getMe(authReq.auth.sub);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthedRequest;
    if (!authReq.auth) throw new AuthError('Unauthorized', 401);
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        phone: z.string().max(32).optional(),
      })
      .parse(req.body);
    const user = await authService.updateMe(authReq.auth.sub, body);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/me/avatar',
  requireAuth,
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      const authReq = req as AuthedRequest;
      if (!authReq.auth) throw new AuthError('Unauthorized', 401);
      const file = req.file;
      if (!file) throw new AuthError('Image file required', 400);
      if (!file.mimetype.startsWith('image/')) {
        throw new AuthError('Avatar must be an image', 400);
      }
      const user = await authService.updateMyAvatar(
        authReq.auth.sub,
        `/uploads/${file.filename}`,
      );
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
