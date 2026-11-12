<script lang="ts">
  import { browser } from '$app/env';
  import {
    nextChapter$,
    sectionList$,
    sectionProgress$,
    type SectionWithProgress
  } from '#lib/components/book-reader/book-toc/book-toc';
  import HtmlRenderer from '#lib/components/html-renderer.svelte';
  import type { BooksDbBookmarkData } from '#lib/data/database/books-db/versions/books-db';
  import { getReaderFontStack, isStoredFont } from '#lib/data/fonts';
  import { logger } from '#lib/data/logger';
  import { customReadingPointEnabled$, disableWheelNavigation$, userFonts$ } from '#lib/data/store';
  import type { TextMarginMode } from '#lib/data/text-margin-mode';
  import { prependValue } from '#lib/functions/file-loaders/epub/generate-epub-html';
  import { getReferencePoints } from '#lib/functions/range-util';
  import { getExternalTargetElement } from '#lib/functions/utils';
  import { faBookmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import {
    animationFrameScheduler,
    debounce,
    debounceTime,
    distinctUntilChanged,
    EMPTY,
    filter,
    fromEvent,
    observeOn,
    skip,
    Subject,
    switchMap,
    take,
    takeUntil,
    timer
  } from 'rxjs';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import type { AutoScroller, BookmarkManager, PageManager } from '../types';
  import { AutoScrollerContinuous } from './auto-scroller-continuous';
  import { BookmarkManagerContinuous } from './bookmark-manager-continuous';
  import { CharacterStatsCalculator } from './character-stats-calculator';
  import { PageManagerContinuous } from './page-manager-continuous';

  export let htmlContent: string;

  export let width: number;

  export let height: number;

  export let rightToLeft: boolean;

  export let prioritizeReaderStyles: boolean;

  export let enableTextJustification: boolean;

  export let enableTextWrapPretty: boolean;

  export let fontColor: string;

  export let backgroundColor: string;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let fontWeight: number | null;

  export let fontSize: number;

  export let lineHeight: number;

  export let textIndentation: number;

  export let textMarginMode: TextMarginMode;

  export let textMarginValue: number;

  export let hideSpoilerImage: boolean;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let autoPositionOnResize: boolean;

  export let autoBookmark: boolean;

  export let autoBookmarkTime: number;

  export let loadingState: boolean;

  export let multiplier: number;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let autoScroller: AutoScroller | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let pageManager: PageManager | undefined;

  export let customReadingPoint: number;

  export let customReadingPointLeft: number;

  export let customReadingPointTop: number;

  export let customReadingPointScrollOffset: number;

  const dispatch = createEventDispatcher<{
    bookmark: void;
    contentChange: HTMLElement;
    trackerPause: void;
  }>();

  let allowDisplay = false;

  let contentEl: HTMLElement | undefined;

  let calculator: CharacterStatsCalculator | undefined;

  let contentReadyEvent = {};

  let autoScrollerConcrete: AutoScrollerContinuous | undefined;

  let bookmarkManagerConcrete: BookmarkManagerContinuous | undefined;

  let pageManagerConcrete: PageManagerContinuous | undefined;

  let bookmarkPos: string | undefined;

  let scrollWhenReady: boolean;

  let prevIntendedCharCount = 0;

  let isResizeScroll = false;

  let bookmarkAdjustment = window.matchMedia('(min-width: 640px)').matches ? '0.5rem' : '0.25rem';

  let fontLoadingAdded = false;
  let loadedHtml: string | undefined;

  const width$ = new Subject<number>();

  const destroy$ = new Subject<void>();

  const sectionToElement = new Map<string, HTMLElement>();

  const sectionData = new Map<string, SectionWithProgress>();

  let scrollAdjustment = 0;

  let willNavigate = false;

  $: width$.next(width);

  $: if (secondDimensionMaxValue && contentEl) {
    const dimensionAdjustment = Number(getComputedStyle(contentEl).marginRight.replace(/px$/, ''));

    bookmarkAdjustment = `min(max(calc(${`${dimensionAdjustment}px - ${bookmarkAdjustment}`}), ${bookmarkAdjustment}), ${
      dimensionAdjustment ? `${dimensionAdjustment}px` : bookmarkAdjustment
    })`;
  }

  $: {
    if (htmlContent) {
      scrollWhenReady = true;
    }
  }

  $: {
    if (calculator && width && height && !loadingState) {
      const c = calculator;
      requestAnimationFrame(() => {
        onContentDisplayChange(c);
      });
    }
  }

  $: {
    if (autoScrollerConcrete) {
      autoScrollerConcrete.multiplier = multiplier;
    }
  }

  $: {
    if (browser && calculator) {
      bookmarkManagerConcrete =
        browser &&
        calculator &&
        new BookmarkManagerContinuous(calculator, window, firstDimensionMargin || 0);
      bookmarkManager = bookmarkManagerConcrete;
    }
  }

  $: {
    if (contentReadyEvent) {
      bookmarkPos = undefined;
      bookmarkData.then((data) => {
        if (!data) return;
        bookmarkPos = bookmarkManagerConcrete?.getBookmarkBarPosition(data);
      });
    }
  }

  $: {
    if (browser) {
      pageManagerConcrete = new PageManagerContinuous(firstDimensionMargin, window);
      pageManager = pageManagerConcrete;
    }
  }

  $: if ($customReadingPointEnabled$ && contentEl && Number.isFinite(customReadingPoint)) {
    updateCustomReadingPointPosition();
    onScroll();
    updateSectionProgress();
  }

  /** Experimental Code - May be removed any time without warning */
  onMount(() => document.addEventListener('ttu-action', handleAction, false));

  function handleAction({ detail }: any) {
    if (!detail.type) {
      return;
    }

    if (detail.type === 'cue') {
      const { scroll, rect } = needScroll(detail.selector, detail.scrollMode);

      if (!scroll) {
        return;
      }

      willNavigate = true;

      window.scrollBy({
        left: 0,
        top:
          rect.top -
          (firstDimensionMargin || 0) -
          customReadingPointScrollOffset -
          (!customReadingPointScrollOffset ||
          (customReadingPointScrollOffset && scrollAdjustment > customReadingPointScrollOffset)
            ? scrollAdjustment
            : 0),
        behavior: detail.scrollBehavior || 'instant'
      });
    } else if (
      detail.type === 'pauseTracker' &&
      needScroll(detail.selector, detail.scrollMode).scroll
    ) {
      dispatch('trackerPause');
    }
  }

  function needScroll(selector: string, scrollMode: string) {
    const targetElement = getExternalTargetElement(document, selector);

    if (!targetElement || !contentEl) {
      return { scroll: false, rect: { top: 0, right: 0, bottom: 0, left: 0 } };
    }

    const rect = targetElement.getBoundingClientRect();

    if (!scrollMode || scrollMode === 'Always') {
      return { scroll: true, rect };
    }

    const footerElement = document.getElementById('ttu-page-footer');
    const { elTopReferencePoint, elBottomReferencePoint } = getReferencePoints(
      window,
      contentEl,
      firstDimensionMargin,
      footerElement
        ? Number.parseFloat(getComputedStyle(footerElement).height.replace('px', ''))
        : 0
    );

    return {
      scroll: rect.top <= elTopReferencePoint || rect.bottom >= elBottomReferencePoint,
      rect
    };
  }
  /** Experimental Code - May be removed any time without warning */

  onDestroy(() => {
    document.removeEventListener('ttu-action', handleAction, false);

    destroy$.next();
    destroy$.complete();
  });

  if (browser) {
    autoScrollerConcrete = new AutoScrollerContinuous(multiplier, destroy$, document);
    autoScroller = autoScrollerConcrete;
  }

  width$
    .pipe(
      filter(() => autoPositionOnResize),
      skip(1),
      distinctUntilChanged(),
      debounceTime(10),
      observeOn(animationFrameScheduler),
      takeUntil(destroy$)
    )
    .subscribe(() => {
      if (!calculator || !pageManagerConcrete) return;

      const scrollPos =
        calculator.getScrollPosByCharCount(prevIntendedCharCount) - customReadingPointScrollOffset;
      isResizeScroll = true;
      pageManagerConcrete.scrollTo(scrollPos);
    });

  function updateCustomReadingPointPosition() {
    if (!$customReadingPointEnabled$ || !contentEl) {
      return;
    }

    const {
      elLeftReferencePoint,
      elTopReferencePoint,
      elBottomReferencePoint,
      firstDimensionMargin: firstDimensionMarginValue,
      pointGap
    } = getReferencePoints(window, contentEl, firstDimensionMargin);

    customReadingPointTop = Math.min(
      Math.max(
        firstDimensionMarginValue +
          (elBottomReferencePoint - elTopReferencePoint) * (customReadingPoint / 100),
        firstDimensionMarginValue
      ),
      elBottomReferencePoint - pointGap * 1.5
    );
    customReadingPointLeft = elLeftReferencePoint;
    customReadingPointScrollOffset = customReadingPointTop - firstDimensionMarginValue;
  }

  function onContentDisplayChange(_calculator: CharacterStatsCalculator) {
    _calculator.updateParagraphPos();
    updateCustomReadingPointPosition();
    exploredCharCount = _calculator.calcExploredCharCount(customReadingPointScrollOffset);

    if (scrollWhenReady) {
      scrollWhenReady = false;

      bookmarkData
        .then((data) => {
          if (!data || !bookmarkManager) {
            return;
          }

          prevIntendedCharCount = data.exploredCharCount || 0;
          bookmarkManager.scrollToBookmark(data, customReadingPointScrollOffset);
        })
        .finally(() => {
          if (autoBookmark) {
            fromEvent(window, 'scroll')
              .pipe(skip(1), debounceTime(autoBookmarkTime * 1000), takeUntil(destroy$))
              .subscribe(() => {
                dispatch('bookmark');
              });
          }

          sectionList$
            .pipe(
              take(1),
              switchMap((sections) => {
                if (!sections.length) {
                  return EMPTY;
                }

                sections.forEach((section) => {
                  const ref = section.reference;
                  const elm = document.getElementById(ref);

                  if (elm) {
                    if (!scrollAdjustment) {
                      scrollAdjustment = Number.parseFloat(getComputedStyle(elm).marginBottom) / 2;
                    }

                    sectionData.set(ref, { ...section, progress: 0 });
                    sectionToElement.set(ref, elm);
                  }
                });

                if (sectionToElement.size) {
                  updateSectionProgress();

                  return fromEvent(window, 'scroll');
                }
                return EMPTY;
              }),
              debounce(() => timer(willNavigate ? 100 : 500)),
              takeUntil(destroy$)
            )
            .subscribe(updateSectionProgress);
        });
    }
    contentReadyEvent = {};
    allowDisplay = true;
  }

  function updateSectionProgress() {
    const entries = [...sectionData.entries()];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const [ref, entry] = entries[index];

      const elm = sectionToElement.get(ref) as HTMLElement;
      const rect = elm.getBoundingClientRect();

      entry.progress =
        (Math.abs(
          Math.min(
            Math.max(
              rect.top - (firstDimensionMargin || 0) - customReadingPointScrollOffset,
              -rect.height
            ),
            0
          )
        ) /
          (rect.height || 1)) *
        100;

      sectionData.set(ref, entry);
    }

    willNavigate = false;
    sectionProgress$.next(sectionData);
  }

  function onScroll() {
    requestAnimationFrame(() => {
      if (!calculator) return;

      exploredCharCount = calculator.calcExploredCharCount(customReadingPointScrollOffset);

      if (!isResizeScroll && exploredCharCount) {
        prevIntendedCharCount = exploredCharCount;
      }
      isResizeScroll = false;
    });
  }

  function onHtmlLoad() {
    // The renderer also reports updates caused by reading progress.
    if (!contentEl || loadedHtml === htmlContent) return;

    loadedHtml = htmlContent;
    calculator = new CharacterStatsCalculator(contentEl, document.documentElement, document);
    exploredCharCount = 0;
    prevIntendedCharCount = exploredCharCount;
    bookCharCount = calculator.charCount;

    let fontLoaded = false;

    try {
      fontLoaded = document.fonts.check(
        `${fontSize}px ${getReaderFontStack(fontFamilyGroupOne, 'serif')}`
      );
    } catch (error: any) {
      logger.error(`Error checking Font Load: ${error.message}`);
      fontLoaded = true;
    }

    if (fontLoaded) {
      dispatch('contentChange', contentEl);
    } else if (!fontLoadingAdded) {
      fontLoadingAdded = true;

      const timeout = isStoredFont(fontFamilyGroupOne, $userFonts$) ? 30000 : 10000;
      const fontLoadTimer = setTimeout(() => {
        if (!contentEl) {
          return;
        }

        logger.error(`Error loading primary Font: ${fontFamilyGroupOne}`);
        dispatch('contentChange', contentEl);
      }, timeout);

      document.fonts.addEventListener('loadingdone', () => {
        clearTimeout(fontLoadTimer);

        if (contentEl) {
          dispatch('contentChange', contentEl);
        }
      });
    }
  }

  nextChapter$.pipe(takeUntil(destroy$)).subscribe((chapterId) => {
    let targetElement = document.getElementById(chapterId);

    if (!targetElement) {
      return;
    }

    const checkForParent = !chapterId.startsWith(prependValue);

    targetElement = checkForParent
      ? targetElement.closest(`div[id^="${prependValue}"]`) || targetElement
      : targetElement;

    willNavigate = true;

    const rect = targetElement.getBoundingClientRect();

    window.scrollBy(
      0,
      rect.top -
        (firstDimensionMargin || 0) -
        customReadingPointScrollOffset -
        (!customReadingPointScrollOffset ||
        (customReadingPointScrollOffset && scrollAdjustment > customReadingPointScrollOffset)
          ? scrollAdjustment
          : 0)
    );
  });
</script>

<div
  bind:this={contentEl}
  style:color={fontColor}
  style:font-size="{fontSize}px"
  style:line-height={lineHeight}
  style:max-width={secondDimensionMaxValue ? `${secondDimensionMaxValue}px` : undefined}
  style:padding-top={firstDimensionMargin ? `${firstDimensionMargin}px` : undefined}
  style:padding-bottom={firstDimensionMargin ? `${firstDimensionMargin}px` : undefined}
  style:--font-family-serif={getReaderFontStack(fontFamilyGroupOne, 'serif')}
  style:--font-family-sans-serif={getReaderFontStack(fontFamilyGroupTwo, 'sans-serif')}
  style:--font-weight={fontWeight}
  style:--book-content-text-margin="{textMarginValue ?? 0}rem"
  style:--book-content-text-intendation="{textIndentation ?? 0}rem"
  class:book-content--hide-spoiler-image={hideSpoilerImage}
  class:ttu-apply-font-weight={!!fontWeight}
  class:ttu-apply-important={prioritizeReaderStyles}
  class:ttu-apply-justification={enableTextJustification}
  class:ttu-margin-manual={textMarginMode === 'manual'}
  class:ttu-text-wrap-pretty={enableTextWrapPretty}
  dir={rightToLeft ? 'rtl' : undefined}
  class="book-content m-auto"
>
  <HtmlRenderer html={htmlContent} on:load={onHtmlLoad} />
</div>

{#if firstDimensionMargin}
  <div
    class="fixed inset-x-0 z-[5]"
    style:background-color={backgroundColor}
    style:height={`${firstDimensionMargin}px`}
    style:top="0"
  />
  <div
    class="fixed inset-x-0 z-[5]"
    style:background-color={backgroundColor}
    style:height={`${firstDimensionMargin}px`}
    style:bottom="0"
  />
{/if}

{#if bookmarkPos}
  <div
    class="pointer-events-none absolute text-sm opacity-25 sm:text-xl"
    style:color={fontColor}
    style:left={bookmarkAdjustment}
    style:top={`calc(${bookmarkPos} + 1.5rem)`}
  >
    <Fa icon={faBookmark} />
  </div>
{/if}

{#if !allowDisplay}
  <div
    class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl"
    style:color={fontColor}
    style:background-color={backgroundColor}
  >
    <Fa icon={faSpinner} spin />
  </div>
{/if}

<svelte:body
  on:mousedown={(e) => {
    if ($disableWheelNavigation$ && e.button === 1) {
      e.preventDefault();
    }
  }}
/>
<svelte:window
  on:scroll={onScroll}
  on:resize={() => {
    if (autoPositionOnResize) {
      isResizeScroll = true;
    }
  }}
/>

<style lang="scss">
  @import '../styles';

  .book-content {
    :global(svg),
    :global(img) {
      max-height: 100vh;
    }
  }

  .book-content {
    > :global(*) {
      margin-bottom: 6rem;
    }

    :global(.grouped-image) {
      display: flex;
      flex-direction: row-reverse;
      justify-content: center;

      :global(svg) {
        margin: 0;
      }
    }
  }
</style>
