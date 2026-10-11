import { Card } from '../../../components/ui/Card';
import { TBody, THead, Table, Td, Th, Tr } from '../../../components/ui/Table';
import { cx } from '../../../utils/cx';
import { formatResult, isPassing, remarksOf } from '../../../utils/grades';
import { gradeColumnsOf, periodTitle } from '../periods';
import { GradeDescriptor } from './GradeDescriptor';

/** A grade as the report card writes it (a dash without one), in bold attention ink below the passing grade. */
function Grade({ result }) {
  const failing = result !== null && !isPassing(result);
  return <span className={cx(failing && 'font-semibold text-attention-ink')}>{formatResult(result)}</span>;
}

/**
 * The grades of a school year's semester or of the whole year as one table, a row per subject: the grade of
 * each period in it (the four quarters, Q1 to Q4, of a semester; the 1st and 2nd Semester of the whole year),
 * the final grade (their average) and Passed / Failed, with the general average and its DepEd descriptor at
 * the bottom. The teacher is on the subject cards beside it, not repeated here. The chosen subject's row is
 * marked with an ink bar and aria-current.
 *
 * @param {object} props
 * @param {Array<{ classSubjectId: number, subjectName: string, percentage: number | null,
 *   quarters?: Record<string, number | null>, semesters?: Record<string, number | null> }>} props.subjects one
 *   row per class-subject: the summary rows of a semester (`quarters`), or wholeYearRows (`semesters`)
 * @param {number | null} props.average the general average of the same period
 * @param {string} props.academicYear
 * @param {string} [props.semester] 'sem1' or 'sem2' for one semester; omit for the whole year
 * @param {number} props.selectedId classSubjectId of the chosen subject
 * @param {(classSubjectId: number) => string} props.rowIdOf the id of a subject's row, for the page to scroll to
 */
export function QuarterGradesTable({ subjects, average, academicYear, semester = '', selectedId, rowIdOf }) {
  const columns = gradeColumnsOf(semester);
  const title = semester ? 'Grades by quarter' : 'Grades by semester';
  const period = periodTitle(academicYear, semester);
  // The general average sits under the final grade, after the subject and the period columns.
  const labelSpan = 1 + columns.length;

  return (
    <Card title={title} description={period} padded={false}>
      <div className="relative overflow-x-auto pb-1" tabIndex={0} role="region" aria-label={title}>
        <Table caption={`${title}, ${period}`}>
          <THead>
            <Tr>
              <Th>Subject</Th>
              {columns.map((column) => (
                <Th key={column.key} align="right">
                  {column.header}
                </Th>
              ))}
              <Th align="right">Final</Th>
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
                  {columns.map((column) => (
                    <Td key={column.key} align="right">
                      <Grade result={column.gradeOf(subject)} />
                    </Td>
                  ))}
                  <Td align="right" className="text-gray-900">
                    <Grade result={subject.percentage} />
                  </Td>
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
