<script lang="ts">
  import {
    nextChapter$,
    sectionList$,
    sectionProgress$,
    type SectionWithProgress
  } from '#lib/components/book-reader/book-toc/book-toc';
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
  import { onDestroy, onMount, untrack } from 'svelte';
  import Fa from 'svelte-fa';
  import type { AutoScroller, BookmarkManager, PageManager } from '../types';
  import { AutoScrollerContinuous } from './auto-scroller-continuous';
  import { BookmarkManagerContinuous } from './bookmark-manager-continuous';
  import { CharacterStatsCalculator } from './character-stats-calculator';
  import { PageManagerContinuous } from './page-manager-continuous';

  interface Props {
    htmlContent: string;
    width: number;
    height: number;
    rightToLeft: boolean;
    prioritizeReaderStyles: boolean;
    enableTextJustification: boolean;
    enableTextWrapPretty: boolean;
    fontColor: string;
    backgroundColor: string;
    fontFamilyGroupOne: string;
    fontFamilyGroupTwo: string;
    fontWeight: number | null;
    fontSize: number;
    lineHeight: number;
    textIndentation: number;
    textMarginMode: TextMarginMode;
    textMarginValue: number;
    hideSpoilerImage: boolean;
    secondDimensionMaxValue: number;
    firstDimensionMargin: number;
    autoPositionOnResize: boolean;
    autoBookmark: boolean;
    autoBookmarkTime: number;
    loadingState: boolean;
    multiplier: number;
    bookmarkData: Promise<BooksDbBookmarkData | undefined>;
    exploredCharCount: number;
    bookCharCount: number;
    autoScroller: AutoScroller | undefined;
    bookmarkManager: BookmarkManager | undefined;
    pageManager: PageManager | undefined;
    customReadingPoint: number;
    customReadingPointLeft: number;
    customReadingPointTop: number;
    customReadingPointScrollOffset: number;
    onBookmark: () => void;
    onContentChange: (content: HTMLElement) => void;
    onTrackerPause: () => void;
  }

  let {
    htmlContent,
    width,
    height,
    rightToLeft,
    prioritizeReaderStyles,
    enableTextJustification,
    enableTextWrapPretty,
    fontColor,
    backgroundColor,
    fontFamilyGroupOne,
    fontFamilyGroupTwo,
    fontWeight,
    fontSize,
    lineHeight,
    textIndentation,
    textMarginMode,
    textMarginValue,
    hideSpoilerImage,
    secondDimensionMaxValue,
    firstDimensionMargin,
    autoPositionOnResize,
    autoBookmark,
    autoBookmarkTime,
    loadingState,
    multiplier,
    bookmarkData = $bindable(),
    exploredCharCount = $bindable(),
    bookCharCount = $bindable(),
    autoScroller = $bindable(),
    bookmarkManager = $bindable(),
    pageManager = $bindable(),
    customReadingPoint = $bindable(),
    customReadingPointLeft = $bindable(),
    customReadingPointTop = $bindable(),
    customReadingPointScrollOffset = $bindable(),
    onBookmark,
    onContentChange,
    onTrackerPause
  }: Props = $props();

  let allowDisplay = $state(false);

  let contentEl = $state<HTMLElement>();

  let calculator = $state<CharacterStatsCalculator>();

  let layoutRevision = $state(0);

  let autoScrollerConcrete = $state<AutoScrollerContinuous>();

  let bookmarkManagerConcrete = $state<BookmarkManagerContinuous>();

  let pageManagerConcrete: PageManagerContinuous | undefined;

  let bookmarkPos = $state<string>();

  let scrollWhenReady = false;

  let prevIntendedCharCount = 0;

  let isResizeScroll = false;
  let viewportWidth = 0;

  let bookmarkAdjustment = $state('0.25rem');

  const width$ = new Subject<number>();

  const destroy$ = new Subject<void>();
  const contentChanged$ = new Subject<void>();
  let destroyed = false;

  const sectionToElement = new Map<string, HTMLElement>();

  const sectionData = new Map<string, SectionWithProgress>();

  let scrollAdjustment = 0;

  let willNavigate = false;

  $effect(() => {
    const currentWidth = width;
    untrack(() => width$.next(currentWidth));
  });

  $effect(() => {
    if (!width || !contentEl) return;

    const defaultAdjustment = window.matchMedia('(min-width: 640px)').matches
      ? '0.5rem'
      : '0.25rem';
    const margin = secondDimensionMaxValue
      ? Number.parseFloat(getComputedStyle(contentEl).marginRight)
      : 0;
    bookmarkAdjustment = margin
      ? `min(max(calc(${margin}px - ${defaultAdjustment}), ${defaultAdjustment}), ${margin}px)`
      : defaultAdjustment;
  });

  // The effect runs after the book HTML has been inserted into the document.
  $effect(() => {
    const html = htmlContent;
    const content = contentEl;
    if (!content) return;
    const stopFontWait = untrack(() => initializeContent(content, html));
    return () => {
      stopFontWait?.();
      contentChanged$.next();
    };
  });

  $effect(() => {
    const currentCalculator = calculator;
    if (!currentCalculator || !width || !height || loadingState) return;
    const frame = requestAnimationFrame(() => onContentDisplayChange(currentCalculator));
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    if (autoScrollerConcrete) {
      autoScrollerConcrete.multiplier = multiplier;
    }
  });

  $effect(() => {
    if (!calculator) return;
    const manager = new BookmarkManagerContinuous(calculator, window, firstDimensionMargin || 0);
    bookmarkManagerConcrete = manager;
    bookmarkManager = manager;
  });

  $effect(() => {
    const manager = bookmarkManagerConcrete;
    if (!layoutRevision || !manager) return;
    let current = true;
    bookmarkPos = undefined;
    bookmarkData.then((data) => {
      if (current && data) bookmarkPos = manager.getBookmarkBarPosition(data);
    });
    return () => (current = false);
  });

  $effect(() => {
    const manager = new PageManagerContinuous(firstDimensionMargin, window);
    pageManagerConcrete = manager;
    pageManager = manager;
  });

  $effect(() => {
    if ($customReadingPointEnabled$ && contentEl && Number.isFinite(customReadingPoint)) {
      untrack(() => {
        updateCustomReadingPointPosition();
        onScroll();
        updateSectionProgress();
      });
    }
  });

  onMount(() => {
    viewportWidth = window.innerWidth;
    const scroller = new AutoScrollerContinuous(multiplier, destroy$, document);
    autoScrollerConcrete = scroller;
    autoScroller = scroller;
    document.addEventListener('ttu-action', handleAction, false);
    return () => document.removeEventListener('ttu-action', handleAction, false);
  });

  /** Experimental Code - May be removed any time without warning */
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
      onTrackerPause();
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
    destroyed = true;
    destroy$.next();
    destroy$.complete();
  });

  width$
    .pipe(
      filter((currentWidth) => autoPositionOnResize && currentWidth > 0),
      distinctUntilChanged(),
      skip(1),
      debounceTime(10),
      observeOn(animationFrameScheduler),
      takeUntil(destroy$)
    )
    .subscribe(() => {
      if (!calculator || !pageManagerConcrete) return;

      const scrollPos =
        calculator.getScrollPosByCharCount(prevIntendedCharCount) - customReadingPointScrollOffset;
      const previousScrollY = window.scrollY;
      pageManagerConcrete.scrollTo(scrollPos);
      isResizeScroll = window.scrollY !== previousScrollY;
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
          if (destroyed || _calculator !== calculator || !data || !bookmarkManager) {
            return;
          }

          prevIntendedCharCount = data.exploredCharCount || 0;
          bookmarkManager.scrollToBookmark(data, customReadingPointScrollOffset);
        })
        .finally(() => {
          if (destroyed || _calculator !== calculator) return;

          if (autoBookmark) {
            fromEvent(window, 'scroll')
              .pipe(
                skip(1),
                debounceTime(autoBookmarkTime * 1000),
                takeUntil(contentChanged$),
                takeUntil(destroy$)
              )
              .subscribe(() => {
                onBookmark();
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
              takeUntil(contentChanged$),
              takeUntil(destroy$)
            )
            .subscribe(updateSectionProgress);
        });
    }
    layoutRevision += 1;
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
      if (destroyed || !calculator) return;

      exploredCharCount = calculator.calcExploredCharCount(customReadingPointScrollOffset);

      if (!isResizeScroll && exploredCharCount) {
        prevIntendedCharCount = exploredCharCount;
      }
      isResizeScroll = false;
    });
  }

  function initializeContent(content: HTMLElement, html: string) {
    scrollWhenReady = !!html;
    allowDisplay = false;
    layoutRevision = 0;
    bookmarkPos = undefined;
    sectionToElement.clear();
    sectionData.clear();
    scrollAdjustment = 0;
    calculator = new CharacterStatsCalculator(content, document.documentElement, document);
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
      onContentChange(content);
      return;
    }

    const font = fontFamilyGroupOne;
    const timeout = isStoredFont(font, $userFonts$) ? 30000 : 10000;
    const stopWaitingForFont = () => {
      clearTimeout(fontLoadTimer);
      document.fonts.removeEventListener('loadingdone', onFontLoaded);
    };
    const onFontLoaded = () => {
      stopWaitingForFont();
      onContentChange(content);
    };
    const fontLoadTimer = setTimeout(() => {
      logger.error(`Error loading primary Font: ${font}`);
      onFontLoaded();
    }, timeout);
    document.fonts.addEventListener('loadingdone', onFontLoaded);
    return stopWaitingForFont;
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
  {@html htmlContent}
</div>

{#if firstDimensionMargin}
  <div
    class="fixed inset-x-0 z-[5]"
    style:background-color={backgroundColor}
    style:height={`${firstDimensionMargin}px`}
    style:top="0"
  ></div>
  <div
    class="fixed inset-x-0 z-[5]"
    style:background-color={backgroundColor}
    style:height={`${firstDimensionMargin}px`}
    style:bottom="0"
  ></div>
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
  onmousedown={(e) => {
    if ($disableWheelNavigation$ && e.button === 1) {
      e.preventDefault();
    }
  }}
/>
<svelte:window
  onscroll={onScroll}
  onresize={() => {
    if (autoPositionOnResize && window.innerWidth !== viewportWidth) {
      isResizeScroll = true;
    }
    viewportWidth = window.innerWidth;
  }}
/>

<style lang="scss">
  @use '../styles';

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
