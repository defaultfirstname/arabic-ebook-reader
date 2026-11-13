/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { getBookImportFormat } from '../src/lib/functions/file-loaders/book-import-format';

test('detects only supported lowercase extensions at the end of a filename', () => {
  expect(getBookImportFormat('كتاب.part.epub')).toBe('epub');
  expect(getBookImportFormat('كتاب.htmlz')).toBe('htmlz');
  expect(getBookImportFormat('كتاب.txt')).toBe('txt');
  expect(getBookImportFormat('كتاب.PDF')).toBeUndefined();
  expect(getBookImportFormat('كتاب.TXT')).toBeUndefined();
  expect(getBookImportFormat('كتاب.epub.zip')).toBeUndefined();
  expect(getBookImportFormat('كتاب')).toBeUndefined();
});
