import { Alert } from '../../../components/ui/Alert';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { fullName } from '../../../utils/names';
import { useDeleteUser } from '../hooks';

/** What each `details.reason` of a refused DELETE /users/:id means for the admin. */
const REFUSALS = {
  has_history: "This account has school records, so it can't be deleted. Deactivate it instead.",
  self: "You can't delete your own account.",
  last_admin: "This is the last active administrator, so the account can't be deleted.",
};

/**
 * Confirms and deletes an account. The dialog stays open while the request runs and shows the
 * server's refusal (records exist, own account, last administrator) until the admin cancels.
 *
 * @param {object} props
 * @param {{ id: number, firstName: string, lastName: string }} props.user the account (USER id)
 * @param {boolean} props.open
 * @param {() => void} props.onCancel
 * @param {() => void} props.onDeleted called after the account is gone
 */
export function DeleteUserDialog({ user, open, onCancel, onDeleted }) {
  const deleteUser = useDeleteUser();

  const cancel = () => {
    if (deleteUser.isPending) return; // Escape and the backdrop must not abandon a running delete
    deleteUser.reset();
    onCancel();
  };
  const onConfirm = () =>
    deleteUser.mutate(user, {
      onSuccess: () => {
        deleteUser.reset();
        onDeleted();
      },
    });

  return (
    <ConfirmDialog
      open={open}
      title={`Delete ${fullName(user)}?`}
      description="The account and its sign-in are removed permanently. Only an account without school records can be deleted."
      confirmLabel="Delete account"
      isLoading={deleteUser.isPending}
      onConfirm={onConfirm}
      onCancel={cancel}
    >
      {deleteUser.error && (
        <Alert tone="error" role="alert">
          {REFUSALS[deleteUser.error.details?.reason] ?? deleteUser.error.message}
        </Alert>
      )}
    </ConfirmDialog>
  );
}
