import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { Organization } from './models/Organization.js';
import { User, type UserDoc } from './models/User.js';
import { Session } from './models/Session.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  createRefreshToken,
  hashToken,
  refreshExpiresAt,
  signAccessToken,
} from '../../utils/tokens.js';
import { AuthError } from './errors.js';

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  orgId: string;
  orgName: string;
  role: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthResult = AuthTokens & { user: PublicUser };

type DeviceType = 'web' | 'desktop' | 'mobile';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'org'
  );
}

async function toPublicUser(user: UserDoc): Promise<PublicUser> {
  const org = await Organization.findById(user.orgId).lean();
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    avatarUrl: user.avatarUrl ?? null,
    orgId: String(user.orgId),
    orgName: org?.name ?? 'Organization',
    role: user.role,
  };
}

async function issueSession(
  user: UserDoc,
  opts: {
    deviceType: DeviceType;
    deviceId?: string;
    ip?: string;
    userAgent?: string;
    familyId?: string;
  },
): Promise<AuthResult> {
  const refreshToken = createRefreshToken();
  const familyId = opts.familyId ?? crypto.randomUUID();
  const session = await Session.create({
    userId: user._id,
    orgId: user.orgId,
    deviceType: opts.deviceType,
    deviceId: opts.deviceId ?? null,
    refreshTokenHash: hashToken(refreshToken),
    familyId,
    ip: opts.ip ?? null,
    userAgent: opts.userAgent ?? null,
    lastActiveAt: new Date(),
    expiresAt: refreshExpiresAt(opts.deviceType),
  });

  const accessToken = signAccessToken({
    sub: String(user._id),
    orgId: String(user.orgId),
    email: user.email,
    role: user.role,
    sessionId: String(session._id),
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: '15m',
    user: await toPublicUser(user),
  };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  orgName?: string;
  inviteToken?: string;
  deviceType?: DeviceType;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthResult> {
  // Invite signup → join existing org + project seat
  if (input.inviteToken?.trim()) {
    const { acceptInviteAndCreateUser } = await import('../workspace/service.js');
    const user = await acceptInviteAndCreateUser({
      token: input.inviteToken.trim(),
      name: input.name,
      password: input.password,
    });
    return issueSession(user, {
      deviceType: input.deviceType ?? 'web',
      deviceId: input.deviceId,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AuthError('Unable to create account with that email', 409, 'EMAIL_TAKEN');
  }

  const orgName = (input.orgName ?? '').trim();
  if (!orgName) {
    throw new AuthError('Organization name required', 400);
  }

  let slug = slugify(orgName);
  const clash = await Organization.findOne({ slug });
  if (clash) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;

  const org = await Organization.create({ name: orgName, slug });
  const user = await User.create({
    orgId: org._id,
    email,
    name: input.name.trim(),
    passwordHash: await hashPassword(input.password),
    role: 'Admin',
    status: 'active',
  });

  return issueSession(user, {
    deviceType: input.deviceType ?? 'web',
    deviceId: input.deviceId,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

export async function login(input: {
  email: string;
  password: string;
  deviceType?: DeviceType;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) {
    throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status === 'disabled') {
    throw new AuthError('Account is disabled', 403, 'ACCOUNT_DISABLED');
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AuthError(
      'Account temporarily locked. Try again later.',
      423,
      'ACCOUNT_LOCKED',
    );
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED) {
      user.lockedUntil = new Date(Date.now() + LOCK_MS);
      user.failedLoginAttempts = 0;
      user.status = 'locked';
    }
    await user.save();
    throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status === 'locked') user.status = 'active';
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  try {
    const { claimPendingProjectInvites } = await import('../workspace/service.js');
    await claimPendingProjectInvites(user);
  } catch (err) {
    console.error('[auth] claim pending invites failed', err);
  }

  return issueSession(user, {
    deviceType: input.deviceType ?? 'web',
    deviceId: input.deviceId,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

export async function refresh(input: {
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthResult> {
  const tokenHash = hashToken(input.refreshToken);
  const session = await Session.findOne({ refreshTokenHash: tokenHash });

  if (!session) {
    throw new AuthError('Invalid refresh token', 401, 'INVALID_REFRESH');
  }

  if (session.revokedAt) {
    await Session.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw new AuthError('Session revoked. Please sign in again.', 401, 'SESSION_REVOKED');
  }

  if (session.expiresAt.getTime() < Date.now()) {
    session.revokedAt = new Date();
    await session.save();
    throw new AuthError('Session expired. Please sign in again.', 401, 'SESSION_EXPIRED');
  }

  const user = await User.findById(session.userId);
  if (!user || user.status === 'disabled') {
    throw new AuthError('Account unavailable', 401, 'ACCOUNT_UNAVAILABLE');
  }

  // Rotate refresh token
  session.revokedAt = new Date();
  await session.save();

  return issueSession(user, {
    deviceType: session.deviceType as DeviceType,
    deviceId: session.deviceId ?? undefined,
    ip: input.ip ?? session.ip ?? undefined,
    userAgent: input.userAgent ?? session.userAgent ?? undefined,
    familyId: session.familyId,
  });
}

export async function logout(refreshToken?: string, accessSessionId?: string): Promise<void> {
  if (refreshToken) {
    const session = await Session.findOne({ refreshTokenHash: hashToken(refreshToken) });
    if (session && !session.revokedAt) {
      session.revokedAt = new Date();
      await session.save();
    }
    return;
  }

  if (accessSessionId && Types.ObjectId.isValid(accessSessionId)) {
    await Session.updateOne(
      { _id: accessSessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}

export async function logoutAll(userId: string): Promise<void> {
  await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new AuthError('User not found', 404, 'NOT_FOUND');
  return toPublicUser(user);
}

export async function updateMe(
  userId: string,
  input: { name?: string; phone?: string },
): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new AuthError('User not found', 404, 'NOT_FOUND');

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AuthError('Name is required', 400);
    if (name.length > 120) throw new AuthError('Name is too long', 400);
    user.name = name;
  }

  if (input.phone !== undefined) {
    const phone = input.phone.trim();
    if (phone.length > 32) throw new AuthError('Phone number is too long', 400);
    if (phone && !/^[+\d][\d\s().-]{6,31}$/.test(phone)) {
      throw new AuthError('Enter a valid mobile number', 400);
    }
    user.phone = phone;
  }

  await user.save();
  return toPublicUser(user);
}

export async function updateMyAvatar(
  userId: string,
  avatarUrl: string,
): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new AuthError('User not found', 404, 'NOT_FOUND');
  const previousUrl = user.avatarUrl ?? null;
  user.avatarUrl = avatarUrl;
  await user.save();
  if (previousUrl && previousUrl !== avatarUrl) {
    const { deleteStoredMedia } = await import('../../storage/media.js');
    await deleteStoredMedia(previousUrl);
  }
  return toPublicUser(user);
}

export async function ensureSeedUser(email: string, password: string): Promise<void> {
  const adminEmail = email.toLowerCase();
  const memberEmail = 'rahul@acme.dev';

  let admin = await User.findOne({ email: adminEmail });
  let orgId = admin?.orgId;

  if (!admin) {
    const org = await Organization.create({
      name: 'Acme Studio',
      slug: 'acme-studio',
    });
    orgId = org._id;
    admin = await User.create({
      orgId,
      email: adminEmail,
      name: 'Riya Patel',
      passwordHash: await hashPassword(password),
      role: 'Admin',
      status: 'active',
    });
    console.log(`[seed] demo user ${adminEmail} / ${password}`);
  }

  const member = await User.findOne({ email: memberEmail });
  if (!member && orgId) {
    await User.create({
      orgId,
      email: memberEmail,
      name: 'Rahul Sharma',
      passwordHash: await hashPassword(password),
      role: 'Member',
      status: 'active',
    });
    console.log(`[seed] demo user ${memberEmail} / ${password}`);
  } else if (member && orgId && String(member.orgId) !== String(orgId)) {
    // Keep both demo accounts in the same org for chat testing
    member.orgId = orgId;
    await member.save();
  }
}
