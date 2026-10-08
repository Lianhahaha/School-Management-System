import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { ERROR_CODES } from '../../../constants/shared';
import { ASSESSMENT_TYPE_OPTIONS, TERM_OPTIONS } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { useCreateAssessment, useUpdateAssessment } from '../hooks';
import { assessmentDefaults, createAssessmentSchema, updateAssessmentSchema } from '../schemas';

const FORM_ID = 'assessment-form';

/**
 * Create (pass `classSubjectId`) or edit (pass `assessment`) an assessment. The class-subject of an
 * assessment is fixed: the page has already chosen it.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object} [props.assessment] the assessment to edit; omit to create
 * @param {string|number} [props.classSubjectId] the lesson a new assessment belongs to
 * @param {string} [props.lessonLabel] "Grade 7 - A · Biology", shown under the title
 */
export function AssessmentFormModal({ open, onClose, assessment, classSubjectId, lessonLabel }) {
  const isEdit = Boolean(assessment);
  const confirm = useConfirm();
  const create = useCreateAssessment();
  const update = useUpdateAssessment();
  const mutation = isEdit ? update : create;
  const schema = isEdit ? updateAssessmentSchema : createAssessmentSchema;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, dirtyFields },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: assessmentDefaults(assessment, classSubjectId),
  });

  // The modal stays mounted while closed, so every opening starts from the assessment's own values.
  useEffect(() => {
    if (open) reset(assessmentDefaults(assessment, classSubjectId));
  }, [open, assessment, classSubjectId, reset]);

  const requestClose = async () => {
    if (isDirty) {
      const discard = await confirm({
        title: 'Discard changes?',
        description: 'The assessment has not been saved.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      });
      if (!discard) return;
    }
    onClose();
  };

  const onSubmit = (values) => {
    if (isEdit && Object.keys(dirtyFields).length === 0) return onClose();
    const request = isEdit
      ? update.mutateAsync({ id: assessment.id, body: changedFields(values, dirtyFields) })
      : create.mutateAsync(values);
    return request.then(onClose).catch((error) => {
      if (error.code === ERROR_CODES.CONFLICT && error.details?.maxExistingScore !== undefined) {
        setError('maxScore', {
          type: 'server',
          message: `A recorded score of ${error.details.maxExistingScore} is higher than this max`,
        });
        return;
      }
      applyServerErrors(error, setError, { knownFields: Object.keys(schema.shape) });
    });
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={isEdit ? 'Edit assessment' : 'Create assessment'}
      description={lessonLabel}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Create assessment'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormRootError error={errors.root?.server} />
        <FormField label="Title" error={errors.title?.message} required>
          <Input {...register('title')} maxLength={150} autoComplete="off" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Type" error={errors.type?.message} required>
            <Select {...register('type')} options={ASSESSMENT_TYPE_OPTIONS} placeholder="Choose a type" />
          </FormField>
          <FormField label="Semester" error={errors.term?.message} required>
            <Select {...register('term')} options={TERM_OPTIONS} placeholder="Choose a semester" />
          </FormField>
          <FormField label="Max score" error={errors.maxScore?.message} required>
            <Input
              {...register('maxScore', { valueAsNumber: true })}
              type="number"
              inputMode="decimal"
              min="0.01"
              max="1000"
              step="0.01"
            />
          </FormField>
          <FormField label="Date" error={errors.assessedOn?.message} required>
            <Input {...register('assessedOn')} type="date" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
