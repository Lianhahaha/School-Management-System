import { useQuery } from '@tanstack/react-query';
import { env } from '../../config/env';
import { api } from '../../lib/apiClient';

/**
 * Development-only warning for the most common setup mistake: the web app and the API use different
 * Firebase projects, so every request fails token verification. It compares the project id the API
 * reports on GET /health with VITE_FIREBASE_PROJECT_ID. Renders nothing when they match or the API
 * cannot be reached. Mount it only when `import.meta.env.DEV`.
 */
export function DevProjectBanner() {
  const { data } = useQuery({
    queryKey: ['dev', 'health'],
    queryFn: () => api.get('/health', { auth: false }).then((response) => response.data),
    staleTime: Infinity,
    retry: false,
  });

  const apiProjectId = data?.firebaseProjectId;
  if (!apiProjectId || apiProjectId === env.firebase.projectId) return null;

  return (
    <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
      Firebase project mismatch: the API uses "{apiProjectId}" but this app is configured for "
      {env.firebase.projectId}". Fix VITE_FIREBASE_* in frontend/.env or the service account in the backend,
      then restart both.
    </div>
  );
}
