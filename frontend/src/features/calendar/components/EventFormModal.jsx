import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { Textarea } from '../../../components/ui/Textarea';
import { CALENDAR_EVENT_TYPE_OPTIONS } from '../../../constants/ui';
import { useDiscardConfirm } from '../../../hooks/useDiscardConfirm';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '../hooks';
import { createEventSchema, eventDefaults, updateEventSchema } from '../schemas';

const FORM_ID = 'calendar-event-form';
const FIELDS = ['title', 'description', 'type', 'startsOn', 'endsOn'];

/** The PATCH body: the changed fields, with both dates whenever one of them changed (they are checked together). */
function changedBody(values, dirtyFields) {
  const body = changedFields(values, dirtyFields);
  if (dirtyFields.startsOn || dirtyFields.endsOn) {
    body.startsOn = values.startsOn;
    body.endsOn = values.endsOn;
  }
  return body;
}

function EventForm({ event, startsOn, mutation, onClose, trackDirty }) {
  const isEdit = Boolean(event);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({
    resolver: zodResolver(isEdit ? updateEventSchema : createEventSchema),
    defaultValues: eventDefaults(event, startsOn),
  });

  useEffect(() => trackDirty(isDirty), [isDirty, trackDirty]);

  const onSubmit = (values) => {
    if (isEdit && !isDirty) return onClose();
    const request = isEdit
      ? mutation.mutateAsync({ id: event.id, body: changedBody(values, dirtyFields) })
      : mutation.mutateAsync(values);
    return request
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField label="Title" error={errors.title?.message} required>
        <Input {...register('title')} maxLength={150} placeholder="Christmas break" />
      </FormField>
      <RadioGroup legend="Kind" options={CALENDAR_EVENT_TYPE_OPTIONS} {...register('type')} />
      <p className="-mt-2 text-xs text-gray-500">
        On a day with no classes, attendance can&apos;t be marked. A school event leaves classes as usual.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First day" error={errors.startsOn?.message} required>
          <Input {...register('startsOn')} type="date" />
        </FormField>
        <FormField label="Last day" hint="Leave empty for a single day." error={errors.endsOn?.message}>
          <Input {...register('endsOn')} type="date" />
        </FormField>
      </div>
      <FormField label="Details" hint="Optional." error={errors.description?.message}>
        <Textarea {...register('description')} rows={3} maxLength={500} />
      </FormField>
    </form>
  );
}

/**
 * Add or edit a calendar entry (admin): a holiday (no classes) or a school event, one day or a range.
 * Closes itself after a successful save; a dirty form asks "Discard changes?" before closing.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} [props.event] the entry to edit
 * @param {string} [props.startsOn] first day of a new entry ('YYYY-MM-DD'), for example the day clicked
 */
export function EventFormModal({ open, onClose, event = null, startsOn = '' }) {
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const { requestClose, trackDirty } = useDiscardConfirm(onClose);
  const isEdit = Boolean(event);
  const mutation = isEdit ? updateEvent : createEvent;

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={isEdit ? 'Edit calendar entry' : 'Add to the calendar'}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      }
    >
      <EventForm
        event={event}
        startsOn={startsOn}
        mutation={mutation}
        onClose={onClose}
        trackDirty={trackDirty}
      />
    </Modal>
  );
}
