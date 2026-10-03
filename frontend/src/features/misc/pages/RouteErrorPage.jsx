import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '../../../components/ui/Button';

/** Messages browsers give when a lazy page chunk cannot be fetched, usually after a new deployment. */
const STALE_CHUNK = /dynamically imported module|Importing a module script failed|Loading chunk/i;

function describe(error) {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * The router's `errorElement`: catches render errors and failed lazy chunks anywhere in the tree.
 * It does not depend on the shell, the providers or the session, so it also works when they are
 * what failed. The error is logged to the console for debugging.
 */
export default function RouteErrorPage() {
  const error = useRouteError();
  const isStaleChunk = error instanceof Error && STALE_CHUNK.test(error.message);

  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-gray-900">
        {isStaleChunk ? 'A new version is available' : 'Something went wrong'}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {isStaleChunk
          ? 'The application was updated while this page was open. Reload to continue.'
          : describe(error)}
      </p>
      <Button icon={RefreshCw} onClick={() => window.location.reload()} className="mt-6">
        Reload
      </Button>
    </div>
  );
}
