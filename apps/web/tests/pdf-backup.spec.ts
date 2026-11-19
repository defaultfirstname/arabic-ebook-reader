/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { readPdfBackupMetadata } from '../src/lib/data/storage/pdf-backup';

test('validates portable PDF metadata and discards local database IDs', () => {
  const book = {
    id: 500,
    backupId: '12345678-1234-1234-1234-123456789abc',
    title: 'كتاب',
    pages: [{ width: 100, height: 200 }],
    page: 1,
    layout: 'cover',
    lastBookModified: 0,
    lastBookOpen: 0,
    lastBookmarkModified: 0
  };
  const restored = readPdfBackupMetadata({ version: 1, book });
  expect(restored).not.toHaveProperty('id');
  expect(restored).toMatchObject({
    backupId: book.backupId,
    title: book.title,
    page: 1,
    layout: 'cover'
  });
  for (const change of [
    { backupId: '../another-book' },
    { page: 0 },
    { page: 2 },
    { layout: 'unknown' },
    { pages: [] },
    { pages: [{ width: -1, height: 200 }] },
    { lastBookOpen: 'yesterday' }
  ])
    expect(() => readPdfBackupMetadata({ version: 1, book: { ...book, ...change } })).toThrow();
  expect(() => readPdfBackupMetadata({ version: 2, book })).toThrow();
  expect(() => readPdfBackupMetadata(null)).toThrow();
});
