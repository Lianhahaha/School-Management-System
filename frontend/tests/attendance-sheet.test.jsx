import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceSheet } from '../src/features/attendance/components/AttendanceSheet';
import { saveAttendanceSheet } from '../src/features/attendance/api';
import { ApiError } from '../src/lib/apiClient';
import { renderWithProviders } from './helpers/render';

vi.mock('../src/features/attendance/api', () => ({ saveAttendanceSheet: vi.fn() }));

const student = (studentId, firstName, lastName) => ({
  studentId,
  firstName,
  lastName,
  studentNumber: `STU-2026-000${studentId}`,
  attendanceId: null,
  status: null,
  remarks: null,
  markedBy: null,
  updatedAt: null,
});

/** GET /attendance/sheet of a Monday lesson nobody has marked yet (Mathematics meets Mon, Wed, Fri). */
const sheetOf = (patch = {}) => ({
  classSubjectId: 12,
  date: '2026-10-05',
  classSubject: { className: 'Grade 7 - A', subjectName: 'Mathematics' },
  holiday: null,
  lessonDays: [1, 3, 5],
  records: [student(1, 'Ana', 'Reyes'), student(2, 'Ben', 'Cruz')],
  ...patch,
});

function renderSheet({ sheet = sheetOf(), canSave = true, onReload = vi.fn() } = {}) {
  return renderWithProviders(<AttendanceSheet sheet={sheet} canSave={canSave} onReload={onReload} />);
}

const statusGroup = (name) => screen.getByRole('group', { name: `Attendance for ${name}` });
const statusOf = (name, label) => within(statusGroup(name)).getByRole('radio', { name: label });
// A second Save sits under the list for phones; jsdom applies no CSS, so both are there and the first is used.
const saveButton = () => screen.getAllByRole('button', { name: 'Save attendance' })[0];

beforeEach(() => {
  vi.mocked(saveAttendanceSheet).mockReset();
});

describe('AttendanceSheet', () => {
  it('lists the roster with every student present until marked', () => {
    renderSheet();

    expect(screen.getByText('Ana Reyes')).toBeInTheDocument();
    expect(screen.getByText('Ben Cruz')).toBeInTheDocument();
    expect(statusOf('Ana Reyes', 'Present')).toBeChecked();
    expect(statusOf('Ben Cruz', 'Present')).toBeChecked();
    expect(screen.getByText('2 present')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Remarks for/ })).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('asks for remarks once a student is absent, and Mark all present undoes the marks', async () => {
    const { user } = renderSheet();

    await user.click(statusOf('Ana Reyes', 'Absent'));
    const remarks = screen.getByRole('textbox', { name: 'Remarks for Ana Reyes' });
    await user.type(remarks, 'Fever');
    expect(screen.getByText('1 present')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark all present' }));

    expect(statusOf('Ana Reyes', 'Present')).toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Remarks for Ana Reyes' })).not.toBeInTheDocument();
    expect(screen.getByText('2 present')).toBeInTheDocument();
  });

  it('saves every student on the roster with the marks the sheet was opened with', async () => {
    const sheet = sheetOf();
    vi.mocked(saveAttendanceSheet).mockResolvedValue(sheet);
    const { user } = renderSheet({ sheet });

    await user.click(statusOf('Ana Reyes', 'Absent'));
    await user.type(screen.getByRole('textbox', { name: 'Remarks for Ana Reyes' }), '  Fever  ');
    await user.click(saveButton());

    expect(saveAttendanceSheet).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveAttendanceSheet).mock.calls[0][0]).toEqual({
      classSubjectId: 12,
      date: '2026-10-05',
      records: [
        { studentId: 1, status: 'absent', remarks: 'Fever', previous: { status: null, remarks: null } },
        { studentId: 2, status: 'present', remarks: null, previous: { status: null, remarks: null } },
      ],
    });
  });

  it('is read-only for a teacher who does not teach the subject', () => {
    renderSheet({ canSave: false });

    expect(
      screen.getByText("You can view this sheet. Only the subject's teacher can save attendance."),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mark all present' })).toBeDisabled();
    expect(statusOf('Ana Reyes', 'Absent')).toBeDisabled();
  });

  it('cannot be marked on a school holiday and says why', () => {
    renderSheet({ sheet: sheetOf({ holiday: { title: 'National Heroes Day' } }) });

    expect(
      screen.getByText(/National Heroes Day\. Attendance can't be marked on a day with no classes\./),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(statusOf('Ben Cruz', 'Late')).toBeDisabled();
  });

  it('cannot be marked on a day the lesson does not meet and names its days', () => {
    renderSheet({ sheet: sheetOf({ date: '2026-10-06' }) }); // a Tuesday

    expect(
      screen.getByText(
        'Mathematics has no periods on Tuesdays. It meets on Monday, Wednesday, and Friday: pick one of those days to mark attendance.',
      ),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('offers a reload when someone saved the sheet meanwhile (409 sheet_changed)', async () => {
    vi.mocked(saveAttendanceSheet).mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'The sheet changed since it was opened',
        details: { reason: 'sheet_changed' },
      }),
    );
    const fresh = sheetOf();
    const onReload = vi.fn().mockResolvedValue({ data: fresh });
    const { user } = renderSheet({ onReload });

    await user.click(statusOf('Ben Cruz', 'Late'));
    await user.click(saveButton());

    expect(await screen.findByText(/^Someone saved this sheet after you opened it\./)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reload sheet' }));

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Someone saved this sheet/)).not.toBeInTheDocument();
    expect(statusOf('Ben Cruz', 'Present')).toBeChecked();
  });
});
