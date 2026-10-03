import { useQueryClient } from '@tanstack/react-query';

/**
 * Returns a function that marks whole query scopes stale, for use in a mutation's `onSuccess`:
 *
 *   const invalidate = useInvalidate();
 *   useMutation({ mutationFn, onSuccess: () => invalidate(classKeys.all, dashboardKeys.all) });
 *
 * It does not return the refetch promise, so `mutateAsync` resolves as soon as the write is done
 * and a modal can close without waiting for the lists to reload.
 */
export function useInvalidate() {
  const queryClient = useQueryClient();
  return (...scopes) => {
    scopes.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };
}
