import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Brand } from './Brand';

/**
 * Full-page screen shown while the session is being resolved (variant "loading"), or when the
 * account could not be loaded because the server is unreachable (variant "error": Retry and Sign out).
 * @param {object} props
 * @param {'loading'|'error'} [props.variant]
 * @param {() => void} [props.onRetry]
 * @param {() => void} [props.onSignOut]
 */
export function SplashScreen({ variant = 'loading', onRetry, onSignOut }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-gray-50 px-4 text-center">
      <Brand />
      {variant === 'error' ? (
        <div role="alert" className="max-w-sm">
          <h1 className="text-lg font-semibold text-gray-900">Can't reach the server</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your account could not be loaded. Check your connection and try again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button icon={RefreshCw} onClick={onRetry}>
              Retry
            </Button>
            <Button variant="secondary" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <Spinner size="lg" label="Loading your account" />
      )}
    </div>
  );
}
