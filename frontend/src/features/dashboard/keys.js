export const dashboardKeys = {
  all: ['dashboard'],
  /** GET /dashboard: one payload per role, no parameters. */
  current: () => [...dashboardKeys.all, 'current'],
};
