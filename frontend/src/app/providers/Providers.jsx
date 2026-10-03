import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ConfirmProvider } from '../../components/ui/ConfirmProvider';
import { ToastProvider } from '../../components/ui/Toast';
import { queryClient } from '../../lib/queryClient';
import { AuthProvider } from './AuthProvider';

/** App-wide providers. The query devtools exist only in development builds. */
export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
