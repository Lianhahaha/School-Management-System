import { Megaphone } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useListParams } from '../../../hooks/useListParams';
import { AnnouncementList } from '../components/AnnouncementList';
import { useAnnouncements } from '../hooks';

const FEED_PAGE_SIZE = 10;

function FeedSkeleton({ count }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading announcements" className="space-y-4">
      {Array.from({ length: count }, (_, row) => (
        <div key={row} className="space-y-3 rounded-card border border-gray-200 bg-white p-5 shadow-card">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * One page of the feed. "Load more" mounts the next chunk below instead of replacing the rows, so
 * the feed is appended client-side while every page keeps its own cache entry.
 */
function FeedChunk({ search, page, isLast, onLoadMore, onClearSearch }) {
  const { data, error, isPending, isFetching, refetch } = useAnnouncements({
    page,
    limit: FEED_PAGE_SIZE,
    ...(search && { search }),
  });

  if (error && !data) {
    return <ErrorState title="Couldn't load announcements" message={error.message} onRetry={refetch} />;
  }
  if (isPending) return <FeedSkeleton count={page === 1 ? 3 : 1} />;
  if (page === 1 && data.items.length === 0) {
    return search ? (
      <EmptyState
        icon={Megaphone}
        title="No announcements match your search"
        action={
          <Button variant="secondary" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={Megaphone}
        title="No announcements yet"
        description="News from your school and teachers will show up here."
      />
    );
  }

  return (
    <>
      <AnnouncementList announcements={data.items} label={`Announcements, page ${page}`} />
      {isLast && data.meta.page < data.meta.totalPages && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={onLoadMore} isLoading={isFetching}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}

/** Pages loaded so far; remounted (key) whenever the search changes so it starts from page 1. */
function Feed({ search, onClearSearch }) {
  const [pageCount, setPageCount] = useState(1);
  return (
    <div className="space-y-4">
      {Array.from({ length: pageCount }, (_, index) => (
        <FeedChunk
          key={index}
          search={search}
          page={index + 1}
          isLast={index + 1 === pageCount}
          onLoadMore={() => setPageCount((count) => count + 1)}
          onClearSearch={onClearSearch}
        />
      ))}
    </div>
  );
}

/** /student/announcements: read-only feed; the backend already scopes it to my audience and my class. */
export default function StudentAnnouncementsPage() {
  const list = useListParams();

  return (
    <>
      <PageHeader title="Announcements" description="News from your school and your teachers." />
      <FilterBar>
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search title, message"
        />
      </FilterBar>
      <Feed key={list.params.search} search={list.params.search} onClearSearch={list.clearFilters} />
    </>
  );
}
