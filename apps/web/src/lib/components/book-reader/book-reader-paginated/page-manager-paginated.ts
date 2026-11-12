/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Observable, take, type Subject, type BehaviorSubject } from 'rxjs';
import {
  sectionProgress$,
  sectionList$,
  type SectionWithProgress
} from '#lib/components/book-reader/book-toc/book-toc';
import type { PageManager } from '../types';

export class PageManagerPaginated implements PageManager {
  private translated = false;

  private sectionData: Map<string, SectionWithProgress> = new Map();

  constructor(
    private contentEl: HTMLElement,
    private scrollEl: HTMLElement,
    private sections: Element[],
    private sectionIndex$: BehaviorSubject<number>,
    private virtualScrollPos$: BehaviorSubject<number>,
    private width: number,
    private pageGap: number,
    private rightToLeft: boolean,
    private pageChange$: Subject<boolean>,
    private sectionRenderComplete$: Subject<number>
  ) {
    sectionList$.pipe(take(1)).subscribe((entries) => {
      if (!entries.length) {
        return;
      }

      entries.forEach((section) => {
        this.sectionData.set(section.reference, { ...section, progress: 0 });
      });

      sectionProgress$.next(this.sectionData);
    });
  }

  nextPage() {
    this.flipPage(1);
  }

  prevPage() {
    this.flipPage(-1);
  }

  updateSectionDataByOffset(offset = 0) {
    const currentPercentage = (this.virtualScrollPos$.getValue() / this.scrollEl.scrollWidth) * 100;

    if (offset) {
      const nextPageOffset = this.virtualScrollPos$.getValue() + this.width + this.pageGap;
      const diffPercentage = (nextPageOffset / this.scrollEl.scrollWidth) * 100 - currentPercentage;

      this.updateSectionData(
        this.sections[this.sectionIndex$.getValue()]?.id,
        currentPercentage + diffPercentage * offset
      );
    } else {
      this.updateSectionData(this.sections[this.sectionIndex$.getValue()]?.id, currentPercentage);
    }
  }

  flipPage(multiplier: 1 | -1) {
    const offset = this.width + this.pageGap;
    const isUser = true;

    if (this.translated) {
      if (multiplier < 0) {
        this.scrollToPos(this.virtualScrollPos$.getValue() - offset, isUser);
        return;
      }

      if (this.nextSection(isUser)) {
        this.clearTranslation();
      }
      return;
    }

    const minValue = 0;
    const maxValue = this.scrollEl.scrollWidth;
    const currentValue = this.virtualScrollPos$.getValue();
    const newValue = currentValue + offset * multiplier;
    const newValueCeil = Math.ceil(newValue);

    if (newValueCeil < minValue) {
      if (currentValue !== minValue) {
        this.scrollToPos(minValue, isUser);
        return;
      }

      this.prevSection(offset, isUser);
      return;
    }
    if (newValueCeil >= maxValue) {
      this.nextSection(isUser);
      return;
    }

    this.scrollOrTranslateToPos(newValue, maxValue, isUser);
  }

  scrollTo(scrollPos: number, isUser: boolean) {
    this.scrollOrTranslateToPos(scrollPos, this.scrollEl.scrollWidth, isUser);
  }

  private prevSection(offset: number, isUser: boolean) {
    const nextPage = this.sectionIndex$.getValue() - 1;
    if (nextPage < 0) return false;

    this.updateSectionIndex(nextPage).subscribe(() => {
      const scrollSize = this.scrollEl.scrollWidth;
      let scrollValue = offset * (Math.ceil(scrollSize / offset) - 1);
      if (Math.ceil(scrollValue) >= scrollSize) {
        scrollValue -= offset;
      }
      this.scrollOrTranslateToPos(scrollValue, scrollSize, isUser);
    });
    return true;
  }

  private nextSection(isUser: boolean) {
    const nextPage = this.sectionIndex$.getValue() + 1;
    if (nextPage >= this.sections.length) return false;

    this.updateSectionIndex(nextPage).subscribe(() => {
      this.scrollToPos(0, isUser);
      this.updateSectionData(this.sections[nextPage - 1]?.id, 100, false);
      this.updateSectionData(this.sections[nextPage]?.id, 0);
    });
    return true;
  }

  private scrollOrTranslateToPos(pos: number, scrollSize: number, isUser: boolean) {
    this.updateSectionData(
      this.sections[this.sectionIndex$.getValue()]?.id,
      (pos / scrollSize) * 100
    );

    if (pos + this.width <= scrollSize) {
      this.scrollToPos(pos, isUser);
      return;
    }
    this.translateXToPos(pos, isUser);
  }

  private scrollToPos(pos: number, isUser: boolean) {
    this.clearTranslation();
    this.virtualScrollPos$.next(pos);
    const offset = this.rightToLeft ? -pos : pos;
    this.scrollEl.scrollTo({ left: offset });
    this.pageChange$.next(isUser);
  }

  private translateXToPos(pos: number, isUser: boolean) {
    this.scrollEl.scrollTo({ left: 0 });
    this.virtualScrollPos$.next(pos);
    this.contentEl.style.transform = `translateX(${this.rightToLeft ? pos : -pos}px)`;
    this.translated = true;
    this.pageChange$.next(isUser);
  }

  private clearTranslation() {
    if (!this.translated) return;
    this.contentEl.style.removeProperty('transform');
    this.translated = false;
  }

  /**
   * Updates the section index if necessary
   * @param index New section index
   * @returns An observable that emits when the section index equals to the new index
   */
  private updateSectionIndex(index: number) {
    return new Observable<void>((subscriber) => {
      if (this.sectionIndex$.getValue() === index) {
        subscriber.next();
        subscriber.complete();
        return undefined;
      }

      const subscription = this.sectionRenderComplete$.subscribe((newIndex) => {
        if (newIndex === index) {
          subscriber.next();
        }
        subscriber.complete();
        subscription.unsubscribe();
      });
      this.sectionIndex$.next(index);
      return subscription;
    });
  }

  private updateSectionData(ref: string, progress: number, emit = true) {
    if (!ref || !this.sectionData.has(ref)) return;

    const sections = [...this.sectionData.values()];
    let currentRefSeen = false;

    sections.forEach((section) => {
      const entry = this.sectionData.get(section.reference) as SectionWithProgress;
      const isCurrentRef = section.reference === ref;

      if (isCurrentRef) {
        entry.progress = progress;
      } else if (currentRefSeen) {
        entry.progress = 0;
      } else {
        entry.progress = 100;
      }

      if (!currentRefSeen && isCurrentRef) {
        currentRefSeen = true;
      }
      this.sectionData.set(section.reference, entry);
    });

    if (emit) {
      sectionProgress$.next(this.sectionData);
    }
  }
}
