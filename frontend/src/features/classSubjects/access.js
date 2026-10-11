import { can } from '../../utils/roles';

/**
 * Who may write to a lesson (a class-subject: its attendance, assessments and grades): an administrator, or the
 * teacher the class-subject is assigned to. A teacher who sees the class only as its homeroom teacher reads
 * it, and so does a student assistant (the school office reads every lesson but never marks or grades).
 * The API enforces the same rule (assertCanManageClassSubject); this decides what the pages offer.
 *
 *   const { me } = useAuth();
 *   const canSave = isClassSubjectOwner(me, assessment.classSubject);
 *
 * @param {{ role: string, teacherId?: number }} me the signed-in account (useAuth().me)
 * @param {{ teacherId: number } | null | undefined} classSubject the lesson, or nothing while it loads
 * @returns {boolean}
 */
export const isClassSubjectOwner = (me, classSubject) =>
  can(me.role, 'lessons.manageAll') || (Boolean(classSubject) && classSubject.teacherId === me.teacherId);
