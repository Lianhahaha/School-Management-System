import { ChartNoAxesColumn } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';

/** Students per grade level as horizontal bars (payload `enrollmentsByGrade`), scaled to the biggest grade. */
export function EnrollmentByGradeCard({ grades }) {
  const sorted = [...grades].sort((a, b) => a.gradeLevel - b.gradeLevel);
  const largest = Math.max(1, ...sorted.map((grade) => grade.students));

  return (
    <Card title="Enrollment by grade" description="Students with an active enrollment">
      {sorted.length === 0 ? (
        <EmptyState icon={ChartNoAxesColumn} title="No enrollments yet" compact />
      ) : (
        <ul className="space-y-3">
          {sorted.map((grade) => (
            <li key={grade.gradeLevel} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 text-gray-700">Grade {grade.gradeLevel}</span>
              <div
                role="meter"
                aria-label={`Grade ${grade.gradeLevel} students`}
                aria-valuemin={0}
                aria-valuemax={largest}
                aria-valuenow={grade.students}
                className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"
              >
                <div
                  className="h-full rounded-full bg-gray-900"
                  style={{ width: `${(grade.students / largest) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-medium text-gray-900 tabular-nums">
                {grade.students}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
