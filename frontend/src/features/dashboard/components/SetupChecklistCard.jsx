import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { TextLink } from '../../../components/ui/TextLink';
import { cx } from '../../../utils/cx';

/**
 * The order a new school is set up in. Each step needs the ones before it (a teacher assignment needs
 * a teacher, a subject and a class), so the first step that is not done is the one to do next.
 * `done` reads the admin dashboard's `counts`.
 */
const STEPS = [
  {
    key: 'teachers',
    title: 'Add teachers',
    hint: 'Create a teacher account for each teacher under Users.',
    to: '/admin/users?role=teacher',
    done: (counts) => counts.teachers > 0,
  },
  {
    key: 'subjects',
    title: 'Add subjects',
    hint: 'The subjects your school teaches, such as Maths and English.',
    to: '/admin/subjects',
    done: (counts) => counts.subjects > 0,
  },
  {
    key: 'classes',
    title: "Create this year's classes",
    hint: 'One class per group of students, for example Grade 10 - A.',
    to: '/admin/classes',
    done: (counts) => counts.classes > 0,
  },
  {
    key: 'teacherAssignments',
    title: 'Assign teachers to subjects',
    hint: 'Open a class and add its subjects, each with the teacher who teaches it.',
    to: '/admin/classes',
    done: (counts) => counts.teacherAssignments > 0,
  },
  {
    key: 'enrollments',
    title: 'Enroll students',
    hint: 'Put each student in a class. Students can also sign up by themselves.',
    to: '/admin/students?hasActiveEnrollment=false&isActive=true',
    done: (counts) => counts.activeEnrollments > 0,
  },
  {
    key: 'timetable',
    title: 'Build the timetable',
    hint: 'Open a class and add its weekly lessons on the Schedule tab.',
    to: '/admin/classes',
    done: (counts) => counts.timetableSlots > 0,
  },
];

/**
 * "Set up your school" on the admin dashboard while any step is still to do: the steps in order,
 * each ticked off from live counts, with a button on the next one. It disappears once all are done.
 *
 * @param {object} props
 * @param {object} props.counts the admin dashboard's `counts`
 */
export function SetupChecklistCard({ counts }) {
  const steps = STEPS.map((step) => ({ ...step, isDone: step.done(counts) }));
  const doneCount = steps.filter((step) => step.isDone).length;
  if (doneCount === steps.length) return null;
  const nextKey = steps.find((step) => !step.isDone).key;

  return (
    <Card
      title="Set up your school"
      total={`${doneCount} of ${steps.length} done`}
      description="Work through these in order; each step needs the ones before it."
    >
      <ol className="divide-y divide-gray-200">
        {steps.map((step, index) => {
          const isNext = step.key === nextKey;
          return (
            <li key={step.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                aria-hidden="true"
                className={cx(
                  'tabular flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  step.isDone
                    ? 'bg-gray-900 text-gray-50'
                    : isNext
                      ? 'bg-accent text-accent-ink'
                      : 'bg-gray-100 text-gray-600',
                )}
              >
                {step.isDone ? <Check className="size-4" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cx(
                    'text-[0.9375rem] font-medium',
                    step.isDone ? 'text-gray-500' : 'text-gray-900',
                  )}
                >
                  {step.title}
                  <span className="sr-only">
                    {step.isDone ? ' (done)' : isNext ? ' (next step)' : ' (to do)'}
                  </span>
                </p>
                {!step.isDone && <p className="text-sm text-gray-600">{step.hint}</p>}
              </div>
              {isNext ? (
                <Button as={Link} to={step.to} variant="secondary" size="sm">
                  Start
                </Button>
              ) : (
                !step.isDone && (
                  <TextLink to={step.to} className="text-sm">
                    Open
                  </TextLink>
                )
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
