import { ShieldX } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { roleHome } from '../../../utils/roles';
import { useAuth } from '../../auth/hooks';

export default function ForbiddenPage() {
  const { role } = useAuth();
  useDocumentTitle('Access denied');

  return (
    <Card padded={false}>
      <EmptyState
        icon={ShieldX}
        title="You don't have access to this page"
        description="Your account's role does not include it. If you think this is a mistake, contact the administrator."
        action={
          <Button as={Link} to={roleHome(role)}>
            Go to my dashboard
          </Button>
        }
      />
    </Card>
  );
}
