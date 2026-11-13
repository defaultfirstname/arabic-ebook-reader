/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { SortDirection } from '#lib/data/sort-types';
import { bookmarkToProgress, compareBookCards } from '../src/routes/manage/book-card-rules';

const bookTwo = {
  id: 2,
  title: 'كتاب 2',
  characters: 100,
  lastBookModified: 123,
  lastBookOpen: 0,
  progress: 0.5,
  lastBookmarkModified: 123
};
const bookTen = { ...bookTwo, id: 10, title: 'كتاب 10' };

test('sorts Arabic titles numerically in both directions', () => {
  expect(
    compareBookCards(bookTwo, bookTen, { property: 'title', direction: SortDirection.ASC })
  ).toBeLessThan(0);
  expect(
    compareBookCards(bookTwo, bookTen, { property: 'title', direction: SortDirection.DESC })
  ).toBeGreaterThan(0);
});

test('sorts numbers and breaks progress and date ties by ascending title', () => {
  for (const property of ['progress', 'lastBookmarkModified'] as const) {
    const later = { ...bookTen, [property]: bookTen[property] + 1 };
    for (const direction of [SortDirection.ASC, SortDirection.DESC]) {
      expect(compareBookCards(bookTwo, bookTen, { property, direction })).toBeLessThan(0);
      expect(compareBookCards(bookTen, { ...bookTen, id: 11 }, { property, direction })).toBe(0);
    }
    expect(
      compareBookCards(bookTwo, later, { property, direction: SortDirection.ASC })
    ).toBeLessThan(0);
    expect(
      compareBookCards(bookTwo, later, { property, direction: SortDirection.DESC })
    ).toBeGreaterThan(0);
  }
});

test('preserves the bookmark progress and timestamp conversions', () => {
  const empty = { progress: 0, lastBookmarkModified: 0 };
  expect(bookmarkToProgress(undefined)).toEqual(empty);
  expect(bookmarkToProgress({ progress: undefined, lastBookmarkModified: 123 })).toEqual(empty);
  expect(bookmarkToProgress({ progress: 0, lastBookmarkModified: 123 })).toEqual(empty);
  expect(bookmarkToProgress({ progress: 0.5, lastBookmarkModified: 123 })).toEqual({
    progress: 0.5,
    lastBookmarkModified: 123
  });
  expect(bookmarkToProgress({ progress: '50%', lastBookmarkModified: 0 })).toEqual({
    progress: 50,
    lastBookmarkModified: 0
  });
  expect(bookmarkToProgress({ progress: '0%', lastBookmarkModified: 123 })).toEqual({
    progress: 0,
    lastBookmarkModified: 123
  });
});
