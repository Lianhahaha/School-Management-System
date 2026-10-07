import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { BackButton } from './BackButton';

/**
 * Title block at the top of every page: the h1, an optional description, right-aligned actions and, on
 * detail pages, a Back button beside the breadcrumb. Pages reached from the navigation have no Back: the
 * sidebar (or the phone tab bar) is how you move between them. It also sets the browser tab title.
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
    <header className="page-band mb-6 rounded-2xl bg-band px-4 py-5 text-band-ink sm:mb-7 sm:px-7 sm:py-6 print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-black">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 empty:hidden">
        {breadcrumbs && <BackButton fallback={parent} />}
        {breadcrumbs && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-band-ink/75">
              {breadcrumbs.map(({ label, to }, index) => (
                <li key={label} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
                  {to ? (
                    <Link to={to} className="rounded-sm hover:text-band-ink hover:underline">
                      {label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-band-ink">
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
            <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-[1.75rem]">
              {title}
            </h1>
            {total !== undefined && total !== null && (
              <span className="tabular text-lg text-band-ink/75">{total}</span>
            )}
          </div>
          {description && <p className="mt-1 text-[0.9375rem] text-band-ink/85">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
