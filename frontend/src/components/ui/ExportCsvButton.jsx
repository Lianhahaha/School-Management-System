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
 * @param {object} props
 * @param {string} props.fileName without extension; it is turned into a safe file name
 * @param {Array<{ header: string, value: (row: object) => unknown }>} props.columns
 * @param {() => object[] | Promise<object[]>} props.getRows
 * @param {string} [props.label] button text (default "Download CSV")
 */
export function ExportCsvButton({ fileName, columns, getRows, label = 'Download CSV', size = 'md' }) {
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const onClick = async () => {
    setIsExporting(true);
    try {
      const rows = await getRows();
      if (rows.length === 0) toast.info('Nothing to download yet.');
      else downloadCsv(fileName, columns, rows);
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
