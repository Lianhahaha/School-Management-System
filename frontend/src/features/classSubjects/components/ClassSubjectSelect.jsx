import { OptionSelect } from '../../../components/ui/OptionSelect';
import { Select } from '../../../components/ui/Select';
import { fullName } from '../../../utils/names';
import { useAuth } from '../../auth/hooks';
import { useClassSubjectOptions } from '../hooks';

/** Admin: the subjects of one class, "Biology · Ana Reyes". */
function ClassSubjectsOfClass({ classId, ...props }) {
  const { data, isPending } = useClassSubjectOptions({ classId });
  const options = data?.map(({ value, item }) => ({
    value,
    label: `${item.subjectName} · ${fullName(item.teacher)}`,
  }));
  return <OptionSelect options={options} isPending={isPending} placeholder="Choose a subject" {...props} />;
}

/** Teacher: every class-subject the teacher can see, grouped "Teaching" (own) and "Homeroom" (read-only). */
function VisibleClassSubjects({ teacherId, disabled, ...props }) {
  const { data = [], isPending } = useClassSubjectOptions();
  const label = ({ item }) => `${item.className} · ${item.subjectName}`;
  const teaching = data.filter(({ item }) => item.teacherId === teacherId);
  const homeroom = data.filter(({ item }) => item.teacherId !== teacherId);
  const renderOptions = (options) =>
    options.map((option) => (
      <option key={option.value} value={option.value}>
        {label(option)}
      </option>
    ));

  return (
    <select
      {...props}
      key={isPending ? 'loading' : 'ready'}
      className="form-control"
      disabled={isPending || disabled}
      aria-busy={isPending || undefined}
    >
      <option value="">Choose a class and subject</option>
      {teaching.length > 0 && <optgroup label="Teaching">{renderOptions(teaching)}</optgroup>}
      {homeroom.length > 0 && <optgroup label="Homeroom">{renderOptions(homeroom)}</optgroup>}
    </select>
  );
}

/**
 * Select of class-subjects (lessons). An admin picks one of a class (`classId` is required before
 * the select is usable); a teacher picks from everything they can see, grouped Teaching / Homeroom.
 * Controlled (`value`, `onChange` with the event); every other prop goes to the native <select>.
 *
 * @param {object} props
 * @param {string} [props.classId] admin only: the class whose subjects are listed
 */
export function ClassSubjectSelect({ classId, ...props }) {
  const { me, role } = useAuth();

  if (role === 'teacher') return <VisibleClassSubjects teacherId={me.teacherId} {...props} />;
  if (!classId) {
    return <Select options={[]} placeholder="Choose a class first" {...props} disabled />;
  }
  return <ClassSubjectsOfClass key={classId} classId={classId} {...props} />;
}
