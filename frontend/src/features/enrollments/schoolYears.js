import { currentAcademicYear } from '../../utils/date';

/** How a school year is named in pickers: '2026-2027' -> 'AY 2026-2027'. */
export const schoolYearLabel = (academicYear) => `AY ${academicYear}`;

/**
 * The school years a student can look back on, newest first, from their enrollments:
 * `[{ academicYear, className }]`, the class being the one they were in last that year (a student who changed
 * class mid-year finished in the second). Years after the current one are left out: a student already placed
 * in next year's class has no grades or attendance there yet.
 * @param {Array<{ enrolledOn: string, class: { name: string, academicYear: string } }>} enrollments
 */
export function schoolYearsOf(enrollments) {
  const thisYear = currentAcademicYear();
  const byYear = new Map();
  for (const enrollment of [...enrollments].sort((a, b) => a.enrolledOn.localeCompare(b.enrolledOn))) {
    const { academicYear, name } = enrollment.class;
    if (academicYear <= thisYear) byYear.set(academicYear, name);
  }
  return [...byYear]
    .map(([academicYear, className]) => ({ academicYear, className }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear));
}

/**
 * The years to offer: the student's years, plus the current one when they have no class this year.
 * @param {Array<{ academicYear: string, className: string }>} schoolYears from schoolYearsOf
 */
export function yearChoices(schoolYears) {
  const thisYear = currentAcademicYear();
  return schoolYears.some((year) => year.academicYear === thisYear)
    ? schoolYears
    : [{ academicYear: thisYear, className: null }, ...schoolYears];
}

/**
 * The year a page opens on: the year of the student's class, unless that class starts next year (then this
 * year, where their results are); without a class, the last year they had one; else the current year.
 * @param {{ academicYear: string } | null} currentEnrollment
 * @param {Array<{ academicYear: string }>} schoolYears from schoolYearsOf
 */
export function defaultSchoolYear(currentEnrollment, schoolYears) {
  const thisYear = currentAcademicYear();
  if (currentEnrollment)
    return currentEnrollment.academicYear <= thisYear ? currentEnrollment.academicYear : thisYear;
  return schoolYears[0]?.academicYear ?? thisYear;
}
