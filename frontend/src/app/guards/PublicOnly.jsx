import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../features/auth/hooks';
import { roleHome } from '../../utils/roles';
import { AuthStatusSplash } from './AuthStatusSplash';

/**
 * Layout route for /login, /register and /forgot-password. Signed-in users are sent on (to the page
 * RequireAuth bounced them from when it belongs to their area, else their dashboard). While the
 * session is unsettled a splash is shown, so the form never flashes for a user who is signed in.
 */
export function PublicOnly() {
  const { status, role } = useAuth();
  const location = useLocation();

  if (status === 'anonymous') return <Outlet />;
  if (status !== 'authenticated') return <AuthStatusSplash />;

  const home = roleHome(role);
  const from = location.state?.from;
  return <Navigate to={from?.pathname.startsWith(home) ? from : home} replace />;
}
