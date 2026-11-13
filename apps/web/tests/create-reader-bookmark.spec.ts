/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { createReaderBookmark } from '../src/lib/components/book-reader/create-reader-bookmark';

const position = {
  dataId: 7,
  exploredCharCount: 31,
  bookCharCount: 80,
  lastBookmarkModified: 123
};

test('keeps the exact character position and stores progress as a fraction', () => {
  expect(createReaderBookmark(position)).toEqual({
    dataId: 7,
    exploredCharCount: 31,
    includesArabicCharacters: true,
    progress: 0.3875,
    lastBookmarkModified: 123
  });
});

test('stores zero progress when the book has no counted characters', () => {
  expect(createReaderBookmark({ ...position, bookCharCount: 0 }).progress).toBe(0);
});
