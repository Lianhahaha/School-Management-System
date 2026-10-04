import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../features/auth/hooks';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { roleHome } from '../../utils/roles';

export default function NotFoundPage() {
  const { role } = useAuth();
  useDocumentTitle('Page not found');

  return (
    <Card padded={false}>
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button as={Link} to={roleHome(role)}>
            Go to my dashboard
          </Button>
        }
      />
    </Card>
  );
}
