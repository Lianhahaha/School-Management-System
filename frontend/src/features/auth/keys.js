export const authKeys = {
  all: ['auth'],
  /** The signed-in account: GET /auth/me. */
  me: () => [...authKeys.all, 'me'],
  /** The demo account the sign-in page offers: GET /auth/demo. */
  demo: () => [...authKeys.all, 'demo'],
};
