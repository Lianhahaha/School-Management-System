/**
 * API status (development tooling only).
 *
 *   useHealth()  GET /health once per session, never retried: an unreachable API simply has no data
 */
import { useQuery } from '@tanstack/react-query';
import { getHealth } from './api';
import { healthKeys } from './keys';

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: getHealth,
    staleTime: Infinity,
    retry: false,
  });
}
