/**
 * Seed a dummy DM between Rahul Sharma and Sundan Sharma with 100 messages.
 * Usage: npm run seed:dm
 */
import { connectDb, disconnectDb } from './db.js';
import { config } from './config.js';
import { ensureSeedUser } from './modules/auth/service.js';
import { User } from './modules/auth/models/User.js';
import { Conversation } from './modules/chat/models/Conversation.js';
import { Message } from './modules/chat/models/Message.js';
import { hashPassword } from './utils/password.js';

const TARGET_COUNT = 100;
const SUNDAN_EMAIL = 'sundan@acme.dev';
const RAHUL_EMAIL = 'rahul@acme.dev';

const LINES = [
  'Hey, are you free for a quick sync?',
  'Yes — give me 5 minutes.',
  'Sounds good. Want to hop on a call?',
  'Let’s keep it in chat for now.',
  'Did you see the latest board updates?',
  'Yep, the DEMO project looks much cleaner.',
  'I pushed a small fix for the chat attachments.',
  'Nice — the image previews look better.',
  'Can you review the call toast UI too?',
  'On it. I’ll send notes after lunch.',
  'Also checking presence / online status.',
  'Sometimes Call stays disabled when socket drops.',
  'We added a retry — try the Retry link in chat.',
  'Perfect, that should help.',
  'Any blockers for tomorrow’s standup?',
  'Just finishing the seed data script.',
  'Ha — meta. Seed the seed.',
  'Exactly 😄',
  'Should we invite the rest of the team to this DM? Nope.',
  'This thread is just for us.',
  'Ack. Shipping the dummy history now.',
  'How many messages are we aiming for?',
  'Around a hundred so the thread feels real.',
  'Great for scroll / pagination testing.',
  'Don’t forget staggered timestamps.',
  'Already handled — spaced over a few days.',
  'Awesome. Talk soon.',
  'Ping me if the socket flakes again.',
  'Will do. Thanks!',
  'Anytime.',
];

async function findOrCreateSundan(orgId: typeof User.prototype.orgId) {
  let sundan =
    (await User.findOne({ name: 'Sundan Sharma', orgId })) ||
    (await User.findOne({ email: SUNDAN_EMAIL }));

  if (!sundan) {
    sundan = await User.create({
      orgId,
      email: SUNDAN_EMAIL,
      name: 'Sundan Sharma',
      passwordHash: await hashPassword(config.seedPassword),
      role: 'Member',
      status: 'active',
    });
    console.log(`[seed-dm] created ${SUNDAN_EMAIL} / ${config.seedPassword}`);
  } else if (String(sundan.orgId) !== String(orgId)) {
    sundan.orgId = orgId;
    await sundan.save();
  }

  if (sundan.name !== 'Sundan Sharma') {
    sundan.name = 'Sundan Sharma';
    await sundan.save();
  }

  return sundan;
}

async function main() {
  await connectDb();
  await ensureSeedUser(config.seedEmail, config.seedPassword);

  const rahul = await User.findOne({ email: RAHUL_EMAIL });
  if (!rahul) {
    throw new Error('Rahul Sharma (rahul@acme.dev) not found — run the API once to seed users');
  }

  const sundan = await findOrCreateSundan(rahul.orgId);
  const memberIds = [rahul._id, sundan._id];

  let conversation = await Conversation.findOne({
    type: 'dm',
    memberIds: { $all: memberIds, $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      orgId: rahul.orgId,
      type: 'dm',
      name: '',
      memberIds,
      createdBy: sundan._id,
      lastMessageAt: new Date(),
      lastMessagePreview: '',
    });
    console.log(`[seed-dm] created DM ${String(conversation._id)}`);
  } else {
    console.log(`[seed-dm] using existing DM ${String(conversation._id)}`);
  }

  const existing = await Message.countDocuments({
    conversationId: conversation._id,
    deletedAt: null,
  });

  if (existing >= TARGET_COUNT) {
    console.log(`[seed-dm] already has ${existing} messages — nothing to do`);
    await disconnectDb();
    return;
  }

  const toCreate = TARGET_COUNT - existing;
  const start = Date.now() - toCreate * 3 * 60 * 1000; // ~3 min apart, newest near now
  const docs = [];

  for (let i = 0; i < toCreate; i++) {
    const n = existing + i;
    const fromRahul = n % 2 === 0;
    const sender = fromRahul ? rahul : sundan;
    const other = fromRahul ? sundan : rahul;
    const body = LINES[n % LINES.length]!;
    const createdAt = new Date(start + i * 3 * 60 * 1000);

    docs.push({
      orgId: rahul.orgId,
      conversationId: conversation._id,
      senderId: sender._id,
      type: 'text' as const,
      body: `${body}${n >= LINES.length ? ` (${n + 1})` : ''}`,
      replyToId: null,
      attachments: [],
      receipts: [
        {
          userId: other._id,
          deliveredAt: createdAt,
          readAt: i < toCreate - 3 ? createdAt : null,
        },
      ],
      call: null,
      editedAt: null,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  await Message.insertMany(docs);

  const last = docs[docs.length - 1]!;
  conversation.lastMessageAt = last.createdAt;
  conversation.lastMessagePreview = last.body.slice(0, 160);
  await conversation.save();

  console.log(
    `[seed-dm] inserted ${toCreate} messages (total ${existing + toCreate}) between ${rahul.name} ↔ ${sundan.name}`,
  );
  console.log(`[seed-dm] login as ${RAHUL_EMAIL} or ${sundan.email} / ${config.seedPassword}`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed-dm] failed', err);
  try {
    await disconnectDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
