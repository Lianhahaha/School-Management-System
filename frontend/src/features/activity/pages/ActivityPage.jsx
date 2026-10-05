import { ChevronDown, History } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ACTIVITY_AREA_LABELS, ACTIVITY_AREA_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { showsFetching } from '../../../lib/liveRefresh';
import { cx } from '../../../utils/cx';
import { formatDateTime, relativeTime } from '../../../utils/date';
import { roleLabel } from '../../../utils/roles';
import { ActivityDetails } from '../components/ActivityDetails';
import { useActivity } from '../hooks';

/** One entry: when, who, what, its area, and its details behind a toggle. */
function ActivityRow({ entry }) {
  const [isOpen, setOpen] = useState(false);
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;
  const detailsId = `activity-${entry.id}`;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-900">{entry.summary}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            <span className="font-medium text-gray-800">{entry.actorName}</span>
            {entry.actor && ` · ${roleLabel(entry.actor.role)}`} ·{' '}
            <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)}>
              {relativeTime(entry.createdAt)}
            </time>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone="gray" className="max-sm:hidden">
            {ACTIVITY_AREA_LABELS[entry.area] ?? entry.area}
          </Badge>
          {hasDetails && (
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronDown}
              aria-expanded={isOpen}
              aria-controls={detailsId}
              aria-label={`${isOpen ? 'Hide' : 'Show'} details`}
              onClick={() => setOpen((open) => !open)}
              className={cx('[&_svg]:transition-transform', isOpen && '[&_svg]:rotate-180')}
            />
          )}
        </div>
      </div>
      {hasDetails && isOpen && (
        <div id={detailsId} className="mt-3">
          <ActivityDetails details={entry.details} />
        </div>
      )}
    </li>
  );
}

/**
 * /admin/activity: who changed what and when, newest first. Search covers the summary, the person and the
 * details (a student's name finds the grade saves that changed their score); filters by area and by school
 * day. The live refresh brings in new entries while the page is open.
 */
export default function ActivityPage() {
  const list = useListParams({ filters: ['area', 'dateFrom', 'dateTo'] });
  const isRangeValid =
    !list.params.dateFrom || !list.params.dateTo || list.params.dateFrom <= list.params.dateTo;
  // An end before the start is a 400; ask instead of requesting.
  const { data, error, isPending, isFetching, refetch } = useActivity(list.apiParams, {
    enabled: isRangeValid,
  });

  let content;
  if (!isRangeValid) {
    content = <EmptyState icon={History} title="The first day is after the last day" />;
  } else if (error && !data) {
    content = <ErrorState title="Couldn't load the activity" message={error.message} onRetry={refetch} />;
  } else if (isPending) {
    content = (
      <div role="status" aria-busy="true" aria-label="Loading activity" className="space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </div>
    );
  } else if (data.meta.total === 0) {
    content = list.hasActiveFilters ? (
      <EmptyState
        icon={History}
        title="Nothing matches your filters"
        action={
          <Button variant="secondary" onClick={list.clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Changes appear here as people make them."
      />
    );
  } else {
    content = (
      <div
        className={cx('transition-opacity', showsFetching(isFetching) && 'opacity-60')}
        aria-busy={showsFetching(isFetching)}
      >
        <section className="sheet p-5">
          <ul className="divide-y divide-gray-200">
            {data.items.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
        <Pagination meta={data.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Activity"
        description="Who changed what and when: grades, attendance, enrollments, accounts and more."
        total={data?.meta?.total}
      />
      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search names, titles"
        />
        <Select
          aria-label="Area"
          value={list.params.area}
          onChange={(event) => list.setFilter('area', event.target.value)}
          options={ACTIVITY_AREA_OPTIONS}
          placeholder="All areas"
          className="sm:w-48"
        />
        <Input
          type="date"
          aria-label="From"
          value={list.params.dateFrom}
          onChange={(event) => list.setFilter('dateFrom', event.target.value)}
          className="sm:w-40"
        />
        <Input
          type="date"
          aria-label="To"
          value={list.params.dateTo}
          onChange={(event) => list.setFilter('dateTo', event.target.value)}
          className="sm:w-40"
        />
      </FilterBar>
      {content}
    </>
  );
}
