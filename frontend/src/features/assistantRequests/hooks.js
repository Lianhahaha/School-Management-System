/**
 * Student assistant sign-ups, for the school office (an admin or an approved assistant).
 *
 *   PENDING_ASSISTANT_REQUESTS_PARAMS   the filter behind the Assistant requests nav badge
 *   useAssistantRequests(params, { enabled })
 *                                       paginated list; params from useListParams().apiParams plus `status`
 *   useApproveAssistantRequest()        mutate(request) after the page's confirmation
 *   useDeclineAssistantRequest() [form] mutate({ userId, reason })
 *
 * A decision refreshes the requests (list and nav badge), the bell (the office's sign-up notes of the request
 * are marked read) and the activity log. A request someone else decided meanwhile is refused (409
 * `not_pending`), which also reloads the list.
 *
 * Mutations tagged [form] are silent (meta.silent): the dialog that sends them shows every error itself.
 * Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { activityKeys } from '../activity/keys';
import { notificationKeys } from '../notifications/keys';
import { approveAssistantRequest, declineAssistantRequest, listAssistantRequests } from './api';
import { assistantRequestKeys } from './keys';

/** Requests waiting for the office; `limit: 1` because only `meta.total` is read. */
export const PENDING_ASSISTANT_REQUESTS_PARAMS = Object.freeze({ status: 'pending', limit: 1 });

export function useAssistantRequests(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: assistantRequestKeys.list(params),
    queryFn: () => listAssistantRequests(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Refreshes what a decision changes; also after a refusal, which means the list on screen is out of date. */
function useInvalidateRequests() {
  const invalidate = useInvalidate();
  return () => invalidate(assistantRequestKeys.all, notificationKeys.all, activityKeys.all);
}

export function useApproveAssistantRequest() {
  const invalidateRequests = useInvalidateRequests();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ userId: number }} */ request) => approveAssistantRequest(request.userId),
    onSuccess: (request) => toast.success(`${fullName(request)} can now work in the school office`),
    onSettled: invalidateRequests,
  });
}

export function useDeclineAssistantRequest() {
  const invalidateRequests = useInvalidateRequests();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ userId: number, reason: string }} */ { userId, reason }) =>
      declineAssistantRequest(userId, reason),
    meta: { silent: true },
    onSuccess: (request) => toast.success(`Request of ${fullName(request)} declined`),
    onSettled: invalidateRequests,
  });
}
