import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';
import { formatScore } from '../../../utils/format';
import { formatPercentage, formatPeriod } from '../../../utils/grades';

const COLUMNS = [
  {
    key: 'title',
    header: 'Assessment',
    cell: (row) => (
      <span className="font-medium text-gray-900">
        {row.assessment.title}
        <span className="ml-2 text-xs font-normal text-gray-500">
          {ASSESSMENT_TYPE_LABELS[row.assessment.type]}
        </span>
      </span>
    ),
  },
  {
    key: 'period',
    header: 'Period',
    cell: (row) => (
      <span className="whitespace-nowrap">{formatPeriod(row.assessment.semester, row.assessment.term)}</span>
    ),
  },
  {
    key: 'assessedOn',
    header: 'Date',
    cell: (row) => (
      <time dateTime={row.assessment.assessedOn} className="whitespace-nowrap">
        {formatDate(row.assessment.assessedOn)}
      </time>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    cell: (row) => formatScore(row.score, row.assessment.maxScore),
  },
  { key: 'percentage', header: 'Percent', align: 'right', cell: (row) => formatPercentage(row.percentage) },
];

/**
 * The scores behind one subject's grades: every graded assessment of the period shown, in one table, and the
 * next assessment if one is coming up.
 *
 * @param {object} props
 * @param {string} props.subjectName
 * @param {object[]} props.grades the subject's grades (GET /grades), newest first
 * @param {{ title: string, assessedOn: string } | undefined} props.next the next assessment, if any
 */
export function SubjectScores({ subjectName, grades, next }) {
  return (
    <section aria-labelledby="subject-scores-heading" className="grid min-w-0 gap-2">
      <h2 id="subject-scores-heading" className="text-base font-semibold text-gray-900">
        Scores of {subjectName}
      </h2>
      <DataTable
        label={`Scores of ${subjectName}`}
        columns={COLUMNS}
        rows={grades}
        rowKey="id"
        emptyState={<EmptyState title="No scores yet" description="Graded assessments will appear here." />}
      />
      {next && (
        <p className="text-sm text-gray-600">
          Coming up: {next.title} · <time dateTime={next.assessedOn}>{formatDate(next.assessedOn)}</time>
        </p>
      )}
    </section>
  );
}
