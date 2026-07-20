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
}): Promise<{ sent: boolean; preview?: string }> {
  const subject = `You're invited to ${input.projectName} on DockX`;
  const text = [
    `Hi,`,
    ``,
    `${input.inviterName} invited you to join “${input.projectName}” at ${input.orgName} on DockX.`,
    ``,
    `Create your account using this link:`,
    input.inviteLink,
    ``,
    `After you sign up, you'll already be on that project.`,
    ``,
    `— DockX`,
  ].join('\n');

  const html = `
    <p>Hi,</p>
    <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to join
      <strong>${escapeHtml(input.projectName)}</strong> at
      <strong>${escapeHtml(input.orgName)}</strong> on DockX.</p>
    <p><a href="${input.inviteLink}">Create your account</a></p>
    <p>After you sign up, you'll already be on that project.</p>
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
