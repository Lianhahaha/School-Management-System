import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stopped changing for `delay` milliseconds.
 * Use it to turn typing into a request parameter:
 *   const debouncedSearch = useDebounce(search, 350);
 *   useClasses({ search: debouncedSearch });
 */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
