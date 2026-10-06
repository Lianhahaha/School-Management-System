import { CheckCheck, RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { TBody, THead, Table, Td, Th, Tr } from '../../../components/ui/Table';
import { ERROR_CODES } from '../../../constants/shared';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_TONES, DAY_LABELS } from '../../../constants/ui';
import { useUnsavedChangesBlocker } from '../../../hooks/useUnsavedChangesBlocker';
import { useAuth } from '../../auth/hooks';
import { formatDate, isoWeekdayOf } from '../../../utils/date';
import { fullName, initials } from '../../../utils/names';
import { useSaveAttendanceSheet } from '../hooks';

const LETTERS = { present: 'P', absent: 'A', late: 'L', excused: 'E' };
const SAVE_BLOCKED_HINT = "Only the subject's teacher can save attendance";

const STATUS_OPTIONS = Object.keys(LETTERS).map((status) => ({
  value: status,
  tone: ATTENDANCE_STATUS_TONES[status],
  label: (
    <>
      <span aria-hidden="true" className="font-semibold">
        {LETTERS[status]}
      </span>
      {ATTENDANCE_STATUS_LABELS[status]}
    </>
  ),
}));

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayList = new Intl.ListFormat('en', { type: 'conjunction' });

/** `{ [studentId]: { status, remarks } }`; students who are not marked yet default to present. */
const toDraft = (records) =>
  Object.fromEntries(
    records.map((record) => [
      record.studentId,
      { status: record.status ?? 'present', remarks: record.remarks ?? '' },
    ]),
  );

const isSameMark = (a, b) => a.status === b.status && a.remarks === b.remarks;

/** The last person to touch the sheet: a quiet "Saved by you" line, or the "Already marked by" banner. */
function lastEditor(records) {
  const marked = records.filter((record) => record.attendanceId !== null && record.markedBy);
  if (marked.length === 0) return null;
  return marked.reduce((latest, record) => (record.updatedAt > latest.updatedAt ? record : latest));
}

/**
 * The roster of one lesson on one date with a status per student. The draft lives here; nothing is
 * sent until Save, which PUTs every roster row (the sheet is the unit of truth) and then adopts the
 * returned sheet. Mount it with a key of lesson + date so a different sheet starts from scratch.
 * On a school holiday (`sheet.holiday`), or on a weekday the lesson does not meet while nothing is marked yet
 * (`sheet.lessonDays`), the sheet is read-only and says why; the API refuses both.
 *
 * @param {object} props
 * @param {object} props.sheet GET /attendance/sheet data
 * @param {boolean} props.canSave false renders the sheet read-only (a homeroom teacher of another teacher's subject)
 * @param {() => Promise<{ data?: object }>} props.onReload refetches the sheet (after the roster changed meanwhile)
 */
export function AttendanceSheet({ sheet, canSave: isOwner, onReload }) {
  const save = useSaveAttendanceSheet();
  const { me } = useAuth();
  // Nobody marks a holiday or a day without this lesson: the API refuses both, so the sheet does not offer it.
  const weekday = isoWeekdayOf(sheet.date);
  const isOffDay =
    sheet.lessonDays.length > 0 &&
    !sheet.lessonDays.includes(weekday) &&
    !sheet.records.some((record) => record.attendanceId !== null);
  const canSave = isOwner && !sheet.holiday && !isOffDay;
  const [saved, setSaved] = useState(sheet);
  const [draft, setDraft] = useState(() => toDraft(sheet.records));
  const [saveError, setSaveError] = useState(null);

  const { records } = saved;
  const initialDraft = toDraft(records);
  const hasEdits = records.some(
    (record) => !isSameMark(draft[record.studentId], initialDraft[record.studentId]),
  );
  const hasUnmarked = records.some((record) => record.attendanceId === null);
  const canSubmit = canSave && (hasEdits || hasUnmarked);
  // The lesson and date live in the query string: changing them would drop the marks.
  useUnsavedChangesBlocker(canSave && hasEdits, { includeSearch: true });

  const counts = Object.fromEntries(Object.keys(LETTERS).map((status) => [status, 0]));
  for (const { status } of Object.values(draft)) counts[status] += 1;

  const editor = lastEditor(records);
  // Your own earlier save is not a conflict: it gets a plain note, not a warning.
  const editedByMe = editor?.markedBy.id === me.id;

  const adopt = (nextSheet) => {
    setSaved(nextSheet);
    setDraft(toDraft(nextSheet.records));
    setSaveError(null);
  };

  const setMark = (studentId, patch) =>
    setDraft((current) => ({ ...current, [studentId]: { ...current[studentId], ...patch } }));

  const markAllPresent = () =>
    setDraft((current) =>
      Object.fromEntries(Object.keys(current).map((id) => [id, { status: 'present', remarks: '' }])),
    );

  const submit = () =>
    save.mutate(
      {
        classSubjectId: saved.classSubjectId,
        date: saved.date,
        records: records.map(({ studentId }) => ({
          studentId,
          status: draft[studentId].status,
          remarks: draft[studentId].remarks.trim() || null,
        })),
      },
      { onSuccess: adopt, onError: setSaveError },
    );

  const reload = () => onReload().then(({ data }) => data && adopt(data));

  if (records.length === 0) {
    return (
      <Card>
        <EmptyState
          title={`No students were in this class on ${formatDate(sheet.date)}`}
          description="Only students enrolled on that date are on the sheet."
        />
      </Card>
    );
  }

  const { className, subjectName } = saved.classSubject;
  const showRootError = saveError?.code === ERROR_CODES.VALIDATION_ERROR;

  return (
    <Card
      title={`${className} · ${subjectName}`}
      description={formatDate(saved.date)}
      padded={false}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            onClick={markAllPresent}
            disabled={!canSave}
          >
            Mark all present
          </Button>
          <span
            title={
              isOwner
                ? sheet.holiday || isOffDay
                  ? `No ${sheet.classSubject.subjectName} period on this day`
                  : undefined
                : SAVE_BLOCKED_HINT
            }
          >
            <Button icon={Save} isLoading={save.isPending} disabled={!canSubmit} onClick={submit} size="sm">
              Save attendance
            </Button>
          </span>
        </div>
      }
    >
      <div className="space-y-3 border-b border-gray-100 px-5 py-3">
        <p className="text-sm text-gray-700" aria-live="polite">
          <span className="font-medium">{counts.present} present</span> · {counts.absent} absent ·{' '}
          {counts.late} late · {counts.excused} excused
        </p>
        <p className="text-xs text-gray-500">Unmarked students are saved as Present.</p>
        {sheet.holiday && (
          <Alert tone="warning">{`No classes on ${formatDate(saved.date)}: ${sheet.holiday.title}. Attendance can't be marked on a school holiday.`}</Alert>
        )}
        {isOffDay && !sheet.holiday && (
          <Alert tone="warning">
            {`${sheet.classSubject.subjectName} has no periods on ${DAY_LABELS[weekday]}s. It meets on ${dayList.format(
              sheet.lessonDays.map((day) => DAY_LABELS[day]),
            )}: pick one of those days to mark attendance.`}
          </Alert>
        )}
        {!isOwner && <Alert tone="info">{`You can view this sheet. ${SAVE_BLOCKED_HINT}.`}</Alert>}
        {editor && editedByMe && (
          <p className="text-xs text-gray-600">{`Saved by you at ${timeFormatter.format(new Date(editor.updatedAt))}.`}</p>
        )}
        {editor && !editedByMe && (
          <Alert tone="warning">
            {`Already marked by ${fullName(editor.markedBy)} (updated ${timeFormatter.format(new Date(editor.updatedAt))}).${canSave ? ' Saving overwrites it.' : ''}`}
          </Alert>
        )}
        {showRootError && (
          <Alert tone="error" role="alert">
            <p>{saveError.message}</p>
            {saveError.details?.invalidStudentIds && (
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={reload} className="mt-2">
                Reload sheet
              </Button>
            )}
          </Alert>
        )}
      </div>

      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Attendance sheet">
        <Table caption={`Attendance for ${className}, ${subjectName}, ${formatDate(saved.date)}`}>
          <THead>
            <Tr>
              <Th>Student</Th>
              <Th>Status</Th>
              <Th>Remarks</Th>
            </Tr>
          </THead>
          <TBody>
            {records.map((record) => {
              const name = fullName(record);
              const mark = draft[record.studentId];
              return (
                <Tr key={record.studentId}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700"
                      >
                        {initials(record)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{name}</p>
                        <p className="text-xs text-gray-500">{record.studentNumber}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <RadioGroup
                      legend={`Attendance for ${name}`}
                      hideLegend
                      name={`status-${record.studentId}`}
                      options={STATUS_OPTIONS}
                      value={mark.status}
                      disabled={!canSave}
                      onChange={(event) =>
                        setMark(record.studentId, {
                          status: event.target.value,
                          ...(event.target.value === 'present' ? { remarks: '' } : {}),
                        })
                      }
                    />
                  </Td>
                  <Td>
                    {(mark.status !== 'present' || mark.remarks !== '') && (
                      <Input
                        aria-label={`Remarks for ${name}`}
                        value={mark.remarks}
                        maxLength={255}
                        readOnly={!canSave}
                        placeholder="Remarks (optional)"
                        onChange={(event) => setMark(record.studentId, { remarks: event.target.value })}
                      />
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}
