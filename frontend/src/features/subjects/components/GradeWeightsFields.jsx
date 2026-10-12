import { useId } from 'react';
import { useWatch } from 'react-hook-form';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import {
  ASSESSMENT_TYPES,
  COMPONENT_OF_TYPE,
  COMPONENT_WEIGHTS,
  GRADING_COMPONENTS,
  GRADING_GROUPS,
  SENIOR_HIGH_GRADING_GROUPS,
} from '../../../constants/shared';
import { ASSESSMENT_TYPE_LABELS, COMPONENT_LABELS, GRADING_GROUP_LABELS } from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { weightsTotal } from '../schemas';

const METHOD_OPTIONS = [
  { value: 'k12', label: 'K-12 components' },
  { value: 'points', label: 'On points' },
  { value: 'weighted', label: 'Weighted by type' },
];

/** A group as a choice: its name and its weights (written work · performance tasks · quarterly assessment). */
const groupOption = (group) => {
  const weights = COMPONENT_WEIGHTS[group];
  return {
    value: group,
    label: (
      <>
        {GRADING_GROUP_LABELS[group]}
        <span className="tabular-nums">
          {weights.written} · {weights.performance} · {weights.quarterly}
        </span>
      </>
    ),
  };
};

/**
 * The groups of Grades 1-10 and those of Senior High, offered apart: a subject is taught only in the grades of
 * its group (the API refuses to put it in a class of the other grades, or to give it a group that does not fit
 * a class it is taught in).
 */
const LOWER_GROUP_OPTIONS = GRADING_GROUPS.filter((group) => !SENIOR_HIGH_GRADING_GROUPS.includes(group)).map(
  groupOption,
);
const SENIOR_HIGH_GROUP_OPTIONS = SENIOR_HIGH_GRADING_GROUPS.map(groupOption);

/** Which Senior High group a subject takes (DepEd Order 8 s. 2015, Table 5). */
const GROUP_HINT =
  'A subject is taught only in the grades of its group. In Senior High, the core subjects of every track take Core; the academic track’s other subjects take Academic track, and its work immersion, research, business enterprise simulation, exhibit or performance take Academic immersion; every other subject of the TVL, Sports and Arts and Design tracks, their work immersion included, takes TVL.';

/** The assessment types each component counts, as text: 'Quiz, test, assignment'. */
const typesOf = (component) => {
  const labels = ASSESSMENT_TYPES.filter((type) => COMPONENT_OF_TYPE[type] === component).map(
    (type) => ASSESSMENT_TYPE_LABELS[type],
  );
  return [labels[0], ...labels.slice(1).map((label) => label.toLowerCase())].join(', ');
};

/** The K-12 components of the chosen group: what each counts and its weight. */
function ComponentTable({ group }) {
  const weights = COMPONENT_WEIGHTS[group];
  return (
    <div className="relative overflow-x-auto rounded-xl ring-1 ring-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-600">
            <th className="px-3 py-2 font-medium">Component</th>
            <th className="px-3 py-2 font-medium">Counts</th>
            <th className="px-3 py-2 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody>
          {GRADING_COMPONENTS.map((component) => (
            <tr key={component} className="border-t border-gray-200">
              <td className="px-3 py-2 font-medium text-gray-900">{COMPONENT_LABELS[component]}</td>
              <td className="px-3 py-2 text-gray-600">{typesOf(component)}</td>
              <td className="px-3 py-2 text-right text-gray-900 tabular-nums">{weights[component]}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
 * The grading part of the subject form: K-12 components (DepEd Order 8, s. 2015) with the subject's group
 * (the Grades 1-10 groups and the Senior High ones offered apart), on points (every point counts the same), or
 * weighted by assessment type with a percent per type and a live total that must reach 100. Changing the
 * method, the group or a weight changes every result in the subject, which the hint says, and the API refuses
 * it once the subject has grades from an earlier school year, or when the group does not fit the grade of a
 * class that takes the subject (the form shows those refusals like any other).
 *
 * @param {object} props
 * @param {import('react-hook-form').Control} props.control
 * @param {import('react-hook-form').UseFormRegister} props.register
 * @param {object} props.errors react-hook-form `formState.errors`
 */
export function GradeWeightsFields({ control, register, errors }) {
  const method = useWatch({ control, name: 'gradingMethod' });
  const group = useWatch({ control, name: 'gradingGroup' });
  const weights = useWatch({ control, name: 'weights' });
  const total = weightsTotal(weights);
  const totalError = errors.weights?.message ?? errors.weights?.root?.message;

  const hint = {
    k12: 'Written work, performance tasks and the quarterly assessment count with the group’s weights; the result is transmuted to 60–100 and 75 passes. Changes apply to every result in this subject; once it has grades from an earlier school year, its grading can’t change.',
    weighted:
      'Each type counts with its share. A type set to 0 does not count. Changes apply to every result in this subject; once it has grades from an earlier school year, its grading can’t change.',
    points:
      'A result is all points scored divided by all points possible, so a long exam counts more than a short quiz.',
  }[method];

  return (
    <div className="space-y-3">
      <RadioGroup legend="Grading" options={METHOD_OPTIONS} {...register('gradingMethod')} />
      <p className="text-xs text-gray-500">{hint}</p>
      {method === 'k12' && (
        <div className="space-y-3">
          <RadioGroup
            legend="Subject group, Grades 1–10"
            options={LOWER_GROUP_OPTIONS}
            {...register('gradingGroup')}
          />
          <RadioGroup
            legend="Subject group, Senior High (Grades 11–12)"
            options={SENIOR_HIGH_GROUP_OPTIONS}
            {...register('gradingGroup')}
          />
          <p className="text-xs text-gray-500">{GROUP_HINT}</p>
          <ComponentTable group={group} />
        </div>
      )}
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
