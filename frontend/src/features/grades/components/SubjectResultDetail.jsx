import { DataTable } from '../../../components/ui/DataTable';
import { ASSESSMENT_TYPES, COMPONENT_OF_TYPE, GRADING_COMPONENTS } from '../../../constants/shared';
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
  percentageByType,
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

/**
 * The parts of a subject's grade, one bar each: the K-12 components with their weights, or the assessment types
 * graded so far (with their weights in a weighted subject; a weighted type not graded yet shows "Not yet").
 * @returns {Array<{ key: string, label: string, weight: number | null, percentage: number | null }>}
 */
function partsOf(subject, grades) {
  if (subject.method === 'k12') {
    return subject.components.map((part) => ({
      key: part.component,
      label: COMPONENT_LABELS[part.component],
      weight: part.weight,
      percentage: part.percentage,
    }));
  }
  const byType = percentageByType(grades);
  const weights = subject.method === 'weighted' ? subject.gradeWeights : null;
  return ASSESSMENT_TYPES.filter((type) => (weights ? weights[type] > 0 : type in byType)).map((type) => ({
    key: type,
    label: ASSESSMENT_TYPE_LABELS[type],
    weight: weights?.[type] ?? null,
    percentage: byType[type] ?? null,
  }));
}

/** One part of the grade: its name (and weight), a bar and its percentage, red below the passing mark. */
function PartBar({ part, passMark }) {
  const low = part.percentage !== null && part.percentage < passMark;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[13rem_minmax(0,1fr)_3.5rem]">
      <span className="text-sm text-gray-700">
        {part.label}
        {part.weight !== null && ` · ${part.weight}%`}
      </span>
      <span className="text-right text-sm font-semibold text-gray-900 tabular-nums sm:order-last">
        {part.percentage === null ? 'Not yet' : formatPercentage(part.percentage)}
      </span>
      <div
        role="meter"
        aria-label={part.label}
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

/** How the grade was worked out, in one sentence, from the parts its bars show. */
function workings(subject, parts) {
  if (subject.method === 'points') {
    return `All points scored divided by all points possible: ${formatScore(subject.totalScore, subject.totalMaxScore)}.`;
  }
  const counted = parts.filter((part) => part.percentage !== null);
  if (!counted.length) return 'Nothing is graded yet.';
  const terms = counted.map((part) => `${formatResult(part.percentage)} × ${part.weight}%`).join(' + ');
  const partial =
    counted.length < parts.length
      ? `, over the ${subject.method === 'k12' ? 'components' : 'types'} graded so far`
      : '';
  return subject.method === 'k12'
    ? `Initial grade ${formatResult(subject.initialGrade)} = ${terms}${partial}; transmuted to ${formatResult(subject.percentage)} on the 60–100 scale.`
    : `Result ${formatResult(subject.percentage)} = ${terms}${partial}.`;
}

/**
 * One subject in detail: its grade and descriptor, a bar per part of the grade (K-12 components or assessment
 * types), how it was worked out and every graded assessment (grouped by component for K-12).
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
  const passMark = passMarkOf(subject.method);
  const parts = partsOf(subject, grades);

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

      <div className="grid gap-3">
        {parts.map((part) => (
          <PartBar key={part.key} part={part} passMark={passMark} />
        ))}
      </div>
      <p className="text-xs text-gray-600">{workings(subject, parts)}</p>

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
