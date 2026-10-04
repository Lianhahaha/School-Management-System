import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { todayYmd } from '../../../utils/date';
import { ClassSelect } from '../../classes/components/ClassSelect';
import { ClassSubjectSelect } from './ClassSubjectSelect';

/**
 * The bar above the attendance and grades pages: class (admin only) -> class-subject (-> date).
 * Its state lives in the URL; build `selection` with useClassSubjectSelection (same `withDate`).
 *
 * @param {object} props
 * @param {ReturnType<typeof import('../hooks').useClassSubjectSelection>} props.selection
 * @param {boolean} [props.withDate] adds the date input (max today)
 */
export function ClassSubjectSelectorBar({ selection, withDate = false }) {
  const { role, classId, classSubjectId, date, setClassId, setClassSubjectId, setDate } = selection;
  const isFuture = withDate && date > todayYmd();

  return (
    <div role="group" aria-label="Choose a lesson" className="mb-6 flex flex-wrap items-start gap-4">
      {role === 'admin' && (
        <FormField label="Class" className="w-full sm:w-64">
          <ClassSelect value={classId} onChange={(event) => setClassId(event.target.value)} />
        </FormField>
      )}
      <FormField label={role === 'admin' ? 'Subject' : 'Class and subject'} className="w-full sm:w-72">
        <ClassSubjectSelect
          classId={classId}
          value={classSubjectId}
          onChange={(event) => setClassSubjectId(event.target.value)}
        />
      </FormField>
      {withDate && (
        <FormField
          label="Date"
          error={isFuture ? "Attendance can't be marked for a future date" : undefined}
          className="w-full sm:w-48"
        >
          <Input
            type="date"
            value={date}
            max={todayYmd()}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
      )}
    </div>
  );
}
