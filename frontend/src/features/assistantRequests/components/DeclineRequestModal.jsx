import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';
import { applyServerErrors } from '../../../lib/formErrors';
import { fullName } from '../../../utils/names';
import { useDeclineAssistantRequest } from '../hooks';
import { declineRequestDefaults, declineRequestSchema } from '../schemas';

const FORM_ID = 'decline-assistant-request-form';
const FIELDS = ['reason'];

function DeclineForm({ request, mutation, onClose }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(declineRequestSchema), defaultValues: declineRequestDefaults });

  const onSubmit = ({ reason }) =>
    mutation
      .mutateAsync({ userId: request.userId, reason })
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField
        label="Reason"
        hint="The applicant reads this when they sign in. Their account stays, without access to the office pages."
        error={errors.reason?.message}
        required
      >
        <Textarea
          {...register('reason')}
          rows={3}
          maxLength={255}
          placeholder="We have enough student assistants this semester."
        />
      </FormField>
    </form>
  );
}

/**
 * Decline a pending student assistant request with a reason (the school office). Closes itself after
 * success; the toast and the list refresh come from useDeclineAssistantRequest.
 *
 * @param {object} props
 * @param {object|null} props.request the request; null while closed
 * @param {() => void} props.onClose
 */
export function DeclineRequestModal({ request, onClose }) {
  const mutation = useDeclineAssistantRequest();
  return (
    <Modal
      open={Boolean(request)}
      onClose={onClose}
      title="Decline request"
      description={request ? `${fullName(request)} asked to be a student assistant.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="danger" isLoading={mutation.isPending}>
            Decline
          </Button>
        </>
      }
    >
      {request && <DeclineForm request={request} mutation={mutation} onClose={onClose} />}
    </Modal>
  );
}
