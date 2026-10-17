// Manage the approved admin list in the live database. Only people on this list can sign in.
// Sign-in is passwordless: a single-use link, then a passkey.
//   npm run admin -- list
//   npm run admin -- add someone@example.com "Their Name"             (may be e-mailed sign-in links)
//   npm run admin -- add someone@example.com "Their Name" --no-email  (never e-mailed by the system)
//   npm run admin -- email someone@example.com on|off                 (allow or stop e-mails)
//   npm run admin -- link someone@example.com                         (print a single-use link to hand over yourself)
//   npm run admin -- remove someone@example.com                       (also removes their passkeys and sessions)
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const noEmail = args.includes('--no-email');
const [cmd, rawEmail = '', ...rest] = args.filter((a) => a !== '--no-email');
const email = rawEmail.toLowerCase();
const isEmail = (s) => /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i.test(s);
const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;
const d1 = (command) =>
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'ndsa-admin-db', '--remote', '--json', '--command', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const rows = (out) => JSON.parse(out)[0]?.results ?? [];
const fail = (msg) => { console.error(msg); process.exit(1); };
const exists = () => rows(d1(`SELECT 1 FROM admins WHERE email = ${sql(email)}`)).length > 0;

const LINK_HOURS = 72;

if (cmd === 'list') {
  const list = rows(d1(`SELECT email, name, email_ok, datetime(last_sign_in_at, 'unixepoch') AS last_sign_in,
    (SELECT COUNT(*) FROM passkeys p WHERE p.email = a.email) AS passkeys FROM admins a ORDER BY email`));
  if (!list.length) console.log('The admin list is empty.');
  for (const a of list) {
    console.log(`${a.email}  ·  ${a.name}  ·  ${a.email_ok ? 'may be e-mailed' : 'NEVER e-mailed'}  ·  passkeys: ${a.passkeys}  ·  last sign-in: ${a.last_sign_in ?? 'never'}`);
  }
} else if (cmd === 'add') {
  const name = rest.join(' ').trim();
  if (!isEmail(email)) fail('That is not an e-mail address.');
  if (!/^[\p{L}\p{M}' .-]{1,60}$/u.test(name)) fail('Add a name, for example: npm run admin -- add jo@example.com "Jo Bloggs"');
  if (exists()) fail(`${email} is already on the list.`);
  const handle = randomBytes(32).toString('base64url');
  d1(`INSERT INTO admins (email, name, user_handle, created_at, email_ok) VALUES (${sql(email)}, ${sql(name)}, ${sql(handle)}, unixepoch(), ${noEmail ? 0 : 1})`);
  console.log(`Added ${name} (${email})${noEmail ? '. The system will NEVER e-mail this address; use "npm run admin -- link" to hand them a link yourself.' : '.'}`);
  console.log('Nothing has been sent to them.');
} else if (cmd === 'email' && ['on', 'off'].includes(rest[0])) {
  if (!exists()) fail(`${email} is not on the list.`);
  d1(`UPDATE admins SET email_ok = ${rest[0] === 'on' ? 1 : 0} WHERE email = ${sql(email)}`);
  console.log(`${email}: ${rest[0] === 'on' ? 'may now be e-mailed sign-in links' : 'will never be e-mailed'}. Nothing has been sent.`);
} else if (cmd === 'link') {
  if (!exists()) fail(`${email} is not on the list.`);
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  d1(`INSERT INTO login_links (token_hash, email, created_at, expires_at) VALUES (${sql(hash)}, ${sql(email)}, unixepoch(), unixepoch() + ${LINK_HOURS * 3600})`);
  d1(`INSERT INTO audit (at, email, action, detail) VALUES (unixepoch(), ${sql(email)}, 'link-made-by-hand', 'printed for hand delivery; not e-mailed')`);
  console.log(`Single-use sign-in link for ${email} (works once, for ${LINK_HOURS} hours). Nothing has been sent; give it to them yourself:\n`);
  console.log(`https://ndsa.labs.chrisdemetriou.com/auth/link?t=${token}\n`);
} else if (cmd === 'remove') {
  if (!exists()) fail(`${email} is not on the list.`);
  d1(`DELETE FROM sessions WHERE email = ${sql(email)}; DELETE FROM passkeys WHERE email = ${sql(email)}; DELETE FROM login_links WHERE email = ${sql(email)}; DELETE FROM admins WHERE email = ${sql(email)}`);
  console.log(`Removed ${email}, with their passkeys, links and sessions.`);
} else {
  console.log('Usage: npm run admin -- list | add <email> "<name>" [--no-email] | email <email> on|off | link <email> | remove <email>');
  process.exit(1);
}
