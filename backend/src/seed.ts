import { randomUUID } from 'crypto';
import { connectDb, disconnectDb } from './db.js';
import { config } from './config.js';
import { ensureSeedUser } from './modules/auth/service.js';
import { User } from './modules/auth/models/User.js';
import { Project } from './modules/workspace/models/Project.js';
import { Task } from './modules/workspace/models/Task.js';
import { DEFAULT_BOARD_COLUMNS } from './modules/workspace/constants.js';

const TASKS_PER_EMPLOYEE = 20;
const SEED_TAG = '[seed-dummy]';

const TITLES = [
  'Update dashboard charts',
  'Fix login edge case',
  'Write API docs',
  'Review pull request',
  'Polish activity UI',
  'Add empty states',
  'Improve board filters',
  'Sync attendance status',
  'Optimize query load',
  'Handle file uploads',
  'Refine invite flow',
  'Add due date reminders',
  'Clean unused CSS',
  'Test check-in restore',
  'Wire timeline edits',
  'Audit permissions',
  'Seed sample comments',
  'Improve mobile layout',
  'Track website usage',
  'Fix drag and drop',
  'Add project settings',
  'Export weekly report',
  'Triage bug backlog',
  'Pair on onboarding',
];

const TYPES = ['task', 'bug', 'story', 'time'] as const;
const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'] as const;

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function newMemberId() {
  return `mem_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

async function ensureDemoProject(orgId: string, admin: { id: string; name: string; email: string }) {
  let project = await Project.findOne({ orgId, key: 'DEMO' });
  if (!project) {
    project = await Project.create({
      orgId,
      name: 'Workload Demo',
      key: 'DEMO',
      description: 'Seeded project with dummy tasks for each employee',
      createdBy: admin.email,
      createdByUserId: admin.id,
      columns: DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c })),
      members: [],
      taskSeq: 0,
    });
    console.log(`[seed] created project ${project.name} (${project.key})`);
  }

  // Ensure every org user is a member
  const users = await User.find({
    orgId,
    status: { $in: ['active', 'invited', 'locked'] },
  });

  let changed = false;
  for (const u of users) {
    const email = u.email.toLowerCase();
    const existing = project.members.find((m) => m.email === email);
    if (existing) {
      if (!existing.userId) {
        existing.userId = u._id;
        changed = true;
      }
      continue;
    }
    project.members.push({
      id: newMemberId(),
      userId: u._id,
      name: u.name,
      email,
      role: u.role === 'Admin' ? 'admin' : 'member',
      addedAt: new Date(),
    });
    changed = true;
  }

  if (changed) await project.save();
  return project;
}

async function seedTasksForOrg(orgId: string) {
  const users = await User.find({
    orgId,
    status: { $in: ['active', 'invited', 'locked'] },
  }).sort({ createdAt: 1 });

  if (users.length === 0) {
    console.log(`[seed] no users for org ${orgId}`);
    return;
  }

  const admin =
    users.find((u) => u.role === 'Admin') ?? users[0];

  const project = await ensureDemoProject(orgId, {
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
  });

  // Reload after member sync
  const fresh = await Project.findById(project._id);
  if (!fresh) return;

  const columns = fresh.columns.map((c) => c.id);
  if (columns.length === 0) {
    fresh.columns = DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c })) as typeof fresh.columns;
    await fresh.save();
  }
  const statuses = fresh.columns.map((c) => c.id);

  let createdTotal = 0;

  for (const user of users) {
    const member = fresh.members.find(
      (m) => m.email.toLowerCase() === user.email.toLowerCase(),
    );
    const assigneeId = member?.id || String(user._id);
    const assigneeName = member?.name || user.name;

    const existing = await Task.countDocuments({
      orgId,
      projectId: fresh._id,
      description: { $regex: SEED_TAG.replace(/[[\]]/g, '\\$&') },
      $or: [
        { assigneeId },
        { assigneeName: assigneeName },
        { assigneeId: String(user._id) },
      ],
    });

    const need = Math.max(0, TASKS_PER_EMPLOYEE - existing);
    if (need === 0) {
      console.log(`[seed] ${assigneeName} already has ${existing} dummy tasks`);
      continue;
    }

    const docs = [];
    for (let i = 0; i < need; i++) {
      const n = existing + i + 1;
      fresh.taskSeq = (fresh.taskSeq ?? 0) + 1;
      const title = `${TITLES[(existing + i) % TITLES.length]} (${assigneeName.split(' ')[0]} #${n})`;
      docs.push({
        orgId,
        projectId: fresh._id,
        key: `${fresh.key}-${fresh.taskSeq}`,
        title,
        description: `${SEED_TAG} Dummy task #${n} for ${assigneeName}.`,
        type: TYPES[(existing + i) % TYPES.length],
        priority: PRIORITIES[(existing + i) % PRIORITIES.length],
        status: statuses[(existing + i) % statuses.length],
        estimateHours: 1 + ((existing + i) % 8),
        loggedHours: 0,
        remainingHours: 1 + ((existing + i) % 8),
        createdBy: String(admin._id),
        createdByName: admin.name,
        reporterName: admin.name,
        assigneeId,
        assigneeName,
        labels: ['seed'],
        startDate: '',
        endDate: '',
        dueDate: daysFromNow((existing + i) % 14),
        comments: [],
        attachments: [],
      });
    }

    await fresh.save();
    await Task.insertMany(docs);
    createdTotal += docs.length;
    console.log(`[seed] ${assigneeName}: +${docs.length} tasks (now ${existing + docs.length})`);
  }

  console.log(`[seed] org ${orgId}: created ${createdTotal} tasks`);
}

async function main() {
  await connectDb();
  await ensureSeedUser(config.seedEmail, config.seedPassword);

  const orgIds = await User.distinct('orgId');
  for (const orgId of orgIds) {
    await seedTasksForOrg(String(orgId));
  }

  console.log('Seed complete — 20 dummy tasks per employee');
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
