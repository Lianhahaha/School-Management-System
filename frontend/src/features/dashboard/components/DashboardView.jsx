import { PageHeader } from '../../../components/layout/PageHeader';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useDashboard } from '../hooks';

function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading dashboard" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((tile) => (
          <Skeleton key={tile} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
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
 * @param {import('react').ReactNode} [props.actions]
 * @param {(data: object) => import('react').ReactNode} props.children render function for the payload
 */
export function DashboardView({ role, title, description, actions, children }) {
  const { data, error, isPending, refetch } = useDashboard();

  let body;
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
      <PageHeader title={title} description={description} actions={actions} />
      {body}
    </>
  );
}
