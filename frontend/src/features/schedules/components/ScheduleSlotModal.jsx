import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { ERROR_CODES } from '../../../constants/shared';
import { DAY_OPTIONS } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { applyServerErrors } from '../../../lib/formErrors';
import { dayLabel } from '../../../utils/schedule';
import { changedFields } from '../../../utils/forms';
import { formatTime } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { useDiscardConfirm } from '../../classes/components/useDiscardConfirm';
import { useCreateSchedule, useDeleteSchedule, useUpdateSchedule } from '../hooks';
import { createScheduleSchema, scheduleDefaults, updateScheduleSchema } from '../schemas';
import { ScheduleConflictList } from './ScheduleConflictList';

const FORM_ID = 'schedule-slot-form';
const FIELDS = ['classSubjectId', 'dayOfWeek', 'startTime', 'endTime', 'room'];

function ScheduleSlotForm({ slot, classSubjects, presetDay, mutation, onClose, trackDirty }) {
  const isEdit = Boolean(slot);
  const [conflict, setConflict] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({
    resolver: zodResolver(isEdit ? updateScheduleSchema : createScheduleSchema),
    defaultValues: scheduleDefaults(slot, {
      dayOfWeek: presetDay ?? '',
      classSubjectId: classSubjects.length === 1 ? classSubjects[0].id : '',
    }),
  });

  useEffect(() => trackDirty(isDirty), [isDirty, trackDirty]);

  const subjectOptions = classSubjects.map((classSubject) => ({
    value: String(classSubject.id),
    label: `${classSubject.subjectName} · ${fullName(classSubject.teacher)}`,
  }));

  const onSubmit = (values) => {
    if (isEdit && !isDirty) return onClose();
    setConflict(null);
    const request = isEdit
      ? mutation.mutateAsync({ id: slot.id, body: changedFields(values, dirtyFields) })
      : mutation.mutateAsync(values);
    return request.then(onClose).catch((error) => {
      if (error?.code === ERROR_CODES.SCHEDULE_CONFLICT) {
        setConflict({ message: error.message, conflicts: error.details?.conflicts ?? [] });
        return;
      }
      applyServerErrors(error, setError, { knownFields: FIELDS });
    });
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {conflict && <ScheduleConflictList message={conflict.message} conflicts={conflict.conflicts} />}
      <FormRootError error={errors.root?.server} />
      <FormField label="Subject" error={errors.classSubjectId?.message} required>
        <Select {...register('classSubjectId')} options={subjectOptions} placeholder="Choose a subject" />
      </FormField>
      <FormField label="Day" error={errors.dayOfWeek?.message} required>
        <Select {...register('dayOfWeek')} options={DAY_OPTIONS} placeholder="Choose a day" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start time" error={errors.startTime?.message} required>
          <Input {...register('startTime')} type="time" step={300} />
        </FormField>
        <FormField label="End time" error={errors.endTime?.message} required>
          <Input {...register('endTime')} type="time" step={300} />
        </FormField>
      </div>
      <FormField label="Room" hint="Optional." error={errors.room?.message}>
        <Input {...register('room')} maxLength={50} />
      </FormField>
    </form>
  );
}

/**
 * Add or edit one timetable slot (admin). Without `slot` it creates one (`presetDay` preselects a
 * weekday); with `slot` it edits it and offers "Delete period". A clash (409 SCHEDULE_CONFLICT)
 * keeps the modal open and lists the conflicting periods inside it. A dirty form asks "Discard
 * changes?" before closing.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Array<{ id: number, subjectName: string, teacher: { firstName: string, lastName: string } }>} props.classSubjects
 *   the subjects of the class the timetable belongs to
 * @param {object|null} [props.slot] the schedule row to edit
 * @param {number|string} [props.presetDay] ISO weekday preselected when creating
 */
export function ScheduleSlotModal({ open, onClose, classSubjects, slot = null, presetDay }) {
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const confirm = useConfirm();
  const { requestClose, trackDirty } = useDiscardConfirm(onClose);
  const isEdit = Boolean(slot);
  const mutation = isEdit ? updateSchedule : createSchedule;

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete this period?',
      description: `${slot.classSubject.subjectName}, ${dayLabel(slot.dayOfWeek)} ${formatTime(slot.startTime)}–${formatTime(slot.endTime)} is removed from the timetable. Attendance already marked is not affected.`,
      confirmLabel: 'Delete period',
    });
    if (ok) deleteSchedule.mutate(slot.id, { onSuccess: onClose });
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={isEdit ? 'Edit period' : 'Add period'}
      size="md"
      footer={
        <>
          {isEdit && (
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={onDelete}
              isLoading={deleteSchedule.isPending}
              className="mr-auto text-red-700 hover:bg-red-50"
            >
              Delete period
            </Button>
          )}
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Add period'}
          </Button>
        </>
      }
    >
      <ScheduleSlotForm
        slot={slot}
        classSubjects={classSubjects}
        presetDay={presetDay}
        mutation={mutation}
        onClose={onClose}
        trackDirty={trackDirty}
      />
    </Modal>
  );
}
