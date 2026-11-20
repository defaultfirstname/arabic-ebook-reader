/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import type { PdfBook } from '../src/lib/data/storage/pdf-book';
import { getPdfRestoreDecision } from '../src/lib/data/storage/pdf-restore-rules';

function dimensions(count: number) {
  return Array.from({ length: count }, () => ({ width: 100, height: 200 }));
}

const existing: PdfBook = Object.freeze({
  id: 42,
  backupId: '12345678-1234-1234-1234-123456789abc',
  title: 'كتاب محلي',
  pages: dimensions(10),
  page: 8,
  layout: 'paired',
  lastBookModified: 20,
  lastBookmarkModified: 40,
  lastBookOpen: 60
});

function backup(changes: Partial<Omit<PdfBook, 'id'>> = {}): Omit<PdfBook, 'id'> {
  const { id: _id, ...book } = existing;
  return Object.freeze({ ...book, title: 'نسخة احتياطية', ...changes });
}

test('restores a new PDF without carrying a local database ID', () => {
  const incoming = backup();
  expect(getPdfRestoreDecision({ incoming, overwrite: false })).toEqual({
    book: incoming,
    replaceFile: true
  });
  expect(getPdfRestoreDecision({ incoming, overwrite: true }).book).not.toHaveProperty('id');
});

test('takes a newer file while preserving and clamping the newer local position', () => {
  const incoming = backup({
    pages: dimensions(3),
    page: 1,
    layout: 'cover',
    lastBookModified: 30,
    lastBookmarkModified: 10,
    lastBookOpen: 5
  });
  const result = getPdfRestoreDecision({ existing, incoming, overwrite: false });
  expect(result).toEqual({
    replaceFile: true,
    book: {
      ...incoming,
      id: 42,
      page: 3,
      layout: 'paired',
      lastBookmarkModified: 40,
      lastBookOpen: 60
    }
  });
  expect(existing.page).toBe(8);
  expect(incoming.page).toBe(1);
});

test('takes newer archived progress without replacing a newer local file', () => {
  const incoming = backup({
    pages: dimensions(2),
    page: 2,
    layout: 'single',
    lastBookModified: 10,
    lastBookmarkModified: 50,
    lastBookOpen: 70
  });
  expect(getPdfRestoreDecision({ existing, incoming, overwrite: false })).toEqual({
    replaceFile: false,
    book: { ...existing, page: 2, layout: 'single', lastBookmarkModified: 50, lastBookOpen: 70 }
  });
});

test('retains local file and position when timestamps tie, including zero', () => {
  for (const timestamp of [0, 20]) {
    const local = { ...existing, lastBookModified: timestamp, lastBookmarkModified: timestamp };
    const incoming = backup({
      page: 1,
      layout: 'cover',
      lastBookModified: timestamp,
      lastBookmarkModified: timestamp,
      lastBookOpen: 0
    });
    expect(getPdfRestoreDecision({ existing: local, incoming, overwrite: false })).toEqual({
      book: local,
      replaceFile: false
    });
  }
});

test('explicit overwrite restores older archived data and keeps the destination ID', () => {
  const incoming = backup({
    pages: dimensions(2),
    page: 1,
    layout: 'cover',
    lastBookModified: 0,
    lastBookmarkModified: 0,
    lastBookOpen: 0
  });
  expect(getPdfRestoreDecision({ existing, incoming, overwrite: true })).toEqual({
    book: { ...incoming, id: 42 },
    replaceFile: true
  });
});
