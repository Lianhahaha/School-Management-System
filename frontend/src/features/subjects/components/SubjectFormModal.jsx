import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { useCreateSubject, useUpdateSubject } from '../hooks';
import { createSubjectSchema, subjectDefaults, updateSubjectSchema } from '../schemas';
import { GradeWeightsFields } from './GradeWeightsFields';

const FORM_ID = 'subject-form';
const FIELDS = ['code', 'name', 'description', 'weights'];
/** The API's `gradeWeights` errors belong to the weight inputs. */
const FIELD_MAP = { gradeWeights: 'weights' };

/** The PATCH body: the text fields that changed, and `gradeWeights` when the method or a weight changed. */
function changedBody(values, dirtyFields) {
  const { gradingMethod, weights, ...textFields } = dirtyFields;
  const body = changedFields(values, textFields);
  if (gradingMethod || weights) body.gradeWeights = values.gradeWeights;
  return body;
}

function SubjectForm({ subject, mutation, onClose }) {
  const isEdit = Boolean(subject);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, dirtyFields },
  } = useForm({
    resolver: zodResolver(isEdit ? updateSubjectSchema : createSubjectSchema),
    defaultValues: subjectDefaults(subject),
  });

  const onSubmit = (values) => {
    let request;
    if (isEdit) {
      const body = changedBody(values, dirtyFields);
      if (Object.keys(body).length === 0) return onClose();
      request = mutation.mutateAsync({ id: subject.id, body });
    } else {
      request = mutation.mutateAsync(values);
    }
    return request
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS, fieldMap: FIELD_MAP }));
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField
        label="Code"
        hint="2 to 20 letters, digits or dashes, for example BIO-7"
        error={errors.code?.message}
        required
      >
        <Input
          {...register('code', {
            onBlur: (event) =>
              setValue('code', event.target.value.trim().toUpperCase(), { shouldDirty: true }),
          })}
          autoComplete="off"
        />
      </FormField>
      <FormField label="Name" error={errors.name?.message} required>
        <Input {...register('name')} autoComplete="off" />
      </FormField>
      <FormField label="Description" error={errors.description?.message}>
        <Textarea {...register('description')} rows={3} />
      </FormField>
      <GradeWeightsFields control={control} register={register} errors={errors} />
    </form>
  );
}

/**
 * Create or edit a subject (edit mode when `subject` is given): code, name, description and how results
 * are graded (on points or weighted by assessment type). The code is upper-cased when the field loses
 * focus; a duplicate code shows under the field.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object} [props.subject] the subject to edit
 */
export function SubjectFormModal({ open, onClose, subject }) {
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const isEdit = Boolean(subject);
  const mutation = isEdit ? updateSubject : createSubject;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit subject' : 'Create subject'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Create subject'}
          </Button>
        </>
      }
    >
      <SubjectForm subject={subject} mutation={mutation} onClose={onClose} />
    </Modal>
  );
}
