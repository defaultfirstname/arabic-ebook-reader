/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type BooksDbV6 from '#lib/data/database/books-db/versions/v6/books-db-v6';
import type { BookReference } from '#lib/data/book-reference';
import type { PdfBook } from '#lib/data/storage/pdf-book';

interface BooksDb extends BooksDbV6 {
  lastItem: { key: number; value: BookReference };
  pdfBook: { key: number; value: PdfBook };
  pdfFile: { key: number; value: Blob | ArrayBuffer };
}

export type BooksDbBookData = BooksDb['data']['value'];
export type BooksDbBookmarkData = BooksDb['bookmark']['value'];
export type BooksDbStorageSource = BooksDb['storageSource']['value'];
export type BooksDbStatistic = BooksDb['statistic']['value'];
export type BooksDbReadingGoal = BooksDb['readingGoal']['value'];
export type BooksDbLastModified = BooksDb['lastModified']['value'];
export type BooksDbAudioBook = BooksDb['audioBook']['value'];
export type BooksDbSubtitleData = BooksDb['subtitle']['value'];
export type BooksDbHandle = BooksDb['handle']['value'];
// Existing ZIP and external storage records still use the v6 file format.
export const currentDbVersion = 6;
export const booksSchemaVersion = 7;

export type { BooksDb as default };
