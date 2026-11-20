/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PdfBook } from './pdf-book';

interface PdfRestoreOptions {
  existing?: Readonly<PdfBook>;
  incoming: Readonly<Omit<PdfBook, 'id'>>;
  overwrite: boolean;
}

export function getPdfRestoreDecision({ existing, incoming, overwrite }: PdfRestoreOptions): {
  book: Omit<PdfBook, 'id'> & { id?: number };
  replaceFile: boolean;
} {
  if (!existing) return { book: { ...incoming }, replaceFile: true };

  // File changes and reading progress have independent timestamps.
  const replaceFile = overwrite || incoming.lastBookModified > existing.lastBookModified;
  const fileMetadata = replaceFile ? incoming : existing;
  const position =
    overwrite || incoming.lastBookmarkModified > existing.lastBookmarkModified
      ? incoming
      : existing;

  return {
    book: {
      ...fileMetadata,
      id: existing.id,
      lastBookOpen: overwrite
        ? incoming.lastBookOpen
        : Math.max(incoming.lastBookOpen, existing.lastBookOpen),
      page: Math.min(position.page, fileMetadata.pages.length),
      layout: position.layout,
      lastBookmarkModified: position.lastBookmarkModified
    },
    replaceFile
  };
}
