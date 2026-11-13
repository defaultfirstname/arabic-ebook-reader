/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

const bookImportFormats = {
  epub: ['application/epub+zip', '.epub'],
  htmlz: ['.htmlz'],
  txt: ['plain/text', '.txt']
} as const;

type BookImportFormat = keyof typeof bookImportFormats;

export const bookImportAccept = Object.values(bookImportFormats).flat().join(',');
export const localBookImportAccept = `${bookImportAccept},application/pdf,.pdf`;

export function isPdfFile(filename: string) {
  return /\.pdf$/i.test(filename);
}

export function getBookImportFormat(filename: string): BookImportFormat | undefined {
  const extension = /\.([^.]+)$/.exec(filename)?.[1];
  if (extension && Object.hasOwn(bookImportFormats, extension)) {
    return extension as BookImportFormat;
  }
  return undefined;
}
