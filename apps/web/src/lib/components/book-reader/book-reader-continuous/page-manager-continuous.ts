/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PageManager } from '../types';

export class PageManagerContinuous implements PageManager {
  constructor(
    private firstDimensionMargin: number,
    private window: Window
  ) {}

  nextPage() {
    this.scrollByPercent(0.95);
  }

  prevPage() {
    this.scrollByPercent(-0.95);
  }

  updateSectionDataByOffset() {
    // no-op
  }

  scrollTo(pos: number) {
    this.window.scrollTo({
      top: pos
    });
  }

  private scrollByPercent(value: number) {
    const pageSize = this.window.innerHeight - this.firstDimensionMargin * 2;
    this.window.scrollBy({
      top: pageSize * value,
      behavior: 'smooth'
    });
  }
}
