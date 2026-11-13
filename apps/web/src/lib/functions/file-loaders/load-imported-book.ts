/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { getBookImportFormat } from './book-import-format';
import loadEpub from './epub/load-epub';
import loadHtmlz from './htmlz/load-htmlz';
import loadTxt from './txt/load-txt';

export function loadImportedBook(file: File, document: Document, lastBookModified: number) {
  switch (getBookImportFormat(file.name)) {
    case 'epub':
      return loadEpub(file, document, lastBookModified);
    case 'htmlz':
      return loadHtmlz(file, document, lastBookModified);
    case 'txt':
      return loadTxt(file, lastBookModified);
    default:
      throw new Error('File(s) must be HTMLZ, TXT or EPUB');
  }
}
