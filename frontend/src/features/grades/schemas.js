import { z } from 'zod';
import { ASSESSMENT_TYPES, TERMS } from '../../constants/shared';
import { dateYMD, optionalField, positiveInt, requiredId, score } from '../../lib/validators';
import { todayYmd } from '../../utils/date';

const MAX_SCORE_LIMIT = 1000;

const title = z.string().trim().min(1, 'This field is required').max(150, 'Use 150 characters or fewer');

const maxScore = z.coerce
  .number({ error: 'Enter a number' })
  .positive('Max score must be greater than 0')
  .max(MAX_SCORE_LIMIT, `Max score cannot be more than ${MAX_SCORE_LIMIT}`)
  .multipleOf(0.01, 'Use at most two decimals');

const assessmentFields = {
  title,
  type: z.enum(ASSESSMENT_TYPES, { error: 'Choose a type' }),
  term: z.enum(TERMS, { error: 'Choose a semester' }),
  maxScore,
  assessedOn: dateYMD,
};

/** POST /assessments. Select values arrive as strings and the schema turns ids and numbers into numbers. */
export const createAssessmentSchema = z.object({
  classSubjectId: requiredId('Choose a class and subject'),
  ...assessmentFields,
});

/** PATCH /assessments/:id: the class-subject of an assessment cannot change. */
export const updateAssessmentSchema = z.object(assessmentFields);

/** Form values; with an assessment it is the edit form, otherwise the create form (today, max score 100). */
export const assessmentDefaults = (assessment, classSubjectId = '') => ({
  ...(assessment ? {} : { classSubjectId: String(classSubjectId) }),
  title: assessment?.title ?? '',
  type: assessment?.type ?? '',
  term: assessment?.term ?? '',
  maxScore: assessment?.maxScore ?? 100,
  assessedOn: assessment?.assessedOn ?? todayYmd(),
});

/**
 * Grade sheet form: one row per student of the roster. A blank score means "not graded yet" and the
 * row is not sent (see toSaveGradesPayload). The upper bound depends on the assessment, hence a function.
 * Two blanks would be lost silently, so they are errors instead: a saved score that was erased (a save
 * cannot unset a grade; the row's Clear action does) and remarks typed for a student without a score.
 * @param {number} assessmentMaxScore the assessment's maxScore
 * @param {Array<{ gradeId: number|null }>} [savedRecords] the roster as saved, in the same order as `rows`
 */
export const gradeSheetSchema = (assessmentMaxScore, savedRecords = []) =>
  z.object({
    rows: z
      .array(
        z.object({
          studentId: positiveInt,
          score: optionalField(
            score.max(assessmentMaxScore, `Score must be between 0 and ${assessmentMaxScore}`),
          ),
          remarks: optionalField(z.string().max(255, 'Use 255 characters or fewer')),
        }),
      )
      .superRefine((rows, context) => {
        rows.forEach((row, index) => {
          if (row.score !== undefined) return;
          if (savedRecords[index]?.gradeId != null) {
            context.addIssue({
              code: 'custom',
              path: [index, 'score'],
              message: 'To remove a saved grade, use Clear',
            });
          } else if (row.remarks !== undefined) {
            context.addIssue({
              code: 'custom',
              path: [index, 'remarks'],
              message: 'Add a score to save these remarks',
            });
          }
        });
      }),
  });

/** Grade sheet form values from the roster (`records` of GET /assessments/:id/grades). */
export const gradeSheetDefaults = (records) => ({
  rows: records.map((record) => ({
    studentId: record.studentId,
    score: record.score === null ? '' : String(record.score),
    remarks: record.remarks ?? '',
  })),
});

/**
 * The `grades` array of the PUT body: only the rows that have a score, each with the grade the sheet was
 * opened with (`previous`), so the API refuses the save when someone changed it meanwhile.
 * `mutate({ assessmentId, grades })`.
 * @param {{ rows: object[] }} values the form values
 * @param {Array<{ studentId: number, score: number|null, remarks: string|null }>} savedRecords the roster as saved
 */
export const toSaveGradesPayload = ({ rows }, savedRecords) => {
  const savedOf = new Map(savedRecords.map((record) => [record.studentId, record]));
  return rows
    .filter((row) => row.score !== undefined)
    .map(({ studentId, score: value, remarks }) => {
      const saved = savedOf.get(studentId);
      return {
        studentId,
        score: value,
        remarks,
        previous: { score: saved?.score ?? null, remarks: saved?.remarks ?? null },
      };
    });
};
