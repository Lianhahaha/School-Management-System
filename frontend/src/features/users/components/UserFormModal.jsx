import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useDiscardConfirm } from '../../../hooks/useDiscardConfirm';
import { fullName } from '../../../utils/names';
import { roleLabel } from '../../../utils/roles';
import { useAuth } from '../../auth/hooks';
import { useCreateUser, useUpdateUser } from '../hooks';
import { CreateUserForm } from './CreateUserForm';
import { DeleteUserDialog } from './DeleteUserDialog';
import { EditUserForm } from './EditUserForm';

const FORM_ID = 'user-form';

/**
 * Create (any role, with its record fields) or edit (name and phone) an account. Create mode when
 * `user` is not given. The create form asks "Discard changes?" before it closes with unsaved input.
 * Edit mode also offers "Delete account" (not on the signed-in admin's own account); after a delete
 * the modal closes. Also used in create mode by the students and teachers pages.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{ id: number, firstName: string, lastName: string, email: string, phone: string|null, role: string }} [props.user]
 *   the account to edit (a User, with the USER id)
 * @param {'admin'|'teacher'|'student'} [props.lockedRole] fixes the role in create mode
 */
export function UserFormModal({ open, onClose, user, lockedRole }) {
  const { me } = useAuth();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { requestClose, trackDirty } = useDiscardConfirm(onClose);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isEdit = Boolean(user);
  const mutation = isEdit ? updateUser : createUser;
  const canDelete = isEdit && user.id !== me?.id;

  const title = isEdit
    ? 'Edit user'
    : lockedRole
      ? `Add ${roleLabel(lockedRole).toLowerCase()}`
      : 'Create user';

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title={title}
        description={isEdit ? fullName(user) : undefined}
        size={isEdit ? 'md' : 'lg'}
        footer={
          <>
            {canDelete && (
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => setIsConfirmingDelete(true)}
                className="mr-auto"
              >
                Delete account
              </Button>
            )}
            <Button variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
              {isEdit ? 'Save changes' : lockedRole ? title : 'Create user'}
            </Button>
          </>
        }
      >
        {isEdit ? (
          <EditUserForm formId={FORM_ID} user={user} mutation={updateUser} onClose={onClose} />
        ) : (
          <CreateUserForm
            formId={FORM_ID}
            lockedRole={lockedRole}
            mutation={createUser}
            onClose={onClose}
            trackDirty={trackDirty}
          />
        )}
      </Modal>
      {canDelete && (
        <DeleteUserDialog
          user={user}
          open={isConfirmingDelete}
          onCancel={() => setIsConfirmingDelete(false)}
          onDeleted={() => {
            setIsConfirmingDelete(false);
            onClose();
            // The row (and the Edit button that opened the modal) is gone, so focus would fall to <body>.
            requestAnimationFrame(() => document.getElementById('main')?.focus());
          }}
        />
      )}
    </>
  );
}
