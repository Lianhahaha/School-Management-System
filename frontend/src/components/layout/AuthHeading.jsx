import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/** Title and subtitle at the top of a public page's card; also sets the browser tab title. */
export function AuthHeading({ title, description }) {
  useDocumentTitle(title);

  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
    </div>
  );
}
