/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookmarkManager } from '../types';
import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
import type { CharacterStatsCalculator } from './character-stats-calculator';

export class BookmarkManagerContinuous implements BookmarkManager {
  constructor(
    private calculator: CharacterStatsCalculator,
    private window: Window,
    private firstDimensionMargin: number
  ) {}

  scrollToBookmark(bookmarkData: BooksDbBookmarkData, customReadingPointScrollOffset = 0) {
    const targetScroll = this.getBookmarkPosition(bookmarkData);
    if (targetScroll === undefined) return;

    this.window.scrollTo({ top: targetScroll - customReadingPointScrollOffset });
  }

  formatBookmarkData(bookId: number, customReadingPointScrollOffset = 0): BooksDbBookmarkData {
    const exploredCharCount = this.calculator.calcExploredCharCount(customReadingPointScrollOffset);
    const bookCharCount = this.calculator.charCount;

    return {
      dataId: bookId,
      exploredCharCount,
      includesArabicCharacters: true,
      progress: bookCharCount ? exploredCharCount / bookCharCount : 0,
      scrollY: this.window.scrollY,
      lastBookmarkModified: new Date().getTime()
    };
  }

  formatBookmarkDataByRange(bookId: number): BooksDbBookmarkData {
    return this.formatBookmarkData(bookId);
  }

  getBookmarkBarPosition(bookmarkData: BooksDbBookmarkData): string | undefined {
    const targetScroll = this.getBookmarkPosition(bookmarkData);
    return targetScroll === undefined ? undefined : `${targetScroll + this.firstDimensionMargin}px`;
  }

  private getBookmarkPosition(bookmark: BooksDbBookmarkData): number | undefined {
    const { exploredCharCount, scrollY } = bookmark;
    if (!exploredCharCount) return undefined;
    if (scrollY && this.calculator.getCharCountByScrollPos(scrollY) === exploredCharCount) {
      return scrollY;
    }
    return this.calculator.getScrollPosByCharCount(exploredCharCount);
  }
}
