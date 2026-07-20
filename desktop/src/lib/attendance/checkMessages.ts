const CHECK_IN_CONFIRM = [
  'Ready to clock in? The keyboard is warming up for you.',
  'Check in and pretend the coffee already kicked in?',
  'Shall we start the clock? Meetings are already circling.',
  'Time to appear productive. Check in?',
  'Punch in and make that to-do list nervous?',
  'Officially start the day… or at least the timer?',
];

const CHECK_OUT_CONFIRM = [
  'Call it a day? Your chair is ready for a nap too.',
  'Check out and leave the unread emails for Future You?',
  'Clock out before someone schedules “one more sync”?',
  'Escape while you still can — check out?',
  'Done enough for today? Hit check out?',
  'Log off like a legend. Confirm check out?',
];

const CHECK_IN_DONE = [
  'Welcome back, legend. The keyboard missed you.',
  'You’re in. Productivity mode: pretending to be engaged.',
  'Officially on the clock. Try not to open YouTube… yet.',
  'Boom — checked in. Your to-do list just felt a chill.',
  'Clock’s ticking. May your meetings be short and your coffee strong.',
  'You’re live. Time to turn caffeine into commits.',
];

const CHECK_OUT_DONE = [
  'You’re free. Go touch grass — or at least a snack.',
  'That’s a wrap. Your laptop can cool down now.',
  'Clocked out. Tomorrow’s problems can wait until tomorrow.',
  'Don’t check Slack. We mean it. Mostly.',
  'Session over. Rest is also a deliverable.',
  'Logged off like a pro. If anyone asks, you were deep in focus.',
];

function pick(list: string[], exclude?: string) {
  if (list.length === 0) return '';
  if (list.length === 1) return list[0]!;
  let next = list[Math.floor(Math.random() * list.length)]!;
  if (!exclude) return next;
  for (let i = 0; i < 6 && next === exclude; i++) {
    next = list[Math.floor(Math.random() * list.length)]!;
  }
  return next;
}

export function randomCheckInConfirmMessage(exclude?: string) {
  return pick(CHECK_IN_CONFIRM, exclude);
}

export function randomCheckOutConfirmMessage(exclude?: string) {
  return pick(CHECK_OUT_CONFIRM, exclude);
}

export function randomCheckInMessage(exclude?: string) {
  return pick(CHECK_IN_DONE, exclude);
}

export function randomCheckOutMessage(exclude?: string) {
  return pick(CHECK_OUT_DONE, exclude);
}
