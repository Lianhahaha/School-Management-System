import { useEffect } from 'react';
import { APP_NAME } from '../constants/ui';

/**
 * Sets the browser tab title to "<title> · Skole" while the component is mounted.
 * PageHeader and AuthHeading call it, so pages rarely need it directly.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
