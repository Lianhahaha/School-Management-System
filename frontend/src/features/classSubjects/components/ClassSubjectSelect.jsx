import { OPTIONS_FAILED_PLACEHOLDER, OptionSelect } from '../../../components/ui/OptionSelect';
import { Select } from '../../../components/ui/Select';
import { fullName } from '../../../utils/names';
import { useAuth } from '../../auth/hooks';
import { useClassSubjectOptions } from '../hooks';

/** Admin: the subjects of one class, "Biology · Ana Reyes". */
function ClassSubjectsOfClass({ classId, ...props }) {
  const { data, isPending, isError } = useClassSubjectOptions({ classId });
  const options = data?.map(({ value, item }) => ({
    value,
    label: `${item.subjectName} · ${fullName(item.teacher)}`,
  }));
  return (
    <OptionSelect
      options={options}
      isPending={isPending}
      isError={isError}
      placeholder="Choose a subject"
      {...props}
    />
  );
}

/**
 * Teacher: every class-subject the teacher can see, grouped "Teaching" (own) and "Homeroom" (read-only). Like
 * OptionSelect, it is disabled while loading and says so when the first load failed.
 */
function VisibleClassSubjects({ teacherId, disabled, ...props }) {
  const { data, isPending, isError } = useClassSubjectOptions();
  const isUnavailable = isError && data === undefined;
  const options = data ?? [];
  const label = ({ item }) => `${item.className} · ${item.subjectName}`;
  const teaching = options.filter(({ item }) => item.teacherId === teacherId);
  const homeroom = options.filter(({ item }) => item.teacherId !== teacherId);
  const renderOptions = (options) =>
    options.map((option) => (
      <option key={option.value} value={option.value}>
        {label(option)}
      </option>
    ));

  return (
    <select
      {...props}
      key={isPending ? 'loading' : isUnavailable ? 'unavailable' : 'ready'}
      className="form-control"
      disabled={isPending || isUnavailable || disabled}
      aria-busy={isPending || undefined}
    >
      <option value="">{isUnavailable ? OPTIONS_FAILED_PLACEHOLDER : 'Choose a class and subject'}</option>
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
