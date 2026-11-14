import { Router } from 'express';
import { z } from 'zod';
import { magicLinkRequestSchema } from '@understood/shared';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { MagicLink, Organization, User } from '../../models.js';
import { AppError } from '../../errors.js';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { rateLimit } from '../../auth/rate-limit.js';
import { tokenHash, randomToken } from '../../auth/tokens.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  sessionCookie,
  setSessionCookie,
} from '../../auth/sessions.js';
import { requireAuth } from '../../auth/middleware.js';
import { defaultOrgName, defaultUserName } from '../../domain/names.js';
import { sendEmail } from '../../email/mailer.js';
import { getKv } from '../../stores/kv.js';

export const authRouter: Router = Router();

authRouter.post(
  '/magic-link',
  rateLimit({ bucket: 'magic-link-ip', limit: 20, windowSeconds: 3600 }),
  asyncHandler(async (req, res) => {
    const { email } = parseBody(magicLinkRequestSchema, req);

    const perEmail = await getKv().incr(`ml:email:${email}`, 3600);
    if (perEmail > 5) throw new AppError('RATE_LIMITED');

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await MagicLink.create({ email, tokenHash: tokenHash(token), expiresAt });

    const url = `${config.APP_URL}/api/v1/auth/verify?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: email,
      subject: 'Sign in to Understood',
      text: `Open this link to sign in. It expires in 15 minutes and can be used once.\n\n${url}\n\nIf you did not request this, ignore this email.`,
      template: 'magic_link',
    }).catch((error) => logger.error({ err: error instanceof Error ? error.message : String(error) }, 'magic link email failed'));

    sendData(res, { sent: true }, undefined, 202);
  }),
);

authRouter.get(
  '/verify',
  rateLimit({ bucket: 'verify-ip', limit: 30, windowSeconds: 3600 }),
  asyncHandler(async (req, res) => {
    const token = z.string().min(20).max(200).safeParse(req.query.token);
    if (!token.success) {
      res.redirect(302, `${config.APP_URL}/signin?error=link_unavailable`);
      return;
    }

    const link = await MagicLink.findOneAndUpdate(
      { tokenHash: tokenHash(token.data), usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: false },
    );
    if (!link) {
      res.redirect(302, `${config.APP_URL}/signin?error=link_unavailable`);
      return;
    }

    let user = await User.findOne({ email: link.email });
    if (!user) {
      const org = await Organization.create({
        name: defaultOrgName(link.email),
        timezone: 'Asia/Dubai',
        locale: 'en',
        plan: 'pilot',
      });
      try {
        user = await User.create({
          orgId: org._id,
          email: link.email,
          name: defaultUserName(link.email),
          role: 'owner',
        });
      } catch (error) {
        const existing = await User.findOne({ email: link.email });
        if (!existing) throw error;
        user = existing;
      }
    }

    user.lastLoginAt = new Date();
    await user.save();

    const sessionToken = await createSession(user._id, user.orgId);
    setSessionCookie(res, sessionToken);
    res.redirect(302, `${config.APP_URL}/home`);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = sessionCookie(req);
    if (token && req.auth) {
      await destroySession(token, req.auth.userId);
    } else if (token) {
      const { readSession } = await import('../../auth/sessions.js');
      const session = await readSession(token);
      if (session) await destroySession(token, session.auth.userId);
    }
    clearSessionCookie(res);
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId);
    const org = await Organization.findById(req.auth!.orgId);
    if (!user || !org) throw new AppError('AUTH_REQUIRED');

    sendData(res, {
      user: { id: String(user._id), name: user.name ?? '', email: user.email, role: user.role, locale: org.locale },
      org: { id: String(org._id), name: org.name, timezone: org.timezone, plan: org.plan },
    });
  }),
);
