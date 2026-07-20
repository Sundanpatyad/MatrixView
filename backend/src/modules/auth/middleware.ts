import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../../utils/tokens.js';
import { Session } from './models/Session.js';
import { AuthError } from './errors.js';

export type DeviceType = 'web' | 'desktop' | 'mobile';

export type AuthedRequest = Request & {
  auth?: AccessTokenPayload & { deviceType: DeviceType };
};

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AuthError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);

    const session = await Session.findById(payload.sessionId);
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new AuthError('Session revoked or expired', 401, 'SESSION_INVALID');
    }

    session.lastActiveAt = new Date();
    await session.save();

    req.auth = {
      ...payload,
      deviceType: (session.deviceType as DeviceType) ?? 'web',
    };
    next();
  } catch (err) {
    if (err instanceof AuthError) return next(err);
    next(new AuthError('Invalid or expired token', 401, 'UNAUTHORIZED'));
  }
}

/** Check-in / activity tracking is desktop-only. */
export function requireDesktop(req: AuthedRequest, _res: Response, next: NextFunction) {
  if (req.auth?.deviceType !== 'desktop') {
    return next(
      new AuthError(
        'Check-in is only available from the desktop app',
        403,
        'DESKTOP_REQUIRED',
      ),
    );
  }
  next();
}
