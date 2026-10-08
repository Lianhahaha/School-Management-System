import { DataTable } from '../../../components/ui/DataTable';
import { TrendChart } from '../../../components/ui/TrendChart';
import { COMPONENT_OF_TYPE, GRADING_COMPONENTS } from '../../../constants/shared';
import { ASSESSMENT_TYPE_LABELS, COMPONENT_LABELS } from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { formatDate } from '../../../utils/date';
import { formatScore } from '../../../utils/format';
import {
  describeGrading,
  formatPercentage,
  formatResult,
  groupBy,
  passMarkOf,
  resultWidth,
} from '../../../utils/grades';
import { GradeDescriptor } from './GradeDescriptor';

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
    key: 'assessedOn',
    header: 'Date',
    cell: (row) => <time dateTime={row.assessment.assessedOn}>{formatDate(row.assessment.assessedOn)}</time>,
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    cell: (row) => formatScore(row.score, row.assessment.maxScore),
  },
  {
    key: 'percentage',
    header: 'Percent',
    align: 'right',
    hideBelow: 'sm',
    cell: (row) => formatPercentage(row.percentage),
  },
  { key: 'remarks', header: 'Remarks', hideBelow: 'md', cell: (row) => row.remarks ?? '—' },
];

/** One component's share of the grade: its name and weight, a bar and its percentage (below 60 % in red). */
function ComponentBar({ part }) {
  const low = part.percentage !== null && part.percentage < passMarkOf('k12');
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[13rem_minmax(0,1fr)_3.5rem]">
      <span className="text-sm text-gray-700">
        {COMPONENT_LABELS[part.component]} · {part.weight}%
      </span>
      <span className="text-right text-sm font-semibold text-gray-900 tabular-nums sm:order-last">
        {part.percentage === null ? 'Not yet' : formatPercentage(part.percentage)}
      </span>
      <div
        role="meter"
        aria-label={`${COMPONENT_LABELS[part.component]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={part.percentage ?? undefined}
        className="col-span-2 h-1.5 overflow-hidden rounded-full bg-gray-200 sm:col-span-1"
      >
        <div
          className={cx('h-full', low ? 'bg-mark-oxblood' : 'bg-gray-900')}
          style={{ width: resultWidth(part.percentage) }}
        />
      </div>
    </div>
  );
}

/** How the grade was worked out, in one sentence. */
function workings(subject) {
  if (subject.method !== 'k12') {
    return subject.method === 'weighted'
      ? `Each assessment type counts with its weight: ${describeGrading(subject)}.`
      : `All points scored divided by all points possible: ${formatScore(subject.totalScore, subject.totalMaxScore)}.`;
  }
  const counted = subject.components.filter((part) => part.percentage !== null);
  if (!counted.length) return 'Nothing is graded yet.';
  const terms = counted.map((part) => `${formatResult(part.percentage)} × ${part.weight}%`).join(' + ');
  const partial = counted.length < subject.components.length;
  return `Initial grade ${formatResult(subject.initialGrade)} = ${terms}${
    partial ? ', over the components graded so far' : ''
  }; transmuted to ${formatResult(subject.percentage)} on the 60–100 scale.`;
}

/**
 * One subject in detail: its grade and descriptor, the components that make it up (K-12), how it was worked
 * out, its results over time and every graded assessment (grouped by component for K-12).
 *
 * @param {object} props
 * @param {object} props.subject a summary row (GET /grades/summary?groupBy=classSubject)
 * @param {object[]} props.grades this subject's grades, newest first
 * @param {string} props.teacher
 * @param {{ title: string, assessedOn: string } | undefined} props.next the next assessment, if any
 */
export function SubjectResultDetail({ subject, grades, teacher, next }) {
  const isK12 = subject.method === 'k12';
  const sections = isK12
    ? GRADING_COMPONENTS.map((component) => [
        COMPONENT_LABELS[component],
        groupBy(grades, (grade) => COMPONENT_OF_TYPE[grade.assessment.type]).get(component) ?? [],
      ]).filter(([, rows]) => rows.length > 0)
    : [['Assessments', grades]];
  const oldestFirst = [...grades].reverse();

  return (
    <section
      id="subject-detail"
      aria-labelledby="subject-detail-heading"
      className="sheet grid min-w-0 scroll-mt-4 gap-5 p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="subject-detail-heading" className="text-lg font-semibold text-gray-900">
            {subject.subjectName}
          </h2>
          <p className="text-sm text-gray-600">
            {[teacher, subject.className, describeGrading(subject)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[2.5rem] leading-none font-semibold text-gray-900 tabular-nums">
            {formatResult(subject.percentage)}
          </span>
          <GradeDescriptor result={subject.percentage} />
        </div>
      </header>

      {isK12 && (
        <div className="grid gap-3">
          {subject.components.map((part) => (
            <ComponentBar key={part.component} part={part} />
          ))}
        </div>
      )}
      <p className="text-xs text-gray-600">{workings(subject)}</p>

      {oldestFirst.length > 1 && (
        <div className="grid gap-1.5">
          <h3 className="text-xs font-semibold tracking-[0.04em] text-gray-600 uppercase">
            Results over time · dashed line {passMarkOf(subject.method)}%
          </h3>
          <TrendChart
            compact
            height={44}
            label={`${subject.subjectName} results over time`}
            points={oldestFirst.map((grade) => ({
              label: `${grade.assessment.title}, ${formatDate(grade.assessment.assessedOn)}`,
              value: grade.percentage,
            }))}
            threshold={passMarkOf(subject.method)}
            formatValue={formatPercentage}
          />
        </div>
      )}

      {sections.map(([title, rows]) => (
        <div key={title} className="grid gap-1.5">
          <h3 className="text-xs font-semibold tracking-[0.04em] text-gray-600 uppercase">{title}</h3>
          <DataTable label={`${subject.subjectName}: ${title}`} columns={COLUMNS} rows={rows} rowKey="id" />
        </div>
      ))}
      {next && (
        <p className="text-sm text-gray-600">
          Coming up: {next.title} · <time dateTime={next.assessedOn}>{formatDate(next.assessedOn)}</time>
        </p>
      )}
    </section>
  );
}
