import { BookText, Megaphone, School, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { env } from '../../../config/env';

/** Shortcuts to the pages where an admin creates things, plus the API documentation. */
export function AdminQuickActionsCard() {
  return (
    <Card title="Quick actions">
      <div className="flex flex-wrap gap-3">
        <Button as={Link} to="/admin/users" variant="secondary" icon={UserPlus}>
          Create user
        </Button>
        <Button as={Link} to="/admin/classes" variant="secondary" icon={School}>
          Create class
        </Button>
        <Button as={Link} to="/admin/announcements" variant="secondary" icon={Megaphone}>
          New announcement
        </Button>
        <Button as="a" href={env.apiDocsUrl} target="_blank" rel="noreferrer" variant="ghost" icon={BookText}>
          API docs
          <span className="sr-only"> (opens in a new tab)</span>
        </Button>
      </div>
    </Card>
  );
}
