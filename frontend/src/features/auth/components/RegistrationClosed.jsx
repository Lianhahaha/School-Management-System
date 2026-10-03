import { Alert } from '../../../components/ui/Alert';

/** Replaces the register form when the backend has self-registration switched off. */
export function RegistrationClosed() {
  return (
    <Alert tone="warning" title="Registration is closed">
      Self-registration is disabled. Ask an administrator to create your account.
    </Alert>
  );
}
