/**
 * 'Ana Reyes' from anything shaped like { firstName, lastName }.
 * @param {{ firstName?: string, lastName?: string }} [person]
 */
export function fullName({ firstName, lastName } = {}) {
  return [firstName, lastName].filter(Boolean).join(' ');
}

/**
 * 'AR' for avatars: the first letter of the first and last name.
 * @param {{ firstName?: string, lastName?: string }} [person]
 */
export function initials({ firstName, lastName } = {}) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
