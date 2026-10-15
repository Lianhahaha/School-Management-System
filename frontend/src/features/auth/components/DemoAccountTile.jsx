import { ChevronRight } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { FormRootError } from '../../../components/ui/FormField';
import { Spinner } from '../../../components/ui/Spinner';
import { fullName, initials } from '../../../utils/names';
import { roleLabel } from '../../../utils/roles';
import { useDemoAccount, useDemoSignIn } from '../hooks';

/**
 * The demo account the API offers (DEMO_ACCOUNT_EMAIL), as one tile under the sign-in form: its initials, name,
 * role and a "Demo account" tag, so a visitor knows what they open before tapping. One tap signs in (no
 * password); AuthProvider and the guards take over from there. Renders nothing when there is no demo.
 */
export function DemoAccountTile() {
  const { data: demo } = useDemoAccount();
  const signIn = useDemoSignIn();
  if (!demo) return null;

  const name = fullName(demo);

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold text-gray-600">Trying Skole? Use the demo account</p>
      <button
        type="button"
        onClick={() => signIn.mutate()}
        disabled={signIn.isPending}
        aria-busy={signIn.isPending || undefined}
        aria-label={`Sign in as ${name}, ${roleLabel(demo.role)}, demo account`}
        className="flex w-full items-center gap-3 rounded-xl bg-well px-3 py-2.5 text-left ring-1 ring-well-edge transition-colors ring-inset hover:bg-gray-100 disabled:cursor-wait"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-control bg-mark-maroon text-sm font-semibold text-mark-cream"
        >
          {initials(demo)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{name}</span>
          <span className="block text-xs text-gray-600">{roleLabel(demo.role)}</span>
        </span>
        <Badge tone="oxblood">Demo account</Badge>
        {signIn.isPending ? (
          <Spinner size="sm" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-[1.125rem] shrink-0 text-gray-600" />
        )}
      </button>
      <FormRootError
        error={signIn.isError ? { message: 'The demo could not be opened. Try again in a moment.' } : null}
        className="mt-2"
      />
    </div>
  );
}
