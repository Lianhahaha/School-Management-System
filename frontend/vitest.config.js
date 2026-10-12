import { defineConfig } from 'vitest/config';

/**
 * Two kinds of test, told apart by the file extension:
 *
 *   unit        *.test.js    the pure modules (grade arithmetic, form rules, paging, dates) in plain Node,
 *                            without jsdom
 *   components  *.test.jsx   a few risky screens rendered with Testing Library in jsdom; the API layer (a
 *                            feature's api.js) is mocked, never the component
 *
 * The React and Tailwind plugins of vite.config.js are left out (Vitest reads this file instead of that one);
 * the JSX of the components compiles with the automatic runtime without them.
 *
 * No Firebase values are needed: the unit tests never reach config/env.js, and the component tests replace
 * config/env.js and config/firebase.js (tests/helpers/setup.js). Keep it that way rather than adding fake keys.
 */
export default defineConfig({
  test: {
    // The school's time zone (UTC+8, no daylight saving), so a test that turns a timestamp into a calendar
    // date or a UTC offset gets the same answer on a laptop in Manila and on a UTC CI runner.
    env: { TZ: 'Asia/Manila' },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/**/*.test.js'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'components',
          include: ['tests/**/*.test.jsx'],
          environment: 'jsdom',
          setupFiles: ['tests/helpers/setup.js'],
        },
      },
    ],
  },
});
