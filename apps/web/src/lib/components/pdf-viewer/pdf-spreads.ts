/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export type PdfLayout = 'single' | 'cover' | 'paired';

export function getPdfSpreads(widePages: readonly boolean[], layout: PdfLayout): number[][] {
  const spreads: number[][] = [];
  for (let index = 0; index < widePages.length; index += 1) {
    const page = index + 1;
    const canPair =
      layout !== 'single' &&
      (layout !== 'cover' || index !== 0) &&
      index + 1 < widePages.length &&
      !widePages[index] &&
      !widePages[index + 1];

    if (canPair) {
      spreads.push([page, page + 1]);
      index += 1;
    } else {
      spreads.push([page]);
    }
  }
  return spreads;
}
