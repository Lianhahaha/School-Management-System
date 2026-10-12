import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from '../src/lib/pagination';

describe('fetchAllPages', () => {
  const pageOf = (items, total, totalPages) => ({ items, meta: { total, totalPages } });

  it('fetches every page at the largest page size, keeping the filters', async () => {
    const fetchPage = vi.fn(async ({ page }) => pageOf([`row ${page}`], 3, 3));
    expect(await fetchAllPages(fetchPage, { classId: 4, page: 9 })).toEqual(['row 1', 'row 2', 'row 3']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { classId: 4, page: 1, limit: 100 });
    expect(fetchPage).toHaveBeenLastCalledWith({ classId: 4, page: 3, limit: 100 });
  });

  it('stops after one page when the list is empty or the response has no page count', async () => {
    const empty = vi.fn(async () => pageOf([], 0, 0));
    expect(await fetchAllPages(empty, {})).toEqual([]);
    const noCount = vi.fn(async () => ({ items: ['a'], meta: { total: 1 } }));
    expect(await fetchAllPages(noCount, {})).toEqual(['a']);
    expect(noCount).toHaveBeenCalledTimes(1);
  });

  // Page 1 was read, then a row was saved ahead of it: row 2 slid onto page 2 and is read again there.
  it('keeps a row once when a write between two pages repeats it on the next', async () => {
    const pages = [
      [{ id: 1 }, { id: 2 }],
      [{ id: 2, note: 'again' }, { id: 3 }],
    ];
    const fetchPage = vi.fn(async ({ page }) => pageOf(pages[page - 1], 4, 2));
    expect(await fetchAllPages(fetchPage, {})).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('keeps every row without an id', async () => {
    const fetchPage = vi.fn(async () =>
      pageOf([{ name: 'a' }, { name: 'a' }, { id: null }, { id: null }], 4, 1),
    );
    expect(await fetchAllPages(fetchPage, {})).toHaveLength(4);
  });

  it('refuses a list longer than 200 pages instead of returning part of it', async () => {
    const fetchPage = vi.fn(async () => pageOf(['a'], 20001, 201));
    await expect(fetchAllPages(fetchPage, {})).rejects.toThrow('20001 rows are too many to load at once');
    expect(fetchPage).toHaveBeenCalledTimes(1);
    const atLimit = vi.fn(async () => pageOf(['a'], 20000, 200));
    expect(await fetchAllPages(atLimit, {})).toHaveLength(200);
  });
});
