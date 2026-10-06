import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { BackButton } from './BackButton';

/**
 * Title block at the top of every page: a Back button (not on the role's home), the h1, an optional
 * description, right-aligned actions and, on detail pages, a breadcrumb. It also sets the browser tab title.
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
 * @param {number} [props.total] running total beside the title on list pages (`meta.total`)
 */
export function PageHeader({ title, description, actions, breadcrumbs, total }) {
  useDocumentTitle(title);
  // Without in-app history, Back goes up to the nearest breadcrumb that is a link (the parent page).
  const parent = breadcrumbs?.findLast((crumb) => crumb.to)?.to;

  return (
    <header className="mb-7">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 empty:hidden">
        <BackButton fallback={parent} />
        {breadcrumbs && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
              {breadcrumbs.map(({ label, to }, index) => (
                <li key={label} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
                  {to ? (
                    <Link to={to} className="rounded-sm hover:text-gray-900 hover:underline">
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
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] text-balance text-gray-900">
              {title}
            </h1>
            {total !== undefined && total !== null && (
              <span className="tabular text-lg text-gray-500">{total}</span>
            )}
          </div>
          {description && <p className="mt-1 text-[0.9375rem] text-gray-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
