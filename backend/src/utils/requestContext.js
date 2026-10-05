/**
 * Who is making the current request, available to any code the request runs (awaited or not) without
 * passing it down every call. `authenticate` opens the context; the activity log reads the actor from it.
 * Outside a request (scripts, seeds, tests calling services directly) there is no user.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

/** Runs `fn` with `context` ({ user }) as the current request context. */
export const runWithContext = (context, fn) => storage.run(context, fn);

/** The signed-in user of the request being handled (req.user), or null. */
export const currentUser = () => storage.getStore()?.user ?? null;
