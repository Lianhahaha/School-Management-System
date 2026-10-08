import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../features/auth/hooks';
import { roleHome } from '../../utils/roles';
import { AuthStatusSplash } from './AuthStatusSplash';

/** Pages every role has, outside the role areas. */
const SHARED_PATHS = ['/profile'];

/** True when `pathname` is `area` itself or a page inside it ("/admin" matches "/admin/users", not "/administer"). */
const isInside = (pathname, area) => pathname === area || pathname.startsWith(`${area}/`);

/**
 * Layout route for /login, /register and /forgot-password. Signed-in users are sent on (to the page
 * RequireAuth bounced them from when it belongs to their area or is shared, else their dashboard). While
 * the session is unsettled a splash is shown, so the form never flashes for a user who is signed in.
 */
export function PublicOnly() {
  const { status, role } = useAuth();
  const location = useLocation();

  if (status === 'anonymous') return <Outlet />;
  if (status !== 'authenticated') return <AuthStatusSplash />;

  const home = roleHome(role);
  const from = location.state?.from;
  const canReturn =
    from && (isInside(from.pathname, home) || SHARED_PATHS.some((path) => isInside(from.pathname, path)));
  return <Navigate to={canReturn ? from : home} replace />;
}
