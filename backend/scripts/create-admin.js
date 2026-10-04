/**
 * create-admin.js — creates one administrator (Firebase account + MySQL row), for a database with no
 * demo data. Administrators cannot sign up on the public page, so the first one comes from here.
 *
 *   npm run db:create-admin -- admin@example.com "A strong password" Amara Johnson
 *
 * The arguments are e-mail, password (8+ characters), first name and last name (both optional).
 * Run it against the cloud database with `node --env-file=.env --env-file=.env.cloud scripts/create-admin.js ...`.
 */
import { closePool } from '../src/config/db.js';
import { assertFirebaseReady, firebase } from '../src/config/firebase.js';
import { createUserAccount } from '../src/modules/users/users.service.js';

const [email, password, firstName = 'Site', lastName = 'Administrator'] = process.argv.slice(2);

async function main() {
  if (!email || !password) {
    throw new Error('Usage: npm run db:create-admin -- <email> <password> [firstName] [lastName]');
  }
  if (password.length < 8) throw new Error('The password needs at least 8 characters.');
  assertFirebaseReady();
  const account = await createUserAccount(
    { email, password, role: 'admin', firstName, lastName },
    { trusted: true },
  );
  console.log(`✔ Administrator ${account.email} created (Firebase project ${firebase.projectId}).`);
}

main()
  .catch((error) => {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
