import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ANNOUNCEMENT_AUDIENCE_OPTIONS, ANNOUNCEMENT_STATUS_FILTER_OPTIONS } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { useListParams } from '../../../hooks/useListParams';
import { showsFetching } from '../../../lib/liveRefresh';
import { cx } from '../../../utils/cx';
import { useAuth } from '../../auth/hooks';
import { ClassSelect } from '../../classes/components/ClassSelect';
import { AnnouncementFormModal } from '../components/AnnouncementFormModal';
import { AnnouncementList } from '../components/AnnouncementList';
import { useAnnouncements, useDeleteAnnouncement, useNewSinceLastVisit } from '../hooks';

const ADMIN_FILTERS = ['status', 'audience', 'classId'];
const TEACHER_FILTERS = ['classId', 'authorId'];
const DEFAULT_STATUS = 'active';

function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading announcements" className="space-y-4">
      {[0, 1, 2].map((row) => (
        <div key={row} className="sheet space-y-3 p-5">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/**
 * /admin/announcements and /teacher/announcements. Admins see every announcement (status filter
 * for scheduled and expired ones) and manage any; teachers see what is visible to them and manage
 * their own, and must pick one of their classes when they create one.
 */
export default function AnnouncementsPage() {
  const { me, role } = useAuth();
  const isAdmin = role === 'admin';
  const list = useListParams({ filters: isAdmin ? ADMIN_FILTERS : TEACHER_FILTERS });
  const { data, error, isPending, isFetching, refetch } = useAnnouncements(list.apiParams);
  const isNew = useNewSinceLastVisit();
  const deleteAnnouncement = useDeleteAnnouncement();
  const confirm = useConfirm();
  // undefined = closed, null = creating, an announcement = editing it
  const [formTarget, setFormTarget] = useState(undefined);

  const canManage = (announcement) => isAdmin || announcement.author.id === me.id;

  const onDelete = async (announcement) => {
    const ok = await confirm({
      title: `Delete "${announcement.title}"?`,
      description: 'It disappears for everyone who can see it. This cannot be undone.',
      confirmLabel: 'Delete announcement',
    });
    if (ok) deleteAnnouncement.mutate(announcement.id);
  };

  const renderActions = (announcement) =>
    canManage(announcement) ? (
      <>
        <Button
          variant="ghost"
          size="sm"
          icon={Pencil}
          onClick={() => setFormTarget(announcement)}
          aria-label={`Edit ${announcement.title}`}
        />
        <Button
          variant="dangerGhost"
          size="sm"
          icon={Trash2}
          onClick={() => onDelete(announcement)}
          aria-label={`Delete ${announcement.title}`}
        />
      </>
    ) : null;

  const createButton = (
    <Button icon={Plus} onClick={() => setFormTarget(null)}>
      New announcement
    </Button>
  );

  let content;
  if (error && !data) {
    content = <ErrorState title="Couldn't load announcements" message={error.message} onRetry={refetch} />;
  } else if (isPending) {
    content = <ListSkeleton />;
  } else if (data.meta.total === 0) {
    content = list.hasActiveFilters ? (
      <EmptyState
        icon={Megaphone}
        title="No announcements match your filters"
        action={
          <Button variant="secondary" onClick={list.clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={Megaphone}
        title="No announcements yet"
        description={
          isAdmin && list.params.status && list.params.status !== DEFAULT_STATUS
            ? 'Nothing is in this state right now.'
            : 'Post one to tell students and teachers what is going on.'
        }
        action={createButton}
      />
    );
  } else {
    // A page past the end (its last row was deleted) has no items but a total: Pagination moves back.
    content = (
      <div
        className={cx('transition-opacity', showsFetching(isFetching) && 'opacity-60')}
        aria-busy={showsFetching(isFetching)}
      >
        <AnnouncementList announcements={data.items} renderActions={renderActions} isNew={isNew} />
        <Pagination meta={data.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description={
          isAdmin
            ? 'Everything posted at the school, including scheduled and expired announcements.'
            : 'What is visible to you, and what you posted for your classes.'
        }
        actions={createButton}
      />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search title, message"
        />
        {isAdmin && (
          <>
            <Select
              aria-label="Status"
              value={list.params.status || DEFAULT_STATUS}
              onChange={(event) =>
                list.setFilter('status', event.target.value === DEFAULT_STATUS ? '' : event.target.value)
              }
              options={ANNOUNCEMENT_STATUS_FILTER_OPTIONS}
              className="sm:w-40"
            />
            <Select
              aria-label="Audience"
              value={list.params.audience}
              onChange={(event) => list.setFilter('audience', event.target.value)}
              options={ANNOUNCEMENT_AUDIENCE_OPTIONS}
              placeholder="All audiences"
              className="sm:w-44"
            />
          </>
        )}
        <ClassSelect
          aria-label="Class"
          value={list.params.classId}
          onChange={(event) => list.setFilter('classId', event.target.value)}
          placeholder="All classes"
          className="sm:w-64"
        />
        {!isAdmin && (
          <Checkbox
            label="Mine"
            checked={list.params.authorId === 'me'}
            onChange={(event) => list.setFilter('authorId', event.target.checked ? 'me' : '')}
          />
        )}
      </FilterBar>

      {content}

      <AnnouncementFormModal
        open={formTarget !== undefined}
        onClose={() => setFormTarget(undefined)}
        announcement={formTarget ?? undefined}
      />
    </>
  );
}
