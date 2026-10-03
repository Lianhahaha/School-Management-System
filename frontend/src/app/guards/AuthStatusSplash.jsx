import { SplashScreen } from '../../components/layout/SplashScreen';
import { useAuth } from '../../features/auth/hooks';

/**
 * What the guards show while the session is not settled: the loading splash while Firebase and
 * /auth/me are being resolved, and the retry screen when the account could not be loaded.
 */
export function AuthStatusSplash() {
  const { status, logout, refreshMe } = useAuth();

  return status === 'profile-error' ? (
    <SplashScreen variant="error" onRetry={refreshMe} onSignOut={logout} />
  ) : (
    <SplashScreen />
  );
}
