import { cx } from '../../../utils/cx';
import { formatResult } from '../../../utils/grades';
import { GradeDescriptor } from './GradeDescriptor';

/**
 * The subjects of a period as a list to pick from: name, teacher, grade and descriptor. The chosen one is
 * outlined in ink and announced with aria-current.
 *
 * @param {object} props
 * @param {Array<{ classSubjectId: number, subjectName: string, percentage: number | null }>} props.subjects
 * @param {number} props.selectedId classSubjectId of the subject shown
 * @param {(classSubjectId: number) => void} props.onSelect
 * @param {(classSubjectId: number) => string} props.teacherOf the teacher's name, or ''
 */
export function SubjectResultList({ subjects, selectedId, onSelect, teacherOf }) {
  return (
    <nav aria-label="Subjects">
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
        {subjects.map((subject) => {
          const selected = subject.classSubjectId === selectedId;
          return (
            <li key={subject.classSubjectId}>
              <button
                type="button"
                onClick={() => onSelect(subject.classSubjectId)}
                aria-current={selected ? 'true' : undefined}
                className={cx(
                  'grid w-full grid-cols-1 gap-y-1 rounded-tile bg-surface px-4 py-3 text-left shadow-card transition-colors hover:bg-gray-50',
                  selected && 'ring-2 ring-gray-900 ring-inset',
                )}
              >
                {/* Two separate lines, so a long descriptor never narrows the subject's name above it; the
                    descriptor moves under the teacher when they don't fit side by side. */}
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
                    {subject.subjectName}
                  </span>
                  <span className="shrink-0 text-lg font-semibold text-gray-900 tabular-nums">
                    {formatResult(subject.percentage)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-gray-600">{teacherOf(subject.classSubjectId)}</span>
                  {subject.percentage !== null ? (
                    <GradeDescriptor result={subject.percentage} className="ml-auto" />
                  ) : (
                    <span className="ml-auto text-xs text-gray-500">Not graded yet</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
