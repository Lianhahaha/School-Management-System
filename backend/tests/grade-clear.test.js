import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';

after(closeWorld);

/**
 * The grade sheet's Clear and its Undo are checked against what the sheet showed, as a save is: Clear sends
 * the grade it cleared (DELETE /grades/:id?score=&remarks=) and Undo saves the old score back with
 * `previous: { score: null, remarks: null }`. When someone saved the grade meanwhile, both answer 409
 * sheet_changed and change nothing.
 */
describe('clearing a grade and undoing it from an outdated sheet', () => {
  let school;
  let quiz;

  const save = (grades) =>
    api.put(`/api/v1/assessments/${quiz.id}/grades`).set(as(school.owner)).send({ grades });
  const gradeOf = async (student) => {
    const res = await api.get(`/api/v1/assessments/${quiz.id}/grades`).set(as(school.owner));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.records.find((record) => record.studentId === student.studentId);
  };
  const clear = (gradeId, query = '') =>
    api.delete(`/api/v1/grades/${gradeId}${query}`).set(as(school.owner));

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    const res = await api
      .post('/api/v1/assessments')
      .set(as(school.owner))
      .send({ classSubjectId: school.csA.id, title: 'Quiz', type: 'quiz', term: 'term1', maxScore: 20 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    quiz = res.body.data;
  });

  it('clears a grade that is still as the sheet showed it, remarks included', async () => {
    assert.equal((await save([{ studentId: school.s1.studentId, score: 18, remarks: 'Good' }])).status, 200);
    const { gradeId } = await gradeOf(school.s1);
    const res = await clear(gradeId, '?score=18&remarks=Good');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await gradeOf(school.s1)).gradeId, null);
  });

  it('refuses to clear a grade someone changed after the sheet was opened, and keeps it', async () => {
    assert.equal((await save([{ studentId: school.s1.studentId, score: 15 }])).status, 200);
    const { gradeId } = await gradeOf(school.s1);
    // Meanwhile another tab saves 17.5.
    const meanwhile = await save([
      { studentId: school.s1.studentId, score: 17.5, previous: { score: 15, remarks: null } },
    ]);
    assert.equal(meanwhile.status, 200, JSON.stringify(meanwhile.body));

    const stale = await clear(gradeId, '?score=15');
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    assert.deepEqual(
      [stale.body.error.details.reason, stale.body.error.details.changedStudentIds],
      ['sheet_changed', [school.s1.studentId]],
    );
    assert.equal((await gradeOf(school.s1)).score, 17.5, 'nothing was cleared');

    // The same score with other remarks is a change too.
    assert.equal((await clear(gradeId, '?score=17.5&remarks=Late')).status, 409);
    // As the grade is now, it clears.
    assert.equal((await clear(gradeId, '?score=17.5')).status, 200);
  });

  it('answers 404 for a grade that is already cleared, with or without the score', async () => {
    assert.equal((await save([{ studentId: school.s2.studentId, score: 12 }])).status, 200);
    const { gradeId } = await gradeOf(school.s2);
    assert.equal((await clear(gradeId, '?score=12')).status, 200);
    assert.equal((await clear(gradeId, '?score=12')).status, 404);
    assert.equal((await clear(gradeId)).status, 404);
  });

  it('still clears a grade without the check when no score is sent', async () => {
    assert.equal((await save([{ studentId: school.s2.studentId, score: 9 }])).status, 200);
    assert.equal((await clear((await gradeOf(school.s2)).gradeId)).status, 200);
  });

  it('rejects a malformed score, and remarks sent without the score', async () => {
    assert.equal((await save([{ studentId: school.s2.studentId, score: 9 }])).status, 200);
    const { gradeId } = await gradeOf(school.s2);
    for (const query of ['?score=abc', '?score=1.234', '?score=-1', '?remarks=Good', '?other=1']) {
      assert.equal((await clear(gradeId, query)).status, 400, query);
    }
    assert.equal((await gradeOf(school.s2)).score, 9);
  });

  it('refuses an Undo when someone graded the student after the clear, and restores it otherwise', async () => {
    const undo = (score) =>
      save([{ studentId: school.s1.studentId, score, previous: { score: null, remarks: null } }]);
    // s1 has no grade now (cleared above); another teacher's tab grades them 11.
    assert.equal((await gradeOf(school.s1)).gradeId, null);
    assert.equal((await save([{ studentId: school.s1.studentId, score: 11 }])).status, 200);
    const refused = await undo(17.5);
    assert.equal(refused.status, 409, JSON.stringify(refused.body));
    assert.equal(refused.body.error.details.reason, 'sheet_changed');
    assert.equal((await gradeOf(school.s1)).score, 11);

    // Nobody else touched it: the Undo puts the old score back.
    assert.equal((await clear((await gradeOf(school.s1)).gradeId, '?score=11')).status, 200);
    const restored = await undo(17.5);
    assert.equal(restored.status, 200, JSON.stringify(restored.body));
    assert.equal((await gradeOf(school.s1)).score, 17.5);
  });
});
