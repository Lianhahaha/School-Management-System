import { Checkbox } from '../../../components/ui/Checkbox';
import { Spinner } from '../../../components/ui/Spinner';
import { cx } from '../../../utils/cx';
import { fullName } from '../../../utils/names';
import { useUpdateAdmission } from '../hooks';

/** The documents the school office checks before admitting, in the order they are listed. */
const DOCUMENTS = [
  { field: 'birthCertificateReceived', label: 'Birth certificate (PSA)' },
  { field: 'reportCardReceived', label: 'Report card (SF9)' },
];

/**
 * One document, saved as soon as it is ticked. The box shows the new value right away and stays disabled,
 * with a spinner, until the save and the reload are done; a failed save puts the old value back (and toasts).
 */
function DocumentCheckbox({ student, field, label }) {
  const mutation = useUpdateAdmission();
  const isSaving = mutation.isPending;
  const checked = isSaving ? mutation.variables.body[field] : student.admission[field];

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        label={
          <>
            {label}
            <span className="sr-only"> received from {fullName(student)}</span>
          </>
        }
        checked={checked}
        disabled={isSaving}
        aria-busy={isSaving || undefined}
        onChange={(event) =>
          mutation.mutate({ studentId: student.id, body: { [field]: event.target.checked } })
        }
      />
      {isSaving && <Spinner size="sm" className="text-gray-500" />}
    </div>
  );
}

/**
 * The document checklist of an application: the PSA birth certificate and the report card (SF9), each a
 * checkbox that saves on change (admin).
 *
 * @param {object} props
 * @param {object} props.student a student with `admission`
 * @param {string} [props.className]
 */
export function DocumentChecklist({ student, className }) {
  return (
    <div className={cx('space-y-2', className)}>
      {DOCUMENTS.map(({ field, label }) => (
        <DocumentCheckbox key={field} student={student} field={field} label={label} />
      ))}
    </div>
  );
}
