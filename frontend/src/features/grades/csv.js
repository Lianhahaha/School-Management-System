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

/** GET /grades items (a student's grades, with their assessment); the quarter is the one within the semester. */
export const STUDENT_GRADES_CSV_COLUMNS = [
  { header: 'Subject', value: (grade) => grade.assessment.subjectName },
  { header: 'Assessment', value: (grade) => grade.assessment.title },
  { header: 'Type', value: (grade) => ASSESSMENT_TYPE_LABELS[grade.assessment.type] },
  { header: 'Semester', value: (grade) => SEMESTER_LABELS[grade.assessment.semester] },
  { header: 'Quarter', value: (grade) => TERM_LABELS[grade.assessment.term] },
  { header: 'Date', value: (grade) => grade.assessment.assessedOn },
  { header: 'Score', value: (grade) => grade.score },
  { header: 'Max score', value: (grade) => grade.assessment.maxScore },
  { header: 'Percent', value: (grade) => grade.percentage },
  { header: 'Remarks', value: (grade) => grade.remarks },
];

/**
 * The remarks of one school year on the SF10, by the promotion rules GET /enrollments/next-class applies:
 * In progress while the year's enrollment is active; otherwise Incomplete when a subject of the class the
 * student finished the year in has no final grade, Promoted when no subject was failed, Remedial for 1 to
 * REMEDIAL_MAX_FAILED failed subjects and Retained for more. Blank while no subject has a final grade and none
 * is known to be missing. The API leaves an incomplete year, or one with nothing to judge, to an admin.
 * @param {Array<number | null>} finalGrades the year's final grade per subject
 * @param {boolean} isActive
 * @param {boolean} [isIncomplete] a subject of the year's class has no final grade
 * @returns {'In progress' | 'Incomplete' | 'Promoted' | 'Remedial' | 'Retained' | ''}
 */
export function sf10Remarks(finalGrades, isActive, isIncomplete = false) {
  if (isActive) return 'In progress';
  if (isIncomplete) return 'Incomplete';
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
 * in `semesters`, and the year's remarks (sf10Remarks). Once a year is over, a subject of the class the
 * student finished it in that has no final grade reads Incomplete, listed with blank grades when nothing of it
 * was graded, and so does the year: it is not judged on the other subjects alone.
 * @param {Array<{ status: string, classId: number, enrolledOn: string,
 *   class: { name: string, gradeLevel: number, academicYear: string } }>} enrollments the student's
 *   enrollments (GET /enrollments?studentId=)
 * @param {Array<{ subjectId: number, subjectName: string, className: string, academicYear: string,
 *   method: string, semester: string, quarters: Record<string, number | null> }>} subjects the rows of
 *   GET /grades/summary?groupBy=classSubject&semester= of the student, every year, of both semesters, each
 *   tagged with the `semester` it was fetched for
 * @param {Array<{ classId: number, className: string, subjectId: number, subjectName: string }>} classSubjects
 *   the subjects of the student's classes (GET /class-subjects?classId=)
 */
export function sf10Rows(enrollments, subjects, classSubjects) {
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
    const isActive = yearEnrollments.some((enrollment) => enrollment.status === 'active');
    const yearSubjects = subjects.filter((subject) => subject.academicYear === academicYear);
    const sectionsOf = (names) => [...new Set(names)].join(' / ');
    const graded = [...groupBy(yearSubjects, (subject) => subject.subjectId).values()].map((rows) => ({
      subjectId: rows[0].subjectId,
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
    }));
    // The subjects of the class the year ended in (the latest enrollment of the year) that have no final grade.
    const finished = [...yearEnrollments].sort((a, b) =>
      (b.enrolledOn ?? '').localeCompare(a.enrolledOn ?? ''),
    )[0];
    const withGrade = new Set(
      graded.filter((result) => result.finalGrade !== null).map((result) => result.subjectId),
    );
    const missing =
      isActive || !finished
        ? []
        : classSubjects.filter(
            (classSubject) =>
              classSubject.classId === finished.classId && !withGrade.has(classSubject.subjectId),
          );
    const missingIds = new Set(missing.map((classSubject) => classSubject.subjectId));
    const listed = new Set(graded.map((result) => result.subjectId));
    const results = [
      ...graded,
      ...missing
        .filter((classSubject) => !listed.has(classSubject.subjectId))
        .map((classSubject) => ({
          subjectId: classSubject.subjectId,
          subject: classSubject.subjectName,
          section: classSubject.className,
          quarters: { sem1: null, sem2: null },
          semesters: { sem1: null, sem2: null },
          finalGrade: null,
        })),
    ].sort((a, b) => a.subject.localeCompare(b.subject));
    const year = { academicYear, gradeLevel: yearEnrollments[0]?.class.gradeLevel ?? null };
    return [
      ...results.map((result) => ({
        ...year,
        ...result,
        remarks: missingIds.has(result.subjectId) ? 'Incomplete' : remarksOf(result.finalGrade),
      })),
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
          isActive,
          missing.length > 0,
        ),
      },
    ];
  });
}

/**
 * Columns of sf10Rows: each semester's Q1 to Q4 are a subject's quarterly grades (blank on the general average)
 * and its semester grade their average (the semester's general average on that row); `Final grade` is the
 * average of the semester grades. `Remarks` is Passed or Failed for a subject (Incomplete for a subject of the
 * year's class without a final grade once the year is over), and the year's remarks on its average.
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
