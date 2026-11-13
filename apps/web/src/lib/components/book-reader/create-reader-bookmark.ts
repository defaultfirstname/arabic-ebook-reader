/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbBookmarkData } from '#lib/data/database/books-db/versions/books-db';

interface ReaderBookmarkOptions {
  dataId: number;
  exploredCharCount: number;
  bookCharCount: number;
  lastBookmarkModified: number;
}

export function createReaderBookmark({
  dataId,
  exploredCharCount,
  bookCharCount,
  lastBookmarkModified
}: ReaderBookmarkOptions): BooksDbBookmarkData {
  return {
    dataId,
    exploredCharCount,
    includesArabicCharacters: true,
    progress: bookCharCount ? exploredCharCount / bookCharCount : 0,
    lastBookmarkModified
  };
}
