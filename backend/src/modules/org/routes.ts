import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { AuthError } from '../auth/errors.js';
import * as org from './service.js';

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

router.get('/org/users', async (req, res, next) => {
  try {
    const data = await org.listOrgUsers(actorFrom(req as AuthedRequest));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/org/users', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email(),
        password: z.string().min(8).max(128),
        role: z.enum(['Admin', 'Manager', 'Member']).optional(),
        projectIds: z.array(z.string()).optional(),
        projectRole: z.enum(['admin', 'member']).optional(),
      })
      .parse(req.body);
    const result = await org.createOrgUser(actorFrom(req as AuthedRequest), body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/org/users/:userId/projects', async (req, res, next) => {
  try {
    const body = z
      .object({
        projectIds: z.array(z.string()).min(1),
        projectRole: z.enum(['admin', 'member']).optional(),
      })
      .parse(req.body);
    const result = await org.assignUserProjects(
      actorFrom(req as AuthedRequest),
      param(req.params.userId),
      body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
