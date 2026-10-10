import { useState } from 'react';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { Select } from '../../../components/ui/Select';
import { fetchAllPages } from '../../../lib/csv';
import { academicYearMonths, todayYmd } from '../../../utils/date';
import { listStudents } from '../../students/api';
import { getAttendanceSummary } from '../api';
import { sf2Sheet } from '../csv';

/**
 * A month of the class's school year and "Download SF2": the DepEd daily attendance report of the class for
 * that month (see sf2Sheet), from its roster and every lesson's marks per student and day. It opens on the
 * current month, or on the nearest month of a school year that is over or has not started.
 *
 * @param {object} props
 * @param {{ id: number, name: string, academicYear: string }} props.schoolClass
 */
export function Sf2Download({ schoolClass }) {
  const months = academicYearMonths(schoolClass.academicYear);
  const [selected, setSelected] = useState(() => {
    const thisMonth = todayYmd().slice(0, 7);
    if (thisMonth < months[0].value) return months[0].value;
    return months.some((month) => month.value === thisMonth) ? thisMonth : months.at(-1).value;
  });
  const month = months.find((option) => option.value === selected);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select
        aria-label="Month of the SF2"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        options={months}
        className="w-48"
      />
      <ExportCsvButton
        label="Download SF2"
        fileName={`SF2 ${schoolClass.name} ${month.label}`}
        getRows={async () => {
          const [roster, dayRows] = await Promise.all([
            fetchAllPages(listStudents, { classId: schoolClass.id }),
            getAttendanceSummary({
              classId: schoolClass.id,
              groupBy: 'studentDay',
              dateFrom: month.dateFrom,
              dateTo: month.dateTo,
            }),
          ]);
          return sf2Sheet(roster, dayRows);
        }}
      />
    </div>
  );
}
