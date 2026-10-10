import { RefreshCw } from 'lucide-react';
import { Alert } from './Alert';
import { Button } from './Button';

/**
 * The messages above an editable sheet (the grade sheet, the attendance sheet). Both sheets keep their own
 * wording; these keep the look and the Reload action the same.
 */

/**
 * The note of a sheet the user may look at but not save, for example a homeroom teacher on another teacher's
 * subject: "You can view this sheet. <reason>."
 * @param {object} props
 * @param {string} props.reason who may save instead, as a sentence without the full stop
 */
export function SheetReadOnlyNote({ reason }) {
  return <Alert tone="info">{`You can view this sheet. ${reason}.`}</Alert>;
}

/**
 * A refused save of a sheet. With `onReload` it offers "Reload sheet", the way out when someone saved the sheet
 * after it was opened (409 `sheet_changed`) or students on it left the class (see useSheetEditing).
 * @param {object} props
 * @param {string} props.message what went wrong and what to do
 * @param {() => void} [props.onReload] reloads the sheet from the server
 */
export function SheetSaveAlert({ message, onReload }) {
  return (
    <Alert tone="error" role="alert">
      <p>{message}</p>
      {onReload && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onReload} className="mt-2">
          Reload sheet
        </Button>
      )}
    </Alert>
  );
}
