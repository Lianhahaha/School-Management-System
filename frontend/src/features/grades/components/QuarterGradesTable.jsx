import { Card } from '../../../components/ui/Card';
import { TBody, THead, Table, Td, Th, Tr } from '../../../components/ui/Table';
import { TERMS } from '../../../constants/shared';
import { TERM_LABELS, TERM_SHORT_LABELS } from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { formatResult, generalAverage, isPassing, remarksOf } from '../../../utils/grades';
import { schoolYearLabel } from '../../enrollments/schoolYears';
import { GradeDescriptor } from './GradeDescriptor';

/** A grade as the report card writes it (a dash without one), in bold attention ink below the passing grade. */
function Grade({ result }) {
  const failing = result !== null && !isPassing(result);
  return <span className={cx(failing && 'font-semibold text-attention-ink')}>{formatResult(result)}</span>;
}

/**
 * The grades of a school year as one table, a row per subject: its teacher, its quarterly grades (Q1 to Q4),
 * the final grade (their average) and Passed / Failed, with the general average and its DepEd descriptor at
 * the bottom. For one quarter only that quarter's column is shown, and it is the grade. The chosen subject's
 * row is marked with an ink bar and aria-current.
 *
 * @param {object} props
 * @param {Array<{ classSubjectId: number, subjectName: string, percentage: number | null,
 *   quarters: Record<string, number | null> }>} props.subjects summary rows (GET /grades/summary?groupBy=classSubject)
 * @param {string} props.academicYear
 * @param {string} [props.term] 'term1' to 'term4' for one quarter; omit for the whole year
 * @param {number} props.selectedId classSubjectId of the chosen subject
 * @param {(classSubjectId: number) => string} props.teacherOf the teacher's name, or ''
 * @param {(classSubjectId: number) => string} props.rowIdOf the id of a subject's row, for the page to scroll to
 */
export function QuarterGradesTable({ subjects, academicYear, term, selectedId, teacherOf, rowIdOf }) {
  const quarters = term ? [term] : TERMS;
  const average = generalAverage(subjects);
  // The general average sits under the last grade column: the final grade, or the one quarter shown.
  const labelSpan = 1 + quarters.length + (term ? 0 : 1);
  const period = term
    ? `${schoolYearLabel(academicYear)} · ${TERM_LABELS[term]}`
    : schoolYearLabel(academicYear);

  return (
    <Card title="Grades by quarter" description={period} padded={false}>
      <div
        className="relative overflow-x-auto pb-1"
        tabIndex={0}
        role="region"
        aria-label="Grades by quarter"
      >
        <Table caption={`Grades by quarter, ${period}`}>
          <THead>
            <Tr>
              <Th>Subject</Th>
              <Th>Teacher</Th>
              {quarters.map((quarter) => (
                <Th key={quarter} align="right">
                  {TERM_SHORT_LABELS[quarter]}
                </Th>
              ))}
              {!term && <Th align="right">Final</Th>}
              <Th>Remarks</Th>
            </Tr>
          </THead>
          <TBody>
            {subjects.map((subject) => {
              const selected = subject.classSubjectId === selectedId;
              return (
                <Tr
                  key={subject.classSubjectId}
                  id={rowIdOf(subject.classSubjectId)}
                  aria-current={selected ? 'true' : undefined}
                  className={cx('scroll-m-4', selected && 'bg-gray-50')}
                >
                  <Td
                    className={cx(
                      'whitespace-nowrap text-gray-900',
                      selected ? 'font-semibold shadow-[inset_3px_0_0_var(--color-gray-900)]' : 'font-medium',
                    )}
                  >
                    {subject.subjectName}
                  </Td>
                  <Td className="whitespace-nowrap">{teacherOf(subject.classSubjectId) || '—'}</Td>
                  {quarters.map((quarter) => (
                    <Td key={quarter} align="right">
                      <Grade result={subject.quarters?.[quarter] ?? null} />
                    </Td>
                  ))}
                  {!term && (
                    <Td align="right" className="text-gray-900">
                      <Grade result={subject.percentage} />
                    </Td>
                  )}
                  <Td>{remarksOf(subject.percentage)}</Td>
                </Tr>
              );
            })}
          </TBody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <Td colSpan={labelSpan} className="font-semibold text-gray-900">
                General average
              </Td>
              <Td align="right" className="font-semibold text-gray-900">
                <Grade result={average} />
              </Td>
              <Td>
                <GradeDescriptor result={average} />
              </Td>
            </tr>
          </tfoot>
        </Table>
      </div>
    </Card>
  );
}
