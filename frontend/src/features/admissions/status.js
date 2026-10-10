/**
 * True for a student whose application is pending or was declined: not placed yet, and handled on the
 * Admissions page rather than among the students without a class.
 * @param {{ admission?: { status: string } | null }} student a student, or an account's student profile
 */
export const isApplicant = (student) => Boolean(student.admission) && student.admission.status !== 'admitted';
