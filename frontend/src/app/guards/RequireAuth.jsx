import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../features/auth/hooks';
import { AuthStatusSplash } from './AuthStatusSplash';

/**
 * Layout route for everything behind sign-in. Nothing below it renders (and no data query runs)
 * until `status` is 'authenticated'; anonymous visitors go to /login and come back afterwards.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  if (status !== 'authenticated') return <AuthStatusSplash />;
  return <Outlet />;
}
