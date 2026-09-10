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

const DEMO_MEMBERS = [
  ['Aarav Mehta', 'aarav@acme.dev'],
  ['Ananya Singh', 'ananya@acme.dev'],
  ['Arjun Verma', 'arjun@acme.dev'],
  ['Diya Nair', 'diya@acme.dev'],
  ['Kabir Khan', 'kabir@acme.dev'],
  ['Meera Joshi', 'meera@acme.dev'],
  ['Vikram Rao', 'vikram@acme.dev'],
  ['Neha Gupta', 'neha@acme.dev'],
  ['Ishan Kapoor', 'ishan@acme.dev'],
  ['Priya Desai', 'priya@acme.dev'],
  ['Rohit Kumar', 'rohit@acme.dev'],
  ['Sneha Iyer', 'sneha@acme.dev'],
  ['Dev Malhotra', 'dev@acme.dev'],
  ['Kavya Reddy', 'kavya@acme.dev'],
  ['Aditya Bose', 'aditya@acme.dev'],
  ['Nisha Shah', 'nisha@acme.dev'],
  ['Sameer Jain', 'sameer@acme.dev'],
  ['Tara Menon', 'tara@acme.dev'],
  ['Varun Sethi', 'varun@acme.dev'],
  ['Zoya Ali', 'zoya@acme.dev'],
] as const;

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
    rememberMe?: boolean;
  },
): Promise<AuthResult> {
  const refreshToken = createRefreshToken();
  const familyId = opts.familyId ?? crypto.randomUUID();
  const rememberMe = opts.rememberMe !== false;
  const session = await Session.create({
    userId: user._id,
    orgId: user.orgId,
    deviceType: opts.deviceType,
    deviceId: opts.deviceId ?? null,
    refreshTokenHash: hashToken(refreshToken),
    previousRefreshTokenHash: null,
    rotatedAt: null,
    rememberMe,
    familyId,
    ip: opts.ip ?? null,
    userAgent: opts.userAgent ?? null,
    lastActiveAt: new Date(),
    expiresAt: refreshExpiresAt(opts.deviceType, rememberMe),
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
  rememberMe?: boolean;
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
      rememberMe: input.rememberMe,
    });
  }

  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AuthError('Unable to create account with that email', 409, 'EMAIL_TAKEN');
  }

  // Personal workspace (no org field in UI) — projects are the real tenancy unit
  const displayName = input.name.trim() || email.split('@')[0] || 'User';
  const orgName =
    (input.orgName ?? '').trim() || `${displayName}'s Workspace`;
  let slug = slugify(orgName);
  const clash = await Organization.findOne({ slug });
  if (clash) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;

  const org = await Organization.create({ name: orgName, slug });
  const user = await User.create({
    orgId: org._id,
    email,
    name: displayName,
    passwordHash: await hashPassword(input.password),
    role: 'Admin',
    status: 'active',
  });

  const { claimPendingInvitesForUser } = await import('../workspace/service.js');
  await claimPendingInvitesForUser(user).catch((err) =>
    console.error('[auth] claim pending invites after register', err),
  );

  return issueSession(user, {
    deviceType: input.deviceType ?? 'web',
    deviceId: input.deviceId,
    ip: input.ip,
    userAgent: input.userAgent,
    rememberMe: input.rememberMe,
  });
}

export async function login(input: {
  email: string;
  password: string;
  deviceType?: DeviceType;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  rememberMe?: boolean;
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

  if (!user.passwordHash) {
    throw new AuthError(
      'This account uses Google sign-in. Continue with Google instead.',
      401,
      'USE_GOOGLE',
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

  const { claimPendingInvitesForUser } = await import('../workspace/service.js');
  await claimPendingInvitesForUser(user).catch((err) =>
    console.error('[auth] claim pending invites after login', err),
  );

  return issueSession(user, {
    deviceType: input.deviceType ?? 'web',
    deviceId: input.deviceId,
    ip: input.ip,
    userAgent: input.userAgent,
    rememberMe: input.rememberMe,
  });
}

/** Find-or-create a user from a verified Google profile, then issue a session. */
export async function loginWithGoogle(input: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  deviceType?: DeviceType;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  rememberMe?: boolean;
}): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  let user =
    (await User.findOne({ googleId: input.googleId })) ||
    (await User.findOne({ email }));

  if (user) {
    if (user.status === 'disabled') {
      throw new AuthError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }
    if (!user.googleId) {
      user.googleId = input.googleId;
    }
    if (!user.avatarUrl && input.avatarUrl) {
      user.avatarUrl = input.avatarUrl;
    }
    if (user.status === 'locked') user.status = 'active';
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();
  } else {
    const displayName = input.name.trim() || email.split('@')[0] || 'User';
    const orgName = `${displayName}'s Workspace`;
    let slug = slugify(orgName);
    const clash = await Organization.findOne({ slug });
    if (clash) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;

    const org = await Organization.create({ name: orgName, slug });
    user = await User.create({
      orgId: org._id,
      email,
      name: displayName,
      avatarUrl: input.avatarUrl ?? null,
      passwordHash: null,
      googleId: input.googleId,
      role: 'Admin',
      status: 'active',
    });
  }

  const { claimPendingInvitesForUser } = await import('../workspace/service.js');
  await claimPendingInvitesForUser(user).catch((err) =>
    console.error('[auth] claim pending invites after Google', err),
  );

  return issueSession(user, {
    deviceType: input.deviceType ?? 'web',
    deviceId: input.deviceId,
    ip: input.ip,
    userAgent: input.userAgent,
    rememberMe: input.rememberMe,
  });
}

/** How long a lost refresh response may be retried with the previous token. */
const REFRESH_REUSE_GRACE_MS = 60_000;

export async function refresh(input: {
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthResult> {
  const tokenHash = hashToken(input.refreshToken);
  let session = await Session.findOne({ refreshTokenHash: tokenHash, revokedAt: null });
  let usedPrevious = false;

  if (!session) {
    session = await Session.findOne({ previousRefreshTokenHash: tokenHash, revokedAt: null });
    usedPrevious = Boolean(session);
    if (session) {
      const rotatedAt = session.rotatedAt?.getTime() ?? 0;
      if (Date.now() - rotatedAt > REFRESH_REUSE_GRACE_MS) {
        await Session.updateMany(
          { familyId: session.familyId, revokedAt: null },
          { $set: { revokedAt: new Date() } },
        );
        throw new AuthError('Session revoked. Please sign in again.', 401, 'SESSION_REVOKED');
      }
    }
  }

  if (!session) {
    throw new AuthError('Invalid refresh token', 401, 'INVALID_REFRESH');
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

  const rememberMe = session.rememberMe !== false;
  const nextRefresh = createRefreshToken();
  session.previousRefreshTokenHash = usedPrevious
    ? session.previousRefreshTokenHash
    : session.refreshTokenHash;
  session.refreshTokenHash = hashToken(nextRefresh);
  session.rotatedAt = new Date();
  session.lastActiveAt = new Date();
  if (input.ip) session.ip = input.ip;
  if (input.userAgent) session.userAgent = input.userAgent;
  if (rememberMe) {
    session.expiresAt = refreshExpiresAt(session.deviceType as DeviceType, true);
  }
  await session.save();

  const accessToken = signAccessToken({
    sub: String(user._id),
    orgId: String(user.orgId),
    email: user.email,
    role: user.role,
    sessionId: String(session._id),
  });

  return {
    accessToken,
    refreshToken: nextRefresh,
    expiresIn: '15m',
    user: await toPublicUser(user),
  };
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

  if (!orgId) return;

  let demoPasswordHash: string | null = null;
  for (const [name, demoEmail] of DEMO_MEMBERS) {
    const existing = await User.findOne({ email: demoEmail });
    if (!existing) {
      demoPasswordHash ??= await hashPassword(password);
      await User.create({
        orgId,
        email: demoEmail,
        name,
        passwordHash: demoPasswordHash,
        role: 'Member',
        status: 'active',
      });
      console.log(`[seed] demo member ${demoEmail}`);
      continue;
    }

    let changed = false;
    if (String(existing.orgId) !== String(orgId)) {
      existing.orgId = orgId;
      changed = true;
    }
    if (existing.name !== name) {
      existing.name = name;
      changed = true;
    }
    if (existing.status !== 'active') {
      existing.status = 'active';
      changed = true;
    }
    if (changed) await existing.save();
  }
}
