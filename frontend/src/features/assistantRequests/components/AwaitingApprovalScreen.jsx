import { LogOut } from 'lucide-react';
import { SplashFrame } from '../../../components/layout/SplashScreen';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { formatDate, isoToYmd } from '../../../utils/date';
import { useAuth } from '../../auth/hooks';

/**
 * The whole app for a student assistant whose sign-up is pending or declined (app/guards/RequireAuth shows it
 * instead of the app shell): where the request stands, the reason when declined, when it was sent, the email
 * the school office answers, Sign out and the theme switch. It reads only the session's `me`, so it fetches
 * nothing: every request but /auth/me would be refused. AuthProvider re-reads /auth/me now and then, so an
 * approval opens the office pages by itself.
 */
export function AwaitingApprovalScreen() {
  const { me, logout } = useAuth();
  const request = me.assistantRequest;
  const isDeclined = request.status === 'declined';
  const title = isDeclined ? 'Your request was declined' : 'Your request is waiting for approval';
  useDocumentTitle(title);

  return (
    <SplashFrame>
      <main className="w-full max-w-md">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Student assistant request sent on {formatDate(isoToYmd(request.requestedAt))}
        </p>
        {isDeclined ? (
          request.declineReason && (
            <Alert tone="error" title="Reason from the school office" className="mt-5 text-left">
              {request.declineReason}
            </Alert>
          )
        ) : (
          <p className="mt-4 text-sm text-gray-600">
            An admin or a student assistant reviews it. Once it is approved, the school office pages open
            here.
          </p>
        )}
        <p className="mt-4 text-sm text-gray-600">
          The school office will email you at <span className="font-medium text-gray-900">{me.email}</span>.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" icon={LogOut} onClick={logout}>
            Sign out
          </Button>
          <ThemeToggle />
        </div>
      </main>
    </SplashFrame>
  );
}
