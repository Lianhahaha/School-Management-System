import { useCallback, useRef, useState } from 'react';
import { ConfirmContext } from '../../hooks/useConfirm';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Owns the single ConfirmDialog of the app and exposes `confirm(options)` through `useConfirm()`.
 * A second request while one is open cancels the first.
 */
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolveRef = useRef(null);

  const settle = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback(
    (nextOptions) =>
      new Promise((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setOptions(nextOptions);
      }),
    [],
  );

  return (
    <ConfirmContext value={confirm}>
      {children}
      <ConfirmDialog
        {...options}
        open={options !== null}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext>
  );
}
