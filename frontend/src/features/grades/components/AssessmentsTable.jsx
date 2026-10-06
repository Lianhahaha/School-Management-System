import { ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { ASSESSMENT_TYPE_LABELS, TERM_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';
import { formatScore } from '../../../utils/format';

/**
 * Assessments of one lesson. The sheet link is always there; Edit and Delete only render when
 * `canManage` (an admin, or the teacher of the lesson).
 *
 * Takes the DataTable props `rows`, `isLoading`, `isFetching`, `error`, `onRetry`, `sort`,
 * `onSortChange`, `emptyState`, plus:
 * @param {object} props
 * @param {(assessment: object) => string} props.sheetPath route of an assessment's grade sheet
 * @param {boolean} props.canManage
 * @param {(assessment: object) => void} props.onEdit
 * @param {(assessment: object) => void} props.onDelete
 */
export function AssessmentsTable({ sheetPath, canManage, onEdit, onDelete, ...tableProps }) {
  const columns = [
    {
      key: 'title',
      header: 'Title',
      sortKey: 'title',
      cell: (row) => <span className="font-medium text-gray-900">{row.title}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      sortKey: 'type',
      hideBelow: 'sm',
      cell: (row) => <Badge tone="gray">{ASSESSMENT_TYPE_LABELS[row.type]}</Badge>,
    },
    { key: 'term', header: 'Term', hideBelow: 'md', cell: (row) => TERM_LABELS[row.term] },
    {
      key: 'assessedOn',
      header: 'Date',
      sortKey: 'assessedOn',
      cell: (row) => <time dateTime={row.assessedOn}>{formatDate(row.assessedOn)}</time>,
    },
    {
      key: 'maxScore',
      header: 'Max score',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => formatScore(row.maxScore),
    },
    {
      key: 'graded',
      header: 'Graded',
      align: 'right',
      // Nobody to grade (no student in the class on that date) is not "all graded": a neutral dash.
      cell: (row) =>
        row.enrolledCount === 0 ? (
          <span className="text-gray-500" title="No students were in the class on the assessment date">
            —
          </span>
        ) : (
          <Badge tone={row.gradedCount < row.enrolledCount ? 'amber' : 'green'}>
            {row.gradedCount}/{row.enrolledCount}
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            as={Link}
            to={sheetPath(row)}
            variant="ghost"
            size="sm"
            icon={ClipboardList}
            aria-label={`Open grade sheet of ${row.title}`}
          >
            Grade sheet
          </Button>
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={Pencil}
                aria-label={`Edit ${row.title}`}
                onClick={() => onEdit(row)}
              />
              <Button
                variant="dangerGhost"
                size="sm"
                icon={Trash2}
                aria-label={`Delete ${row.title}`}
                onClick={() => onDelete(row)}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return <DataTable label="Assessments" columns={columns} {...tableProps} />;
}
