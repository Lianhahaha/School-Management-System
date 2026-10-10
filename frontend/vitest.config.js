import { defineConfig } from 'vitest/config';

/**
 * Unit tests of the frontend's pure modules: grade arithmetic, form rules, CSV import and export, dates.
 * Nothing under test touches the DOM, so the tests run in plain Node without jsdom, and the React and
 * Tailwind plugins of vite.config.js are left out (Vitest reads this file instead of that one).
 *
 * None of the modules under test reaches config/env.js, which throws without the VITE_FIREBASE_* variables,
 * so no Firebase values are needed here. Keep it that way: test a module that does import it through the
 * functions that do not, rather than adding fake keys.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    // The school's time zone (UTC+8, no daylight saving), so a test that turns a timestamp into a calendar
    // date or a UTC offset gets the same answer on a laptop in Manila and on a UTC CI runner.
    env: { TZ: 'Asia/Manila' },
  },
});
