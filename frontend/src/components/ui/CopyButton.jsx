import { Copy } from 'lucide-react';
import { toastBus } from '../../lib/toastBus';
import { Button } from './Button';

/**
 * A small square button that copies `value` and says so in a toast; a browser that refuses (an old one, an
 * insecure page) is told to select the text instead.
 *
 * @param {object} props
 * @param {string} props.value what is copied
 * @param {string} props.label what it is, for the button's name and the toast ("Email" -> "Copy email", "Email copied")
 */
export function CopyButton({ value, label, className }) {
  const copy = () =>
    navigator.clipboard
      .writeText(value)
      .then(() => toastBus.success(`${label} copied`))
      .catch(() => toastBus.info(`Couldn't copy. Select the ${label.toLowerCase()} and copy it instead.`));

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={Copy}
      aria-label={`Copy ${label.toLowerCase()}`}
      title={`Copy ${label.toLowerCase()}`}
      onClick={copy}
      className={className}
    />
  );
}
