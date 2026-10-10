import { describe, expect, it } from 'vitest';
import { sf2DayMark, sf2Sheet } from '../src/features/attendance/csv';
import { sf10Remarks, sf10Rows } from '../src/features/grades/csv';
import { inSchoolFormOrder, sf1Columns } from '../src/features/students/csv';
import { toCsv } from '../src/lib/csv';

/** One learner's counts for one day of GET /attendance/summary?groupBy=studentDay. */
const day = (studentId, date, { present = 0, absent = 0, late = 0, excused = 0 }) => ({
  studentId,
  label: `Learner ${studentId}`,
  date,
  total: present + absent + late + excused,
  present,
  absent,
  late,
  excused,
});

describe('school form order (SF1, SF2)', () => {
  it('lists males first, then females, then the rest, each by last name and then first name', () => {
    const learners = [
      { id: 1, firstName: 'Ana', lastName: 'Reyes', gender: 'female' },
      { id: 2, firstName: 'Ben', lastName: 'Cruz', gender: 'male' },
      { id: 3, firstName: 'Ava', lastName: 'Cruz', gender: 'female' },
      { id: 4, firstName: 'Kai', lastName: 'Abad', gender: null },
      { id: 5, firstName: 'Al', lastName: 'Cruz', gender: 'male' },
    ];
    expect(inSchoolFormOrder(learners).map((learner) => learner.id)).toEqual([5, 2, 3, 1, 4]);
  });

  it('writes the SF1 with the LRN as text, M/F and the age on the first day of the school year', () => {
    const student = {
      lrn: '136512140001',
      lastName: 'Cruz',
      firstName: 'Liam',
      gender: 'male',
      dateOfBirth: '2012-08-02',
      address: 'Quezon City',
      guardianName: 'Maria Cruz',
      guardianPhone: '+63 917 765 4321',
    };
    expect(toCsv(sf1Columns('2026-2027'), [student]).split('\r\n')).toEqual([
      'LRN,Last name,First name,Sex,Birth date,Age on 2026-08-01,Address,Guardian,Guardian phone',
      '="136512140001",Cruz,Liam,M,2012-08-02,13,Quezon City,Maria Cruz,+63 917 765 4321',
    ]);
  });
});

describe('SF2 daily attendance', () => {
  it('judges a whole day on every lesson marked that day', () => {
    expect(sf2DayMark(day(1, 'd', { absent: 2 }))).toBe('A');
    expect(sf2DayMark(day(1, 'd', { absent: 1, excused: 1 }))).toBe('A');
    expect(sf2DayMark(day(1, 'd', { excused: 3 }))).toBe('E');
    expect(sf2DayMark(day(1, 'd', { late: 1, absent: 1 }))).toBe('T');
    expect(sf2DayMark(day(1, 'd', { late: 1, present: 2 }))).toBe('T');
    expect(sf2DayMark(day(1, 'd', { present: 1, absent: 1 }))).toBe('');
    expect(sf2DayMark(day(1, 'd', { present: 3 }))).toBe('');
  });

  it('has a column per marked date, "-" for a learner not marked that day, and the absent and tardy days', () => {
    const roster = [
      { id: 1, lrn: '136512140001', firstName: 'Ana', lastName: 'Reyes', gender: 'female' },
      { id: 2, lrn: null, firstName: 'Ben', lastName: 'Cruz', gender: 'male' },
    ];
    const dayRows = [
      day(1, '2026-10-01', { absent: 1, excused: 1 }),
      day(1, '2026-10-02', { excused: 2 }),
      day(1, '2026-10-05', { late: 1, present: 1 }),
      day(2, '2026-10-01', { present: 2 }),
      day(2, '2026-10-05', { absent: 2 }),
      day(9, '2026-10-02', { present: 1 }), // left the class during the month
    ];
    const { columns, rows } = sf2Sheet(roster, dayRows);
    expect(toCsv(columns, rows).split('\r\n')).toEqual([
      'LRN,Learner,Sex,Oct 1,Oct 2,Oct 5,Absent,Tardy',
      ',Ben Cruz,M,,-,A,1,0',
      '="136512140001",Ana Reyes,F,A,E,T,2,1',
      ',Learner 9,,-,,-,0,0',
    ]);
  });

  it('has no rows for a month without marks, so nothing is downloaded', () => {
    const roster = [{ id: 1, firstName: 'Ana', lastName: 'Reyes', gender: 'female' }];
    expect(sf2Sheet(roster, []).rows).toEqual([]);
  });
});

describe('SF10 permanent record', () => {
  it('gives each school year its remarks by the promotion rules', () => {
    expect(sf10Remarks([90, 80, 75], false)).toBe('Promoted');
    expect(sf10Remarks([90, 74, null], false)).toBe('Remedial');
    expect(sf10Remarks([70, 74, 80], false)).toBe('Remedial');
    expect(sf10Remarks([70, 74, 60, 90], false)).toBe('Retained');
    expect(sf10Remarks([70, 74, 60], true)).toBe('In progress');
    expect(sf10Remarks([null], false)).toBe('');
    expect(sf10Remarks([], true)).toBe('In progress');
  });

  it('lists every school year oldest first: its subjects, then its general average and remarks', () => {
    const enrollments = [
      { status: 'active', class: { name: 'Grade 8 - A', gradeLevel: 8, academicYear: '2026-2027' } },
      { status: 'completed', class: { name: 'Grade 7 - B', gradeLevel: 7, academicYear: '2025-2026' } },
    ];
    const subject = (subjectId, subjectName, className, academicYear, percentage) => ({
      subjectId,
      subjectName,
      className,
      academicYear,
      percentage,
    });
    const subjects = [
      subject(2, 'Science', 'Grade 8 - A', '2026-2027', 88),
      subject(1, 'Math', 'Grade 7 - B', '2025-2026', 70),
      subject(2, 'Science', 'Grade 7 - B', '2025-2026', 90),
      subject(3, 'English', 'Grade 7 - B', '2025-2026', null),
    ];
    const pick = ({ academicYear, gradeLevel, section, subject: name, finalGrade, remarks }) =>
      [academicYear, gradeLevel, section, name, finalGrade, remarks].join('|');
    expect(sf10Rows(enrollments, subjects).map(pick)).toEqual([
      '2025-2026|7|Grade 7 - B|English||',
      '2025-2026|7|Grade 7 - B|Math|70|Failed',
      '2025-2026|7|Grade 7 - B|Science|90|Passed',
      '2025-2026|7|Grade 7 - B|General average|80|Remedial',
      '2026-2027|8|Grade 8 - A|Science|88|Passed',
      '2026-2027|8|Grade 8 - A|General average|88|In progress',
    ]);
  });
});
