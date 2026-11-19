/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { DatabaseService } from '#lib/data/database/books-db/database.service';
import { logger } from '#lib/data/logger';
import { loadPdf, pdfOpenError, readPdfDimensions } from './pdf-document';

interface ImportPdfBookOptions {
  signal: AbortSignal;
  storage: Pick<DatabaseService, 'addPdfBook'>;
}

export async function importPdfBook(file: File, { signal, storage }: ImportPdfBookOptions) {
  let opened: Awaited<ReturnType<typeof loadPdf>> | undefined;
  try {
    const data = await file.arrayBuffer();
    // PDF.js transfers its buffer to the worker. Keep the original bytes for storage.
    opened = await loadPdf(data.slice(0), signal);
    const pages = await readPdfDimensions(opened.document, signal);
    if (!pages.length) throw new Error('Empty PDF');
    await storage.addPdfBook(
      {
        title: file.name.replace(/\.pdf$/i, '') || file.name,
        pages,
        page: 1,
        layout: 'cover',
        lastBookModified: file.lastModified,
        lastBookOpen: 0,
        lastBookmarkModified: 0
      },
      // Large ArrayBuffers can exceed IndexedDB's serialized-value limit in Chromium.
      new Blob([data], { type: 'application/pdf' }),
      signal
    );
  } catch (cause) {
    if (!signal.aborted) {
      logger.warn('PDF import failed', cause);
      return `${file.name}: ${opened ? 'Could not import this PDF.' : pdfOpenError(cause)}`;
    }
  } finally {
    await opened?.destroy();
  }
  return undefined;
}
