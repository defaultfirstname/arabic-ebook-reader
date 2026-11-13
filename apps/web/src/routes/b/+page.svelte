<script lang="ts">
  import {
    auditTime,
    debounceTime,
    EMPTY,
    filter,
    fromEvent,
    map,
    merge,
    NEVER,
    of,
    ReplaySubject,
    share,
    shareReplay,
    skip,
    startWith,
    switchMap,
    take,
    takeWhile,
    tap,
    timer
  } from 'rxjs';
  import { quintInOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { browser } from '$app/env';
  import { afterNavigate, goto } from '$app/navigation';
  import { faCloudBolt, faPause, faPlay, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import BookReader from '#lib/components/book-reader/book-reader.svelte';
  import type {
    AutoScroller,
    BookmarkManager,
    PageManager
  } from '#lib/components/book-reader/types';
  import LogReportDialog from '#lib/components/log-report-dialog.svelte';
  import MessageDialog from '#lib/components/message-dialog.svelte';
  import StyleSheetRenderer from '#lib/components/style-sheet-renderer.svelte';
  import {
    autoBookmark$,
    autoBookmarkTime$,
    autoPositionOnResize$,
    avoidPageBreak$,
    bookReaderKeybindMap$,
    database,
    enableTapEdgeToFlip$,
    enableTextJustification$,
    enableTextWrapPretty$,
    firstDimensionMargin$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    fontWeight$,
    hideSpoilerImage$,
    multiplier$,
    pageColumns$,
    prioritizeReaderStyles$,
    secondDimensionMaxValue$,
    showFooterChapterCharacterCounter$,
    showFooterChapterPercentage$,
    textIndentation$,
    textMarginMode$,
    textMarginValue$,
    theme$,
    trackerAutostartTime$,
    viewMode$,
    selectionToBookmarkEnabled$,
    lineHeight$,
    syncTarget$,
    autoReplication$,
    skipKeyDownListener$,
    replicationSaveBehavior$,
    cacheStorageData$,
    confirmClose$,
    horizontalCustomReadingPosition$,
    customReadingPointEnabled$,
    statisticsEnabled$,
    openTrackerOnCompletion$,
    addCharactersOnCompletion$,
    statisticsMergeMode$,
    isOnline$,
    manualBookmark$,
    customThemes$,
    overwriteBookCompletion$,
    startDayHoursForTracker$,
    readingGoalsMergeMode$,
    pauseTrackerOnCustomPointChange$,
    hideSpoilerImageMode$,
    showCharacterCounter$,
    showPercentage$
  } from '#lib/data/store';
  import BookCompletionConfetti from '#lib/components/book-reader/book-completion-confetti/book-completion-confetti.svelte';
  import BookReaderHeader from '#lib/components/book-reader/book-reader-header.svelte';
  import {
    readerImageGalleryPictures$,
    toggleImageGalleryPictureSpoiler$,
    updateImageGalleryPictureSpoilers$
  } from '#lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import BookReaderImageGallery from '#lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery.svelte';
  import {
    getDefaultStatistic,
    isTrackerMenuOpen$,
    isTrackerPaused$
  } from '#lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import BookReadingTracker from '#lib/components/book-reader/book-reading-tracker/book-reading-tracker.svelte';
  import {
    getChapterData,
    nextChapter$,
    sectionList$,
    sectionProgress$,
    tocIsOpen$,
    type SectionWithProgress
  } from '#lib/components/book-reader/book-toc/book-toc';
  import BookToc from '#lib/components/book-reader/book-toc/book-toc.svelte';
  import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
  import NumberDialog from '#lib/components/number-dialog.svelte';
  import { mergeEntries } from '#lib/components/merged-header-icon/merged-entries';
  import { preFilteredTitlesForStatistics$ } from '#lib/components/statistics/statistics-types';
  import {
    currentDbVersion,
    type BooksDbBookData,
    type BooksDbBookmarkData,
    type BooksDbStatistic
  } from '#lib/data/database/books-db/versions/books-db';
  import { dialogManager } from '#lib/data/dialog-manager';
  import { pagePath } from '#lib/data/env';
  import { DB_VERSION, PAGE_CHANGE, SKIPKEYLISTENER, SYNCED } from '#lib/data/events';
  import { fullscreenManager } from '#lib/data/fullscreen-manager';
  import { logger } from '#lib/data/logger';
  import { MergeMode } from '#lib/data/merge-mode';
  import { getStorageHandler } from '#lib/data/storage/storage-handler-factory';
  import { BaseStorageHandler } from '#lib/data/storage/handler/base-handler';
  import type { BrowserStorageHandler } from '#lib/data/storage/handler/browser-handler';
  import {
    StorageDataType,
    StorageSourceDefault,
    StorageKey
  } from '#lib/data/storage/storage-types';
  import { storageSource$ } from '#lib/data/storage/storage-view';
  import { availableThemes } from '#lib/data/theme-option';
  import { ViewMode } from '#lib/data/view-mode';
  import loadBookData from '#lib/functions/book-data-loader/load-book-data';
  import { getArabicBookMetrics } from '#lib/functions/book-data-loader/get-arabic-book-metrics';
  import { formatPageTitle } from '#lib/functions/format-page-title';
  import { iffBrowser } from '#lib/functions/rxjs/iff-browser';
  import {
    AutoReplicationType,
    ReplicationSaveBehavior
  } from '#lib/functions/replication/replication-options';
  import { replicateData } from '#lib/functions/replication/replicator';
  import { reduceToEmptyString } from '#lib/functions/rxjs/reduce-to-empty-string';
  import { takeWhenBrowser } from '#lib/functions/rxjs/take-when-browser';
  import { tapDom } from '#lib/functions/rxjs/tap-dom';
  import { multiClickHandler } from '#lib/functions/multi-click-handler';
  import {
    executeReplicate$,
    type ReplicationContext
  } from '#lib/functions/replication/replication-progress';
  import { getDateKey } from '#lib/functions/statistic-util';
  import { clickOutside } from '#lib/functions/use-click-outside';
  import { dummyFn, isMobile$ } from '#lib/functions/utils';
  import { formatBookProgress } from './format-book-progress';
  import { formatChapterProgress } from './format-chapter-progress';
  import { onKeydownReader } from './on-keydown-reader';
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import Fa from 'svelte-fa';
  import {
    clearRange,
    getParagraphToPoint,
    getRangeForUserSelection,
    getReferencePoints,
    pulseElement
  } from '#lib/functions/range-util';

  let showSpinner = $state(true);
  let showHeader = $state(false);
  let isBookmarkScreen = $state(false);
  let showFooter = $state(true);
  let exploredCharCount = $state(0);
  let bookCharCount = $state(0);
  let autoScroller: AutoScroller | undefined = $state();
  let bookmarkManager: BookmarkManager | undefined = $state();
  let pageManager: PageManager | undefined = $state();
  let bookmarkData: Promise<BooksDbBookmarkData | undefined> = $state(Promise.resolve(undefined));
  let customReadingPointTop = $state(-2);
  let customReadingPointLeft = $state(-2);
  let customReadingPoint = $state(untrack(() => $horizontalCustomReadingPosition$));
  let customReadingPointScrollOffset = $state(0);
  let customReadingPointRange: Range | undefined = $state();
  let lastSelectedRange: Range | undefined;
  let lastSelectedRangeWasEmpty = true;
  let isSelectingCustomReadingPoint = $state(false);
  let showCustomReadingPoint = $state(false);
  let localStorageHandler: BrowserStorageHandler;
  let dataToReplicate: StorageDataType[] = $state([]);
  let dataToReplicateQueue: StorageDataType[] = [];
  let externalStorageHandler: BaseStorageHandler | undefined = $state();
  let externalStorageErrors = $state(0);
  let isReplicating = $state(false);
  let storedExploredCharacter = $state(0);
  let hasBookmarkData = $state(false);
  let blockDataUpdates = $state(false);
  let trackerElm = $state<ReturnType<typeof BookReadingTracker>>();
  let showTrackerIcon = $state(false);
  let wasTrackerPaused = $state(true);
  let frozenPosition = $state(-1);
  let skipFirstFreezeChange = false;
  let bookCompleted = $state(false);
  let confettiWidthModifier = $state(36);
  let confettiMaxRuns = $state(0);
  let showReaderImageGallery = $state(false);
  let dismissDialogs = true;
  let syncedResolver: () => void;

  const syncedPromise = new Promise<void>((resolver) => {
    syncedResolver = resolver;
  });
  const queuedReaderImageGalleryPictures = new Map<string, boolean>();
  const bookId$ = new ReplaySubject<number>(1);
  afterNavigate(({ to }) => {
    if (to) bookId$.next(Number(to.url.searchParams.get('id')));
  });

  const rawBookData$ = bookId$.pipe(
    switchMap(async (id) => {
      let bookData: BooksDbBookData | undefined;

      try {
        localStorageHandler = getStorageHandler(
          window,
          StorageKey.BROWSER,
          undefined,
          true,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        );

        localStorageHandler.startContext({ id, title: '' });
        bookData = await localStorageHandler.getBook();

        if (!bookData) {
          return bookData;
        }

        const currentContext = {
          id: bookData.id,
          title: bookData.title,
          imagePath: bookData.coverImage
        };

        localStorageHandler.startContext(currentContext);

        if (bookData.storageSource) {
          externalStorageHandler = await getStorageHandlerByName(bookData.storageSource, true);
        } else if ($autoReplication$ !== AutoReplicationType.Off) {
          externalStorageHandler = await getStorageHandlerByName($syncTarget$);
        }

        bookData.lastBookOpen = new Date().getTime();

        await localStorageHandler.updateLastRead(bookData);
        await syncDownData(externalStorageHandler, currentContext);

        if (!$statisticsEnabled$) {
          const wasNew = (
            await database.setFirstBookRead(currentContext.title, $startDayHoursForTracker$)
          )[1];

          if (wasNew) {
            scheduleReplication(StorageDataType.STATISTICS);
          }
        }

        bookData = await saveExternalLastRead(externalStorageHandler, bookData);
      } catch (error: any) {
        const message = `Error loading book: ${error.message}`;

        logger.warn(message);

        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message
            }
          }
        ]);
        return undefined;
      } finally {
        syncedResolver();

        showSpinner = false;
      }

      if (externalStorageHandler) {
        externalStorageHandler.updateSettings(
          window,
          true,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$,
          $cacheStorageData$,
          false,
          bookData.storageSource || $syncTarget$
        );
      }

      return { ...bookData, arabicMetrics: getArabicBookMetrics(bookData, document) };
    }),
    share()
  );

  const leaveIfBookMissing$ = rawBookData$.pipe(
    tap((data) => {
      if (!data) {
        goto(`${pagePath}${mergeEntries.MANAGE.routeId}`);
      }
    }),
    reduceToEmptyString()
  );

  const bookData$ = rawBookData$.pipe(
    switchMap((rawBookData) => {
      if (!rawBookData) return EMPTY;

      bookmarkData = database
        .getBookmark(rawBookData.id)
        .then((bookmark) => rawBookData.arabicMetrics?.restoreBookmark(bookmark) ?? bookmark);
      sectionData = [];
      sectionList$.next(rawBookData.arabicMetrics?.sections ?? rawBookData.sections ?? []);

      return loadBookData(
        rawBookData,
        '.book-content',
        document,
        $viewMode$ === ViewMode.Paginated,
        $hideSpoilerImageMode$
      );
    }),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const resize$ = iffBrowser(() =>
    visualViewport ? fromEvent(visualViewport, 'resize') : of()
  ).pipe(share());

  const containerViewportWidth$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport?.width || 0),
    takeWhenBrowser()
  );

  const containerViewportHeight$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport?.height || 0),
    takeWhenBrowser()
  );

  const themeOption$ = theme$.pipe(
    map(
      (theme) =>
        availableThemes.get(theme) || $customThemes$[theme] || availableThemes.get('light-theme')
    ),
    filter((o): o is NonNullable<typeof o> => !!o),
    takeWhenBrowser()
  );

  const backgroundColor$ = themeOption$.pipe(map((o) => o.backgroundColor));

  const collectReaderImageGallerySpoilerToggles$ = toggleImageGalleryPictureSpoiler$.pipe(
    tap((readerImageGalleryPicture) => {
      queuedReaderImageGalleryPictures.set(
        readerImageGalleryPicture.url,
        readerImageGalleryPicture.unspoilered
      );

      updateImageGalleryPictureSpoilers$.next();
    }),
    reduceToEmptyString()
  );

  const handleUpdateImageGalleryPictureSpoilers$ = updateImageGalleryPictureSpoilers$.pipe(
    debounceTime(250),
    tap(() => {
      $readerImageGalleryPictures$ = $readerImageGalleryPictures$.map((galleryPicture) => {
        const picture = galleryPicture;

        if (queuedReaderImageGalleryPictures.has(picture.url)) {
          picture.unspoilered = queuedReaderImageGalleryPictures.get(picture.url)!;
        }

        return picture;
      });

      queuedReaderImageGalleryPictures.clear();
    }),
    reduceToEmptyString()
  );

  const backgroundStyleName = 'background-color';
  const setBackgroundColor$ = backgroundColor$.pipe(
    tapDom(
      () => document.body,
      (backgroundColor, body) => body.style.setProperty(backgroundStyleName, backgroundColor),
      (body) => body.style.removeProperty(backgroundStyleName)
    ),
    reduceToEmptyString(),
    takeWhenBrowser()
  );

  // Chapter updates can arrive before the header or tracker menu reads them.
  let sectionData = $state.raw<SectionWithProgress[]>([]);
  const sectionProgressSubscription = iffBrowser(() => sectionProgress$).subscribe((progress) => {
    sectionData = [...progress.values()];
  });

  const textSelector$ = iffBrowser(() => fromEvent(document, 'selectionchange')).pipe(
    debounceTime(200),
    tap(() => {
      const currentSelected = window.getSelection()?.toString() || '';

      if (!currentSelected && lastSelectedRangeWasEmpty) {
        lastSelectedRange = undefined;
      } else if (currentSelected) {
        lastSelectedRange = window.getSelection()?.getRangeAt(0);
        lastSelectedRangeWasEmpty = false;
      } else {
        lastSelectedRangeWasEmpty = true;
      }
    }),
    reduceToEmptyString()
  );

  const replicator$ = executeReplicate$.pipe(
    auditTime(60000),
    switchMap(() => executeReplication()),
    reduceToEmptyString()
  );

  const autoStartTracker$ = iffBrowser(() =>
    $statisticsEnabled$ && $trackerAutostartTime$ > 0 ? fromEvent(document, PAGE_CHANGE) : NEVER
  ).pipe(
    debounceTime($trackerAutostartTime$ * 1000),
    take(1),
    tap(() => {
      wasTrackerPaused = false;
      isTrackerPaused$.next(wasTrackerPaused);
    }),
    reduceToEmptyString()
  );

  onMount(() => document.addEventListener('ttu-action', handleAction, false));

  function handleAction({ detail }: any) {
    if (!detail.type) {
      return;
    }

    if (detail.type === 'dbVersion') {
      document.dispatchEvent(new CustomEvent(DB_VERSION, { detail: currentDbVersion }));
    } else if (detail.type === 'waitForSync') {
      syncedPromise.finally(() => document.dispatchEvent(new CustomEvent(SYNCED)));
    } else if (detail.type === 'skipKeyDownListener') {
      skipKeyDownListener$.next(detail.params.value);
    } else if (
      detail.type === 'sync' &&
      (detail.syncType === StorageDataType.AUDIOBOOK ||
        detail.syncType === StorageDataType.SUBTITLE)
    ) {
      scheduleReplication(detail.syncType);
    }
  }
  /** Experimental Code - May be removed any time without warning */

  onDestroy(() => {
    sectionProgressSubscription.unsubscribe();
    if (browser) {
      document.removeEventListener('ttu-action', handleAction, false);
    }

    readerImageGalleryPictures$.next([]);

    if (dismissDialogs) {
      dialogManager.dialogs$.next([]);
    }
  });

  function handleUnload(event: BeforeUnloadEvent) {
    if (
      $confirmClose$ &&
      (isReplicating ||
        storedExploredCharacter !== exploredCharCount ||
        (upSyncEnabled && dataToReplicate.length) ||
        (upSyncEnabled && dataToReplicateQueue.length))
    ) {
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      return (event.returnValue = 'Are you sure you want to exit?');
    }

    return event;
  }

  function trackerSingleClickHandler() {
    if (!statisticsEnabled$) {
      return;
    }

    wasTrackerPaused = $isTrackerPaused$;
    isTrackerPaused$.next(true);
    isTrackerMenuOpen$.next(true);
  }

  function trackerDblClickHandler() {
    if (!statisticsEnabled$) {
      return;
    }

    dialogManager.dialogs$.next([]);
    wasTrackerPaused = !$isTrackerPaused$;
    isTrackerPaused$.next(wasTrackerPaused);
  }

  async function handleJump() {
    const dataId = getBookIdSync();

    if (!bookmarkManager || !dataId) {
      return;
    }

    pauseTracker();
    skipKeyDownListener$.next(true);

    const target = await new Promise<number | undefined>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: NumberDialog,
          props: {
            dialogHeader: 'Jump to Position',
            minValue: 1,
            maxValue: bookCharCount || 1,
            resolver
          }
        }
      ]);
    });

    skipKeyDownListener$.next(false);

    if (typeof target !== 'number') {
      restartTrackerAfterCharacterChangeOrTime(1);
      return;
    }

    restartTrackerAfterCharacterChangeOrTime(1000);

    bookmarkManager.scrollToBookmark(
      {
        dataId: dataId,
        exploredCharCount: target,
        lastBookmarkModified: new Date().getTime(),
        progress: 0
      },
      customReadingPointScrollOffset
    );
  }

  async function completeBook() {
    if (!$rawBookData$) {
      return;
    }

    const wasAutoscrollerEnabled = autoScroller?.wasAutoScrollerEnabled$.getValue();
    const wasTrackerPausedBefore = $statisticsEnabled$ ? $isTrackerPaused$ : true;

    showHeader = false;
    autoScroller?.off();

    if ($statisticsEnabled$) {
      wasTrackerPaused = true;
      isTrackerPaused$.next(true);
    }

    const diffToComplete =
      $statisticsEnabled$ && $addCharactersOnCompletion$
        ? Math.max(0, bookCharCount - exploredCharCount)
        : 0;
    const wasCanceled = await new Promise((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: ConfirmDialog,
          props: {
            dialogHeader: 'Complete Book',
            dialogMessage: `Would you like to complete this Book${
              diffToComplete ? ` and capture ${diffToComplete} characters read` : ''
            }?`,
            resolver
          }
        }
      ]);
    });

    if (wasCanceled) {
      if ($statisticsEnabled$ && !wasTrackerPausedBefore) {
        wasTrackerPaused = false;
        $isTrackerPaused$ = false;
      }

      if (wasAutoscrollerEnabled) {
        autoScroller?.toggle();
      }

      return;
    }

    dialogManager.dialogs$.next([
      {
        component: '<div/>',
        disableCloseOnClick: true
      }
    ]);

    try {
      if (diffToComplete && trackerElm) {
        const [hadError] = await trackerElm.processStatistics(diffToComplete);

        if (hadError) {
          throw new Error('Character Update failed');
        }
      }

      const finishedStatistic = await database.getStatisticForCompletedBook($rawBookData$.title);
      const todayKey = getDateKey($startDayHoursForTracker$);
      const statisticsUntilToday = await database.getStatisticsUntilDate(
        $rawBookData$.title,
        todayKey
      );
      const todayStatistic =
        statisticsUntilToday.find((statistic) => statistic.dateKey === todayKey) ||
        getDefaultStatistic($rawBookData$.title, todayKey);
      const statisticsToStore: BooksDbStatistic[] = [];
      const lastStatisticModified = Date.now();

      todayStatistic.lastStatisticModified = lastStatisticModified;
      todayStatistic.completedBook = 1;
      todayStatistic.completedData = {
        ...{ dateKey: todayKey },
        ...BaseStorageHandler.getStatisticsMetadata(
          BaseStorageHandler.getStatisticsFileName(
            statisticsUntilToday,
            todayStatistic.lastStatisticModified
          )
        )
      };

      let updateFinishedStatistic = false;

      if (!finishedStatistic) {
        statisticsToStore.push(todayStatistic);
      } else if (
        $overwriteBookCompletion$ &&
        finishedStatistic.dateKey !== todayStatistic.dateKey
      ) {
        delete finishedStatistic.completedBook;
        delete finishedStatistic.completedData;
        finishedStatistic.lastStatisticModified = lastStatisticModified;
        statisticsToStore.push(todayStatistic, finishedStatistic);
        updateFinishedStatistic = true;
      } else if ($overwriteBookCompletion$) {
        statisticsToStore.push(todayStatistic);
      }

      if (statisticsToStore.length) {
        await database.storeStatistics(
          $rawBookData$.title,
          statisticsToStore,
          ReplicationSaveBehavior.Overwrite,
          MergeMode.LOCAL,
          lastStatisticModified
        );

        trackerElm?.updateCompletedBook(
          todayStatistic,
          updateFinishedStatistic ? finishedStatistic : undefined
        );

        scheduleReplication(StorageDataType.STATISTICS);
      }

      if (bookmarkManager) {
        const data = {
          ...bookmarkManager.formatBookmarkData($rawBookData$.id, customReadingPointScrollOffset),
          exploredCharCount: Math.max(0, bookCharCount - 1),
          progress: 1
        };

        await database.putBookmark(data);

        bookmarkData = Promise.resolve(data);

        scheduleReplication(StorageDataType.PROGRESS);
      }

      if ($statisticsEnabled$ && $openTrackerOnCompletion$) {
        confettiWidthModifier = 36;
        confettiMaxRuns = 0;
        bookCompleted = window.matchMedia('(min-width: 900px)').matches;
        isTrackerMenuOpen$.next(true);
      } else {
        dialogManager.dialogs$.next([]);
        confettiWidthModifier = 0;
        confettiMaxRuns = 3;
        bookCompleted = true;

        merge(fromEvent(document, 'pointerup'), timer(10000))
          .pipe(take(1))
          .subscribe(() => {
            bookCompleted = false;
          });
      }
    } catch ({ message }: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: `Error completing Book: ${message}`
          }
        }
      ]);
    }
  }

  function copyCurrentProgress(currentProgress: string) {
    try {
      navigator.clipboard.writeText(currentProgress);
    } catch (error: any) {
      logger.error(`Error writing Progress to Clipboard: ${error.message}`);
    }
  }

  function freezeTrackerPosition() {
    if (!$statisticsEnabled$) {
      return;
    }

    if (frozenPosition > -1) {
      frozenPosition = -1;
    } else {
      skipFirstFreezeChange = true;
      frozenPosition = exploredCharCount;
    }
  }

  async function getStorageHandlerByName(storageSourceName: string, throwIfNotFound = false) {
    if (!storageSourceName) {
      if (throwIfNotFound) {
        throw new Error(`No storage source found`);
      }

      return undefined;
    }

    if (storageSourceName === StorageSourceDefault.GDRIVE_DEFAULT) {
      if (!$isOnline$) {
        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message:
                'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
            }
          }
        ]);

        return undefined;
      }

      return getStorageHandler(
        window,
        StorageKey.GDRIVE,
        storageSourceName,
        true,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      );
    }
    if (storageSourceName === StorageSourceDefault.ONEDRIVE_DEFAULT) {
      if (!$isOnline$) {
        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message:
                'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
            }
          }
        ]);

        return undefined;
      }

      return getStorageHandler(
        window,
        StorageKey.ONEDRIVE,
        storageSourceName,
        true,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      );
    }
    if (storageSourceName) {
      const db = await database.db;
      const storageSource = await db.get('storageSource', storageSourceName);

      if (storageSource) {
        if (storageSource.type !== StorageKey.FS && !$isOnline$) {
          dialogManager.dialogs$.next([
            {
              component: MessageDialog,
              props: {
                title: 'Load Error',
                message:
                  'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
              }
            }
          ]);

          return undefined;
        }

        return getStorageHandler(
          window,
          storageSource.type,
          storageSourceName,
          true,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        );
      }
      if (throwIfNotFound) {
        throw new Error(`No storage source with name ${storageSourceName} found`);
      }
    }

    const message = `No storage source with name ${storageSourceName} found - skipping auto import/export`;

    logger.warn(message);

    dialogManager.dialogs$.next([
      {
        component: MessageDialog,
        props: {
          title: 'Configuration Error',
          message
        }
      }
    ]);

    return undefined;
  }

  async function saveExternalLastRead(
    storageHandler: BaseStorageHandler | undefined,
    localBookData: BooksDbBookData
  ) {
    if (!storageHandler) {
      return localBookData;
    }

    // eslint-disable-next-line prefer-const
    let { id, ...bookData } = localBookData;

    if (localBookData.storageSource) {
      const externalBookData = await storageHandler.getBook();

      if (externalBookData && !(externalBookData instanceof File)) {
        bookData = {
          ...externalBookData,
          ...{
            id: localBookData.id,
            lastBookOpen: localBookData.lastBookOpen,
            storageSource: localBookData.storageSource
          }
        };
      }
    } else if (!localBookData.elementHtml) {
      throw new Error('Book has no data stored');
    }

    const dataToReturn = { id, ...bookData };

    await storageHandler.updateLastRead(dataToReturn).catch((error: any) => {
      const message = `Failed to update last read on external storage: ${error.message}`;

      logger.warn(message);

      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Update Error',
            message
          }
        }
      ]);
    });

    return dataToReturn;
  }

  async function syncDownData(
    storageHandler: BaseStorageHandler | undefined,
    context: ReplicationContext
  ) {
    if (localStorageHandler && storageHandler) {
      storageHandler.startContext(context);
    }

    if (
      localStorageHandler &&
      storageHandler &&
      ($autoReplication$ === AutoReplicationType.Down ||
        $autoReplication$ === AutoReplicationType.All)
    ) {
      const error = await replicateData(
        storageHandler,
        localStorageHandler,
        false,
        [context],
        [
          StorageDataType.PROGRESS,
          StorageDataType.STATISTICS,
          StorageDataType.READING_GOALS,
          StorageDataType.AUDIOBOOK,
          StorageDataType.SUBTITLE
        ]
      );

      if (error) {
        throw new Error(error);
      }
    }
  }

  function onKeydown(ev: KeyboardEvent) {
    if (
      $skipKeyDownListener$ ||
      ev.altKey ||
      ev.ctrlKey ||
      ev.shiftKey ||
      ev.metaKey ||
      ev.repeat
    ) {
      return;
    }

    const result = onKeydownReader(
      ev,
      bookReaderKeybindMap$.getValue(),
      bookmarkPage,
      scrollToBookmark,
      (x) => multiplier$.next(multiplier$.getValue() + x),
      autoScroller,
      pageManager,
      changeChapter,
      handleSetCustomReadingPoint,
      trackerDblClickHandler,
      freezeTrackerPosition
    );

    if (!result) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    ev.preventDefault();
  }

  function getBookIdSync() {
    let bookId: number | undefined;
    bookId$.subscribe((x) => (bookId = x)).unsubscribe();
    return bookId;
  }

  async function bookmarkPage() {
    const bookId = getBookIdSync();
    if (!bookId || !bookmarkManager) return;

    let data: BooksDbBookmarkData;

    showHeader = false;

    if (isPaginated) {
      const userSelectedRange = $selectionToBookmarkEnabled$
        ? getRangeForUserSelection(window, lastSelectedRange)
        : undefined;
      const bookmarkRange = userSelectedRange || customReadingPointRange;

      pulseElement(bookmarkRange?.endContainer?.parentElement, 'add', 0.5, 500);

      data = bookmarkManager.formatBookmarkDataByRange(bookId, bookmarkRange);

      if (userSelectedRange) {
        clearRange(window);
      }
    } else {
      data = bookmarkManager.formatBookmarkData(bookId, customReadingPointScrollOffset);
    }

    await database.putBookmark(data);

    bookmarkData = Promise.resolve(data);

    scheduleReplication(StorageDataType.PROGRESS);
  }

  async function scrollToBookmark() {
    const data = await bookmarkData;
    if (!data || !bookmarkManager) return;

    if (data.exploredCharCount !== exploredCharCount) {
      pauseTracker(true);
    }

    bookmarkManager.scrollToBookmark(data, customReadingPointScrollOffset);
  }

  function onFullscreenClick() {
    showHeader = false;

    if (!fullscreenManager.fullscreenElement) {
      fullscreenManager.requestFullscreen(document.documentElement);
      return;
    }
    fullscreenManager.exitFullscreen();
  }

  function changeChapter(offset: number) {
    if (!sectionData.length) {
      return;
    }

    const [mainChapters, currentChapterIndex] = getChapterData(sectionData);

    if (
      (!currentChapterIndex && offset === -1) ||
      (offset === 1 && currentChapterIndex === mainChapters.length - 1)
    ) {
      return;
    }

    const nextChapter = mainChapters[currentChapterIndex + offset];

    if (!nextChapter) {
      return;
    }

    if (nextChapter.startCharacter !== exploredCharCount) {
      pauseTracker(true);
    }

    nextChapter$.next(nextChapter.reference);
  }

  async function executeReplication(isSilent = true) {
    if (isReplicating || !dataToReplicate.length || !$rawBookData$ || !externalStorageHandler) {
      return;
    }

    isReplicating = true;

    if (!isSilent) {
      skipKeyDownListener$.next(true);
      logger.clearHistory();
      openActionBackdrop();
    }

    const currentHandlerStorageSource = $rawBookData$.storageSource || $syncTarget$;

    externalStorageHandler.updateSettings(
      window,
      false,
      $replicationSaveBehavior$,
      $statisticsMergeMode$,
      $readingGoalsMergeMode$,
      $cacheStorageData$,
      !isSilent,
      currentHandlerStorageSource
    );

    const error = await replicateData(
      localStorageHandler,
      externalStorageHandler,
      !isSilent && $storageSource$ === externalStorageHandler.storageType,
      [
        {
          id: $rawBookData$.id,
          title: $rawBookData$.title,
          imagePath: $rawBookData$.coverImage
        }
      ],
      dataToReplicate
    ).catch((err: any) => err.message);

    externalStorageHandler.updateSettings(
      window,
      true,
      $replicationSaveBehavior$,
      $statisticsMergeMode$,
      $readingGoalsMergeMode$,
      $cacheStorageData$,
      false,
      currentHandlerStorageSource
    );

    isReplicating = false;

    if (error) {
      if (!isSilent) {
        const showReport = logger.errorCount > 1;

        logger.warn(error);

        dialogManager.dialogs$.next([
          {
            component: showReport ? LogReportDialog : MessageDialog,
            props: {
              title: 'Error Processing Data',
              message: showReport
                ? `Some or all data could not be stored on an external storage`
                : error
            }
          }
        ]);
      }

      externalStorageErrors += 1;
    } else {
      externalStorageErrors = 0;

      if (!isSilent) {
        dialogManager.dialogs$.next([]);
      }

      if (dataToReplicateQueue.length) {
        const isAudioBookOnly =
          dataToReplicate.length === 1 && dataToReplicate[0] === StorageDataType.AUDIOBOOK;
        dataToReplicate = JSON.parse(JSON.stringify(dataToReplicateQueue));
        dataToReplicateQueue = [];

        if (isSilent || isAudioBookOnly) {
          executeReplicate$.next();
        } else if (!isAudioBookOnly) {
          await executeReplication(false);
        } else {
          dataToReplicate = [];
        }
      } else {
        dataToReplicate = [];
      }
    }

    if (!isSilent) {
      skipKeyDownListener$.next(false);
    }
  }

  function openActionBackdrop() {
    dialogManager.dialogs$.next([
      {
        component: '<div/>',
        disableCloseOnClick: true
      }
    ]);
  }

  async function leaveReader(routeId: string, deleteLastItem = true) {
    let message;

    try {
      blockDataUpdates = true;

      await tick();

      autoScroller?.off();
      wasTrackerPaused = true;
      isTrackerPaused$.next(true);

      if ($confirmClose$ && storedExploredCharacter !== exploredCharCount) {
        const wasCanceled = await new Promise((resolver) => {
          dialogManager.dialogs$.next([
            {
              component: ConfirmDialog,
              props: {
                dialogHeader: 'Confirm Exit',
                dialogMessage: 'Your current location was not bookmarked. Continue leaving?',
                resolver
              },

              disableCloseOnClick: true
            }
          ]);
        });

        if (wasCanceled) {
          blockDataUpdates = false;
          return;
        }

        await tick();
      }

      openActionBackdrop();

      if (deleteLastItem) {
        await database.deleteLastItem();
      }

      if (!$manualBookmark$) {
        await bookmarkPage();
      }

      if ($statisticsEnabled$ && trackerElm) {
        const [hadError, updated] = await trackerElm.flushUpdates(true);

        if (hadError) {
          throw new Error('Error updating Statistics');
        }

        if (updated) {
          scheduleReplication(StorageDataType.STATISTICS);
        }
      }

      dialogManager.dialogs$.next([]);

      if (upSyncEnabled) {
        await executeReplication(false);
      }
    } catch (error: any) {
      message = error.message;
    }

    if (message) {
      logger.error(message);

      dismissDialogs = false;
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message
          },
          disableCloseOnClick: true
        }
      ]);
    }

    goto(`${pagePath}${routeId}`);
  }

  function handleSetCustomReadingPoint() {
    if (!$customReadingPointEnabled$ && !isPaginated) {
      return;
    }

    const contentEl = document.querySelector('.book-content');

    if (!contentEl) {
      return;
    }

    autoScroller?.off();

    if ($pauseTrackerOnCustomPointChange$) {
      pauseTracker();
    }

    if (isPaginated) {
      customReadingPointTop = window.innerHeight / 2 - 2;
      customReadingPointLeft = window.innerWidth / 2 - 2;
    }

    showHeader = false;
    isSelectingCustomReadingPoint = true;
    document.body.classList.add('cursor-crosshair');

    const {
      elLeftReferencePoint,
      elTopReferencePoint,
      elRightReferencePoint,
      elBottomReferencePoint,
      pointGap
    } = getReferencePoints(window, contentEl, firstDimensionMargin);

    merge(fromEvent(document, 'pointerup'), fromEvent(document, 'pointermove'))
      // eslint-disable-next-line rxjs/no-ignored-takewhile-value
      .pipe(takeWhile(() => isSelectingCustomReadingPoint))
      .subscribe((event: Event) => {
        if (!(event instanceof PointerEvent)) {
          return;
        }

        if (event.type === 'pointerup') {
          document.body.classList.remove('cursor-crosshair');
          isSelectingCustomReadingPoint = false;

          tick().then(() => {
            customReadingPointTop = event.y;

            const result = getParagraphToPoint(customReadingPointLeft, customReadingPointTop);

            if (result) {
              pulseElement(result.parent, 'add', 0.5, 500);
            }

            if (isPaginated) {
              customReadingPointRange = result?.range;
            } else {
              const newPercentage = Math.ceil(
                (Math.max(0, customReadingPointTop - elTopReferencePoint) /
                  (elBottomReferencePoint - elTopReferencePoint)) *
                  100
              );

              horizontalCustomReadingPosition$.next(newPercentage);
              customReadingPoint = newPercentage;
            }

            if ($pauseTrackerOnCustomPointChange$) {
              restartTrackerAfterCharacterChangeOrTime(1000);
            }
          });
        } else {
          const insideXBound =
            event.x >= elLeftReferencePoint + pointGap && event.x <= elRightReferencePoint;
          const insideYBound =
            event.y >= elTopReferencePoint && event.y <= elBottomReferencePoint - pointGap;

          if (isPaginated) {
            customReadingPointTop = insideYBound ? event.y : customReadingPointTop;
            customReadingPointLeft = insideXBound ? event.x : customReadingPointLeft;
          } else if (insideYBound) {
            customReadingPointTop = event.y;
          }
        }
      });
  }

  function pauseTracker(restartAfterCharacterChange = false) {
    if ($statisticsEnabled$ && !$isTrackerPaused$) {
      wasTrackerPaused = false;
      $isTrackerPaused$ = true;

      if (restartAfterCharacterChange) {
        restartTrackerAfterCharacterChangeOrTime();
      }
    }
  }

  function restartTrackerAfterCharacterChangeOrTime(timerAmount = 0) {
    if (!$statisticsEnabled$ || wasTrackerPaused) {
      return;
    }

    merge(fromEvent(document, PAGE_CHANGE), timerAmount ? timer(timerAmount) : NEVER)
      .pipe(debounceTime(200), take(1))
      .subscribe(() => {
        wasTrackerPaused = false;
        $isTrackerPaused$ = false;
      });
  }

  function scheduleReplication(dataType: StorageDataType) {
    if (upSyncEnabled) {
      const toReplicate = isReplicating ? dataToReplicateQueue : dataToReplicate;

      if (!toReplicate.includes(dataType)) {
        toReplicate.push(dataType);
      }

      if (!isReplicating) {
        dataToReplicate = [...dataToReplicate];
      }

      if (!blockDataUpdates) {
        executeReplicate$.next();
      }
    }
  }
  $effect(() => {
    if ($tocIsOpen$) {
      const scroller = autoScroller;
      untrack(() => scroller?.off());
    }
  });
  $effect(() => {
    if (bookCharCount) {
      const count = exploredCharCount;
      untrack(() =>
        document.dispatchEvent(
          new CustomEvent(PAGE_CHANGE, { detail: { exploredCharCount: count } })
        )
      );
    }
  });
  $effect(() => {
    const count = bookCharCount;
    untrack(() =>
      document.dispatchEvent(new CustomEvent(PAGE_CHANGE, { detail: { bookCharCount: count } }))
    );
  });
  $effect(() => {
    if (!showCustomReadingPoint) return;
    const element = customReadingPointRange?.endContainer?.parentElement;
    untrack(() => {
      pauseTracker();
      pulseElement(element, 'add', 1);
    });
    const subscription = fromEvent(document, 'click')
      .pipe(skip(1), take(1))
      .subscribe(() => {
        showCustomReadingPoint = false;
        pulseElement(element, 'remove', 1);
        restartTrackerAfterCharacterChangeOrTime(1);
      });
    return () => subscription.unsubscribe();
  });
  $effect(() => {
    if (frozenPosition !== -1 && exploredCharCount >= frozenPosition) {
      if (skipFirstFreezeChange) {
        skipFirstFreezeChange = false;
      } else {
        frozenPosition = -1;
      }
    }
  });
  let isPaginated = $derived($viewMode$ === ViewMode.Paginated);
  let bookLanguage = $derived($rawBookData$?.language);
  let hasArabicLanguage = $derived(/^ar(?:-|$)/i.test(bookLanguage ?? ''));
  let rightToLeft = $derived(hasArabicLanguage || !!$rawBookData$?.arabicMetrics);
  let readingLanguage = $derived(rightToLeft && !hasArabicLanguage ? 'ar' : bookLanguage);
  let firstDimensionMargin = $derived($firstDimensionMargin$ ?? 0);
  let tapButtonHeight = $derived(`calc(100% - ${showHeader ? 5 : 4}rem)`);
  let tapButtonTop = $derived(`${showHeader ? 3 : 2}rem`);
  let footerChapterProgress = $derived(
    formatChapterProgress(sectionData, {
      exploredCharCount,
      showCharacterCounter: $showFooterChapterCharacterCounter$,
      showPercentage: $showFooterChapterPercentage$
    })
  );
  let upSyncEnabled = $derived(
    externalStorageHandler &&
      ($autoReplication$ === AutoReplicationType.Up ||
        $autoReplication$ === AutoReplicationType.All)
  );
  $effect(() => {
    let current = true;
    bookmarkData.then((data) => {
      if (!current) return;
      hasBookmarkData = !!data;
      storedExploredCharacter = data?.exploredCharCount || 0;
    });
    return () => (current = false);
  });
  /** Experimental Code - May be removed any time without warning */

  $effect(() => {
    const skipListener = $skipKeyDownListener$;
    untrack(() =>
      document.dispatchEvent(new CustomEvent(SKIPKEYLISTENER, { detail: skipListener }))
    );
  });
</script>

<svelte:head>
  <title>{formatPageTitle($rawBookData$?.title ?? '')}</title>
</svelte:head>

{$collectReaderImageGallerySpoilerToggles$ ?? ''}
{$handleUpdateImageGalleryPictureSpoilers$ ?? ''}
<button
  aria-label="Show reader controls"
  class="fixed inset-x-0 top-0 z-10 h-8 w-full"
  onclick={() => (showHeader = true)}
></button>
{#if showHeader}
  <div
    class="elevation-4 writing-horizontal-tb fixed inset-x-0 top-0 z-10 w-full"
    transition:fly|local={{ y: -300, easing: quintInOut }}
    use:clickOutside={() => (showHeader = false)}
  >
    <BookReaderHeader
      hasChapterData={sectionData.length > 0}
      hasText={!!bookCharCount}
      hasCustomReadingPoint={!!(
        ($customReadingPointEnabled$ || isPaginated) &&
        ((isPaginated && customReadingPointRange) ||
          (!isPaginated && customReadingPointLeft > -1 && customReadingPointTop > -1))
      )}
      showFullscreenButton={fullscreenManager.fullscreenEnabled}
      autoScrollMultiplier={$multiplier$}
      {hasBookmarkData}
      {isBookmarkScreen}
      onTocClick={() => {
        pauseTracker();

        showHeader = false;
        tocIsOpen$.next(true);
      }}
      onJumpClick={handleJump}
      onCompleteBook={completeBook}
      onSetCustomReadingPoint={handleSetCustomReadingPoint}
      onShowCustomReadingPoint={() => {
        showHeader = false;
        showCustomReadingPoint = true;
      }}
      onResetCustomReadingPoint={() => {
        showHeader = false;

        if ($pauseTrackerOnCustomPointChange$) {
          pauseTracker();
        }

        if (isPaginated) {
          customReadingPointRange = undefined;
        } else {
          horizontalCustomReadingPosition$.next(0);
          customReadingPoint = 0;
        }

        if ($pauseTrackerOnCustomPointChange$) {
          restartTrackerAfterCharacterChangeOrTime(1000);
        }
      }}
      {onFullscreenClick}
      onBookmarkClick={bookmarkPage}
      onScrollToBookmarkClick={() => {
        showHeader = false;
        scrollToBookmark();
      }}
      onStatisticsClick={() => {
        if ($rawBookData$) {
          $preFilteredTitlesForStatistics$ = new Set([$rawBookData$.title]);
        }

        leaveReader(mergeEntries.STATISTICS.routeId, false);
      }}
      onReaderImageGalleryClick={() => {
        showHeader = false;
        showReaderImageGallery = true;
      }}
      onSettingsClick={() => leaveReader(mergeEntries.SETTINGS.routeId, false)}
      onBookManagerClick={() => leaveReader(mergeEntries.MANAGE.routeId)}
    />
  </div>
{/if}

{#if $bookData$ && $rawBookData$}
  {#if $statisticsEnabled$}
    <BookReadingTracker
      fontColor={$themeOption$.fontColor}
      backgroundColor={$backgroundColor$}
      bookTitle={$rawBookData$.title}
      {sectionData}
      {frozenPosition}
      {exploredCharCount}
      {bookCharCount}
      {autoScroller}
      {blockDataUpdates}
      bind:wasTrackerPaused
      bind:this={trackerElm}
      onFreezeCurrentLocation={freezeTrackerPosition}
      onStatisticsSaved={() => {
        if (!blockDataUpdates) {
          scheduleReplication(StorageDataType.STATISTICS);
        }
      }}
      onTrackerAvailable={() => (showTrackerIcon = true)}
      onTrackerMenuClosed={() => {
        if (!wasTrackerPaused) {
          isTrackerPaused$.next(false);
        }

        isTrackerMenuOpen$.next(false);

        bookCompleted = false;
      }}
    />
  {/if}
  <StyleSheetRenderer styleSheet={$bookData$.styleSheet} />
  <BookReader
    htmlContent={$bookData$.htmlContent}
    {rightToLeft}
    language={readingLanguage}
    width={$containerViewportWidth$ ?? 0}
    height={$containerViewportHeight$ ?? 0}
    prioritizeReaderStyles={$prioritizeReaderStyles$}
    enableTextJustification={$enableTextJustification$}
    enableTextWrapPretty={$enableTextWrapPretty$}
    fontColor={$themeOption$?.fontColor}
    backgroundColor={$backgroundColor$}
    fontFamilyGroupOne={$fontFamilyGroupOne$}
    fontFamilyGroupTwo={$fontFamilyGroupTwo$}
    fontWeight={$fontWeight$}
    fontSize={$fontSize$}
    lineHeight={$lineHeight$}
    textIndentation={$textIndentation$}
    textMarginMode={$textMarginMode$}
    textMarginValue={$textMarginValue$}
    hideSpoilerImage={$hideSpoilerImage$}
    viewMode={$viewMode$}
    secondDimensionMaxValue={$secondDimensionMaxValue$}
    {firstDimensionMargin}
    autoPositionOnResize={$autoPositionOnResize$}
    avoidPageBreak={$avoidPageBreak$}
    pageColumns={$pageColumns$}
    autoBookmark={$autoBookmark$}
    autoBookmarkTime={$autoBookmarkTime$}
    multiplier={$multiplier$}
    bind:exploredCharCount
    bind:bookCharCount
    bind:isBookmarkScreen
    bind:bookmarkData
    bind:autoScroller
    bind:bookmarkManager
    bind:pageManager
    bind:customReadingPoint
    bind:customReadingPointTop
    bind:customReadingPointLeft
    bind:customReadingPointScrollOffset
    bind:customReadingPointRange
    bind:showCustomReadingPoint
    onBookmark={bookmarkPage}
    onTrackerPause={() => pauseTracker(true)}
  />
  {$setBackgroundColor$ ?? ''}
  {$textSelector$ ?? ''}
  {$replicator$ ?? ''}
  {$autoStartTracker$ ?? ''}
{:else}
  {$leaveIfBookMissing$ ?? ''}
{/if}

{#if $tocIsOpen$ && sectionData.length}
  <div
    class="writing-horizontal-tb fixed top-0 left-0 z-[60] flex h-full w-full max-w-xl flex-col justify-between"
    style:color={$themeOption$?.fontColor}
    style:background-color={$backgroundColor$}
    in:fly|local={{ x: -100, duration: 100, easing: quintInOut }}
    use:clickOutside={() => {
      if ($statisticsEnabled$ && !wasTrackerPaused) {
        isTrackerPaused$.next(false);
      }
      tocIsOpen$.next(false);
    }}
  >
    <BookToc {sectionData} {exploredCharCount} {wasTrackerPaused} />
  </div>
{/if}

{#if showReaderImageGallery}
  <BookReaderImageGallery
    fontColor={$themeOption$.fontColor}
    backgroundColor={$backgroundColor$}
    onClose={() => (showReaderImageGallery = false)}
  />
{/if}

{#if (isSelectingCustomReadingPoint && !$isMobile$) || (!isPaginated && showCustomReadingPoint)}
  <div
    class="fixed left-0 z-20 h-[1px] w-full border border-red-500"
    style:top={`${customReadingPointTop}px`}
  ></div>
  <div
    class="fixed top-0 z-20 h-full w-[1px] border border-red-500"
    style:left={`${customReadingPointLeft}px`}
  ></div>
{/if}

{#if $enableTapEdgeToFlip$ && isPaginated && !$skipKeyDownListener$}
  <button
    class="fixed left-0 z-10 w-5"
    aria-label={rightToLeft ? 'Next page' : 'Previous page'}
    onclick={rightToLeft ? () => pageManager?.nextPage() : () => pageManager?.prevPage()}
    style:height={tapButtonHeight}
    style:top={tapButtonTop}
  ></button>
  <button
    class="fixed right-0 z-10 w-5"
    aria-label={rightToLeft ? 'Previous page' : 'Next page'}
    onclick={rightToLeft ? () => pageManager?.prevPage() : () => pageManager?.nextPage()}
    style:height={tapButtonHeight}
    style:top={tapButtonTop}
  ></button>
{/if}

{#if showSpinner}
  <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
    <Fa icon={faSpinner} spin />
  </div>
{/if}

<div
  id="ttu-page-footer"
  tabindex="0"
  role="button"
  class="writing-horizontal-tb fixed bottom-0 left-0 z-10 flex h-8 w-full items-center justify-between text-xs leading-none"
  style:color={$themeOption$?.tooltipTextFontColor}
  onclick={() => (showFooter = !showFooter)}
  onkeyup={dummyFn}
>
  <div class="flex h-full">
    {#if showTrackerIcon}
      <div
        role="button"
        title="Click to open Tracker Menu or Double Click to toggle Tracker"
        class="flex h-full w-8 items-center justify-center text-sm sm:text-lg"
        class:text-red-500={$isTrackerPaused$}
        class:animate-pulse={frozenPosition > -1}
        use:multiClickHandler={[trackerSingleClickHandler, trackerDblClickHandler]}
      >
        <Fa icon={$isTrackerPaused$ ? faPlay : faPause} />
      </div>
    {/if}
    {#if dataToReplicate.length}
      <div
        tabindex="0"
        role="button"
        class="flex h-full w-8 items-center justify-center text-sm sm:text-lg"
        class:text-red-500={externalStorageErrors > 1}
        class:animate-pulse={externalStorageErrors > 1 || isReplicating}
        onclick={(event) => {
          event.stopPropagation();
          if ($statisticsEnabled$) {
            wasTrackerPaused = $isTrackerPaused$;
            isTrackerPaused$.next(true);
          }

          executeReplication(false).finally(() => {
            if ($statisticsEnabled$ && !wasTrackerPaused) {
              isTrackerPaused$.next(false);
            }
          });
        }}
        onkeyup={dummyFn}
      >
        <Fa icon={faCloudBolt} />
      </div>
    {/if}
  </div>
  {#if showFooter && bookCharCount}
    {@const { copyText, displayText } = formatBookProgress({
      exploredCharCount,
      bookCharCount,
      showCharacterCounter: $showCharacterCounter$,
      showPercentage: $showPercentage$,
      showTotalLabel: $showFooterChapterCharacterCounter$ || $showFooterChapterPercentage$
    })}
    <div
      tabindex="0"
      role="button"
      title="Click to copy Progress"
      class="writing-horizontal-tb fixed bottom-2 right-2 z-10 text-xs leading-none select-none whitespace-pre"
      class:invisible={!$showCharacterCounter$ &&
        !$showPercentage$ &&
        !$showFooterChapterCharacterCounter$ &&
        !$showFooterChapterPercentage$}
      style:color={$themeOption$?.tooltipTextFontColor}
      onclick={(event) => {
        event.stopPropagation();
        const { target } = event;
        if (!$showCharacterCounter$ && !$showPercentage$) {
          return;
        }

        copyCurrentProgress(copyText);

        if (target instanceof HTMLElement) {
          pulseElement(target.parentElement || target, 'add', 0.5, 500);
        }
      }}
      onkeyup={dummyFn}
    >
      <span class="mr-4" class:invisible={!footerChapterProgress}>{footerChapterProgress}</span>
      <span class:invisible={!$showCharacterCounter$ && !$showPercentage$}>{displayText}</span>
    </div>
  {/if}
</div>

{#if bookCompleted}
  <BookCompletionConfetti {confettiWidthModifier} {confettiMaxRuns} {window} />
{/if}

<svelte:window
  onkeydown={onKeydown}
  onbeforeunload={handleUnload}
  onresize={() => {
    if ($statisticsEnabled$ && !$isTrackerPaused$) {
      pauseTracker();

      merge(fromEvent(document, PAGE_CHANGE), timer(1000))
        .pipe(debounceTime(1000), take(1))
        .subscribe(() => {
          restartTrackerAfterCharacterChangeOrTime(1000);
        });
    }
  }}
/>
