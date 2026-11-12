<script lang="ts">
  import {
    animationFrameScheduler,
    combineLatest,
    debounceTime,
    filter,
    map,
    mergeMap,
    of,
    ReplaySubject,
    share,
    shareReplay,
    startWith,
    Subject,
    tap
  } from 'rxjs';
  import BookReaderContinuous from '#lib/components/book-reader/book-reader-continuous/book-reader-continuous.svelte';
  import { pxReader } from '#lib/components/book-reader/css-classes';
  import type { BooksDbBookmarkData } from '#lib/data/database/books-db/versions/books-db';
  import type { TextMarginMode } from '#lib/data/text-margin-mode';
  import { ViewMode } from '#lib/data/view-mode';
  import { iffBrowser } from '#lib/functions/rxjs/iff-browser';
  import { reduceToEmptyString } from '#lib/functions/rxjs/reduce-to-empty-string';
  import { writableSubject } from '#lib/functions/svelte/store';
  import { convertRemToPixels } from '#lib/functions/utils';
  import { logger } from '#lib/data/logger';
  import { imageLoadingState } from './image-loading-state';
  import { reactiveElements } from './reactive-elements';
  import type { AutoScroller, BookmarkManager, PageManager } from './types';
  import BookReaderPaginated from './book-reader-paginated/book-reader-paginated.svelte';
  import { enableReaderWakeLock$, enableTapEdgeToFlip$ } from '#lib/data/store';
  import { onDestroy } from 'svelte';

  interface Props {
    htmlContent: string;
    rightToLeft: boolean;
    language: string | undefined;
    width: number;
    height: number;
    prioritizeReaderStyles: boolean;
    enableTextJustification: boolean;
    enableTextWrapPretty: boolean;
    textIndentation: number;
    textMarginMode: TextMarginMode;
    textMarginValue: number;
    fontColor: string;
    backgroundColor: string;
    fontFamilyGroupOne: string;
    fontFamilyGroupTwo: string;
    fontWeight: number | null;
    fontSize: number;
    lineHeight: number;
    hideSpoilerImage: boolean;
    secondDimensionMaxValue: number;
    firstDimensionMargin: number;
    autoPositionOnResize: boolean;
    avoidPageBreak: boolean;
    pageColumns: number;
    autoBookmark: boolean;
    autoBookmarkTime: number;
    viewMode: ViewMode;
    exploredCharCount: number;
    bookCharCount: number;
    multiplier: number;
    bookmarkData: Promise<BooksDbBookmarkData | undefined>;
    autoScroller: AutoScroller | undefined;
    bookmarkManager: BookmarkManager | undefined;
    pageManager: PageManager | undefined;
    isBookmarkScreen: boolean;
    customReadingPoint: number;
    customReadingPointTop: number;
    customReadingPointLeft: number;
    customReadingPointScrollOffset: number;
    customReadingPointRange: Range | undefined;
    showCustomReadingPoint: boolean;
    onBookmark: () => void;
    onTrackerPause: () => void;
  }

  let {
    htmlContent,
    rightToLeft,
    language,
    width,
    height,
    prioritizeReaderStyles,
    enableTextJustification,
    enableTextWrapPretty,
    textIndentation,
    textMarginMode,
    textMarginValue,
    fontColor,
    backgroundColor,
    fontFamilyGroupOne,
    fontFamilyGroupTwo,
    fontWeight,
    fontSize,
    lineHeight,
    hideSpoilerImage,
    secondDimensionMaxValue,
    firstDimensionMargin,
    autoPositionOnResize,
    avoidPageBreak,
    pageColumns,
    autoBookmark,
    autoBookmarkTime,
    viewMode,
    exploredCharCount = $bindable(),
    bookCharCount = $bindable(),
    multiplier,
    bookmarkData = $bindable(),
    autoScroller = $bindable(),
    bookmarkManager = $bindable(),
    pageManager = $bindable(),
    isBookmarkScreen = $bindable(),
    customReadingPoint = $bindable(),
    customReadingPointTop = $bindable(),
    customReadingPointLeft = $bindable(),
    customReadingPointScrollOffset = $bindable(),
    customReadingPointRange = $bindable(),
    showCustomReadingPoint = $bindable(),
    onBookmark,
    onTrackerPause
  }: Props = $props();

  let showBlurMessage = $state(false);

  let wakeLock: WakeLockSentinel | undefined;

  let visibilityState = $state<DocumentVisibilityState>();

  const mutationObserver: MutationObserver = new MutationObserver(handleMutation);

  const width$ = new Subject<number>();

  const height$ = new Subject<number>();

  const containerEl$ = writableSubject<HTMLElement | null>(null);

  onDestroy(() => {
    mutationObserver.disconnect();

    releaseWakeLock();
  });

  const computedStyle$ = combineLatest([
    containerEl$.pipe(filter((el): el is HTMLElement => !!el)),
    combineLatest([width$, height$]).pipe(startWith(0))
  ]).pipe(
    debounceTime(0, animationFrameScheduler),
    map(([el]) => getComputedStyle(el)),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const contentEl$ = new ReplaySubject<HTMLElement>(1);

  const contentViewportWidth$ = computedStyle$.pipe(
    map((style) =>
      getAdjustedWidth(
        width -
          parsePx(style.paddingLeft) -
          parsePx(style.paddingRight) -
          ($enableTapEdgeToFlip$ && ViewMode.Paginated === viewMode
            ? convertRemToPixels(window, 1.75)
            : 0)
      )
    )
  );

  const contentViewportHeight$ = computedStyle$.pipe(
    map(
      (style) => height - parsePx(style.paddingTop) - parsePx(style.paddingBottom) - heightModifer
    )
  );

  const reactiveElements$ = iffBrowser(() => of(document)).pipe(
    mergeMap((document) => {
      const reactiveElementsFn = reactiveElements(
        document,
        hideSpoilerImage,
        navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches
      );
      return contentEl$.pipe(mergeMap((contentEl) => reactiveElementsFn(contentEl)));
    }),
    reduceToEmptyString()
  );

  const imageLoadingState$ = contentEl$.pipe(
    mergeMap((contentEl) => imageLoadingState(contentEl)),
    share()
  );

  const blurListener$ = contentEl$.pipe(
    tap((contentEl) => {
      mutationObserver.disconnect();
      mutationObserver.observe(contentEl, { attributes: true });
    }),
    reduceToEmptyString()
  );

  function getAdjustedWidth(widthValue: number) {
    if (ViewMode.Paginated === viewMode && secondDimensionMaxValue) {
      return Math.min(secondDimensionMaxValue, widthValue);
    }
    return widthValue;
  }

  function parsePx(px: string) {
    return Number(px.replace(/px$/, ''));
  }

  function handleMutation([mutation]: MutationRecord[]) {
    if (!(mutation.target instanceof HTMLElement)) {
      showBlurMessage = false;
      return;
    }

    showBlurMessage = mutation.target.style.filter.includes('blur');
  }

  async function requestWakeLock() {
    if (wakeLock && !wakeLock.released) {
      return;
    }

    wakeLock = await navigator.wakeLock.request().catch(({ message }) => {
      logger.error(`failed to request wakelock: ${message}`);

      return undefined;
    });

    if (wakeLock) {
      wakeLock.addEventListener('release', releaseWakeLock, false);
    }
  }

  async function releaseWakeLock() {
    if (wakeLock && !wakeLock.released) {
      await wakeLock.release().catch(() => {
        // no-op
      });
    }

    wakeLock = undefined;
  }
  let heightModifer = $derived(
    firstDimensionMargin && ViewMode.Paginated === viewMode ? firstDimensionMargin * 2 : 0
  );
  $effect(() => {
    if (!$enableReaderWakeLock$ || visibilityState !== 'visible') return;
    const timer = setTimeout(requestWakeLock, 500);
    return () => clearTimeout(timer);
  });
  $effect(() => {
    width$.next(width);
  });
  $effect(() => {
    height$.next(height);
  });
</script>

{#if showBlurMessage}
  <div
    class="fixed top-12 right-4 p-2 border max-w-[90vw] z-[1]"
    style:writing-mode="horizontal-tb"
    style:color={fontColor}
    style:background-color={backgroundColor}
    style:border-color={fontColor}
  >
    The reader is currently blurred by an external application
  </div>
{/if}
<div bind:this={$containerEl$} class="{pxReader} py-8" lang={language}>
  {#if viewMode === ViewMode.Continuous}
    <BookReaderContinuous
      {htmlContent}
      {rightToLeft}
      width={$contentViewportWidth$ ?? 0}
      height={$contentViewportHeight$ ?? 0}
      {prioritizeReaderStyles}
      {enableTextJustification}
      {enableTextWrapPretty}
      {fontColor}
      {backgroundColor}
      {fontFamilyGroupOne}
      {fontFamilyGroupTwo}
      {fontWeight}
      {fontSize}
      {lineHeight}
      {textIndentation}
      {textMarginMode}
      {textMarginValue}
      {hideSpoilerImage}
      {secondDimensionMaxValue}
      {firstDimensionMargin}
      {autoPositionOnResize}
      {autoBookmark}
      {autoBookmarkTime}
      {multiplier}
      loadingState={$imageLoadingState$ ?? true}
      bind:exploredCharCount
      bind:bookCharCount
      bind:bookmarkData
      bind:autoScroller
      bind:bookmarkManager
      bind:pageManager
      bind:customReadingPoint
      bind:customReadingPointTop
      bind:customReadingPointLeft
      bind:customReadingPointScrollOffset
      onContentChange={(content) => contentEl$.next(content)}
      {onBookmark}
      {onTrackerPause}
    />
  {:else}
    <BookReaderPaginated
      {htmlContent}
      {rightToLeft}
      width={$contentViewportWidth$ ?? 0}
      height={$contentViewportHeight$ ?? 0}
      {prioritizeReaderStyles}
      {enableTextJustification}
      {enableTextWrapPretty}
      {fontColor}
      {backgroundColor}
      {fontFamilyGroupOne}
      {fontFamilyGroupTwo}
      {fontWeight}
      {fontSize}
      {lineHeight}
      {textIndentation}
      {textMarginMode}
      {textMarginValue}
      {hideSpoilerImage}
      loadingState={$imageLoadingState$ ?? true}
      {avoidPageBreak}
      {pageColumns}
      {autoBookmark}
      {autoBookmarkTime}
      {firstDimensionMargin}
      bind:exploredCharCount
      bind:bookCharCount
      bind:isBookmarkScreen
      bind:bookmarkData
      bind:bookmarkManager
      bind:pageManager
      bind:customReadingPointRange
      bind:showCustomReadingPoint
      onContentChange={(content) => contentEl$.next(content)}
      {onBookmark}
      {onTrackerPause}
    />
  {/if}
</div>
{$blurListener$ ?? ''}
{$reactiveElements$ ?? ''}
<svelte:document bind:visibilityState />
