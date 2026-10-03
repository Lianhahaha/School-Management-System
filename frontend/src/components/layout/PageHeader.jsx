import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/**
 * Title block at the top of every page: the h1, an optional description, right-aligned actions and,
 * on detail pages, a breadcrumb. It also sets the browser tab title.
 *
 *   <PageHeader title="Students" description="All registered students"
 *     actions={<Button onClick={modal.open}>Add student</Button>} />
 *   <PageHeader title="Grade 7 - A" breadcrumbs={[{ label: 'Classes', to: '/admin/classes' }, { label: 'Grade 7 - A' }]} />
 *
 * @param {object} props
 * @param {string} props.title plain text (it is also the document title)
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.actions] primary buttons
 * @param {Array<{ label: string, to?: string }>} [props.breadcrumbs] the last entry is the current page
 */
export function PageHeader({ title, description, actions, breadcrumbs }) {
  useDocumentTitle(title);

  return (
    <header className="mb-6">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
            {breadcrumbs.map(({ label, to }, index) => (
              <li key={label} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
                {to ? (
                  <Link to={to} className="hover:text-gray-900 hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-gray-700">
                    {label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
