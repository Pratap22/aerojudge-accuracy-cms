import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env.js';

let client: SESClient | null = null;

function getSesClient(): SESClient {
  if (client) return client;
  client = new SESClient({
    region: env.AWS_REGION,
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });
  return client;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send email via AWS SES. When SES_FROM_EMAIL is unset (local/dev),
 * logs the message instead of throwing so flows remain testable.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ delivered: boolean }> {
  if (!env.sesEnabled || !env.SES_FROM_EMAIL) {
    console.info('[email] SES not configured — message not sent', {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { delivered: false };
  }

  const from = env.SES_FROM_NAME
    ? `${env.SES_FROM_NAME} <${env.SES_FROM_EMAIL}>`
    : env.SES_FROM_EMAIL;

  await getSesClient().send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [input.to] },
      Message: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: input.text, Charset: 'UTF-8' },
          Html: { Data: input.html, Charset: 'UTF-8' },
        },
      },
    }),
  );

  return { delivered: true };
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<{ delivered: boolean }> {
  const subject = 'Reset your AeroJudge password';
  const text = [
    `Hi ${opts.firstName},`,
    '',
    'We received a request to reset your AeroJudge password.',
    `Open this link to choose a new password (expires in ${opts.expiresInMinutes} minutes):`,
    opts.resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
    '',
    '— AeroJudge',
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #0f172a;">
  <p>Hi ${escapeHtml(opts.firstName)},</p>
  <p>We received a request to reset your AeroJudge password.</p>
  <p>
    <a href="${escapeAttr(opts.resetUrl)}" style="display:inline-block;padding:10px 16px;background:#0284c7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
      Reset password
    </a>
  </p>
  <p style="color:#64748b;font-size:14px;">This link expires in ${opts.expiresInMinutes} minutes. If you did not request a reset, you can ignore this email.</p>
  <p style="color:#64748b;font-size:12px;">Or copy this URL:<br/><span style="word-break:break-all;">${escapeHtml(opts.resetUrl)}</span></p>
</body>
</html>`.trim();

  return sendEmail({ to: opts.to, subject, text, html });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
