import { describe, expect, it } from 'vitest';
import { HELP } from '../src/features/help/helpContent';

/** The pages each role may open (its own area, plus the pages every role shares). */
const AREAS = {
  admin: '/admin',
  assistant: '/admin',
  teacher: '/teacher',
  student: '/student',
};
const SHARED_PAGES = ['/profile', '/privacy', '/help'];

describe('help content', () => {
  it.each(Object.keys(AREAS))('gives the %s short answers that open their own pages', (role) => {
    const entries = HELP[role];
    expect(entries.length).toBeGreaterThan(10);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(entry.question, entry.id).toMatch(/^(How do I|Why) .+\?$/);
      expect(entry.steps.length, entry.id).toBeGreaterThanOrEqual(2);
      expect(entry.steps.length, entry.id).toBeLessThanOrEqual(5);
      if (entry.to) {
        const ownPage = entry.to.startsWith(AREAS[role]) || SHARED_PAGES.includes(entry.to.split('?')[0]);
        expect(ownPage, `${entry.id} -> ${entry.to}`).toBe(true);
        expect(entry.toLabel, entry.id).toBeTruthy();
      }
    }
  });

  it('tells every role how to use their privacy rights', () => {
    for (const role of Object.keys(AREAS)) {
      expect(HELP[role].map((entry) => entry.id)).toContain('privacy-request');
    }
  });
});
