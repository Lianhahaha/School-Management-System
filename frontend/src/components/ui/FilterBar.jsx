import { FilterX } from 'lucide-react';
import { Button } from './Button';

/**
 * Row above a list that holds the SearchInput and the filter Selects, plus a "Clear filters"
 * button while any filter is active. Pass `onClear` only then:
 *   <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}> ... </FilterBar>
 * Give every Select an `aria-label` (there is no visible label) and a placeholder that reads as
 * the "all" option, for example "All classes".
 */
export function FilterBar({ onClear, children }) {
  return (
    <div role="group" aria-label="Filters" className="filter-bar mb-4 flex flex-wrap items-center gap-3">
      {children}
      {onClear && (
        <Button variant="ghost" size="sm" icon={FilterX} onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
