import { OptionSelect } from '../../../components/ui/OptionSelect';
import { useSubjectOptions } from '../hooks';

/**
 * Select of active subjects (the first 100), labelled "CODE · Name". A retired subject is not offered,
 * so it cannot be added to new classes. Works with react-hook-form (`{...register('subjectId')}`).
 *
 * @param {object} props
 * @param {number[]} [props.excludeIds] subjects to leave out, for example those the class already has
 * @param {string} [props.placeholder] label of the empty choice (default "Choose a subject")
 * Every other prop goes to the native <select>.
 */
export function SubjectSelect({ excludeIds = [], placeholder = 'Choose a subject', ...props }) {
  const { data, isPending, isError } = useSubjectOptions();
  const options = data?.filter((option) => !excludeIds.includes(option.item.id));
  return (
    <OptionSelect
      options={options}
      isPending={isPending}
      isError={isError}
      placeholder={placeholder}
      {...props}
    />
  );
}
