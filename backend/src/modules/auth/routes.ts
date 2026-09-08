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
  rememberMe: z.boolean().optional(),
});

const optionalTrimmed = z.preprocess((v) => {
  if (v == null || v === '') return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  return v;
}, z.string().max(200).optional());

const registerSchema = credentialsSchema.extend({
  name: z.string().min(1).max(120),
  /** Optional — personal workspace is created automatically when omitted */
  orgName: optionalTrimmed,
  inviteToken: optionalTrimmed,
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

router.get('/google/start', async (req, res, next) => {
  try {
    const {
      buildGoogleAuthUrl,
      googleConfigured,
    } = await import('./google.js');
    if (!googleConfigured()) {
      throw new AuthError('Google sign-in is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
    }
    const returnTo = z.string().url().parse(req.query.returnTo);
    const deviceType = z
      .enum(['web', 'desktop', 'mobile'])
      .optional()
      .parse(req.query.deviceType) ?? 'desktop';
    const deviceId = z.string().max(128).optional().parse(req.query.deviceId);
    const rememberMe = z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v !== 'false')
      .parse(req.query.rememberMe);
    const url = buildGoogleAuthUrl({ returnTo, deviceType, deviceId, rememberMe });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

/** Desktop app: JSON auth URL for a loopback redirect (installed OAuth client). */
router.get('/google/desktop-url', async (req, res, next) => {
  try {
    const { buildDesktopLoopbackAuthUrl, googleConfigured } = await import('./google.js');
    if (!googleConfigured()) {
      throw new AuthError('Google sign-in is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
    }
    const redirectUri = z.string().url().parse(req.query.redirectUri);
    const deviceId = z.string().max(128).optional().parse(req.query.deviceId);
    const rememberMe = z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v !== 'false')
      .parse(req.query.rememberMe);
    const url = buildDesktopLoopbackAuthUrl(redirectUri, deviceId, rememberMe);
    res.json({ url, redirectUri });
  } catch (err) {
    next(err);
  }
});

/** Desktop app: exchange Google auth code from the local loopback listener. */
router.post('/google/desktop', async (req, res, next) => {
  try {
    const { assertLoopbackRedirectUri, exchangeGoogleCode, googleConfigured } =
      await import('./google.js');
    if (!googleConfigured()) {
      throw new AuthError('Google sign-in is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
    }
    const body = z
      .object({
        code: z.string().min(10),
        redirectUri: z.string().url(),
        deviceType: z.enum(['web', 'desktop', 'mobile']).optional(),
        deviceId: z.string().max(128).optional(),
        rememberMe: z.boolean().optional(),
      })
      .parse(req.body);
    const redirectUri = assertLoopbackRedirectUri(body.redirectUri);
    const profile = await exchangeGoogleCode(body.code, redirectUri);
    const result = await authService.loginWithGoogle({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      deviceType: body.deviceType ?? 'desktop',
      deviceId: body.deviceId,
      rememberMe: body.rememberMe,
      ...clientMeta(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/google/callback', async (req, res, next) => {
  const {
    assertAllowedReturnTo,
    decodeOAuthState,
    exchangeGoogleCode,
    storeOAuthExchange,
  } = await import('./google.js');

  let returnTo: string | null = null;
  try {
    const stateRaw = z.string().min(1).parse(req.query.state);
    const state = decodeOAuthState(stateRaw);
    assertAllowedReturnTo(state.returnTo);
    returnTo = state.returnTo;

    const oauthError = typeof req.query.error === 'string' ? req.query.error : null;
    if (oauthError) {
      const dest = new URL(state.returnTo);
      dest.searchParams.set('error', oauthError);
      res.redirect(dest.toString());
      return;
    }

    const code = z.string().min(1).parse(req.query.code);
    const profile = await exchangeGoogleCode(code);
    const result = await authService.loginWithGoogle({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      deviceType: state.deviceType,
      deviceId: state.deviceId,
      rememberMe: state.rememberMe,
      ...clientMeta(req),
    });
    const exchangeCode = storeOAuthExchange(result);
    const dest = new URL(state.returnTo);
    dest.searchParams.set('code', exchangeCode);
    res.redirect(dest.toString());
  } catch (err) {
    if (returnTo) {
      const dest = new URL(returnTo);
      const msg =
        err instanceof AuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Google sign-in failed';
      dest.searchParams.set('error', msg.slice(0, 180));
      res.redirect(dest.toString());
      return;
    }
    next(err);
  }
});

router.post('/google/exchange', async (req, res, next) => {
  try {
    const { consumeOAuthExchange } = await import('./google.js');
    const body = z.object({ code: z.string().min(10) }).parse(req.body);
    const result = consumeOAuthExchange(body.code);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    const { verifyGoogleIdToken } = await import('./google.js');
    // ID-token login only needs client ID(s) for audience checks — no client secret.
    const body = z
      .object({
        idToken: z.string().min(20),
        deviceType: z.enum(['web', 'desktop', 'mobile']).optional(),
        deviceId: z.string().max(128).optional(),
        rememberMe: z.boolean().optional(),
      })
      .parse(req.body);
    const profile = await verifyGoogleIdToken(body.idToken);
    const result = await authService.loginWithGoogle({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      deviceType: body.deviceType,
      deviceId: body.deviceId,
      rememberMe: body.rememberMe,
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
      const { storeUploadedFile } = await import('../../storage/media.js');
      const stored = await storeUploadedFile(file, 'avatars');
      const user = await authService.updateMyAvatar(authReq.auth.sub, stored.url);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
