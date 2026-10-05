import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { addDaysYmd, todayYmd } from '../src/utils/dates.js';
import { api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';

after(closeWorld);

const today = todayYmd();

describe('school calendar', () => {
  let school;
  const create = (who, body) => api.post('/api/v1/calendar-events').set(as(who)).send(body);

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it('lets admins add entries; everyone reads them; endsOn defaults to startsOn', async () => {
    const res = await create(school.admin, {
      title: 'Sports day',
      type: 'event',
      startsOn: addDaysYmd(today, 3),
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.endsOn, res.body.data.startsOn);
    assert.equal(res.body.data.description, null);

    assert.equal((await create(school.owner, { title: 'x', type: 'event', startsOn: today })).status, 403);
    for (const who of [school.owner, school.s1]) {
      const list = await api.get('/api/v1/calendar-events').set(as(who));
      assert.equal(list.status, 200);
      assert.equal(list.body.meta.total, 1);
    }
  });

  it('checks the date order and length', async () => {
    const backwards = await create(school.admin, {
      title: 'Oops',
      type: 'event',
      startsOn: today,
      endsOn: addDaysYmd(today, -1),
    });
    assert.equal(backwards.status, 400);
    assert.equal(backwards.body.error.details.reason, 'invalid_date_range');
    const tooLong = await create(school.admin, {
      title: 'Typo year',
      type: 'holiday',
      startsOn: today,
      endsOn: addDaysYmd(today, 366),
    });
    assert.equal(tooLong.body.error.details.reason, 'date_range_too_long');
  });

  it('lists the entries that overlap a range', async () => {
    const break_ = (
      await create(school.admin, {
        title: 'Term break',
        type: 'holiday',
        startsOn: addDaysYmd(today, 20),
        endsOn: addDaysYmd(today, 30),
      })
    ).body.data;
    const inside = await api
      .get(`/api/v1/calendar-events?dateFrom=${addDaysYmd(today, 25)}&dateTo=${addDaysYmd(today, 26)}`)
      .set(as(school.s1));
    assert.deepEqual(
      inside.body.data.map((event) => event.id),
      [break_.id],
    );
    const holidays = await api.get('/api/v1/calendar-events?type=holiday').set(as(school.admin));
    assert.equal(holidays.body.meta.total, 1);

    const patched = await api
      .patch(`/api/v1/calendar-events/${break_.id}`)
      .set(as(school.admin))
      .send({ endsOn: addDaysYmd(today, 10) });
    assert.equal(patched.status, 400, 'the merged dates are checked: the end would come before the start');
  });

  it('blocks attendance on a holiday and says so on the sheet', async () => {
    const holiday = (await create(school.admin, { title: 'Founders day', type: 'holiday', startsOn: today }))
      .body.data;
    const sheet = await api
      .get(`/api/v1/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`)
      .set(as(school.owner));
    assert.deepEqual(sheet.body.data.holiday, { id: holiday.id, title: 'Founders day' });

    const save = await api
      .put('/api/v1/attendance/sheet')
      .set(as(school.owner))
      .send({
        classSubjectId: school.csA.id,
        date: today,
        records: [{ studentId: school.s1.studentId, status: 'present' }],
      });
    assert.equal(save.status, 400);
    assert.equal(save.body.error.details.reason, 'school_holiday');

    // Every dashboard lists what is coming up, the holiday running today included.
    for (const who of [school.admin, school.owner, school.s1]) {
      const dashboard = (await api.get('/api/v1/dashboard').set(as(who))).body.data;
      assert.ok(dashboard.upcomingEvents.some((event) => event.id === holiday.id));
    }

    assert.equal(
      (await api.delete(`/api/v1/calendar-events/${holiday.id}`).set(as(school.admin))).status,
      200,
    );
    const open = await api
      .get(`/api/v1/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`)
      .set(as(school.owner));
    assert.equal(open.body.data.holiday, null);
    assert.equal(
      (await api.delete(`/api/v1/calendar-events/${holiday.id}`).set(as(school.admin))).status,
      404,
    );
  });
});
