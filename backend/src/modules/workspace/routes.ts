import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { AuthError } from '../auth/errors.js';
import { User } from '../auth/models/User.js';
import * as workspace from './service.js';
import { upload } from './upload.js';

const router = Router();
router.use(requireAuth);

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

async function actorFrom(req: AuthedRequest) {
  if (!req.auth) throw new AuthError('Unauthorized', 401);
  const user = await User.findById(req.auth.sub).lean();
  return {
    sub: req.auth.sub,
    orgId: req.auth.orgId,
    email: req.auth.email,
    role: req.auth.role,
    name: user?.name,
  };
}

router.get('/workspace', async (req, res, next) => {
  try {
    const data = await workspace.getWorkspace(await actorFrom(req as AuthedRequest));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/projects', async (req, res, next) => {
  try {
    const data = await workspace.getWorkspace(await actorFrom(req as AuthedRequest));
    res.json({ projects: data.projects });
  } catch (err) {
    next(err);
  }
});

router.post('/projects', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        key: z.string().min(1).max(6),
        description: z.string().max(2000).optional(),
      })
      .parse(req.body);
    const project = await workspace.createProject(await actorFrom(req as AuthedRequest), body);
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

router.delete('/projects/:projectId', async (req, res, next) => {
  try {
    const result = await workspace.deleteProject(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/members', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().max(120).optional(),
        email: z.string().email(),
        role: z.enum(['admin', 'member']).default('member'),
      })
      .parse(req.body);
    const result = await workspace.addMember(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      body,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/projects/:projectId/members/:memberId', async (req, res, next) => {
  try {
    const body = z.object({ role: z.enum(['admin', 'member']) }).parse(req.body);
    const project = await workspace.updateMemberRole(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      param(req.params.memberId),
      body.role,
    );
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.delete('/projects/:projectId/members/:memberId', async (req, res, next) => {
  try {
    const project = await workspace.removeMember(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      param(req.params.memberId),
    );
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/columns', async (req, res, next) => {
  try {
    const body = z.object({ label: z.string().min(1).max(80) }).parse(req.body);
    const result = await workspace.addColumn(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      body.label,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/projects/:projectId/columns/:columnId', async (req, res, next) => {
  try {
    const body = z.object({ label: z.string().min(1).max(80) }).parse(req.body);
    const project = await workspace.renameColumn(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      param(req.params.columnId),
      body.label,
    );
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.put('/projects/:projectId/columns', async (req, res, next) => {
  try {
    const body = z.object({ columnIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const project = await workspace.reorderColumns(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      body.columnIds,
    );
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.delete('/projects/:projectId/columns/:columnId', async (req, res, next) => {
  try {
    const moveToStatus =
      typeof req.query.moveTo === 'string' ? req.query.moveTo : undefined;
    const result = await workspace.removeColumn(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      param(req.params.columnId),
      moveToStatus,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/projects/:projectId/tasks', async (req, res, next) => {
  try {
    const data = await workspace.getWorkspace(await actorFrom(req as AuthedRequest));
    const tasks = data.tasks.filter((t) => t.projectId === param(req.params.projectId));
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/tasks', async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(1).max(300),
        description: z.string().max(10000).optional(),
        type: z.enum(['task', 'bug', 'story', 'time']).optional(),
        priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']).optional(),
        estimateHours: z.number().min(0).max(1000).optional(),
        assigneeName: z.string().max(120).optional(),
        assigneeId: z.string().max(64).optional(),
        dueDate: z.string().max(40).optional(),
      })
      .parse(req.body);
    const task = await workspace.createTask(
      await actorFrom(req as AuthedRequest),
      param(req.params.projectId),
      body,
    );
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

router.patch('/tasks/:taskId', async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(1).max(300).optional(),
        description: z.string().max(10000).optional(),
        type: z.enum(['task', 'bug', 'story', 'time']).optional(),
        priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']).optional(),
        status: z.string().min(1).max(64).optional(),
        estimateHours: z.number().min(0).max(1000).optional(),
        loggedHours: z.number().min(0).max(1000).optional(),
        assigneeId: z.string().max(64).optional(),
        assigneeName: z.string().max(120).optional(),
        reporterName: z.string().max(120).optional(),
        labels: z.array(z.string().max(40)).optional(),
        startDate: z.string().max(40).optional(),
        endDate: z.string().max(40).optional(),
        dueDate: z.string().max(40).optional(),
      })
      .parse(req.body);
    const task = await workspace.updateTask(
      await actorFrom(req as AuthedRequest),
      param(req.params.taskId),
      body,
    );
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/tasks/:taskId/comments',
  upload.array('files', 10),
  async (req, res, next) => {
    try {
      const body = typeof req.body.body === 'string' ? req.body.body : '';
      const task = await workspace.addComment(
        await actorFrom(req as AuthedRequest),
        param(req.params.taskId),
        body,
        (req.files as Express.Multer.File[]) ?? [],
      );
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/tasks/:taskId/attachments',
  upload.array('files', 10),
  async (req, res, next) => {
    try {
      const task = await workspace.addTaskAttachments(
        await actorFrom(req as AuthedRequest),
        param(req.params.taskId),
        (req.files as Express.Multer.File[]) ?? [],
      );
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/tasks/:taskId/attachments/:attachmentId', async (req, res, next) => {
  try {
    const task = await workspace.removeTaskAttachment(
      await actorFrom(req as AuthedRequest),
      param(req.params.taskId),
      param(req.params.attachmentId),
    );
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

router.post('/timeline', upload.array('files', 10), async (req, res, next) => {
  try {
    const body = z
      .object({
        projectId: z.string().min(1),
        title: z.string().min(1).max(300),
        description: z.string().max(10000).optional().default(''),
        type: z.enum(['task', 'bug', 'story', 'time']).optional().default('task'),
        priority: z
          .enum(['lowest', 'low', 'medium', 'high', 'highest'])
          .optional()
          .default('medium'),
        dueDate: z.string().max(40).optional().default(''),
      })
      .parse(req.body);
    const item = await workspace.createTimelineItem(
      await actorFrom(req as AuthedRequest),
      body,
      (req.files as Express.Multer.File[]) ?? [],
    );
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

router.patch('/timeline/:itemId', upload.array('files', 10), async (req, res, next) => {
  try {
    let removeAttachmentIds: string[] = [];
    const rawRemove = req.body.removeAttachmentIds;
    if (typeof rawRemove === 'string' && rawRemove.trim()) {
      try {
        const parsed = JSON.parse(rawRemove) as unknown;
        if (Array.isArray(parsed)) {
          removeAttachmentIds = parsed.filter((x): x is string => typeof x === 'string');
        }
      } catch {
        removeAttachmentIds = [];
      }
    }

    const body = z
      .object({
        title: z.string().min(1).max(300).optional(),
        description: z.string().max(10000).optional(),
        type: z.enum(['task', 'bug', 'story', 'time']).optional(),
        priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']).optional(),
        dueDate: z.string().max(40).optional(),
        assigneeId: z.string().max(64).optional(),
        assigneeName: z.string().max(120).optional(),
      })
      .parse({
        title: req.body.title,
        description: req.body.description,
        type: req.body.type,
        priority: req.body.priority,
        dueDate: req.body.dueDate,
        assigneeId: req.body.assigneeId,
        assigneeName: req.body.assigneeName,
      });

    const result = await workspace.updateTimelineItem(
      await actorFrom(req as AuthedRequest),
      param(req.params.itemId),
      {
        ...body,
        removeAttachmentIds,
        assigneeId: body.assigneeId === undefined ? undefined : body.assigneeId || null,
        assigneeName: body.assigneeName === undefined ? undefined : body.assigneeName || null,
      },
      (req.files as Express.Multer.File[]) ?? [],
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/timeline/:itemId/assign', async (req, res, next) => {
  try {
    const body = z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .parse(req.body);
    const result = await workspace.assignTimelineItem(
      await actorFrom(req as AuthedRequest),
      param(req.params.itemId),
      body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/timeline/:itemId', async (req, res, next) => {
  try {
    const result = await workspace.deleteTimelineItem(
      await actorFrom(req as AuthedRequest),
      param(req.params.itemId),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
