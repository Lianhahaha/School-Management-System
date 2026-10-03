import { DescriptionList } from '../../../components/ui/DescriptionList';
import { GENDER_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';

/** The read-only, school-managed part of a profile; the role decides which fields exist. */
function detailsOf(me) {
  const { profile } = me;
  if (me.role === 'student') {
    return [
      { label: 'Student number', value: profile.studentNumber },
      { label: 'Class', value: me.currentEnrollment?.className ?? 'Not enrolled yet' },
      { label: 'Date of birth', value: formatDate(profile.dateOfBirth) },
      { label: 'Gender', value: GENDER_LABELS[profile.gender] },
      { label: 'Admission date', value: formatDate(profile.admissionDate) },
    ];
  }
  return [
    { label: 'Employee number', value: profile.employeeNumber },
    { label: 'Department', value: profile.department },
    { label: 'Qualification', value: profile.qualification },
    { label: 'Hire date', value: formatDate(profile.hireDate) },
  ];
}

/** Student or teacher record of the signed-in account. Render it only when `me.profile` exists (not for admins). */
export function RoleDetails({ me }) {
  return <DescriptionList items={detailsOf(me)} />;
}
