import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { ANNOUNCEMENT_AUDIENCE_OPTIONS } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { useAuth } from '../../auth/hooks';
import { ClassSelect } from '../../classes/components/ClassSelect';
import { useCreateAnnouncement, useUpdateAnnouncement } from '../hooks';
import { announcementDefaults, createAnnouncementSchema, updateAnnouncementSchema } from '../schemas';

const FORM_ID = 'announcement-form';
const BODY_MAX_LENGTH = 5000;
const FIELDS = ['title', 'body', 'audience', 'classId', 'publishedAt', 'expiresAt'];

/**
 * Create (no `announcement`) or edit an announcement. A teacher must pick one of their classes; an
 * admin may leave the class empty for a school-wide announcement. Editing sends only the changed fields.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object} [props.announcement] the announcement to edit
 */
export function AnnouncementFormModal({ open, onClose, announcement }) {
  const { role } = useAuth();
  const confirm = useConfirm();
  const isTeacher = role === 'teacher';
  const isEdit = Boolean(announcement);
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();

  const schema = useMemo(
    () =>
      isEdit
        ? updateAnnouncementSchema({ isClassRequired: isTeacher })
        : createAnnouncementSchema({ isClassRequired: isTeacher }),
    [isEdit, isTeacher],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, dirtyFields, isDirty, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: announcementDefaults(announcement) });

  // The modal stays mounted between uses; start every opening from the announcement being edited.
  useEffect(() => {
    if (open) reset(announcementDefaults(announcement));
  }, [open, announcement, reset]);

  const body = useWatch({ control, name: 'body' }) ?? '';

  const requestClose = async () => {
    if (isDirty && !isSubmitting) {
      const discard = await confirm({
        title: 'Discard changes?',
        description: 'The announcement has changes that are not saved.',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
      });
      if (!discard) return;
    }
    onClose();
  };

  const onSubmit = (values) => {
    const request = isEdit
      ? updateMutation.mutateAsync({ id: announcement.id, body: changedFields(values, dirtyFields) })
      : createMutation.mutateAsync(values);
    return request
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={isEdit ? 'Edit announcement' : 'Create announcement'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSubmitting} disabled={isEdit && !isDirty}>
            {isEdit ? 'Save changes' : 'Publish'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormRootError error={errors.root?.server} />
        <FormField label="Title" error={errors.title?.message} required>
          <Input {...register('title')} maxLength={150} />
        </FormField>
        <FormField
          label="Message"
          error={errors.body?.message}
          hint={`${body.length} / ${BODY_MAX_LENGTH} characters`}
          required
        >
          <Textarea {...register('body')} rows={6} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Audience" error={errors.audience?.message} required>
            <Select {...register('audience')} options={ANNOUNCEMENT_AUDIENCE_OPTIONS} />
          </FormField>
          <FormField
            label="Class"
            error={errors.classId?.message}
            hint={isTeacher ? 'Only students of this class see it.' : 'Leave empty for the whole school.'}
            required={isTeacher}
          >
            <ClassSelect
              {...register('classId')}
              placeholder={isTeacher ? 'Choose a class' : 'Whole school'}
            />
          </FormField>
          <FormField
            label="Publish at"
            error={errors.publishedAt?.message}
            hint={isEdit ? undefined : 'Leave empty to publish now.'}
            required={isEdit}
          >
            <Input {...register('publishedAt')} type="datetime-local" />
          </FormField>
          <FormField
            label="Expires at"
            error={errors.expiresAt?.message}
            hint="Leave empty to keep it up until it is deleted."
          >
            <Input {...register('expiresAt')} type="datetime-local" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
