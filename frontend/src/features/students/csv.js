/**
 * DepEd school form 1 (SF1, School Register) as CSV, and the learner order every school form uses: males
 * first, then females, each group by last name and then first name.
 */
import { academicYearStart, ageOn } from '../../utils/date';

/** Sex as the school forms write it; any other value is left blank. */
export const SEX_LETTERS = Object.freeze({ male: 'M', female: 'F' });

const SEX_ORDER = { male: 0, female: 1 };

/**
 * Learners in the order of the DepEd school forms: males, then females, then anyone recorded as neither,
 * each group by last name and then first name.
 * @template {{ gender?: string | null, lastName?: string, firstName?: string }} T
 * @param {T[]} learners
 * @returns {T[]}
 */
export function inSchoolFormOrder(learners) {
  const rank = (learner) => SEX_ORDER[learner.gender] ?? 2;
  return [...learners].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.lastName ?? '').localeCompare(b.lastName ?? '') ||
      (a.firstName ?? '').localeCompare(b.firstName ?? ''),
  );
}

/**
 * SF1 columns for the students (GET /students items) of a class of `academicYear`. The age is the one on the
 * first day of that school year, and the LRN is kept as text so a spreadsheet shows all 12 digits.
 * @param {string} academicYear
 */
export function sf1Columns(academicYear) {
  const start = academicYearStart(academicYear);
  return [
    { header: 'LRN', value: (student) => student.lrn, text: true },
    { header: 'Last name', value: (student) => student.lastName },
    { header: 'First name', value: (student) => student.firstName },
    { header: 'Sex', value: (student) => SEX_LETTERS[student.gender] },
    { header: 'Birth date', value: (student) => student.dateOfBirth },
    { header: `Age on ${start}`, value: (student) => ageOn(student.dateOfBirth, start) },
    { header: 'Address', value: (student) => student.address },
    { header: 'Guardian', value: (student) => student.guardianName },
    { header: 'Guardian phone', value: (student) => student.guardianPhone },
  ];
}
