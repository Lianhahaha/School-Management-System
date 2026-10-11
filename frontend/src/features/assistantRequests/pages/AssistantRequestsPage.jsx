import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import {
  ASSISTANT_REQUEST_STATUS_FILTER_OPTIONS,
  ASSISTANT_REQUEST_STATUS_LABELS,
} from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { useListParams } from '../../../hooks/useListParams';
import { formatDate, isoToYmd } from '../../../utils/date';
import { toApiParams } from '../../../utils/listParams';
import { fullName } from '../../../utils/names';
import { AssistantRequestStatusBadge } from '../components/AssistantRequestStatusBadge';
import { DeclineRequestModal } from '../components/DeclineRequestModal';
import { useApproveAssistantRequest, useAssistantRequests } from '../hooks';

/** The list opens on the requests that wait for the school office. */
const DEFAULT_STATUS = 'pending';
const STATUS_FILTERS = ASSISTANT_REQUEST_STATUS_FILTER_OPTIONS.map((option) => option.value);

/** Who decided and when, and the reason of a declined request. */
function Decision({ request }) {
  if (!request.decidedAt) return null;
  return (
    <span className="block">
      {request.decidedBy ? fullName(request.decidedBy) : '—'}
      <span className="block text-xs text-gray-500">{formatDate(isoToYmd(request.decidedAt))}</span>
      {request.declineReason && (
        <span className="mt-1 block text-xs text-gray-600">Reason: {request.declineReason}</span>
      )}
    </span>
  );
}

/**
 * /admin/assistant-requests: the student assistants who signed up, oldest first, for the school office (an
 * admin or an approved assistant). Approve (after a confirmation) opens the office pages to them; Decline asks
 * for the reason they read. The office emails the applicant itself, so each email has a copy button. The
 * sign-up notification opens `?user=<id>`, which sets that request apart.
 */
export default function AssistantRequestsPage() {
  const list = useListParams({ filters: ['status'], defaultSort: ['requestedAt', 'asc'] });
  const status = STATUS_FILTERS.includes(list.params.status) ? list.params.status : DEFAULT_STATUS;
  const [searchParams] = useSearchParams();
  const linkedUserId = searchParams.get('user');
  const { data, isPending, isFetching, error, refetch } = useAssistantRequests(
    toApiParams({ ...list.apiParams, status: status === 'all' ? undefined : status }),
  );
  const approve = useApproveAssistantRequest();
  const confirm = useConfirm();
  const [declineTarget, setDeclineTarget] = useState(null);

  const onApprove = async (request) => {
    const name = fullName(request);
    const ok = await confirm({
      title: `Approve ${name}?`,
      description: `${name} can use the school office pages from their next visit, without the admin-only ones. Let them know at ${request.email}.`,
      confirmLabel: 'Approve',
      tone: 'primary',
    });
    if (ok) approve.mutate(request);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortKey: 'lastName',
      cell: (request) => <span className="whitespace-nowrap">{fullName(request)}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      // Kept on one line (a wrapped address is hard to read back); the table scrolls sideways when narrow.
      cell: (request) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {request.email}
          <CopyButton value={request.email} label="Email" className="-my-1.5" />
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'lg',
      cell: (request) => <span className="whitespace-nowrap">{request.phone ?? '—'}</span>,
    },
    {
      key: 'requestedAt',
      header: 'Requested',
      sortKey: 'requestedAt',
      cell: (request) => formatDate(isoToYmd(request.requestedAt)),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (request) => <AssistantRequestStatusBadge status={request.status} />,
    },
    // Nothing is decided in the default list, so the column only shows for the others.
    ...(status === DEFAULT_STATUS
      ? []
      : [
          {
            key: 'decided',
            header: 'Decided',
            sortKey: 'decidedAt',
            hideBelow: 'md',
            cell: (request) => <Decision request={request} />,
          },
        ]),
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (request) =>
        request.status === 'pending' && (
          <span className="inline-flex flex-wrap justify-end gap-1">
            <Button
              size="sm"
              onClick={() => onApprove(request)}
              isLoading={approve.isPending && approve.variables?.userId === request.userId}
              aria-label={`Approve ${fullName(request)}`}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDeclineTarget(request)}
              aria-label={`Decline ${fullName(request)}`}
            >
              Decline
            </Button>
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        total={data?.meta?.total}
        title="Assistant requests"
        description="Student assistants who signed up. Approve them to open the school office pages to them, or decline with a reason."
      />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search name or email"
        />
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(event) =>
            list.setFilter('status', event.target.value === DEFAULT_STATUS ? '' : event.target.value)
          }
          options={ASSISTANT_REQUEST_STATUS_FILTER_OPTIONS}
        />
      </FilterBar>

      <DataTable
        label="Student assistant requests"
        columns={columns}
        rows={data?.items ?? []}
        rowKey="userId"
        highlightedRowKey={linkedUserId}
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }}
        onSortChange={list.setSort}
        emptyState={
          list.params.search ? (
            <EmptyState
              title="No requests match your search"
              action={
                <Button variant="ghost" onClick={() => list.setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : status === DEFAULT_STATUS ? (
            <EmptyState
              title="No requests waiting"
              description="Student assistants who sign up on the registration page appear here."
            />
          ) : status === 'all' ? (
            <EmptyState title="No requests yet" />
          ) : (
            <EmptyState title={`No ${ASSISTANT_REQUEST_STATUS_LABELS[status].toLowerCase()} requests`} />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <DeclineRequestModal request={declineTarget} onClose={() => setDeclineTarget(null)} />
    </>
  );
}
