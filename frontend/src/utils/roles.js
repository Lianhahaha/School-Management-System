import { ROLE_HOME, ROLE_LABELS, ROLE_TONES } from '../constants/ui';

/** 'teacher' -> 'Teacher'. */
export const roleLabel = (role) => ROLE_LABELS[role] ?? role;

/** Badge tone of a role. */
export const roleTone = (role) => ROLE_TONES[role] ?? 'gray';

/** Landing path of a role's area: '/admin', '/teacher' or '/student'. */
export const roleHome = (role) => ROLE_HOME[role];
