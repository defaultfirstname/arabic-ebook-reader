/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PdfLayout } from '#lib/components/pdf-viewer/pdf-spreads';

export interface PdfPageDimensions {
  width: number;
  height: number;
}

export interface PdfReadingPosition {
  page: number;
  layout: PdfLayout;
}

export interface PdfBook extends PdfReadingPosition {
  id: number;
  title: string;
  pages: PdfPageDimensions[];
  lastBookModified: number;
  lastBookOpen: number;
  lastBookmarkModified: number;
}
