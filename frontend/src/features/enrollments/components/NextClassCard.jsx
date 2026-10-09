import {
  ArrowFatLinesUpIcon,
  ArrowCounterClockwiseIcon,
  ConfettiIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatResult } from '../../../utils/grades';
import { GradeDescriptor } from '../../grades/components/GradeDescriptor';
import { useNextClass } from '../hooks';
import { SectionPicker } from './SectionPicker';

/** "Math (72) and English (70)": failed subjects with their grades. */
const listSubjects = (subjects) => {
  const parts = subjects.map((subject) => `${subject.subjectName} (${formatResult(subject.percentage)})`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
};

/** Title, icon, colour and text of each standing that has something to say (see NEXT_CLASS_STANDINGS). */
function copyOf(standing) {
  const { lastClass, gradeLevel, academicYear, failedSubjects } = standing;
  const pick = `Pick your Grade ${gradeLevel} section for ${academicYear}.`;
  switch (standing.status) {
    case 'promoted':
      return {
        icon: ArrowFatLinesUpIcon,
        mark: 'sage',
        title: `You passed Grade ${lastClass.gradeLevel}`,
        description: `You passed every subject in ${lastClass.academicYear}. ${pick}`,
      };
    case 'retained':
      return {
        icon: ArrowCounterClockwiseIcon,
        mark: 'oxblood',
        title: `You'll take Grade ${lastClass.gradeLevel} again`,
        description: `You didn't pass ${listSubjects(failedSubjects)} in ${lastClass.academicYear}. ${pick}`,
      };
    case 'remedial':
      return {
        icon: WarningIcon,
        mark: 'oxblood',
        title: 'Remedial classes first',
        description: `You need to pass remedial classes in ${listSubjects(failedSubjects)} before Grade ${
          lastClass.gradeLevel + 1
        }. The school office enrolls you once you do.`,
      };
    case 'finished':
      return {
        icon: ConfettiIcon,
        mark: 'sage',
        title: `You finished Grade ${lastClass.gradeLevel}`,
        description: 'Congratulations. There is no higher grade level to enroll in.',
      };
    default:
      return null;
  }
}

/**
 * A student without a class and their next step, from GET /enrollments/next-class: their last year's general
 * average and, when they may enroll themselves (promoted or retained), the sections to pick from. Renders
 * nothing for the standings an admin handles alone (`enrolled`, `needs_placement`).
 *
 * @param {object} props
 * @param {object} props.standing the next-class standing
 */
export function NextClassCard({ standing }) {
  const copy = copyOf(standing);
  if (!copy) return null;
  const canEnroll = standing.status === 'promoted' || standing.status === 'retained';

  return (
    <Card icon={copy.icon} mark={copy.mark} title={copy.title} description={copy.description}>
      <div className="space-y-4">
        {standing.generalAverage !== null && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            General average in {standing.lastClass.academicYear}
            <span className="font-semibold text-gray-900 tabular-nums">
              {formatResult(standing.generalAverage)}
            </span>
            <GradeDescriptor result={standing.generalAverage} />
          </p>
        )}
        {canEnroll &&
          (standing.classes.length > 0 ? (
            <SectionPicker classes={standing.classes} />
          ) : (
            <p className="rounded-tile bg-gray-50 px-4 py-3 text-sm text-gray-700">
              The school hasn't opened Grade {standing.gradeLevel} sections for {standing.academicYear} yet.
              Check back soon.
            </p>
          ))}
      </div>
    </Card>
  );
}

/**
 * For a student without a class: their next step for next year (NextClassCard), or `fallback` when the
 * school places them (no completed year to judge). Fetches the standing itself.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.fallback shown for `needs_placement`
 */
export function NextClassStep({ fallback }) {
  const { data, error, isPending, refetch } = useNextClass();
  if (error) {
    return (
      <ErrorState title="Couldn't load your next school year" message={error.message} onRetry={refetch} />
    );
  }
  if (isPending) return <Skeleton className="h-40 w-full" />;
  return copyOf(data) ? <NextClassCard standing={data} /> : fallback;
}
