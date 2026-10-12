/**
 * Runs before every component test (*.test.jsx), in jsdom.
 *
 * config/env.js throws without the VITE_FIREBASE_* variables and config/firebase.js starts a Firebase app, so
 * both are replaced: no test signs in or reaches the network. Each test mocks its feature's api.js instead.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: { firebase: {}, apiBaseUrl: '/api/v1', demoAccounts: null },
}));

vi.mock('../../src/config/firebase', () => ({ auth: { currentUser: null } }));

// Testing Library unmounts after each test by itself only when Vitest's globals are on; they are off here.
afterEach(cleanup);
