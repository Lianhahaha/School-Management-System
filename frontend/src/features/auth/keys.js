export const authKeys = {
  all: ['auth'],
  /** The signed-in account: GET /auth/me. */
  me: () => [...authKeys.all, 'me'],
};
