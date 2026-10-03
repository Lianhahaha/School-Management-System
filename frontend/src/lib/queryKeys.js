/**
 * Query-key factory shared by every feature, so cache keys always have the same shape:
 *
 *   const studentKeys = createKeys('students');
 *   studentKeys.all            // ['students']                 invalidate a whole feature
 *   studentKeys.lists()        // ['students', 'list']
 *   studentKeys.list(params)   // ['students', 'list', params] params = useListParams().apiParams
 *   studentKeys.details()      // ['students', 'detail']
 *   studentKeys.detail(id)     // ['students', 'detail', '7']  ids are always strings (route params are)
 *
 * Features add their own keys next to these (sheet, summary, roster, ...) by spreading the result.
 * Parameters in keys must be plain objects of strings and numbers.
 */
export function createKeys(scope) {
  const all = [scope];
  const lists = () => [...all, 'list'];
  const details = () => [...all, 'detail'];
  return {
    all,
    lists,
    list: (params) => [...lists(), params],
    details,
    detail: (id) => [...details(), String(id)],
  };
}
