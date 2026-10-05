import { useId } from 'react';
import { useWatch } from 'react-hook-form';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { ASSESSMENT_TYPES } from '../../../constants/shared';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { weightsTotal } from '../schemas';

const METHOD_OPTIONS = [
  { value: 'points', label: 'On points' },
  { value: 'weighted', label: 'Weighted by type' },
];

/** One weight input with its label and a % sign. */
function WeightInput({ type, register, error }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {ASSESSMENT_TYPE_LABELS[type]}
      </label>
      <div className="relative">
        <input
          id={id}
          {...register(`weights.${type}`)}
          inputMode="numeric"
          placeholder="0"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="form-control pr-8 text-right tabular-nums"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500"
        >
          %
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The grading part of the subject form: on points (every point counts the same), or weighted by assessment
 * type with a percent per type and a live total that must reach 100. Changing the method or a weight
 * changes every result in the subject, past ones included, which the hint says.
 *
 * @param {object} props
 * @param {import('react-hook-form').Control} props.control
 * @param {import('react-hook-form').UseFormRegister} props.register
 * @param {object} props.errors react-hook-form `formState.errors`
 */
export function GradeWeightsFields({ control, register, errors }) {
  const method = useWatch({ control, name: 'gradingMethod' });
  const weights = useWatch({ control, name: 'weights' });
  const total = weightsTotal(weights);
  const totalError = errors.weights?.message ?? errors.weights?.root?.message;

  return (
    <div className="space-y-3">
      <RadioGroup legend="Grading" options={METHOD_OPTIONS} {...register('gradingMethod')} />
      <p className="text-xs text-gray-500">
        {method === 'weighted'
          ? 'Each type counts with its share. A type set to 0 does not count. Changes apply to every result in this subject, past ones too.'
          : 'A result is all points scored divided by all points possible, so a long exam counts more than a short quiz.'}
      </p>
      {method === 'weighted' && (
        <fieldset className="space-y-3">
          <legend className="sr-only">Weight of each assessment type, in percent</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ASSESSMENT_TYPES.map((type) => (
              <WeightInput
                key={type}
                type={type}
                register={register}
                error={errors.weights?.[type]?.message}
              />
            ))}
          </div>
          <p
            aria-live="polite"
            className={cx(
              'text-sm font-medium tabular-nums',
              total === 100 ? 'text-green-700' : 'text-amber-700',
            )}
          >
            Total {total}%{total === 100 ? '' : ' of 100%'}
          </p>
          {totalError && <p className="text-xs text-red-600">{totalError}</p>}
        </fieldset>
      )}
    </div>
  );
}
