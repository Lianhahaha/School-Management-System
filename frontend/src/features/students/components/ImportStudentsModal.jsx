import { CircleCheck, Download, FileUp } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { TBody, THead, Table, Td, Th, Tr } from '../../../components/ui/Table';
import { downloadCsv, readTextFile } from '../../../lib/csv';
import { cx } from '../../../utils/cx';
import { countOf } from '../../../utils/format';
import { useImportStudents } from '../hooks';
import { TEMPLATE_COLUMNS, TEMPLATE_ROWS, columnLabel, readImportFile } from '../studentImport';

/** Rows sent per create call, so the dialog can show progress on a long file. */
const CHUNK_SIZE = 20;

const CREATED_COLUMNS = [
  { header: 'Row', value: (result) => result.line },
  { header: 'Student number', value: (result) => result.studentNumber },
  { header: 'Name', value: (result) => result.name },
  { header: 'Email', value: (result) => result.email },
  { header: 'Temporary password', value: (result) => result.temporaryPassword },
  { header: 'Class', value: (result) => result.className },
  { header: 'Note', value: (result) => result.message },
];

/** Step 1: the file. */
function PickStep({ onRead, error, isChecking }) {
  const inputId = useId();
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Upload a CSV file with one student per row. Email, First name and Last name are required; Class (a
        class of this school year) enrolls the student. Excel and Google Sheets save CSV with File → Save as /
        Download. Format the LRN column as Text in Excel, or its 12 digits are saved as 1.23457E+11.
      </p>
      <Button
        variant="secondary"
        size="sm"
        icon={Download}
        onClick={() => downloadCsv('student import template', TEMPLATE_COLUMNS, TEMPLATE_ROWS)}
      >
        Download the template
      </Button>
      <div>
        <label
          htmlFor={inputId}
          className={cx(
            'flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-gray-300 px-6 py-8 text-center transition-colors hover:border-gray-500 hover:bg-gray-50',
            isChecking && 'pointer-events-none opacity-60',
          )}
        >
          <FileUp className="size-6 text-gray-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-gray-900">
            {isChecking ? 'Checking the file…' : 'Choose a CSV file'}
          </span>
          <span className="text-xs text-gray-500">Up to 200 students per file</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={isChecking}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = ''; // choosing the same file again still fires
            if (file) readTextFile(file).then((text) => onRead(file.name, text));
          }}
        />
      </div>
      {error && (
        <Alert tone="error" role="alert">
          {error}
        </Alert>
      )}
    </div>
  );
}

/** Step 2: every row with its problems, then the go. */
function ReviewStep({ fileName, rows, report, ignored }) {
  const problemsByLine = new Map(report.problems.map((problem) => [problem.line, problem.errors]));
  const invalid = report.problems.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">{fileName}</span>: {countOf(report.total, 'student')},{' '}
        <span className="font-medium text-green-700">{report.valid} ready</span>
        {invalid > 0 && (
          <>
            , <span className="font-medium text-red-700">{invalid} to fix</span>
          </>
        )}
        .
      </p>
      {ignored.length > 0 && <Alert tone="info">{`Columns not imported: ${ignored.join(', ')}.`}</Alert>}
      {invalid > 0 && (
        <Alert tone="warning">
          Fix the rows marked below in your file and upload it again. Nothing is created until every row is
          ready.
        </Alert>
      )}
      <div
        className="max-h-80 overflow-auto rounded-xl ring-1 ring-gray-200"
        tabIndex={0}
        role="region"
        aria-label="Rows of the file"
      >
        <Table caption={`Rows of ${fileName}`}>
          <THead>
            <Tr>
              <Th width="4rem">Row</Th>
              <Th>Student</Th>
              <Th hideBelow="md">Class</Th>
              <Th>Check</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const errors = problemsByLine.get(row.line);
              return (
                <Tr key={row.line}>
                  <Td className="tabular-nums">{row.line}</Td>
                  <Td>
                    <p className="font-medium text-gray-900">
                      {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-xs text-gray-500">{row.email || '—'}</p>
                  </Td>
                  <Td hideBelow="md" className="whitespace-nowrap">
                    {row.className || '—'}
                  </Td>
                  <Td>
                    {errors ? (
                      <ul className="space-y-0.5 text-xs text-red-700">
                        {errors.map((error) => (
                          <li key={`${error.field}:${error.message}`}>
                            <span className="font-medium">{columnLabel(error.field)}</span>: {error.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <CircleCheck className="size-3.5" aria-hidden="true" />
                        Ready
                      </span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
      {invalid === 0 && (
        <Alert tone="info">
          Each new student gets their own temporary password. After the import, download the list of new
          students: it holds every password, and they are not shown again. Give each student theirs; they can
          change it with &ldquo;Forgot password&rdquo;.
        </Alert>
      )}
    </div>
  );
}

/** Step 3: progress while the accounts are created, then the outcome per row. */
function ResultStep({ done, total, results }) {
  const created = results.filter((result) => result.status === 'created');
  const failed = results.filter((result) => result.status === 'failed');
  const unconfirmed = results.filter((result) => result.status === 'unconfirmed');
  const notEnrolled = created.filter((result) => result.message);
  const isRunning = done < total;
  const outcome = [
    `${countOf(created.length, 'student')} created`,
    failed.length && `${failed.length} failed`,
    unconfirmed.length && `${unconfirmed.length} not confirmed`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div aria-live="polite">
        <p className="text-sm font-medium text-gray-900">
          {isRunning ? `Creating accounts… ${done} of ${total}` : `${outcome.join(', ')}.`}
        </p>
        <div
          role="progressbar"
          aria-label="Import progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className="h-full rounded-full bg-gray-900 transition-[width]"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>
      {!isRunning && failed.length > 0 && (
        <Alert tone="error" title="Not created">
          <ul className="space-y-0.5">
            {failed.map((result) => (
              <li key={result.line}>{`Row ${result.line}: ${result.message}`}</li>
            ))}
          </ul>
        </Alert>
      )}
      {!isRunning && unconfirmed.length > 0 && (
        <Alert tone="warning" title="Not confirmed">
          <p>
            The connection broke while these rows were being created, so some of them may exist already. Check
            the student list before you import them again.
          </p>
          <ul className="mt-1 space-y-0.5">
            {unconfirmed.map((result) => (
              <li key={result.line}>{`Row ${result.line}: ${result.name}`}</li>
            ))}
          </ul>
        </Alert>
      )}
      {!isRunning && notEnrolled.length > 0 && (
        <Alert tone="warning" title="Created but not enrolled">
          <ul className="space-y-0.5">
            {notEnrolled.map((result) => (
              <li key={result.line}>{`Row ${result.line}: ${result.message}`}</li>
            ))}
          </ul>
        </Alert>
      )}
      {!isRunning && created.length > 0 && (
        <Alert tone="info" title="Download the list before you close this">
          <p>It is the only copy of each new student&rsquo;s temporary password.</p>
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={() => downloadCsv('imported students', CREATED_COLUMNS, created)}
            className="mt-2"
          >
            Download the list of new students
          </Button>
        </Alert>
      )}
    </div>
  );
}

/**
 * Import students from a CSV file (admin): pick the file (or download the template), review every row as
 * the API checks it (dry run), then the accounts are created in batches of 20 with a progress bar and the
 * outcome per row; each account gets its own temporary password, listed in the download. Nothing is created
 * while any row has a problem. The dialog cannot be closed while accounts are being created.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function ImportStudentsModal({ open, onClose }) {
  const importStudents = useImportStudents();
  // { step: 'pick' } | { step: 'review', fileName, rows, ignored, report } | { step: 'result', total, done, results }
  const [state, setState] = useState({ step: 'pick' });
  const [pickError, setPickError] = useState(null);

  const isCreating = state.step === 'result' && state.done < state.total;

  const reset = () => {
    setState({ step: 'pick' });
    setPickError(null);
  };
  const close = () => {
    if (isCreating) return;
    reset();
    onClose();
  };

  const onRead = async (fileName, text) => {
    const { rows, ignored, error } = readImportFile(text);
    if (error) return setPickError(error);
    setPickError(null);
    try {
      const report = await importStudents.mutateAsync({ dryRun: true, rows });
      setState({ step: 'review', fileName, rows, ignored, report });
    } catch (requestError) {
      setPickError(requestError.message);
    }
  };

  const create = async () => {
    const { rows } = state;
    const nameOf = new Map(rows.map((row) => [row.line, `${row.firstName} ${row.lastName}`]));
    let results = [];
    setState({ step: 'result', total: rows.length, done: 0, results });
    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      const chunk = rows.slice(start, start + CHUNK_SIZE);
      try {
        const report = await importStudents.mutateAsync({ rows: chunk });
        results = [
          ...results,
          ...report.results.map((result) => ({ ...result, name: nameOf.get(result.line) })),
        ];
      } catch (error) {
        // A 4xx refused the batch as a whole (an email was taken meanwhile): nothing of it was created, and
        // the API names each row's problem. Without an answer (offline, timeout, server error) some rows may
        // have been created before the connection broke, so they are not reported as "not created".
        const problems = new Map((error.details?.problems ?? []).map((problem) => [problem.line, problem]));
        const messageOf = (row) => {
          const problem = problems.get(row.line);
          if (problem) return problem.errors.map((e) => `${columnLabel(e.field)}: ${e.message}`).join('; ');
          return problems.size ? 'not created, another row of its batch had a problem' : error.message;
        };
        const status = error.isTransient ? 'unconfirmed' : 'failed';
        results = [
          ...results,
          ...chunk.map((row) => ({
            line: row.line,
            status,
            name: nameOf.get(row.line),
            message: status === 'failed' ? messageOf(row) : undefined,
          })),
        ];
      }
      setState({ step: 'result', total: rows.length, done: start + chunk.length, results });
    }
  };

  let body;
  let footer;
  if (state.step === 'pick') {
    body = <PickStep onRead={onRead} error={pickError} isChecking={importStudents.isPending} />;
    footer = (
      <Button variant="secondary" onClick={close}>
        Cancel
      </Button>
    );
  } else if (state.step === 'review') {
    const isReady = state.report.problems.length === 0;
    body = (
      <ReviewStep fileName={state.fileName} rows={state.rows} report={state.report} ignored={state.ignored} />
    );
    footer = (
      <>
        <Button variant="secondary" onClick={reset}>
          Choose another file
        </Button>
        {isReady && <Button onClick={create}>{`Create ${countOf(state.report.valid, 'student')}`}</Button>}
      </>
    );
  } else {
    body = <ResultStep done={state.done} total={state.total} results={state.results} />;
    footer = (
      <Button onClick={close} disabled={isCreating}>
        Done
      </Button>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Import students"
      description={
        state.step === 'result' ? undefined : 'Create many student accounts at once from a spreadsheet.'
      }
      footer={footer}
    >
      {body}
    </Modal>
  );
}
