/**
 * The values of the fields a user changed, for PATCH bodies: sending only what changed keeps the
 * request small and never overwrites a field somebody else edited meanwhile.
 *
 *   const { dirtyFields } = formState;
 *   updateStudent.mutate({ id, body: changedFields(values, dirtyFields) });
 *
 * Works for flat forms (react-hook-form marks a changed field with `true` in `dirtyFields`).
 * @param {Record<string, *>} values the submitted (parsed) form values
 * @param {Record<string, *>} dirtyFields react-hook-form `formState.dirtyFields`
 */
export function changedFields(values, dirtyFields) {
  return Object.fromEntries(Object.keys(dirtyFields).map((field) => [field, values[field]]));
}
