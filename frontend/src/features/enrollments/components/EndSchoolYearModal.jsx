import { useRef, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Modal } from '../../../components/ui/Modal';
import { academicYearEnd, formatDate, todayYmd } from '../../../utils/date';
import { countOf } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { ClassSelect } from '../../classes/components/ClassSelect';
import { useClassRoster } from '../../students/hooks';
import { useCompleteSchoolYear } from '../hooks';
import { completeSchoolYearSchema } from '../schemas';
import { StudentCheckboxList } from './StudentCheckboxList';

/**
 * End of a school year for one class (POST /enrollments/complete, all or nothing). Admin only. Every student
 * of the class starts ticked; the ticked students' enrollments close as completed and, with a next class (a
 * class of a later year), they are enrolled there in the same step. Unticked students stay in the class.
 * The modal remembers the unticked students, so the default needs no effect, and starts fresh on every
 * opening. When a student left the class meanwhile (409 `not_active_in_class`) nothing is written: the modal
 * names them and reloads the list.
 *
 * @param {object} props
 * @param {{ id: number, name: string, academicYear: string }} props.schoolClass
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function EndSchoolYearModal({ schoolClass, open, onClose }) {
  const mutation = useCompleteSchoolYear();
  const roster = useClassRoster(schoolClass.id, { enabled: open });
  const [unticked, setUnticked] = useState({}); // student id -> true
  const [nextClassId, setNextClassId] = useState('');
  const [problem, setProblem] = useState(null);
  const opening = useRef(0); // bumped on close, so a request that finishes after it cannot touch the next opening

  const close = () => {
    opening.current += 1;
    setUnticked({});
    setNextClassId('');
    setProblem(null);
    onClose();
  };

  const students = roster.data ?? [];
  const ticked = students.filter((student) => !(student.id in unticked));
  const yearEnd = academicYearEnd(schoolClass.academicYear);

  const change = (update) => {
    setProblem(null);
    setUnticked(update);
  };
  const toggle = (student) =>
    change((current) => {
      const next = { ...current };
      if (student.id in next) delete next[student.id];
      else next[student.id] = true;
      return next;
    });

  const onSubmit = () => {
    const parsed = completeSchoolYearSchema.safeParse({
      studentIds: ticked.map((student) => student.id),
      nextClassId,
    });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0].message);
      return;
    }
    setProblem(null);
    const current = opening.current;
    mutation
      .mutateAsync({ classId: schoolClass.id, ...parsed.data })
      .then(() => current === opening.current && close())
      .catch((error) => {
        if (current !== opening.current) return;
        const leftIds = error?.details?.invalidStudentIds;
        if (error?.details?.reason === 'not_active_in_class' && Array.isArray(leftIds)) {
          const names = leftIds.map((id) => {
            const student = students.find((row) => row.id === id);
            return student ? fullName(student) : `Student ${id}`;
          });
          setProblem(
            `Nothing was saved. No longer in ${schoolClass.name}: ${names.join(', ')}. The list is reloaded; confirm again.`,
          );
          roster.refetch();
        } else {
          setProblem(error?.message ?? 'Something went wrong. Please try again.');
        }
      });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="End of school year"
      description={`${schoolClass.name}, ${schoolClass.academicYear}. Close the year for the students you select.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={mutation.isPending} disabled={ticked.length === 0}>
            {ticked.length > 0
              ? `Complete the year for ${countOf(ticked.length, 'student')}`
              : 'Complete the year'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {problem && (
          <Alert tone="error" role="alert">
            {problem}
          </Alert>
        )}
        {todayYmd() <= yearEnd && (
          <Alert tone="warning">
            The {schoolClass.academicYear} school year runs until {formatDate(yearEnd)}. From today the
            selected students leave this class's attendance and grade sheets; earlier days stay editable.
          </Alert>
        )}
        <FormField label="Next class" hint="Only classes of a later school year are listed.">
          <ClassSelect
            value={nextClassId}
            onChange={(event) => {
              setProblem(null);
              setNextClassId(event.target.value);
            }}
            placeholder="Don't enroll them yet"
            fromCurrentYear
            afterYear={schoolClass.academicYear}
          />
        </FormField>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <span aria-live="polite">
              {ticked.length} of {students.length} selected
            </span>
            <span className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => change({})}
                disabled={ticked.length === students.length}
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => change(Object.fromEntries(students.map((student) => [student.id, true])))}
                disabled={ticked.length === 0}
              >
                Clear selection
              </Button>
            </span>
          </div>
          <StudentCheckboxList
            label={`Students in ${schoolClass.name}`}
            students={students}
            isPending={roster.isPending}
            error={roster.error}
            onRetry={roster.refetch}
            isChecked={(student) => !(student.id in unticked)}
            onToggle={toggle}
            emptyText="No student is in this class."
          />
        </div>
        <p className="text-sm text-gray-600">
          Each ticked student's enrollment in {schoolClass.name} is marked Completed
          {nextClassId ? ', and they join the next class in the same step' : ''}. Students you untick stay in{' '}
          {schoolClass.name}. Grades and attendance stay on record.
        </p>
      </div>
    </Modal>
  );
}
