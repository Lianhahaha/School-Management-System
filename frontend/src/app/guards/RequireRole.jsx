import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../features/auth/hooks';

/**
 * Layout route that admits only the given roles; everyone else sees the 403 page.
 * Nest it under RequireAuth, so every page of an area is protected by construction.
 * This only hides the pages: the backend is what actually enforces access.
 * @param {{ roles: string[] }} props
 */
export function RequireRole({ roles }) {
  const { role } = useAuth();
  return roles.includes(role) ? <Outlet /> : <Navigate to="/403" replace />;
}
