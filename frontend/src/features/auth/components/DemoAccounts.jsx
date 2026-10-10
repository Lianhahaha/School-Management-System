import { ChevronDown, Copy } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { env } from '../../../config/env';
import { toastBus } from '../../../lib/toastBus';

/** Copies `value`; a browser that refuses (an old one, an insecure page) is told to select the text instead. */
function CopyButton({ value, label }) {
  const copy = () =>
    navigator.clipboard
      .writeText(value)
      .then(() => toastBus.success(`${label} copied`))
      .catch(() => toastBus.info(`Couldn't copy. Select the ${label.toLowerCase()} and copy it instead.`));

  return (
    <Button variant="ghost" size="sm" icon={Copy} aria-label={`Copy ${label.toLowerCase()}`} onClick={copy} />
  );
}

/**
 * The demo sign-ins of a public demo (env.demoAccounts, from the build's VITE_DEMO_ACCOUNTS), folded under the
 * sign-in form so the page still reads as a school's sign-in until a reviewer opens it. One row per account
 * with its role and email, then the password they share, each with a copy button. Renders nothing when the
 * build has no demo accounts.
 */
export function DemoAccounts() {
  const demo = env.demoAccounts;
  if (!demo || demo.accounts.length === 0) return null;

  return (
    <details className="group mt-6 border-t border-gray-200 pt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-control px-1 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
        Demo accounts for reviewers
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-gray-600 transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="mt-2 mb-3 text-xs text-gray-600">
        A mock school to explore. One password for {demo.accounts.length === 1 ? 'it' : 'all of them'}.
      </p>
      <ul className="divide-y divide-gray-200 rounded-xl bg-well ring-1 ring-well-edge ring-inset">
        {demo.accounts.map((account) => (
          <li key={account.email} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
            <Badge tone="blue" className="w-16 shrink-0 justify-center">
              {account.role}
            </Badge>
            <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere] text-gray-900">
              {/* On a phone a long address wraps after the @ rather than in the middle of a word. */}
              {account.email.split('@')[0]}@<wbr />
              {account.email.split('@').slice(1).join('@')}
            </span>
            <CopyButton value={account.email} label={`${account.role} email`} />
          </li>
        ))}
        <li className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
          <span className="w-16 shrink-0 text-xs font-semibold text-gray-600">Password</span>
          <span className="min-w-0 flex-1 font-mono text-sm break-all text-gray-900">{demo.password}</span>
          <CopyButton value={demo.password} label="Password" />
        </li>
      </ul>
    </details>
  );
}
