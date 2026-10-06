import { cx } from '../../../utils/cx';

const Stack = ({ children }) => <div className="flex min-w-0 flex-col gap-6">{children}</div>;

/**
 * The sheets of a dashboard in up to three columns that follow the room the page has (a container
 * query, so the sidebar and browser zoom count), not the screen: one column on phones, two from
 * 48rem, three from 72rem. Each column is its own stack, so sheets of different heights leave no gaps.
 * With two columns the second and third stacks share the right column; on a phone the stacks follow
 * each other in order, so `first` holds what matters most.
 * @param {object} props
 * @param {import('react').ReactNode} props.first
 * @param {import('react').ReactNode} props.second
 * @param {import('react').ReactNode} props.third
 * @param {boolean} [props.wideFirst] the first column takes more room with three columns (a timeline)
 */
export function DashboardColumns({ first, second, third, wideFirst = false }) {
  return (
    <div className="@container">
      <div
        className={cx(
          'grid items-start gap-6 @3xl:grid-cols-2',
          wideFirst ? '@6xl:grid-cols-[1.35fr_1fr_1fr]' : '@6xl:grid-cols-3',
        )}
      >
        <Stack>{first}</Stack>
        <div className="flex min-w-0 flex-col gap-6 @6xl:contents">
          <Stack>{second}</Stack>
          <Stack>{third}</Stack>
        </div>
      </div>
    </div>
  );
}
