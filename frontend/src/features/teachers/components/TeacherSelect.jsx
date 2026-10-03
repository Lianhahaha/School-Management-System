import { OptionSelect } from '../../../components/ui/OptionSelect';
import { useTeacherOptions } from '../hooks';

/**
 * Select of active teachers (the first 100), labelled with the full name. Works with react-hook-form
 * (`{...register('teacherId')}`) and as a controlled filter (`value`, `onChange` with the event).
 * Admin only: the teachers list is an admin endpoint.
 *
 * @param {object} props
 * @param {string} [props.placeholder] label of the empty choice (default "Choose a teacher"); pass
 *   "No homeroom teacher" for an optional field
 * Every other prop goes to the native <select>.
 */
export function TeacherSelect({ placeholder = 'Choose a teacher', ...props }) {
  const { data, isPending } = useTeacherOptions();
  return <OptionSelect options={data} isPending={isPending} placeholder={placeholder} {...props} />;
}
