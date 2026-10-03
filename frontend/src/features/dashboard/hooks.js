import { useQuery } from '@tanstack/react-query';
import { getDashboard } from './api';
import { dashboardKeys } from './keys';

/** The dashboard payload of the signed-in role; render it as it is, the server does the aggregation. */
export function useDashboard() {
  return useQuery({ queryKey: dashboardKeys.current(), queryFn: getDashboard });
}
