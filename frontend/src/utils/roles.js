import { ROLE_HOME, ROLE_LABELS, ROLE_TONES } from '../constants/ui';

/** 'teacher' -> 'Teacher'. */
export const roleLabel = (role) => ROLE_LABELS[role] ?? role;

/** Badge tone of a role. */
export const roleTone = (role) => ROLE_TONES[role] ?? 'gray';

/** Landing path of a role's area: '/admin' (the admin, the student assistant), '/teacher' or '/student'. */
export const roleHome = (role) => ROLE_HOME[role];

const ADMIN = Object.freeze(['admin']);
/** The school office: the admin and the student assistant (backend access.isOffice). */
const OFFICE = Object.freeze(['admin', 'assistant']);

/**
 * The roles allowed each action the pages offer or hide by role. It mirrors the backend's authorize() lists,
 * and the service rules where a route admits more roles than one of its uses (a student assistant creates
 * student accounts only, and closes an enrollment as withdrawn only). Only actions some page checks are
 * listed: everything else in an area is open to every role that reaches it. This only decides what is shown;
 * the backend enforces access.
 */
export const PERMISSIONS = Object.freeze({
  /** Every class, student and teacher: the search, the class picker of attendance and grades, nav counts. */
  'school.readAll': OFFICE,
  /** The setup checklist of a new school: every step is office work. */
  'school.setUp': OFFICE,
  /** The Users page: every account (GET /users). */
  'users.list': ADMIN,
  /** Deactivate or reactivate an account (PATCH /users/:id/status). */
  'users.setStatus': ADMIN,
  /** Delete an account created by mistake (DELETE /users/:id). */
  'users.delete': ADMIN,
  /**
   * The sign-ups of student assistants: list, approve and decline them (/assistant-requests), and the count
   * beside the menu entry. Only an approved assistant gets this far (RequireAuth shows the others a waiting
   * screen). Nobody creates an assistant account: POST /users refuses the role.
   */
  'assistantRequests.review': OFFICE,
  /** Create a teacher account (POST /users with role teacher). */
  'teachers.create': OFFICE,
  /** Edit a teacher's record (PATCH /teachers/:id) and account. */
  'teachers.manage': ADMIN,
  /** Close an active enrollment as withdrawn (PATCH /enrollments/:id). */
  'enrollments.withdraw': OFFICE,
  /** End of school year (POST /enrollments/complete) and closing an enrollment as completed. */
  'enrollments.complete': ADMIN,
  /** Create, edit, retire and delete subjects, with their grading rules (POST, PATCH, DELETE /subjects). */
  'subjects.manage': OFFICE,
  /** DELETE /classes/:id. */
  'classes.delete': ADMIN,
  /** Remove a subject and its teacher from a class (DELETE /class-subjects/:id). */
  'classSubjects.delete': ADMIN,
  /** Attendance, assessments and grades of any class-subject (a teacher: only the ones assigned to them). */
  'lessons.manageAll': ADMIN,
  /** Edit or delete anyone's announcement, and see scheduled and expired ones; everyone else, their own. */
  'announcements.manageAll': OFFICE,
  /** Add, edit and remove calendar entries (POST, PATCH, DELETE /calendar). */
  'calendar.manage': OFFICE,
});

/**
 * Whether `role` may take `action`:
 *   const { role } = useAuth();
 *   {can(role, 'classes.delete') && <Button>Delete</Button>}
 * An action missing from PERMISSIONS is a typo, so it throws instead of quietly hiding a button.
 *
 * @param {string | null | undefined} role the signed-in user's role
 * @param {keyof typeof PERMISSIONS} action
 * @returns {boolean}
 */
export function can(role, action) {
  const roles = PERMISSIONS[action];
  if (!roles) throw new Error(`Unknown permission "${action}"`);
  return role != null && roles.includes(role);
}
