import { Navigate, Outlet, useLocation } from 'react-router';
import { AwaitingApprovalScreen } from '../../features/assistantRequests/components/AwaitingApprovalScreen';
import { isAwaitingApproval } from '../../features/assistantRequests/status';
import { useAuth } from '../../features/auth/hooks';
import { AuthStatusSplash } from './AuthStatusSplash';

/**
 * Layout route for everything behind sign-in. Nothing below it renders (and no data query runs)
 * until `status` is 'authenticated'; anonymous visitors go to /login and come back afterwards.
 *
 * A student assistant whose sign-up is pending or declined gets the waiting screen instead of the whole app,
 * whatever the URL: the API refuses them everything but /auth/me, so no app shell (bell, nav counts, live
 * refresh) and no page is mounted for them. Once the office approves them, /auth/me says so and the app opens.
 */
export function RequireAuth() {
  const { status, me } = useAuth();
  const location = useLocation();

  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  if (status !== 'authenticated') return <AuthStatusSplash />;
  if (isAwaitingApproval(me)) return <AwaitingApprovalScreen />;
  return <Outlet />;
}
