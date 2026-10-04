import { OptionSelect } from '../../../components/ui/OptionSelect';
import { PAGINATION } from '../../../constants/shared';
import { currentAcademicYear } from '../../../utils/date';
import { useAuth } from '../../auth/hooks';
import { useClassSubjects } from '../../classSubjects/hooks';
import { useClassOptions } from '../hooks';

/**
 * Select of classes, labelled "Name · 2026-2027 · 30 students" (the first 100 classes, newest academic
 * year first). Works with react-hook-form (`{...register('classId')}`) and as a controlled filter
 * (`value`, `onChange` with the event). A teacher only gets the classes they can see (they teach a
 * subject there or are its homeroom teacher), because the API's class list is not scoped.
 *
 * @param {object} props
 * @param {object} [props.filters] extra list filters, for example `{ academicYear: '2026-2027' }`
 * @param {number[]} [props.excludeIds] classes to leave out, for example the one a student is moving from
 * @param {boolean} [props.fromCurrentYear] only classes of the current or a later academic year: the API
 *   refuses to enroll or transfer a student into a past year's class
 * @param {string} [props.placeholder] label of the empty choice (default "Choose a class"); pass "All classes" for a filter
 * Every other prop goes to the native <select>.
 */
export function ClassSelect({
  filters,
  excludeIds = [],
  fromCurrentYear = false,
  placeholder = 'Choose a class',
  ...props
}) {
  const { me, role } = useAuth();
  const isTeacher = role === 'teacher';
  const classes = useClassOptions(filters);
  const lessons = useClassSubjects({ limit: PAGINATION.MAX_LIMIT }, { enabled: isTeacher });

  const firstYear = currentAcademicYear();
  const taughtClassIds = new Set(lessons.data?.items.map((lesson) => lesson.classId));
  const isVisible = ({ item }) =>
    !isTeacher || taughtClassIds.has(item.id) || item.homeroomTeacher?.id === me.teacherId;
  const isOffered = (option) =>
    isVisible(option) &&
    !excludeIds.includes(option.item.id) &&
    (!fromCurrentYear || option.item.academicYear >= firstYear);
  const options = classes.data?.filter(isOffered);
  const isPending = classes.isPending || (isTeacher && lessons.isPending);

  return <OptionSelect options={options} isPending={isPending} placeholder={placeholder} {...props} />;
}
