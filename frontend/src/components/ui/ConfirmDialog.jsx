import { Button } from './Button';
import { Modal } from './Modal';

/**
 * Controlled confirmation dialog. Most code should call `useConfirm()` instead; use this component
 * directly when the dialog must stay open while the request runs, or show the server's refusal:
 *
 *   <ConfirmDialog open={target !== null} title={`Deactivate ${fullName(target)}?`}
 *     description="They are signed out on their next request."
 *     confirmLabel="Deactivate" isLoading={mutation.isPending}
 *     onConfirm={() => mutation.mutate(target.id)} onCancel={() => setTarget(null)}>
 *     {mutation.error && <Alert tone="error" role="alert">{mutation.error.message}</Alert>}
 *   </ConfirmDialog>
 *
 * Focus starts on Cancel for the danger tone, so Enter never destroys anything by accident.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title name the object and the consequence
 * @param {string} [props.description]
 * @param {string} [props.confirmLabel] the verb of the action ("Delete", "Withdraw"), never "OK"
 * @param {string} [props.cancelLabel]
 * @param {'danger'|'primary'} [props.tone]
 * @param {boolean} [props.isLoading] spinner on the confirm button, both buttons disabled
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel also called for Escape and backdrop clicks
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}) {
  const isDanger = tone === 'danger';

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            data-autofocus={isDanger ? '' : undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            data-autofocus={isDanger ? undefined : ''}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
