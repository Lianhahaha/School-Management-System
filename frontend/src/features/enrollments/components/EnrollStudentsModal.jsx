import { useRef, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Modal } from '../../../components/ui/Modal';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Skeleton } from '../../../components/ui/Skeleton';
import { BULK_MAX_ROWS, ERROR_CODES, PAGINATION } from '../../../constants/shared';
import { fullName } from '../../../utils/names';
import { useStudents } from '../../students/hooks';
import { useEnrollStudents } from '../hooks';
import { enrollStudentsSchema } from '../schemas';

/** The students who joined the school but have no class yet, with a search box and a checkbox each. */
function StudentChecklist({ search, onSearch, selected, onToggle, onSelectVisible, onClearSelection }) {
  const { data, isPending, error, refetch } = useStudents({
    hasActiveEnrollment: 'false',
    isActive: 'true',
    limit: PAGINATION.MAX_LIMIT,
    ...(search && { search }),
  });
  const students = data?.items ?? [];
  const total = data?.meta?.total ?? 0;

  let body;
  if (isPending) {
    body = (
      <div role="status" aria-label="Loading students" className="space-y-3 p-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-2/3" />
        ))}
      </div>
    );
  } else if (error) {
    body = <ErrorState title="Couldn't load students" message={error.message} onRetry={refetch} />;
  } else if (students.length === 0) {
    body = (
      <p className="p-6 text-center text-sm text-gray-600">
        {search ? 'No unenrolled student matches your search.' : 'Every student already has a class.'}
      </p>
    );
  } else {
    body = (
      <ul className="divide-y divide-gray-200">
        {students.map((student) => (
          <li key={student.id} className="px-3 py-2">
            <Checkbox
              label={`${fullName(student)} · ${student.studentNumber}`}
              checked={student.id in selected}
              onChange={() => onToggle(student)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sm:[&>div]:w-full">
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Search name, student number, email"
          label="Search students without a class"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span aria-live="polite">
          {Object.keys(selected).length} selected (up to {BULK_MAX_ROWS})
        </span>
        <span className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSelectVisible(students)}
            disabled={students.length === 0}
          >
            Select all shown
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            disabled={Object.keys(selected).length === 0}
          >
            Clear selection
          </Button>
        </span>
      </div>
      <div
        role="group"
        aria-label="Students without a class"
        className="max-h-72 overflow-y-auto rounded-[1.25rem] bg-gray-50"
      >
        {body}
      </div>
      {total > students.length && (
        <p className="text-xs text-gray-500">
          Showing the first {students.length} of {total} students. Search to narrow the list.
        </p>
      )}
    </div>
  );
}

/**
 * Enroll many students into one class at once (POST /enrollments/bulk, all or nothing). Admin only.
 * Pick from the students who have no active class; the selection survives a change of search and is
 * cleared, with the search and any error, whenever the modal closes. If the
 * server finds students who are already enrolled (409 `alreadyActive[]`) nothing is written; the modal
 * names them, offers to deselect them and keeps everything else selected so a retry is one click.
 *
 * @param {object} props
 * @param {number} props.classId
 * @param {string} [props.className] shown in the description
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function EnrollStudentsModal({ classId, className, open, onClose }) {
  const mutation = useEnrollStudents();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // student id -> student row, so names survive a new search
  const [problem, setProblem] = useState(null); // { message, alreadyActiveIds }
  const opening = useRef(0); // bumped on close, so a request that finishes after it cannot touch the next opening

  // The modal stays mounted between openings, so every way out starts the next opening fresh.
  const close = () => {
    opening.current += 1;
    setSearch('');
    setSelected({});
    setProblem(null);
    onClose();
  };

  const select = (update) => {
    setProblem(null);
    setSelected(update);
  };
  const toggle = (student) =>
    select((current) => {
      const next = { ...current };
      if (student.id in next) delete next[student.id];
      else next[student.id] = student;
      return next;
    });
  const selectVisible = (students) =>
    select((current) => {
      const next = { ...current };
      for (const student of students) {
        if (Object.keys(next).length >= BULK_MAX_ROWS) break;
        next[student.id] = student;
      }
      return next;
    });
  const deselectAlreadyEnrolled = () =>
    select((current) => {
      const next = { ...current };
      for (const id of problem.alreadyActiveIds) delete next[id];
      return next;
    });

  const onSubmit = () => {
    const parsed = enrollStudentsSchema.safeParse({ studentIds: Object.keys(selected) });
    if (!parsed.success) {
      setProblem({ message: parsed.error.issues[0].message, alreadyActiveIds: [] });
      return;
    }
    setProblem(null);
    const current = opening.current;
    mutation
      .mutateAsync({ classId, studentIds: parsed.data.studentIds })
      .then(() => current === opening.current && close())
      .catch((error) => {
        if (current !== opening.current) return;
        const alreadyActive = error?.details?.alreadyActive;
        if (error?.code === ERROR_CODES.CONFLICT && Array.isArray(alreadyActive)) {
          const alreadyActiveIds = alreadyActive.map((row) => String(row.studentId));
          const names = alreadyActiveIds.map((id) =>
            selected[id] ? fullName(selected[id]) : `Student ${id}`,
          );
          setProblem({
            message: `Nothing was saved. Already enrolled in a class: ${names.join(', ')}.`,
            alreadyActiveIds,
          });
        } else {
          setProblem({
            message: error?.message ?? 'Something went wrong. Please try again.',
            alreadyActiveIds: [],
          });
        }
      });
  };

  const count = Object.keys(selected).length;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Enroll students"
      description={className ? `Choose the students who join ${className}.` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={mutation.isPending} disabled={count === 0}>
            {count > 0 ? `Enroll ${count} ${count === 1 ? 'student' : 'students'}` : 'Enroll students'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {problem && (
          <Alert tone="error" role="alert">
            <p>{problem.message}</p>
            {problem.alreadyActiveIds.length > 0 && (
              <Button size="sm" variant="secondary" className="mt-2" onClick={deselectAlreadyEnrolled}>
                Deselect them and retry
              </Button>
            )}
          </Alert>
        )}
        <StudentChecklist
          search={search}
          onSearch={setSearch}
          selected={selected}
          onToggle={toggle}
          onSelectVisible={selectVisible}
          onClearSelection={() => select({})}
        />
      </div>
    </Modal>
  );
}
