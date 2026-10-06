import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../features/auth/hooks';
import { ROLE_HOME } from '../../constants/ui';
import { Button } from '../ui/Button';

/**
 * "Back" at the top of every page except the role's home. It returns to the page the user came from
 * when there is one in this tab (the browser's history); a page opened directly (a link, a reload)
 * has none, so it goes up to `fallback` instead, or to the role's home.
 * @param {object} props
 * @param {string} [props.fallback] where to go without in-app history, usually the parent list page
 */
export function BackButton({ fallback }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const home = ROLE_HOME[role] ?? '/';

  if (location.pathname.replace(/\/$/, '') === home) return null;

  // React Router gives the first entry of a session the key "default": nothing in the app to go back to.
  const hasHistory = location.key !== 'default';

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={ArrowLeft}
      onClick={() => (hasHistory ? navigate(-1) : navigate(fallback ?? home))}
      className="-ml-3"
    >
      Back
    </Button>
  );
}
