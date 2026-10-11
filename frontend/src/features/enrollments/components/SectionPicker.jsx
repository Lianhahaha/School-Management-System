import { useId, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { RadioTiles } from '../../../components/ui/RadioTiles';
import { useConfirm } from '../../../hooks/useConfirm';
import { cx } from '../../../utils/cx';
import { fullName } from '../../../utils/names';
import { useEnrollMyself } from '../hooks';
import { isClassFullError, seatsLabel, seatsOf } from '../seats';

/** One section as a tile: its name (and "Full"), its homeroom teacher and its seats. */
function sectionOption(klass) {
  const { isFull, isFew } = seatsOf(klass);
  return {
    value: String(klass.id),
    disabled: isFull,
    label: (
      <span className="flex items-center justify-between gap-2">
        {klass.name}
        {isFull && <Badge tone="gray">Full</Badge>}
      </span>
    ),
    description: (
      <>
        <span className="block">
          {klass.homeroomTeacher ? fullName(klass.homeroomTeacher) : 'No homeroom teacher yet'}
        </span>
        <span className={cx('tabular block', isFew && 'font-semibold text-attention-ink')}>
          {seatsLabel(klass)}
        </span>
      </>
    ),
  };
}

/** The refusal of a self-enrollment, in words: a section that filled up meanwhile, or the server's message. */
function refusalOf(error, classes) {
  if (!isClassFullError(error)) return error.message;
  const name = classes.find((klass) => klass.id === error.details.classId)?.name ?? 'That section';
  return `${name} filled up just now. Pick another section.`;
}

/**
 * The sections a student may enroll in, as radio tiles (name, homeroom teacher, seats taken), and the button
 * that enrolls them after a confirmation: a student cannot change the section themselves afterwards. A full
 * section cannot be picked; one that fills up while the student decides is refused (409 `class_full`), which
 * shows here and reloads the sections (useEnrollMyself).
 *
 * @param {object} props
 * @param {Array<{ id: number, name: string, academicYear: string, homeroomTeacher: object | null, enrolled: number, seats: number }>} props.classes
 */
export function SectionPicker({ classes }) {
  const name = useId();
  const open = classes.filter((klass) => !seatsOf(klass).isFull);
  const [classId, setClassId] = useState(open.length === 1 ? open[0].id : null);
  const enroll = useEnrollMyself();
  const confirm = useConfirm();
  // A section that fills up while the student looks (a reload after 409, the live refresh) drops out of the pick.
  const chosen = open.find((klass) => klass.id === classId);

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
      <RadioTiles
        legend="Section"
        hideLegend
        name={name}
        options={classes.map(sectionOption)}
        value={chosen ? String(chosen.id) : ''}
        onChange={(event) => {
          enroll.reset();
          setClassId(Number(event.target.value));
        }}
        gridClassName="sm:grid-cols-2 xl:grid-cols-3"
      />
      {enroll.error && (
        <Alert tone="error" role="alert">
          {refusalOf(enroll.error, classes)}
        </Alert>
      )}
      <Button onClick={submit} disabled={!chosen} isLoading={enroll.isPending}>
        {chosen ? `Enroll in ${chosen.name}` : 'Pick a section'}
      </Button>
    </div>
  );
}
