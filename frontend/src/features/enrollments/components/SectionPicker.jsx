import { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { useConfirm } from '../../../hooks/useConfirm';
import { cx } from '../../../utils/cx';
import { countOf } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { useEnrollMyself } from '../hooks';

/**
 * The sections a student may enroll in, as radio tiles (name, homeroom teacher, head count), and the button
 * that enrolls them after a confirmation: a student cannot change the section themselves afterwards.
 *
 * @param {object} props
 * @param {Array<{ id: number, name: string, academicYear: string, homeroomTeacher: object | null, studentCount: number }>} props.classes
 */
export function SectionPicker({ classes }) {
  const name = useId();
  const [classId, setClassId] = useState(classes.length === 1 ? classes[0].id : null);
  const enroll = useEnrollMyself();
  const confirm = useConfirm();
  const chosen = classes.find((klass) => klass.id === classId);

  const submit = async () => {
    const ok = await confirm({
      title: `Enroll in ${chosen.name}?`,
      description: `You join ${chosen.name} for ${chosen.academicYear}. Only the school office can move you to another section afterwards.`,
      confirmLabel: `Enroll in ${chosen.name}`,
      cancelLabel: 'Back',
      tone: 'primary',
    });
    if (ok) enroll.mutate(chosen.id);
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="sr-only">Section</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((klass) => (
            <label key={klass.id} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={klass.id}
                checked={classId === klass.id}
                onChange={() => setClassId(klass.id)}
                className="peer sr-only"
              />
              <span
                className={cx(
                  'grid gap-0.5 rounded-tile bg-gray-50 px-4 py-3 ring-1 ring-gray-200 transition-colors ring-inset hover:bg-gray-100',
                  'peer-checked:bg-surface peer-checked:ring-2 peer-checked:ring-gray-900',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gray-900',
                )}
              >
                <span className="text-sm font-semibold text-gray-900">{klass.name}</span>
                <span className="text-xs text-gray-600">
                  {klass.homeroomTeacher ? fullName(klass.homeroomTeacher) : 'No homeroom teacher yet'}
                </span>
                <span className="text-xs text-gray-600">{countOf(klass.studentCount, 'student')} so far</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button onClick={submit} disabled={!chosen} isLoading={enroll.isPending}>
        {chosen ? `Enroll in ${chosen.name}` : 'Pick a section'}
      </Button>
    </div>
  );
}
