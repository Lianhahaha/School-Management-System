/**
 * True for a student whose application is pending: signed up and not in a class yet, so they still pick one
 * (or the office places them). An application declined in the past (nothing declines one any more) is not
 * waiting for anything: that student shows as any student without a class.
 * @param {{ admission?: { status: string } | null }} student a student, or an account's student profile
 */
export const isApplicant = (student) => student.admission?.status === 'pending';
