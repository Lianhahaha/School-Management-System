import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { useDebounce } from '../../../hooks/useDebounce';
import { cx } from '../../../utils/cx';
import { MIN_SEARCH_LENGTH, useGlobalSearch } from '../hooks';

/** Consecutive results of the same group, each keeping its position in the flat list (for the keyboard). */
function groupsOf(results) {
  const groups = [];
  results.forEach((result, index) => {
    const last = groups.at(-1);
    if (last?.group === result.group) last.entries.push({ result, index });
    else groups.push({ group: result.group, entries: [{ result, index }] });
  });
  return groups;
}

/**
 * The search box and its results, as a combobox: typing filters, ArrowUp/ArrowDown move the
 * highlighted result, Enter opens it. Lives inside the Modal, so it starts empty on every opening.
 */
function SearchPanel({ onNavigate }) {
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebounce(term, 250);
  const { results, isSearching, hasError } = useGlobalSearch(debounced);
  const listId = useId();
  const optionId = (index) => `${listId}-${index}`;
  const active = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((active + step + results.length) % results.length);
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      onNavigate(results[active].to);
    }
  };

  const tooShort = debounced.trim().length < MIN_SEARCH_LENGTH;
  let status = null;
  if (term.trim().length < MIN_SEARCH_LENGTH) status = 'Type at least two letters.';
  else if (hasError) status = "Some results couldn't be loaded. Try again in a moment.";
  else if (!tooShort && !isSearching && results.length === 0)
    status = `Nothing matches "${debounced.trim()}".`;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
        <input
          data-autofocus
          type="search"
          role="combobox"
          aria-label="Search students, teachers, classes, subjects and pages"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Name, student number, class, subject"
          className="form-control pr-11 pl-10"
        />
        {isSearching && <Spinner size="sm" className="absolute top-1/2 right-4 -translate-y-1/2" />}
      </div>

      <p aria-live="polite" className={cx('text-sm text-gray-600', !status && 'sr-only')}>
        {status ?? `${results.length} results`}
      </p>

      <div id={listId} role="listbox" aria-label="Search results">
        {groupsOf(results).map(({ group, entries }) => (
          <div key={group} role="group" aria-labelledby={`${listId}-${group}`}>
            <p id={`${listId}-${group}`} className="px-3 pt-3 pb-1 text-xs font-medium text-gray-500">
              {group}
            </p>
            {entries.map(({ result, index }) => (
              <div
                key={result.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => onNavigate(result.to)}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2',
                  index === active && 'bg-gray-100',
                )}
              >
                <span className="truncate text-[0.9375rem] font-medium text-gray-900">{result.label}</span>
                {result.detail && <span className="shrink-0 text-xs text-gray-500">{result.detail}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Search the whole school from anywhere (admin). Opened by the top bar's search button or Ctrl+K /
 * Cmd+K; choosing a result navigates there and closes the dialog.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function SearchDialog({ open, onClose }) {
  const navigate = useNavigate();
  const onNavigate = (to) => {
    onClose();
    navigate(to);
  };

  return (
    <Modal open={open} onClose={onClose} title="Search" size="lg">
      <SearchPanel onNavigate={onNavigate} />
    </Modal>
  );
}
