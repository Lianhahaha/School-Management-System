import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { cx } from '../../utils/cx';
import { Input } from './Input';

/**
 * Search box that reports the text 350 ms after the user stops typing. `value` is the committed
 * search (usually `list.params.search`); the box follows it when it changes from outside, for
 * example when "Clear filters" is pressed.
 *
 *   <SearchInput value={list.params.search} onChange={list.setSearch}
 *                placeholder="Search name, student number, email" />
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(search: string) => void} props.onChange
 * @param {string} [props.placeholder] name the searched columns
 * @param {string} [props.label] accessible name (default "Search")
 * @param {number} [props.delay] debounce in milliseconds
 */
export function SearchInput({ value, onChange, placeholder, label = 'Search', delay = 350, className }) {
  const [draft, setDraft] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  const debouncedDraft = useDebounce(draft, delay);
  const latest = useRef({ value, onChange });

  useEffect(() => {
    latest.current = { value, onChange };
  });

  // Report only what the user typed: this effect runs when the debounced text changes, never
  // because `value` or `onChange` changed, so an external reset is not echoed back.
  useEffect(() => {
    const { value: committed, onChange: commit } = latest.current;
    if (debouncedDraft.trim() !== committed) commit(debouncedDraft.trim());
  }, [debouncedDraft]);

  // Follow external changes of `value`, unless it is just the answer to our own commit.
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== debouncedDraft.trim()) setDraft(value);
  }

  return (
    <div className={cx('relative w-full sm:w-64', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gray-500"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="rounded-full border-transparent bg-surface pl-10 hover:border-gray-300"
      />
    </div>
  );
}
