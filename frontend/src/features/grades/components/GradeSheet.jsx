import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert } from '../../../components/ui/Alert';
import { BarChart } from '../../../components/ui/BarChart';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { TBody, THead, Table, Td, Th, Tr } from '../../../components/ui/Table';
import { ERROR_CODES } from '../../../constants/shared';
import { useToast } from '../../../hooks/useToast';
import { applyServerErrors } from '../../../lib/formErrors';
import { formatPercent, formatScore } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { useUnsavedChangesBlocker } from '../../../hooks/useUnsavedChangesBlocker';
import { useDeleteGrade, useRestoreGrade, useSaveGrades } from '../hooks';
import { gradeSheetDefaults, gradeSheetSchema, toSaveGradesPayload } from '../schemas';

const SAVE_BLOCKED_HINT = "Only the subject's teacher can save grades";
const SCORE_INPUT = '[data-score-input]:not([disabled]):not([readonly])';

/** Graded count, mean, highest and lowest percentage of the saved records. */
function summarize(records) {
  const percentages = records.filter((record) => record.gradeId !== null).map((record) => record.percentage);
  if (percentages.length === 0) return { graded: 0, mean: null, highest: null, lowest: null };
  const sum = percentages.reduce((total, value) => total + value, 0);
  return {
    graded: percentages.length,
    mean: sum / percentages.length / 100,
    highest: Math.max(...percentages) / 100,
    lowest: Math.min(...percentages) / 100,
  };
}

/** Saved results per 10-point band of the percentage (90 to 100 shares the top band). */
function scoreBands(records) {
  const bands = Array.from({ length: 10 }, (_, index) => ({
    label: String(index * 10),
    longLabel: index === 9 ? '90 to 100%' : `${index * 10} to ${index * 10 + 9}%`,
    value: 0,
  }));
  for (const record of records) {
    if (record.gradeId === null) continue;
    bands[Math.min(9, Math.floor(record.percentage / 10))].value += 1;
  }
  return bands;
}

/** Enter moves to the next score field instead of submitting the form. */
function focusNextScore(event) {
  if (event.key !== 'Enter' || !event.target.matches('[data-score-input]')) return;
  event.preventDefault();
  const inputs = [...event.currentTarget.querySelectorAll(SCORE_INPUT)];
  inputs[inputs.indexOf(event.target) + 1]?.focus();
}

/**
 * The roster of one assessment with a score field per student. A blank score means "not graded":
 * only rows that have a score are saved. Clearing a recorded grade is a separate action because a
 * save cannot unset a score. Mount it with a key of the assessment so another sheet starts fresh.
 *
 * @param {object} props
 * @param {object} props.roster GET /assessments/:id/grades data ({ assessment, records })
 * @param {boolean} props.canSave false renders the sheet read-only
 * @param {() => Promise<{ data?: object }>} props.onReload refetches the roster
 */
export function GradeSheet({ roster, canSave, onReload }) {
  const { assessment } = roster;
  const toast = useToast();
  const save = useSaveGrades();
  const deleteGrade = useDeleteGrade();
  const restoreGrade = useRestoreGrade();
  const [records, setRecords] = useState(roster.records);
  const schema = useMemo(() => gradeSheetSchema(assessment.maxScore), [assessment.maxScore]);

  const {
    register,
    handleSubmit,
    reset,
    resetField,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: gradeSheetDefaults(roster.records),
  });

  const rows = useWatch({ control, name: 'rows' });
  const hasScores = rows.some((row) => String(row.score ?? '').trim() !== '');
  useUnsavedChangesBlocker(canSave && isDirty);

  const adopt = (nextRoster) => {
    save.reset();
    setRecords(nextRoster.records);
    reset(gradeSheetDefaults(nextRoster.records));
  };

  const onSubmit = (values) =>
    save
      .mutateAsync({ assessmentId: assessment.id, grades: toSaveGradesPayload(values) })
      .then(adopt)
      .catch((error) => {
        const { studentId } = error.details ?? {};
        const index = records.findIndex((record) => record.studentId === studentId);
        if (error.code === ERROR_CODES.VALIDATION_ERROR && index !== -1) {
          setError(`rows.${index}.score`, {
            type: 'server',
            message: `Score must be between 0 and ${assessment.maxScore}`,
          });
          return;
        }
        if (error.code === ERROR_CODES.VALIDATION_ERROR)
          applyServerErrors(error, setError, { knownFields: [] });
      });

  const reload = () => onReload().then(({ data }) => data && adopt(data));

  /** Replaces one student's row with `next` and resets that row's inputs to it; other rows keep their edits. */
  const replaceRow = (index, next) => {
    setRecords((current) => current.map((row) => (row.studentId === next.studentId ? next : row)));
    resetField(`rows.${index}.score`, { defaultValue: next.score === null ? '' : String(next.score) });
    resetField(`rows.${index}.remarks`, { defaultValue: next.remarks ?? '' });
  };

  /** A one-click clear: no confirmation, but the toast offers Undo, which saves the old score back. */
  const clearGrade = (record, index) => {
    deleteGrade.mutate(record.gradeId, {
      onSuccess: () => {
        replaceRow(index, {
          ...record,
          gradeId: null,
          score: null,
          percentage: null,
          remarks: null,
          gradedBy: null,
        });
        toast.success(`Grade of ${fullName(record)} cleared`, {
          action: {
            label: 'Undo',
            onClick: () =>
              restoreGrade.mutate(
                {
                  assessmentId: assessment.id,
                  grade: { studentId: record.studentId, score: record.score, remarks: record.remarks },
                },
                {
                  onSuccess: (roster) => {
                    const restored = roster.records.find((row) => row.studentId === record.studentId);
                    if (restored) replaceRow(index, restored);
                  },
                },
              ),
          },
        });
      },
    });
  };

  if (records.length === 0) {
    return (
      <Card>
        <EmptyState title="No students enrolled in this class" />
      </Card>
    );
  }

  const stats = summarize(records);
  const showReload = save.error?.details?.invalidStudentIds;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card
        padded={false}
        title="Grade sheet"
        description="Leave a score blank to keep the student ungraded."
        actions={
          <span title={canSave ? undefined : SAVE_BLOCKED_HINT}>
            <Button
              type="submit"
              icon={Save}
              isLoading={save.isPending}
              disabled={!canSave || !isDirty || !hasScores}
            >
              Save grades
            </Button>
          </span>
        }
      >
        {(!canSave || errors.root?.server || showReload) && (
          <div className="space-y-3 border-b border-gray-100 px-5 py-3">
            {!canSave && <Alert tone="info">{`You can view this sheet. ${SAVE_BLOCKED_HINT}.`}</Alert>}
            {!showReload && <FormRootError error={errors.root?.server} />}
            {showReload && (
              <Alert tone="error" role="alert">
                <p>The class roster changed while you were grading.</p>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={reload} className="mt-2">
                  Reload sheet
                </Button>
              </Alert>
            )}
          </div>
        )}

        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Grade sheet">
          <Table caption={`Grades for ${assessment.title}`}>
            <THead>
              <Tr>
                <Th>Student</Th>
                <Th>Score (max {formatScore(assessment.maxScore)})</Th>
                <Th hideBelow="md">Remarks</Th>
                <Th align="right" hideBelow="sm">
                  Current
                </Th>
                <Th hideBelow="lg">Graded by</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody onKeyDown={focusNextScore}>
              {records.map((record, index) => {
                const name = fullName(record);
                const scoreError = errors.rows?.[index]?.score?.message;
                const remarksError = errors.rows?.[index]?.remarks?.message;
                return (
                  <Tr key={record.studentId}>
                    <Td>
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">{record.studentNumber}</p>
                    </Td>
                    <Td className="align-top">
                      <Input
                        {...register(`rows.${index}.score`)}
                        data-score-input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max={assessment.maxScore}
                        step="0.01"
                        readOnly={!canSave}
                        aria-label={`Score for ${name}`}
                        aria-invalid={scoreError ? true : undefined}
                        aria-describedby={scoreError ? `score-error-${record.studentId}` : undefined}
                        className="w-28"
                      />
                      {scoreError && (
                        <p id={`score-error-${record.studentId}`} className="mt-1 text-xs text-red-600">
                          {scoreError}
                        </p>
                      )}
                    </Td>
                    <Td hideBelow="md" className="align-top">
                      <Input
                        {...register(`rows.${index}.remarks`)}
                        maxLength={255}
                        readOnly={!canSave}
                        placeholder="Remarks (optional)"
                        aria-label={`Remarks for ${name}`}
                        aria-invalid={remarksError ? true : undefined}
                      />
                      {remarksError && <p className="mt-1 text-xs text-red-600">{remarksError}</p>}
                    </Td>
                    <Td align="right" hideBelow="sm">
                      {formatPercent(record.percentage === null ? null : record.percentage / 100)}
                    </Td>
                    <Td hideBelow="lg">{record.gradedBy ? fullName(record.gradedBy) : '—'}</Td>
                    <Td align="right">
                      {canSave && record.gradeId !== null && (
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Clear grade of ${name}`}
                          onClick={() => clearGrade(record, index)}
                        >
                          Clear
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-gray-100 px-5 py-4 sm:grid-cols-4">
          <Stat label="Graded" value={`${stats.graded} of ${records.length}`} />
          <Stat label="Mean" value={formatPercent(stats.mean)} />
          <Stat label="Highest" value={formatPercent(stats.highest)} />
          <Stat label="Lowest" value={formatPercent(stats.lowest)} />
        </dl>
        {stats.graded > 0 && (
          <div className="border-t border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Score spread</h3>
            <p className="mt-0.5 mb-3 text-xs text-gray-600">
              Students per band of 10 percentage points (the 90 band includes 100).
            </p>
            <BarChart bars={scoreBands(records)} label={`Score spread for ${assessment.title}`} />
          </div>
        )}
      </Card>
    </form>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-lg font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
