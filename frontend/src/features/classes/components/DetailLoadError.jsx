import { ArrowLeft, SearchX, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';

/**
 * What a detail page shows when its main query failed: a 404 reads "not found", a 403 "no access",
 * anything else is an ErrorState with Retry. Both inline states link back to the list.
 *
 * @param {object} props
 * @param {Error & { status?: number }} props.error the query error
 * @param {string} props.noun what was looked up, for example "class"
 * @param {string} props.backTo path of the list page
 * @param {string} props.backLabel for example "Back to classes"
 * @param {() => void} props.onRetry
 */
export function DetailLoadError({ error, noun, backTo, backLabel, onRetry }) {
  const backButton = (
    <Button as={Link} to={backTo} variant="secondary" icon={ArrowLeft}>
      {backLabel}
    </Button>
  );

  if (error.status === 404) {
    return (
      <EmptyState
        icon={SearchX}
        title={`This ${noun} doesn't exist`}
        description="It may have been deleted, or the link is wrong."
        action={backButton}
      />
    );
  }
  if (error.status === 403) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={`You don't have access to this ${noun}`}
        description="Ask an administrator if you think you should."
        action={backButton}
      />
    );
  }
  return <ErrorState title={`Couldn't load the ${noun}`} message={error.message} onRetry={onRetry} />;
}
