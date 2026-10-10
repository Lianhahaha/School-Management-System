import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { addDaysYmd, currentAcademicYear, nextAcademicYear, todayYmd } from '../src/utils/dates.js';
import { api, as, buildSchool, closeWorld, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld);

const year = currentAcademicYear();
const nextYear = nextAcademicYear(year);
const today = todayYmd();

const addFee = (who, body) => api.post('/api/v1/fees').set(as(who)).send(body);
const statement = (who, studentId, academicYear = year) =>
  api.get(`/api/v1/fees/statement?studentId=${studentId}&academicYear=${academicYear}`).set(as(who));
const pay = (who, body) =>
  api
    .post('/api/v1/payments')
    .set(as(who))
    .send({ academicYear: year, paidOn: today, method: 'cash', ...body });

describe('fees', () => {
  let school;

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it('lets admins add, list, edit and delete the fees of a school year', async () => {
    const tuition = await addFee(school.admin, {
      academicYear: nextYear,
      gradeLevel: 10,
      name: 'Tuition',
      amount: 18000,
    });
    assert.equal(tuition.status, 201, JSON.stringify(tuition.body));
    assert.equal(tuition.body.data.gradeLevel, 10);
    assert.equal(tuition.body.data.amount, 18000);
    const misc = await addFee(school.admin, {
      academicYear: nextYear,
      name: 'Miscellaneous',
      amount: 2500.5,
    });
    assert.equal(misc.status, 201);
    assert.equal(misc.body.data.gradeLevel, null, 'no grade level: every grade');
    const library = await addFee(school.admin, {
      academicYear: nextYear,
      gradeLevel: null,
      name: 'Library',
      amount: 300,
    });
    assert.equal(library.status, 201);

    const list = await api.get(`/api/v1/fees?academicYear=${nextYear}`).set(as(school.admin));
    assert.equal(list.status, 200);
    assert.deepEqual(
      list.body.data.map((fee) => fee.name),
      ['Library', 'Miscellaneous', 'Tuition'],
      'every-grade fees first, then by grade and name',
    );
    const grade7 = await api.get(`/api/v1/fees?academicYear=${nextYear}&gradeLevel=7`).set(as(school.admin));
    assert.equal(grade7.body.meta.total, 2, 'what Grade 7 pays: the every-grade fees only');

    const edited = await api
      .patch(`/api/v1/fees/${tuition.body.data.id}`)
      .set(as(school.admin))
      .send({ amount: 18500, gradeLevel: null });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.amount, 18500);
    assert.equal(edited.body.data.gradeLevel, null);

    const removed = await api.delete(`/api/v1/fees/${library.body.data.id}`).set(as(school.admin));
    assert.deepEqual(removed.body.data, { id: library.body.data.id });
    assert.equal(
      (await api.delete(`/api/v1/fees/${library.body.data.id}`).set(as(school.admin))).status,
      404,
    );
  });

  it('refuses a second fee with the same name for the same year and grade, every grade included', async () => {
    const twice = await addFee(school.admin, { academicYear: nextYear, name: 'Miscellaneous', amount: 100 });
    assert.equal(twice.status, 409, 'two every-grade fees with one name (grade_key makes NULL comparable)');
    assert.equal(twice.body.error.details.key, 'fees.uq_fees_year_grade_name');
    const forGrade = await addFee(school.admin, {
      academicYear: nextYear,
      gradeLevel: 10,
      name: 'Miscellaneous',
      amount: 100,
    });
    assert.equal(forGrade.status, 201, 'the same name for one grade is another fee');
    const otherYear = await addFee(school.admin, {
      academicYear: year,
      name: 'Miscellaneous',
      amount: 2500.5,
    });
    assert.equal(otherYear.status, 201);
  });

  it('validates the amount, the school year and the grade', async () => {
    const valid = { academicYear: year, name: 'Books', amount: 1200 };
    const cases = [
      [{ ...valid, amount: 0 }, 'body.amount'],
      [{ ...valid, amount: -50 }, 'body.amount'],
      [{ ...valid, amount: 10.005 }, 'body.amount'],
      [{ ...valid, academicYear: '2026-2028' }, 'body.academicYear'],
      [{ ...valid, academicYear: '26-27' }, 'body.academicYear'],
      [{ ...valid, gradeLevel: 13 }, 'body.gradeLevel'],
      [{ ...valid, name: '  ' }, 'body.name'],
    ];
    for (const [body, path] of cases) {
      const res = await addFee(school.admin, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.ok(
        res.body.error.details.issues.some((issue) => issue.path === path),
        `${path}: ${JSON.stringify(res.body.error.details.issues)}`,
      );
    }
    const fee = (await api.get(`/api/v1/fees?academicYear=${nextYear}`).set(as(school.admin))).body.data[0];
    assert.equal((await api.patch(`/api/v1/fees/${fee.id}`).set(as(school.admin)).send({})).status, 400);
  });

  it('is closed to teachers; a student reads only their own statement', async () => {
    const teacher = school.owner;
    const teacherCalls = [
      api.get('/api/v1/fees').set(as(teacher)),
      addFee(teacher, { academicYear: year, name: 'X', amount: 1 }),
      api.patch('/api/v1/fees/1').set(as(teacher)).send({ amount: 1 }),
      api.delete('/api/v1/fees/1').set(as(teacher)),
      statement(teacher, school.s1.studentId),
      pay(teacher, { studentId: school.s1.studentId, amount: 1, receiptNumber: 'T-1' }),
      api.delete('/api/v1/payments/1').set(as(teacher)),
    ];
    for (const [index, res] of (await Promise.all(teacherCalls)).entries()) {
      assert.equal(res.status, 403, `teacher call ${index}`);
      assert.equal(res.body.error.details.reason, 'role_not_allowed');
    }

    assert.equal((await api.get('/api/v1/fees').set(as(school.s1))).status, 403);
    assert.equal(
      (await pay(school.s1, { studentId: school.s1.studentId, amount: 1, receiptNumber: 'S-1' })).status,
      403,
    );
    const own = await statement(school.s1, 'me');
    assert.equal(own.status, 200);
    assert.equal(own.body.data.studentId, school.s1.studentId);
    const other = await statement(school.s1, school.s2.studentId);
    assert.equal(other.status, 403);
    assert.equal(other.body.error.details.reason, 'student_not_self');

    assert.equal((await statement(school.admin, 'me')).status, 400, 'an admin has no own statement');
    assert.equal((await statement(school.admin, 999999)).status, 404);
  });

  it('adds the grade and every-grade fees, the payments and the balance, to the centavo', async () => {
    // This year: Miscellaneous 2,500.50 for every grade (added above), plus these.
    await addFee(school.admin, { academicYear: year, gradeLevel: 10, name: 'Tuition', amount: 18000 });
    await addFee(school.admin, { academicYear: year, gradeLevel: 7, name: 'Tuition', amount: 15000 });

    const before = (await statement(school.admin, school.s1.studentId)).body.data;
    assert.deepEqual(before.class, { id: school.classA.id, name: school.classA.name, gradeLevel: 10 });
    assert.deepEqual(
      before.fees.map((fee) => [fee.name, fee.gradeLevel, fee.amount]),
      [
        ['Miscellaneous', null, 2500.5],
        ['Tuition', 10, 18000],
      ],
    );
    assert.deepEqual([before.totalFees, before.totalPaid, before.balance], [20500.5, 0, 20500.5]);

    for (const [amount, receiptNumber] of [
      [5000, 'OR-0001'],
      [1000.1, 'OR-0002'],
      [2000.2, 'OR-0003'],
    ]) {
      const res = await pay(school.admin, { studentId: school.s1.studentId, amount, receiptNumber });
      assert.equal(res.status, 201, JSON.stringify(res.body));
    }
    // Next year's payment counts towards next year only.
    await pay(school.admin, {
      studentId: school.s1.studentId,
      academicYear: nextYear,
      amount: 999,
      receiptNumber: 'OR-0004',
    });

    const after = (await statement(school.s1, 'me')).body.data;
    assert.equal(after.payments.length, 3);
    assert.equal(after.totalPaid, 8000.3);
    assert.equal(after.balance, 12500.2, 'summed by MySQL, so 20500.5 - 8000.3 has no floating-point tail');

    const noClass = (await statement(school.admin, school.s3.studentId)).body.data;
    assert.equal(noClass.class, null);
    assert.deepEqual(
      noClass.fees.map((fee) => fee.name),
      ['Miscellaneous'],
      'without a class only the every-grade fees apply',
    );
    await pay(school.admin, { studentId: school.s3.studentId, amount: 3000, receiptNumber: 'OR-0005' });
    assert.equal((await statement(school.admin, school.s3.studentId)).body.data.balance, -499.5, 'overpaid');
  });

  it('refuses a used receipt number and a future date; removing a payment changes the balance', async () => {
    const duplicate = await pay(school.admin, {
      studentId: school.s2.studentId,
      amount: 100,
      receiptNumber: 'or-0001',
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.details.key, 'payments.uq_payments_receipt');
    const future = await pay(school.admin, {
      studentId: school.s2.studentId,
      amount: 100,
      receiptNumber: 'OR-0100',
      paidOn: addDaysYmd(today, 1),
    });
    assert.equal(future.status, 400);
    assert.equal(future.body.error.details.issues[0].path, 'body.paidOn');
    const unknown = await pay(school.admin, { studentId: 999999, amount: 100, receiptNumber: 'OR-0101' });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.error.details.field, 'studentId');

    const [latest] = (await statement(school.admin, school.s1.studentId)).body.data.payments;
    assert.equal(latest.receiptNumber, 'OR-0003');
    const removed = await api.delete(`/api/v1/payments/${latest.id}`).set(as(school.admin));
    assert.equal(removed.status, 200);
    assert.equal((await statement(school.admin, school.s1.studentId)).body.data.balance, 14500.4);
    assert.equal((await api.delete(`/api/v1/payments/${latest.id}`).set(as(school.admin))).status, 404);
  });

  it('logs every change in the fees area', async () => {
    const res = await api.get('/api/v1/activity?area=fees&limit=100').set(as(school.admin));
    const actions = new Set(res.body.data.map((entry) => entry.action));
    for (const action of ['fee.create', 'fee.update', 'fee.delete', 'payment.create', 'payment.delete']) {
      assert.ok(actions.has(action), action);
    }
    const student = school.s1;
    const recorded = res.body.data.find(
      (entry) => entry.action === 'payment.create' && entry.details.receiptNumber === 'OR-0001',
    );
    assert.equal(
      recorded.summary,
      `Recorded ₱5,000.00 (OR OR-0001) for ${student.firstName} ${student.lastName}`,
    );
    const removed = res.body.data.find((entry) => entry.action === 'payment.delete');
    assert.equal(removed.details.amount, 2000.2);
    assert.equal(removed.details.receiptNumber, 'OR-0003');
  });

  it('keeps an account with payments from being deleted, as the student or as the recorder', async () => {
    const [student, cashier] = [await makeUser('student'), await makeUser('admin')];
    const paid = await pay(cashier, { studentId: student.studentId, amount: 50, receiptNumber: 'OR-0200' });
    assert.equal(paid.status, 201);
    for (const user of [student, cashier]) {
      const res = await api.delete(`/api/v1/users/${user.id}`).set(as(school.admin));
      assert.equal(res.status, 409, user.role);
      assert.equal(res.body.error.details.reason, 'has_history');
    }
  });
});
