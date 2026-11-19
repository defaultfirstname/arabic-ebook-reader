/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PdfBook } from './pdf-book';

export const pdfBackupRoot = '__iliktruni_pdf_v1__';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPdfBackupMetadata(value: unknown): Omit<PdfBook, 'id'> {
  const data = value as { version?: unknown; book?: Partial<PdfBook> } | null;
  const book = data?.book;
  if (
    data?.version !== 1 ||
    !book ||
    typeof book.backupId !== 'string' ||
    !uuidPattern.test(book.backupId) ||
    typeof book.title !== 'string' ||
    !book.title.trim() ||
    !Array.isArray(book.pages) ||
    !book.pages.length ||
    !book.pages.every(
      (page) =>
        page &&
        Number.isFinite(page.width) &&
        page.width > 0 &&
        Number.isFinite(page.height) &&
        page.height > 0
    ) ||
    !Number.isInteger(book.page) ||
    book.page! < 1 ||
    book.page! > book.pages.length ||
    !['single', 'cover', 'paired'].includes(book.layout || '') ||
    ![book.lastBookModified, book.lastBookOpen, book.lastBookmarkModified].every(
      (time) => typeof time === 'number' && Number.isFinite(time) && time >= 0
    )
  )
    throw new Error('Invalid or unsupported PDF backup metadata.');
  // Select only portable fields: local database IDs must never overwrite another book.
  return {
    backupId: book.backupId,
    title: book.title,
    pages: book.pages,
    page: book.page!,
    layout: book.layout!,
    lastBookModified: book.lastBookModified!,
    lastBookOpen: book.lastBookOpen!,
    lastBookmarkModified: book.lastBookmarkModified!
  };
}
