import { PageHeader } from '../../../components/layout/PageHeader';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useDashboard } from '../hooks';

function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading dashboard" className="@container space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 @3xl:grid-cols-3">
        {[0, 1, 2].map((tile) => (
          <Skeleton key={tile} className="h-14 w-full" />
        ))}
      </div>
      <div className="grid gap-6 @3xl:grid-cols-2 @6xl:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full @max-6xl:hidden" />
      </div>
    </div>
  );
}

/**
 * Page frame of the three dashboards: header, loading skeleton, error state with retry, and the
 * payload handed to `children` once it has arrived. The payload is discriminated by `role`; a
 * payload of another role than the page expects is treated as an error (it should never happen,
 * the route guards and the backend both key off the same role).
 *
 * @param {object} props
 * @param {'admin'|'teacher'|'student'} props.role
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import('react').ReactNode | ((data: object) => import('react').ReactNode)} [props.actions] header
 *   actions; a function receives the payload and renders once it has arrived (for links into today's data)
 * @param {(data: object) => import('react').ReactNode} props.children render function for the payload
 */
export function DashboardView({ role, title, description, actions, children }) {
  const { data, error, isPending, refetch } = useDashboard();

  let body;
  const hasPayload = Boolean(data) && data.role === role;
  const headerActions = typeof actions === 'function' ? (hasPayload ? actions(data) : null) : actions;
  if (error && !data) {
    body = <ErrorState title="Couldn't load the dashboard" message={error.message} onRetry={refetch} />;
  } else if (isPending) {
    body = <DashboardSkeleton />;
  } else if (data.role !== role) {
    body = (
      <ErrorState
        title="This dashboard isn't for your account"
        message="Open the dashboard from the navigation menu."
        onRetry={refetch}
      />
    );
  } else {
    body = children(data);
  }

  return (
    <>
      <PageHeader title={title} description={description} actions={headerActions} />
      {body}
    </>
  );
}
