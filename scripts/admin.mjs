// Manage the admin list in the live database.
//   npm run admin -- add someone@example.com "Their Name"
//   npm run admin -- remove someone@example.com
//   npm run admin -- list
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const [cmd, email = '', ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();
const isEmail = (s) => /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i.test(s);
const sql = (s) => `'${s.replace(/'/g, "''")}'`;
const d1 = (command) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'ndsa-admin-db', '--remote', '--command', command], { stdio: 'inherit' });

if (cmd === 'list') {
  d1('SELECT email, name, datetime(last_sign_in_at, \'unixepoch\') AS last_sign_in, (SELECT COUNT(*) FROM passkeys p WHERE p.email = a.email) AS passkeys FROM admins a ORDER BY email');
} else if (cmd === 'add' && isEmail(email) && /^[\p{L}\p{M}' .-]{1,60}$/u.test(name)) {
  const handle = randomBytes(32).toString('base64url');
  d1(`INSERT INTO admins (email, name, user_handle, created_at) VALUES (${sql(email.toLowerCase())}, ${sql(name)}, ${sql(handle)}, unixepoch())`);
  console.log(`Added ${email}. They can now sign in at https://ndsa.labs.chrisdemetriou.com/admin`);
} else if (cmd === 'remove' && isEmail(email)) {
  d1(`DELETE FROM admins WHERE email = ${sql(email.toLowerCase())}`); // passkeys and sessions go with it
  console.log(`Removed ${email}, with their passkeys and sessions.`);
} else {
  console.log('Usage: npm run admin -- add <email> "<name>" | remove <email> | list');
  process.exit(1);
}
