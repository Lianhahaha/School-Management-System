/**
 * Search across the school for the admin's search dialog: one small query per list, run in
 * parallel, merged into a flat result list in a fixed group order.
 */
import { NAV } from '../../components/layout/navConfig';
import { fullName } from '../../utils/names';
import { useClasses } from '../classes/hooks';
import { useStudents } from '../students/hooks';
import { useSubjects } from '../subjects/hooks';
import { useTeachers } from '../teachers/hooks';

/** Rows per group; the dialog is for jumping somewhere, the lists are for browsing. */
const PER_GROUP = 5;
/** Shorter terms match too much to be useful. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * @typedef {{ id: string, group: string, label: string, detail?: string, to: string }} SearchResult
 */

/**
 * Results for `term` (already debounced): matching pages of the admin menu, then students, teachers,
 * classes and subjects. A list query only runs while the term is long enough.
 *
 * @param {string} term
 * @returns {{ results: SearchResult[], isSearching: boolean, hasError: boolean }}
 */
export function useGlobalSearch(term) {
  const search = term.trim();
  const enabled = search.length >= MIN_SEARCH_LENGTH;
  const params = { search, limit: PER_GROUP };

  const students = useStudents(params, { enabled });
  const teachers = useTeachers(params, { enabled });
  const classes = useClasses(params, { enabled });
  const subjects = useSubjects(params, { enabled });
  const queries = [students, teachers, classes, subjects];

  const needle = search.toLowerCase();
  const pages = needle
    ? NAV.admin
        .filter((entry) => entry.label.toLowerCase().includes(needle))
        .map((entry) => ({ id: `page-${entry.to}`, group: 'Pages', label: entry.label, to: entry.to }))
    : [];

  const items = (query) => (enabled ? (query.data?.items ?? []) : []);
  const results = [
    ...pages,
    ...items(students).map((student) => ({
      id: `student-${student.id}`,
      group: 'Students',
      label: fullName(student),
      detail: [student.studentNumber, student.currentEnrollment?.className].filter(Boolean).join(' · '),
      to: `/admin/students/${student.id}`,
    })),
    ...items(teachers).map((teacher) => ({
      id: `teacher-${teacher.id}`,
      group: 'Teachers',
      label: fullName(teacher),
      detail: [teacher.employeeNumber, teacher.department].filter(Boolean).join(' · '),
      to: `/admin/teachers/${teacher.id}`,
    })),
    ...items(classes).map((schoolClass) => ({
      id: `class-${schoolClass.id}`,
      group: 'Classes',
      label: schoolClass.name,
      detail: schoolClass.academicYear,
      to: `/admin/classes/${schoolClass.id}`,
    })),
    ...items(subjects).map((subject) => ({
      id: `subject-${subject.id}`,
      group: 'Subjects',
      label: subject.name,
      detail: subject.code,
      to: `/admin/subjects?search=${encodeURIComponent(subject.code)}`,
    })),
  ];

  return {
    results,
    isSearching: enabled && queries.some((query) => query.isFetching),
    hasError: enabled && queries.some((query) => query.isError),
  };
}
