/**
 * In-memory replacement for the Firebase Admin SDK surface the app uses, with a fixed project id
 * (no service-account file needed). Tokens are the string `token-<uid>`; `bearer(uid)` builds the header value.
 */
import { firebase } from '../../src/config/firebase.js';

const users = new Map(); // uid -> { uid, email, password, disabled }
let counter = 0;

export const FAKE_PROJECT_ID = 'fake-school-project';

const failure = (code) => Object.assign(new Error(code), { code });

export function installFakeFirebase() {
  users.clear();
  counter = 0;

  Object.defineProperty(firebase, 'projectId', { value: FAKE_PROJECT_ID, configurable: true });
  firebase.verifyIdToken = async (token) => {
    const uid = String(token).replace(/^token-/, '');
    if (!users.has(uid)) throw failure('auth/argument-error');
    return { uid };
  };
  firebase.createUser = async ({ email, password }) => {
    if ([...users.values()].some((user) => user.email === email)) throw failure('auth/email-already-exists');
    const uid = `uid-${++counter}`;
    users.set(uid, { uid, email, password, disabled: false });
    return { uid };
  };
  firebase.getUserByEmail = async (email) => {
    const found = [...users.values()].find((user) => user.email === email);
    if (!found) throw failure('auth/user-not-found');
    return found;
  };
  firebase.updateUser = async (uid, properties) => {
    if (!users.has(uid)) throw failure('auth/user-not-found');
    Object.assign(users.get(uid), properties);
    return users.get(uid);
  };
  firebase.deleteUser = async (uid) => {
    if (!users.delete(uid)) throw failure('auth/user-not-found');
  };
  firebase.revokeRefreshTokens = async () => {};
}

export const firebaseUsers = () => [...users.values()];
export const bearer = (uid) => `Bearer token-${uid}`;
