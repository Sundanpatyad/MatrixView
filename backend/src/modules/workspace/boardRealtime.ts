import { emitToProject, emitToUser } from '../../gateway/io.js';
import { User } from '../auth/models/User.js';
import type { ProjectDoc } from './models/Project.js';

/**
 * Broadcast a board event to everyone in the project room and each member's
 * personal socket room (same dual-delivery pattern as chat).
 */
export async function broadcastProjectEvent(
  project: ProjectDoc,
  event: string,
  payload: Record<string, unknown>,
) {
  const projectId = String(project._id);
  const full = { projectId, ...payload };

  emitToProject(projectId, event, full);

  const userIds = new Set<string>();
  for (const m of project.members) {
    if (m.userId) userIds.add(String(m.userId));
  }

  const emails = project.members
    .filter((m) => !m.userId && m.email)
    .map((m) => m.email.toLowerCase());
  if (emails.length > 0) {
    const users = await User.find({ email: { $in: emails } })
      .select('_id')
      .lean();
    for (const u of users) userIds.add(String(u._id));
  }

  for (const uid of userIds) {
    emitToUser(uid, event, full);
  }
}
