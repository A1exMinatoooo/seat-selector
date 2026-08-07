import { hashPassword } from "../src/server/security/crypto";

const password = process.argv[2];
if (!password || password.length < 10) {
  process.stderr.write("Usage: pnpm admin:hash '<password-at-least-10-characters>'\n");
  process.exitCode = 1;
} else {
  process.stdout.write(`${hashPassword(password)}\n`);
}
