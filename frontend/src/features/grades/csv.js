/**
 * CSV for grades: one assessment's grade sheet, a student's own grades, and DepEd school form 10 (SF10,
 * Learner's Permanent Academic Record) of one student.
 */
import { REMEDIAL_MAX_FAILED, SEMESTERS, TERMS } from '../../constants/shared';
import { ASSESSMENT_TYPE_LABELS, SEMESTER_LABELS, TERM_LABELS, TERM_SHORT_LABELS } from '../../constants/ui';
import {
  generalAverage,
  groupBy,
  isPassing,
  remarksOf,
  subjectFinalGrade,
  subjectQuarters,
  subjectSemesters,
} from '../../utils/grades';
import { fullName } from '../../utils/names';

/** GET /assessments/:id/grades `records` (the roster, graded or not). */
export const GRADE_SHEET_CSV_COLUMNS = [
  { header: 'Student no', value: (record) => record.studentNumber },
  { header: 'Student', value: (record) => fullName(record) },
  { header: 'Score', value: (record) => record.score },
  { header: 'Percent', value: (record) => record.percentage },
  { header: 'Remarks', value: (record) => record.remarks },
  { header: 'Graded by', value: (record) => (record.gradedBy ? fullName(record.gradedBy) : '') },
];

/** GET /grades items (a student's grades, with their assessment). */
export const STUDENT_GRADES_CSV_COLUMNS = [
  { header: 'Subject', value: (grade) => grade.assessment.subjectName },
  { header: 'Assessment', value: (grade) => grade.assessment.title },
  { header: 'Type', value: (grade) => ASSESSMENT_TYPE_LABELS[grade.assessment.type] },
  { header: 'Quarter', value: (grade) => TERM_LABELS[grade.assessment.term] },
  { header: 'Date', value: (grade) => grade.assessment.assessedOn },
  { header: 'Score', value: (grade) => grade.score },
  { header: 'Max score', value: (grade) => grade.assessment.maxScore },
  { header: 'Percent', value: (grade) => grade.percentage },
  { header: 'Remarks', value: (grade) => grade.remarks },
];

/**
 * The remarks of one school year on the SF10, by the promotion rules GET /enrollments/next-class applies:
 * In progress while the year's enrollment is active; otherwise Promoted when no subject was failed, Remedial
 * for 1 to REMEDIAL_MAX_FAILED failed subjects and Retained for more. Blank while no subject has a final grade
 * (nothing to judge, as the API leaves such a student to an admin).
 * @param {Array<number | null>} finalGrades the year's final grade per subject
 * @param {boolean} isActive
 * @returns {'In progress' | 'Promoted' | 'Remedial' | 'Retained' | ''}
 */
export function sf10Remarks(finalGrades, isActive) {
  if (isActive) return 'In progress';
  const graded = finalGrades.filter((grade) => grade !== null);
  if (graded.length === 0) return '';
  const failed = graded.filter((grade) => !isPassing(grade)).length;
  if (failed === 0) return 'Promoted';
  return failed <= REMEDIAL_MAX_FAILED ? 'Remedial' : 'Retained';
}

/**
 * The SF10 rows of one student, school year by school year, oldest first: a row per subject with its quarterly
 * grades and grade in each semester (`quarters` and `semesters`, by semester; null for a semester with no
 * row), its final grade (the average of the semester grades that exist, utils/grades subjectFinalGrade) and
 * Passed or Failed (a subject taken in two sections of one year puts the quarters of both together per
 * semester and quarter, as the general average does), then the year's general average, with each semester's
 * in `semesters`, and the year's remarks (sf10Remarks).
 * @param {Array<{ status: string, class: { name: string, gradeLevel: number, academicYear: string } }>} enrollments
 *   the student's enrollments (GET /enrollments?studentId=)
 * @param {Array<{ subjectId: number, subjectName: string, className: string, academicYear: string,
 *   method: string, semester: string, quarters: Record<string, number | null> }>} subjects the rows of
 *   GET /grades/summary?groupBy=classSubject&semester= of the student, every year, of both semesters, each
 *   tagged with the `semester` it was fetched for
 */
export function sf10Rows(enrollments, subjects) {
  const years = [
    ...new Set([
      ...enrollments.map((enrollment) => enrollment.class.academicYear),
      ...subjects.map((subject) => subject.academicYear),
    ]),
  ].sort();
  return years.flatMap((academicYear) => {
    const yearEnrollments = enrollments.filter(
      (enrollment) => enrollment.class.academicYear === academicYear,
    );
    const yearSubjects = subjects.filter((subject) => subject.academicYear === academicYear);
    const sectionsOf = (names) => [...new Set(names)].join(' / ');
    const results = [...groupBy(yearSubjects, (subject) => subject.subjectId).values()]
      .map((rows) => ({
        subject: rows[0].subjectName,
        section: sectionsOf(rows.map((row) => row.className)),
        quarters: Object.fromEntries(
          SEMESTERS.map((semester) => {
            const ofSemester = rows.filter((row) => row.semester === semester);
            return [semester, ofSemester.length ? subjectQuarters(ofSemester) : null];
          }),
        ),
        semesters: subjectSemesters(rows),
        finalGrade: subjectFinalGrade(rows),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
    const year = { academicYear, gradeLevel: yearEnrollments[0]?.class.gradeLevel ?? null };
    return [
      ...results.map((result) => ({ ...year, ...result, remarks: remarksOf(result.finalGrade) })),
      {
        ...year,
        section: sectionsOf([
          ...yearEnrollments.map((enrollment) => enrollment.class.name),
          ...yearSubjects.map((subject) => subject.className),
        ]),
        subject: 'General average',
        quarters: null,
        semesters: Object.fromEntries(
          SEMESTERS.map((semester) => [
            semester,
            generalAverage(yearSubjects.filter((row) => row.semester === semester)),
          ]),
        ),
        finalGrade: generalAverage(yearSubjects),
        remarks: sf10Remarks(
          results.map((result) => result.finalGrade),
          yearEnrollments.some((enrollment) => enrollment.status === 'active'),
        ),
      },
    ];
  });
}

/**
 * Columns of sf10Rows: each semester's Q1 to Q4 are a subject's quarterly grades (blank on the general average)
 * and its semester grade their average (the semester's general average on that row); `Final grade` is the
 * average of the semester grades. `Remarks` is Passed or Failed for a subject, and the year's remarks on its
 * average.
 */
export const SF10_CSV_COLUMNS = [
  { header: 'School year', value: (row) => row.academicYear },
  { header: 'Grade level', value: (row) => row.gradeLevel },
  { header: 'Section', value: (row) => row.section },
  { header: 'Subject', value: (row) => row.subject },
  ...SEMESTERS.flatMap((semester) => [
    ...TERMS.map((term) => ({
      header: `${SEMESTER_LABELS[semester]} ${TERM_SHORT_LABELS[term]}`,
      value: (row) => row.quarters?.[semester]?.[term],
    })),
    { header: `${SEMESTER_LABELS[semester]} grade`, value: (row) => row.semesters?.[semester] },
  ]),
  { header: 'Final grade', value: (row) => row.finalGrade },
  { header: 'Remarks', value: (row) => row.remarks },
];
