import { Download } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { downloadCsv } from '../../lib/csv';
import { Button } from './Button';

/**
 * "Download CSV": gets the rows (from memory or by fetching every page), then downloads them.
 * It shows a spinner while fetching, a toast when nothing is there or the fetch fails, and is hidden
 * when the page is printed.
 *
 *   <ExportCsvButton fileName={`attendance ${className}`} columns={ATTENDANCE_CSV}
 *                    getRows={() => fetchAllPages(listAttendance, { classSubjectId })} />
 *
 * A sheet whose columns depend on the data (one per marked day) leaves `columns` out and has `getRows`
 * resolve `{ columns, rows }` instead.
 *
 * @param {object} props
 * @param {string} props.fileName without extension; it is turned into a safe file name
 * @param {import('../../lib/csv').CsvColumn[]} [props.columns]
 * @param {() => object[] | { columns: import('../../lib/csv').CsvColumn[], rows: object[] }
 *   | Promise<object[] | { columns: import('../../lib/csv').CsvColumn[], rows: object[] }>} props.getRows
 * @param {string} [props.label] button text (default "Download CSV")
 */
export function ExportCsvButton({ fileName, columns, getRows, label = 'Download CSV', size = 'md' }) {
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const onClick = async () => {
    setIsExporting(true);
    try {
      const result = await getRows();
      const sheet = Array.isArray(result) ? { columns, rows: result } : result;
      if (sheet.rows.length === 0) toast.info('Nothing to download yet.');
      else downloadCsv(fileName, sheet.columns, sheet.rows);
    } catch (error) {
      toast.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size={size}
      icon={Download}
      onClick={onClick}
      isLoading={isExporting}
      className="print:hidden"
    >
      {label}
    </Button>
  );
}
