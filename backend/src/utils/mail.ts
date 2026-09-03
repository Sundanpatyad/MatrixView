import nodemailer from 'nodemailer';
import { config } from '../config.js';

function smtpConfigured() {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPass && config.smtpFrom);
}

export async function sendInviteEmail(input: {
  to: string;
  inviterName: string;
  projectName: string;
  orgName: string;
  inviteLink: string;
  hasAccount?: boolean;
}): Promise<{ sent: boolean; preview?: string }> {
  const subject = `You're invited to ${input.projectName} on DockX`;
  const action = input.hasAccount
    ? `Sign in and Accept to join the project:`
    : `Create your account. That accepts the invite:`;
  const after = input.hasAccount
    ? `You will not see the board until you Accept.`
    : `After you create your account you'll land on the project.`;
  const text = [
    `Hi,`,
    ``,
    `${input.inviterName} invited you to join “${input.projectName}” on DockX.`,
    ``,
    action,
    input.inviteLink,
    ``,
    after,
    ``,
    `— DockX`,
  ].join('\n');

  const html = `
    <p>Hi,</p>
    <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to join
      <strong>${escapeHtml(input.projectName)}</strong> on DockX.</p>
    <p><a href="${input.inviteLink}">${input.hasAccount ? 'Accept invite' : 'Create your account'}</a></p>
    <p>${escapeHtml(after)}</p>
  `;

  console.log(`[mail] Invite for ${input.to}`);
  console.log(`[mail] Link: ${input.inviteLink}`);

  if (!smtpConfigured()) {
    console.log(`[mail] SMTP not configured — invite logged only (set SMTP_HOST / SMTP_FROM)`);
    return { sent: false, preview: input.inviteLink };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: !config.smtpSecure && config.smtpPort === 587,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await transporter.sendMail({
    from: config.smtpFrom,
    to: input.to,
    subject,
    text,
    html,
  });

  console.log(`[mail] Sent invite to ${input.to}`);
  return { sent: true };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
