import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { AuthError } from '../auth/errors.js';
import * as chat from './service.js';

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

router.get('/chat/conversations', async (req, res, next) => {
  try {
    const data = await chat.listConversations(actorFrom(req as AuthedRequest));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/chat/users', async (req, res, next) => {
  try {
    const data = await chat.listChatUsers(actorFrom(req as AuthedRequest));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/chat/conversations/dm', async (req, res, next) => {
  try {
    const body = z
      .object({
        userId: z.string().min(1).optional(),
        email: z.string().email().optional(),
      })
      .refine((v) => Boolean(v.userId || v.email), {
        message: 'Email or userId required',
      })
      .parse(req.body);
    const data = await chat.getOrCreateDm(actorFrom(req as AuthedRequest), body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/chat/conversations/groups', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        memberIds: z.array(z.string()).default([]),
      })
      .parse(req.body);
    const data = await chat.createGroup(actorFrom(req as AuthedRequest), body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/chat/conversations/:id', async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1).max(120) }).parse(req.body);
    const data = await chat.updateGroup(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
      body,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/chat/conversations/:id/avatar',
  chat.chatUpload.single('avatar'),
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) throw new AuthError('Image file required', 400);
      if (!file.mimetype.startsWith('image/')) {
        throw new AuthError('Group photo must be an image', 400);
      }
      const { storeUploadedFile } = await import('../../storage/media.js');
      const stored = await storeUploadedFile(file, 'chat-avatars');
      const data = await chat.updateGroupAvatar(
        actorFrom(req as AuthedRequest),
        param(req.params.id),
        stored.url,
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

router.post('/chat/conversations/:id/members', async (req, res, next) => {
  try {
    const body = z.object({ memberIds: z.array(z.string()).min(1) }).parse(req.body);
    const data = await chat.addGroupMembers(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
      body.memberIds,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/chat/conversations/:id/members/:userId', async (req, res, next) => {
  try {
    const data = await chat.removeGroupMember(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
      param(req.params.userId),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/chat/conversations/:id/messages', async (req, res, next) => {
  try {
    const afterRaw = req.query.after;
    const after =
      typeof afterRaw === 'string' && afterRaw.trim() ? afterRaw.trim() : undefined;
    const data = await chat.listMessages(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
      { after },
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/chat/conversations/:id/messages',
  chat.chatUpload.array('files', 5),
  async (req, res, next) => {
    try {
      const body = typeof req.body.body === 'string' ? req.body.body : '';
      const replyToId =
        typeof req.body.replyToId === 'string' && req.body.replyToId
          ? req.body.replyToId
          : undefined;
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const data = await chat.sendMessage(
        actorFrom(req as AuthedRequest),
        param(req.params.id),
        { body, replyToId },
        files,
      );
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  },
);

router.patch('/chat/messages/:id', async (req, res, next) => {
  try {
    const body = z.object({ body: z.string().max(8000) }).parse(req.body);
    const data = await chat.editMessage(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
      body.body,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/chat/messages/:id/forward', async (req, res, next) => {
  try {
    const body = z.object({ conversationId: z.string().min(1) }).parse(req.body);
    const data = await chat.forwardMessage(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
      body.conversationId,
    );
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/chat/messages/:id', async (req, res, next) => {
  try {
    const data = await chat.deleteMessage(
      actorFrom(req as AuthedRequest),
      param(req.params.id),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
