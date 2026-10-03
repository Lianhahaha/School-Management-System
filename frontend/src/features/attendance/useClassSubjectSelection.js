import { useSearchParams } from 'react-router';
import { DATE_REGEX } from '../../constants/shared';
import { todayYmd } from '../../utils/date';
import { useAuth } from '../auth/hooks';
import { useClassSubject } from '../classSubjects/hooks';

/**
 * The class (admin only), class-subject and optional date a page works on, kept in the URL
 * (`classId`, `classSubjectId`, `date`) so a link from the dashboard can preselect a lesson.
 * Used by the attendance and grades pages together with <ClassSubjectSelectorBar>.
 *
 *   const selection = useClassSubjectSelection({ withDate: true });
 *   selection.classSubjectId, selection.date, selection.isOwner ...
 *
 * `selected` is the class-subject query (one lesson: class, subject, teacherId). `isOwner` is true for
 * an admin and for the teacher the class-subject is assigned to; a teacher who only sees the class as
 * its homeroom teacher gets read-only access.
 *
 * @param {{ withDate?: boolean }} [options]
 */
export function useClassSubjectSelection({ withDate = false } = {}) {
  const { me, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const classSubjectId = searchParams.get('classSubjectId') ?? '';
  const rawDate = searchParams.get('date') ?? '';
  const date = withDate ? (DATE_REGEX.test(rawDate) ? rawDate : todayYmd()) : '';

  const selected = useClassSubject(classSubjectId);
  // An admin who arrived with only a class-subject (a link) still sees the right class selected.
  const classId = searchParams.get('classId') || (selected.data ? String(selected.data.classId) : '');

  const update = (patch) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        next.delete('page');
        return next;
      },
      { replace: true },
    );

  return {
    role,
    classId,
    classSubjectId,
    date,
    selected,
    isOwner: role === 'admin' || (Boolean(selected.data) && selected.data.teacherId === me.teacherId),
    setClassId: (value) => update({ classId: value, classSubjectId: '' }),
    setClassSubjectId: (value) => update({ classSubjectId: value }),
    setDate: (value) => update({ date: value }),
  };
}
