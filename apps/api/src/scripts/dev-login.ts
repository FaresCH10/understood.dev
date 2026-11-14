import { connectMongo, disconnectMongo } from '../db.js';
import { config } from '../config.js';
import { MagicLink, User } from '../models.js';
import { randomToken, tokenHash } from '../auth/tokens.js';
import { isProduction } from '../config.js';

const email = process.argv[2] ?? 'owner@demo.understood.local';

async function main(): Promise<void> {
  if (isProduction) throw new Error('Development sign-in helpers are disabled in production.');
  await connectMongo();
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(`No user ${email}. Run "npm run seed --workspace @understood/api" first.`);
  }
  if (await User.exists({_id:user._id,passwordHash:{$exists:true}})) {
    process.stdout.write(`Open ${config.APP_URL}/signin and sign in with your verified email and password.\n`);
    await disconnectMongo();
    return;
  }
  const token = randomToken(32);
  await MagicLink.create({
    email: user.email,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  process.stdout.write(`${config.APP_URL}/api/v1/auth/verify?token=${token}\n`);
  await disconnectMongo();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
