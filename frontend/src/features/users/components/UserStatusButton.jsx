import { Button } from '../../../components/ui/Button';
import { useConfirm } from '../../../hooks/useConfirm';
import { fullName } from '../../../utils/names';
import { useAuth } from '../../auth/hooks';
import { useSetUserStatus } from '../hooks';

const SIGNED_OUT = "They are signed out on their next request and can't sign in until reactivated.";
const DEACTIVATE_DESCRIPTIONS = {
  student: `${SIGNED_OUT} Their current class enrollment is closed as withdrawn, and reactivating the account does not restore it: enroll them again.`,
  default: `${SIGNED_OUT} A teacher with current class assignments can't be deactivated.`,
};

/**
 * Row action that deactivates or reactivates an account behind a confirmation. The server's refusal
 * (a teacher with class assignments, your own account) surfaces as the hook's error toast and the
 * row stays as it was. The signed-in admin's own row is disabled.
 *
 * @param {object} props
 * @param {{ id: number, firstName: string, lastName: string, isActive: boolean, role?: string }} props.user
 *   `id` is the USER id (for a student or teacher row pass `{ ...row, id: row.userId }`); `role` picks the
 *   confirmation text (a student's enrollment is closed)
 */
export function UserStatusButton({ user }) {
  const { me } = useAuth();
  const confirm = useConfirm();
  const setStatus = useSetUserStatus();
  const name = fullName(user);
  const isSelf = me?.id === user.id;

  const onClick = async () => {
    const ok = user.isActive
      ? await confirm({
          title: `Deactivate ${name}?`,
          description: DEACTIVATE_DESCRIPTIONS[user.role] ?? DEACTIVATE_DESCRIPTIONS.default,
          confirmLabel: 'Deactivate',
        })
      : await confirm({
          title: `Activate ${name}?`,
          description: 'They will be able to sign in again.',
          confirmLabel: 'Activate',
          tone: 'primary',
        });
    if (ok) setStatus.mutate({ id: user.id, isActive: !user.isActive });
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      isLoading={setStatus.isPending}
      disabled={isSelf}
      title={isSelf ? "You can't change your own status" : undefined}
      aria-label={`${user.isActive ? 'Deactivate' : 'Activate'} ${name}`}
    >
      {user.isActive ? 'Deactivate' : 'Activate'}
    </Button>
  );
}
