import { TBody, THead, Table, Td, Th, Tr } from '../../../components/ui/Table';
import { ATTENDANCE_STATUS_LABELS } from '../../../constants/ui';
import { formatDateTime } from '../../../utils/date';
import { describeWeights } from '../../../utils/grades';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "guardianPhone" -> "Guardian phone". */
const fieldLabel = (field) => {
  const words = field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A logged value as text: blanks as a dash, timestamps in local time, statuses by name, weights as a list. */
function formatValue(value, field) {
  if (field === 'gradeWeights') return describeWeights(value) || 'On points';
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && ISO_INSTANT.test(value)) return formatDateTime(value);
  if (typeof value === 'string' && ATTENDANCE_STATUS_LABELS[value]) return ATTENDANCE_STATUS_LABELS[value];
  if (typeof value === 'object') {
    return (
      Object.entries(value)
        .filter(([, part]) => part)
        .map(([key, part]) => `${fieldLabel(key)} ${part}`)
        .join(', ') || '—'
    );
  }
  return String(value);
}

/** Before / after rows: either one per field (edits) or one per student (grades, attendance). */
function ChangesTable({ caption, firstHeader, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
      <Table caption={caption}>
        <THead>
          <Tr>
            <Th>{firstHeader}</Th>
            <Th>Before</Th>
            <Th>After</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.key}>
              <Td className="font-medium text-gray-900">{row.label}</Td>
              <Td>{formatValue(row.from, row.field)}</Td>
              <Td>{formatValue(row.to, row.field)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/**
 * The details of one activity entry: before / after tables for edits, grade saves and attendance, the list
 * of students of a bulk enrollment, and every other value as a label and text.
 *
 * @param {object} props
 * @param {object} props.details the entry's `details`
 */
export function ActivityDetails({ details }) {
  const { changes, marks, students, ...facts } = details;
  const perStudent = Array.isArray(changes) ? changes : marks;
  const perField = changes && !Array.isArray(changes) ? changes : null;

  return (
    <div className="space-y-3">
      {perField && (
        <ChangesTable
          caption="What changed"
          firstHeader="Field"
          rows={Object.entries(perField).map(([field, change]) => ({
            key: field,
            field,
            label: fieldLabel(field),
            from: change.from,
            to: change.to,
          }))}
        />
      )}
      {perStudent && perStudent.length > 0 && (
        <ChangesTable
          caption="Per student"
          firstHeader="Student"
          rows={perStudent.map((change) => ({
            key: change.studentId,
            label: change.student,
            from: change.from,
            to: change.to,
          }))}
        />
      )}
      {students && <p className="text-sm text-gray-700">{students.join(', ')}</p>}
      {Object.keys(facts).length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(facts).map(([field, value]) => (
            <div key={field} className="contents">
              <dt className="text-gray-500">{fieldLabel(field)}</dt>
              <dd className="text-gray-900">{formatValue(value, field)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
