import { config, isProduction } from '../config.js';
import { logger } from '../logger.js';
import { EmailLog } from '../models.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  template: 'magic_link' | 'help_alert' | 'org_deletion';
  orgId?: string | null;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    if (isProduction) {
      throw new Error('Console mailer cannot run in production');
    }
    process.stdout.write(`\n[email:${message.template}] to=${message.to} subject=${message.subject}\n${message.text}\n\n`);
  }
}

class ResendMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`resend ${response.status}: ${body.slice(0, 200)}`);
    }
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (!mailer) mailer = config.EMAIL_DRIVER === 'resend' ? new ResendMailer() : new ConsoleMailer();
  return mailer;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await getMailer().send(message);
    await EmailLog.create({
      orgId: message.orgId ?? null,
      to: message.to,
      template: message.template,
      status: 'sent',
    });
  } catch (error) {
    logger.error(
      { template: message.template, err: error instanceof Error ? error.message : String(error) },
      'email send failed',
    );
    await EmailLog.create({
      orgId: message.orgId ?? null,
      to: message.to,
      template: message.template,
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    }).catch(() => undefined);
    throw error;
  }
}
