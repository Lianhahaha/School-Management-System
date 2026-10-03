import { useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useConfirm } from '../../../hooks/useConfirm';
import { fullName } from '../../../utils/names';
import { roleLabel } from '../../../utils/roles';
import { CreateUserForm } from './CreateUserForm';
import { EditUserForm } from './EditUserForm';

const FORM_ID = 'user-form';

/**
 * Create (any role, with its record fields) or edit (name and phone) an account. Create mode when
 * `user` is not given. The create form asks "Discard changes?" before it closes with unsaved input.
 * Also used by the dashboard's quick-create and by the students and teachers pages.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{ id: number, firstName: string, lastName: string, email: string, phone: string|null, role: string }} [props.user]
 *   the account to edit (a User, with the USER id)
 * @param {'admin'|'teacher'|'student'} [props.lockedRole] fixes the role in create mode
 */
export function UserFormModal({ open, onClose, user, lockedRole }) {
  const confirm = useConfirm();
  const isDirty = useRef(false);
  const isEdit = Boolean(user);

  const requestClose = async () => {
    if (isDirty.current) {
      const discard = await confirm({
        title: 'Discard changes?',
        description: 'The details you entered will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      });
      if (!discard) return;
    }
    isDirty.current = false;
    onClose();
  };

  const title = isEdit
    ? 'Edit user'
    : lockedRole
      ? `Add ${roleLabel(lockedRole).toLowerCase()}`
      : 'Create user';

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={title}
      description={isEdit ? fullName(user) : undefined}
      size={isEdit ? 'md' : 'lg'}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {isEdit ? 'Save changes' : lockedRole ? title : 'Create user'}
          </Button>
        </>
      }
    >
      {isEdit ? (
        <EditUserForm formId={FORM_ID} user={user} onClose={onClose} />
      ) : (
        <CreateUserForm
          formId={FORM_ID}
          lockedRole={lockedRole}
          onClose={() => {
            isDirty.current = false;
            onClose();
          }}
          onDirtyChange={(dirty) => {
            isDirty.current = dirty;
          }}
        />
      )}
    </Modal>
  );
}
