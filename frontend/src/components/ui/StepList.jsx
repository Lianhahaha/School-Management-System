import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { cx } from '../../utils/cx';
import { Button } from './Button';
import { TextLink } from './TextLink';

/**
 * Numbered steps, each ticked off when done. The first step that is not done is the next one: its
 * number sits on the yellow chip and it gets a button; the other open steps get a quiet link.
 *
 *   <StepList steps={[{ key: 'subjects', title: 'Add subjects', hint: '…', to: '/admin/subjects', isDone: true }]} />
 *
 * @param {object} props
 * @param {Array<{ key: string, title: string, hint?: string, to?: string, isDone: boolean, actionLabel?: string }>} props.steps
 *   `actionLabel` names the button of the next step (default "Start"); a step without `to` has no action
 */
export function StepList({ steps }) {
  const nextKey = steps.find((step) => !step.isDone)?.key;

  return (
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
              {!step.isDone && step.hint && <p className="text-sm text-gray-600">{step.hint}</p>}
            </div>
            {!step.isDone &&
              step.to &&
              (isNext ? (
                <Button as={Link} to={step.to} variant="secondary" size="sm">
                  {step.actionLabel ?? 'Start'}
                </Button>
              ) : (
                <TextLink to={step.to} className="text-sm">
                  Open
                </TextLink>
              ))}
          </li>
        );
      })}
    </ol>
  );
}
