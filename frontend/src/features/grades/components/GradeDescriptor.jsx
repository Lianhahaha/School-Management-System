import { Badge } from '../../../components/ui/Badge';
import { descriptorOf } from '../../../utils/grades';

/**
 * The DepEd descriptor of a grade as a tag (Outstanding, Very Satisfactory, ...); nothing without a grade.
 *
 * @param {object} props
 * @param {number | null} props.result
 * @param {string} [props.className]
 */
export function GradeDescriptor({ result, className }) {
  const descriptor = descriptorOf(result);
  if (!descriptor) return null;
  return (
    <Badge tone={descriptor.tone} className={className}>
      {descriptor.label}
    </Badge>
  );
}
