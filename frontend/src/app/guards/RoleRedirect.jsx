import { Navigate } from 'react-router';
import { useAuth } from '../../features/auth/hooks';
import { roleHome } from '../../utils/roles';

/** The index route '/': sends the signed-in user to their own area. */
export function RoleRedirect() {
  const { role } = useAuth();
  return <Navigate to={roleHome(role)} replace />;
}
