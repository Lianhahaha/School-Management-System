import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GradeSheet } from '../src/features/grades/components/GradeSheet';
import { deleteGrade, saveGrades } from '../src/features/grades/api';
import { ApiError } from '../src/lib/apiClient';
import { renderWithProviders } from './helpers/render';

vi.mock('../src/features/grades/api', () => ({ saveGrades: vi.fn(), deleteGrade: vi.fn() }));

const ANA = {
  studentId: 1,
  firstName: 'Ana',
  lastName: 'Reyes',
  studentNumber: 'STU-2026-0001',
  gradeId: 101,
  score: 40,
  percentage: 80,
  remarks: null,
  gradedBy: { firstName: 'Rosa', lastName: 'Diaz' },
};
const BEN = {
  studentId: 2,
  firstName: 'Ben',
  lastName: 'Cruz',
  studentNumber: 'STU-2026-0002',
  gradeId: null,
  score: null,
  percentage: null,
  remarks: null,
  gradedBy: null,
};

/** GET /assessments/30/grades: a quiz out of 50, Ana graded 40, Ben not graded yet. */
const rosterOf = (records = [ANA, BEN]) => ({
  assessmentId: 30,
  assessment: { id: 30, title: 'Quiz 1', maxScore: 50, className: 'Grade 7 - A', assessedOn: '2026-10-05' },
  records,
});

function renderSheet({ onReload = vi.fn() } = {}) {
  return renderWithProviders(<GradeSheet roster={rosterOf()} canSave onReload={onReload} />);
}

const scoreOf = (name) => screen.getByRole('spinbutton', { name: `Score for ${name}` });
const saveButton = () => screen.getByRole('button', { name: 'Save grades' });

beforeEach(() => {
  vi.mocked(saveGrades).mockReset();
  vi.mocked(deleteGrade).mockReset();
});

describe('GradeSheet', () => {
  it('refuses a score above the maximum before anything is sent', async () => {
    const { user } = renderSheet();

    await user.type(scoreOf('Ben Cruz'), '60');
    await user.click(saveButton());

    expect(await screen.findByText('Score must be between 0 and 50')).toBeInTheDocument();
    expect(scoreOf('Ben Cruz')).toHaveAttribute('aria-invalid', 'true');
    expect(saveGrades).not.toHaveBeenCalled();
  });

  it('sends no grade for a student whose score is left blank', async () => {
    vi.mocked(saveGrades).mockResolvedValue(rosterOf());
    const { user } = renderSheet();

    await user.clear(scoreOf('Ana Reyes'));
    await user.type(scoreOf('Ana Reyes'), '45');
    await user.click(saveButton());

    expect(saveGrades).toHaveBeenCalledTimes(1);
    const [assessmentId, grades] = vi.mocked(saveGrades).mock.calls[0];
    expect(assessmentId).toBe(30);
    expect(grades.map((grade) => grade.studentId)).toEqual([1]);
  });

  it('sends each score with the grade the sheet was opened with', async () => {
    vi.mocked(saveGrades).mockResolvedValue(rosterOf());
    const { user } = renderSheet();

    await user.type(scoreOf('Ben Cruz'), '35.5');
    await user.click(saveButton());

    expect(saveGrades).toHaveBeenCalledWith(30, [
      { studentId: 1, score: 40, previous: { score: 40, remarks: null } },
      { studentId: 2, score: 35.5, previous: { score: null, remarks: null } },
    ]);
  });

  it('clears a saved grade at once and offers Undo, which puts the score back', async () => {
    vi.mocked(deleteGrade).mockResolvedValue(null);
    vi.mocked(saveGrades).mockResolvedValue(rosterOf());
    const { user } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Clear grade of Ana Reyes' }));

    expect(vi.mocked(deleteGrade).mock.calls[0][0]).toEqual({ id: 101, score: 40, remarks: null });
    expect(await screen.findByText('Grade of Ana Reyes cleared')).toBeInTheDocument();
    expect(scoreOf('Ana Reyes')).toHaveValue(null);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(saveGrades).toHaveBeenCalledWith(30, [
      { studentId: 1, score: 40, remarks: null, previous: { score: null, remarks: null } },
    ]);
    expect(await screen.findByText('Grade restored')).toBeInTheDocument();
    expect(scoreOf('Ana Reyes')).toHaveValue(40);
  });

  it('offers a reload when someone saved the grades meanwhile (409 sheet_changed)', async () => {
    vi.mocked(saveGrades).mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'The sheet changed since it was opened',
        details: { reason: 'sheet_changed' },
      }),
    );
    const onReload = vi.fn().mockResolvedValue({ data: rosterOf() });
    const { user } = renderSheet({ onReload });

    await user.type(scoreOf('Ben Cruz'), '30');
    await user.click(saveButton());

    expect(
      await screen.findByText(/^Someone saved these grades after you opened the sheet\./),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reload sheet' }));

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Someone saved these grades/)).not.toBeInTheDocument();
    expect(scoreOf('Ben Cruz')).toHaveValue(null);
  });
});
