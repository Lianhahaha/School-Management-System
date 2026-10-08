import { PASSING_GRADE } from '../../../constants/shared';
import { countOf } from '../../../utils/format';
import { formatResult, generalAverage, isPassing } from '../../../utils/grades';
import { GradeDescriptor } from './GradeDescriptor';

/** One figure of the overview: a label, the figure, and a line or tag under it. */
function Figure({ label, children, note }) {
  return (
    <div className="grid content-start gap-1.5 rounded-tile bg-gray-50 px-4 py-3.5">
      <span className="text-sm text-gray-600">{label}</span>
      {children}
      {note && <span className="text-xs text-gray-600">{note}</span>}
    </div>
  );
}

/**
 * The top of My grades: the general average with its descriptor, how many subjects pass (75), which need
 * attention, and how many assessments are graded.
 *
 * @param {object} props
 * @param {Array<{ subjectName: string, percentage: number | null }>} props.subjects summary rows of the period
 * @param {number} props.graded how many grades the period has
 * @param {number | null} props.upcoming assessments still ahead in the current class, or null for a past period
 */
export function GradesOverview({ subjects, graded, upcoming }) {
  const average = generalAverage(subjects);
  const withResult = subjects.filter((subject) => subject.percentage !== null);
  const below = withResult.filter((subject) => !isPassing(subject.percentage));

  return (
    <section aria-label="Overview" className="sheet grid grid-cols-2 gap-3 p-4 sm:p-5 xl:grid-cols-4">
      <Figure label="General average">
        <span className="text-[2.5rem] leading-none font-semibold tracking-[-0.02em] text-gray-900 tabular-nums">
          {formatResult(average)}
        </span>
        <GradeDescriptor result={average} className="justify-self-start" />
      </Figure>
      <Figure label="Subjects passed" note={`Passing grade is ${PASSING_GRADE}`}>
        <span className="text-[1.75rem] leading-none font-semibold text-gray-900 tabular-nums">
          {withResult.length - below.length} of {withResult.length}
        </span>
      </Figure>
      <Figure
        label="Needs attention"
        note={below.length ? `Below ${PASSING_GRADE} so far` : 'Every subject is passing'}
      >
        <span className="text-lg leading-snug font-semibold text-gray-900">
          {below.length ? below.map((subject) => subject.subjectName).join(', ') : 'None'}
        </span>
      </Figure>
      <Figure
        label="Graded so far"
        note={upcoming === null ? undefined : `${countOf(upcoming, 'assessment')} still to come`}
      >
        <span className="text-[1.75rem] leading-none font-semibold text-gray-900 tabular-nums">
          {countOf(graded, 'grade')}
        </span>
      </Figure>
    </section>
  );
}
