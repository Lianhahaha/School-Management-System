/** CSV columns for grades: one assessment's grade sheet, and a student's own grades. */
import { ASSESSMENT_TYPE_LABELS, TERM_LABELS } from '../../constants/ui';
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
  { header: 'Term', value: (grade) => TERM_LABELS[grade.assessment.term] },
  { header: 'Date', value: (grade) => grade.assessment.assessedOn },
  { header: 'Score', value: (grade) => grade.score },
  { header: 'Max score', value: (grade) => grade.assessment.maxScore },
  { header: 'Percent', value: (grade) => grade.percentage },
  { header: 'Remarks', value: (grade) => grade.remarks },
];
