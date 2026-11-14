import { connectMongo, disconnectMongo } from '../db.js';
import { config } from '../config.js';
import { MagicLink, User } from '../models.js';
import { randomToken, tokenHash } from '../auth/tokens.js';

const email = process.argv[2] ?? 'owner@demo.understood.local';

async function main(): Promise<void> {
  await connectMongo();
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(`No user ${email}. Run "npm run seed --workspace @understood/api" first.`);
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
