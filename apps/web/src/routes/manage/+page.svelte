<script lang="ts">
  import { goto } from '$app/navigation';
  import { faUpload } from '@fortawesome/free-solid-svg-icons';
  import BookCardList from '#lib/components/book-card/book-card-list.svelte';
  import type { BookCardProps } from '#lib/components/book-card/book-card-props';
  import BookManagerHeader from '#lib/components/book-card/book-manager-header.svelte';
  import BookExportDialog from '#lib/components/book-export/book-export-dialog.svelte';
  import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
  import ExternalReadDialog from '#lib/components/external-read-dialog.svelte';
  import LogReportDialog from '#lib/components/log-report-dialog.svelte';
  import { mergeEntries } from '#lib/components/merged-header-icon/merged-entries';
  import MessageDialog from '#lib/components/message-dialog.svelte';
  import {
    loadPdf,
    pdfOpenError,
    readPdfDimensions
  } from '#lib/components/pdf-viewer/pdf-document';
  import { getBookHref, getBookKey } from '#lib/data/book-reference';
  import { preFilteredTitlesForStatistics$ } from '#lib/components/statistics/statistics-types';
  import { pxScreen } from '#lib/css-classes';
  import { dialogManager } from '#lib/data/dialog-manager';
  import { pagePath } from '#lib/data/env';
  import { logger } from '#lib/data/logger';
  import { openLibraryBook } from '#lib/data/storage/book-library';
  import { getStorageHandler } from '#lib/data/storage/storage-handler-factory';
  import { StorageKey } from '#lib/data/storage/storage-types';
  import { storageSource$ } from '#lib/data/storage/storage-view';
  import { storage } from '#lib/data/window/navigator/storage';
  import {
    booklistSortOptions$,
    cacheStorageData$,
    confirmStatisticsDeletion$,
    database,
    fileCountData$,
    hideExternalReadHint$,
    isOnline$,
    keepLocalStatisticsOnDeletion$,
    lastExportedTarget$,
    lastExportedTypes$,
    readingGoalsMergeMode$,
    replicationSaveBehavior$,
    requestPersistentStorage$,
    showExternalPlaceholder$,
    statisticsMergeMode$
  } from '#lib/data/store';
  import { cloneMutateSet } from '#lib/functions/clone-mutate-set';
  import { getDropEventFiles } from '#lib/functions/file-dom/get-drop-event-files';
  import { inputFile } from '#lib/functions/file-dom/input-file';
  import {
    bookImportAccept,
    getBookImportFormat,
    isPdfFile,
    localBookImportAccept
  } from '#lib/functions/file-loaders/book-import-format';
  import { formatPageTitle } from '#lib/functions/format-page-title';
  import { keyBy } from '#lib/functions/key-by';
  import { handleErrorDuringReplication } from '#lib/functions/replication/error-handler';
  import { importBackup, importData, replicateData } from '#lib/functions/replication/replicator';
  import { throwIfAborted } from '#lib/functions/replication/replication-error';
  import {
    replicationProgress$,
    executeReplicate$,
    type ReplicationProgress
  } from '#lib/functions/replication/replication-progress';
  import { pluralize } from '#lib/functions/utils';
  import { reduceToEmptyString } from '#lib/functions/rxjs/reduce-to-empty-string';
  import pLimit from 'p-limit';
  import { combineLatest, map, Observable, share, Subject, switchMap, takeUntil } from 'rxjs';
  import { onDestroy, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import { bookmarkToProgress, compareBookCards } from './book-card-rules';

  const booksAreLoading$ = database.listLoading$.pipe(map((isLoading) => isLoading));

  const bookCards$: Observable<BookCardProps[]> = combineLatest([
    database.dataList$,
    database.bookmarks$,
    database.pdfBooks$,
    booklistSortOptions$
  ]).pipe(
    map(([dataList, bookmarks, pdfBooks, sortOptions]) => {
      const sortProp = sortOptions[$storageSource$];
      const compare = (a: BookCardProps, b: BookCardProps) => compareBookCards(a, b, sortProp);

      if ($storageSource$ === StorageKey.BROWSER) {
        const bookmarkMap = keyBy(bookmarks, 'dataId');

        return [
          ...dataList
            .filter((d) => $showExternalPlaceholder$ || !d.isPlaceholder)
            .map((d) => ({
              ...d,
              ...bookmarkToProgress(bookmarkMap.get(d.id))
            })),
          ...pdfBooks.map(
            (book): BookCardProps => ({
              id: book.id,
              format: 'pdf',
              title: book.title,
              imagePath: '',
              characters: 0,
              pageCount: book.pages.length,
              progress: book.page / book.pages.length,
              lastBookModified: book.lastBookModified,
              lastBookOpen: book.lastBookOpen,
              lastBookmarkModified: book.lastBookmarkModified,
              isPlaceholder: false
            })
          )
        ].sort(compare);
      }

      return [...dataList.sort(compare)];
    }),
    share()
  );

  const lastItem$ = database.lastItem$;

  let selectedBookKeys: ReadonlySet<string> = $state(new Set());
  const selectedBooks = $derived(
    ($bookCards$ ?? []).filter((card) => selectedBookKeys.has(cardKey(card)))
  );
  const eligibleBooks = $derived(selectedBooks.filter((card) => card.format !== 'pdf'));
  let selectMode = $state(false);
  let cancelToken = $state(new AbortController());
  let cancelSignal = $derived(cancelToken.signal);
  let cancelTooltip = $state('');
  let replicationProgress = $state(0);
  let replicationToProgress = $state(0);
  let replicationProgressRemaining = $state('~ ??:??:??');
  let replicationDone = new Subject<void>();
  let progressBase = 0;
  let executionStart: number;

  $effect.pre(() => {
    if (!selectMode) {
      selectedBookKeys = new Set();
    }
  });

  onDestroy(() => dialogManager.dialogs$.next([]));

  function cardKey(card: BookCardProps) {
    return getBookKey({ dataId: card.id, format: card.format });
  }

  async function onBookClick(bookItem: BookCardProps) {
    if (!operationAllowed()) {
      return;
    }

    const key = cardKey(bookItem);
    if (!selectMode) {
      if (bookItem.format === 'pdf') {
        await goto(getBookHref({ dataId: bookItem.id, format: 'pdf' }));
        return;
      }
      dialogManager.dialogs$.next([
        {
          component: '<div/>',
          disableCloseOnClick: true
        }
      ]);

      let idToOpen = bookItem.id;

      try {
        const { id, isCloudBook } = await openLibraryBook({
          window,
          source: $storageSource$,
          book: bookItem,
          cacheStorageData: $cacheStorageData$,
          saveBehavior: $replicationSaveBehavior$,
          statisticsMergeMode: $statisticsMergeMode$,
          readingGoalsMergeMode: $readingGoalsMergeMode$
        });
        idToOpen = id;

        if (!$hideExternalReadHint$ && isCloudBook) {
          const nextAction = await new Promise<string>((resolver) => {
            dialogManager.dialogs$.next([
              {
                component: ExternalReadDialog,
                props: { resolver },
                disableCloseOnClick: true
              }
            ]);
          });

          if (nextAction === 'cancel') {
            return;
          }

          if (nextAction === 'export') {
            selectedBookKeys = cloneMutateSet(selectedBookKeys, (set) => {
              set.add(key);
            });
            selectMode = true;

            await tick();

            return onReplicateData();
          }
        }

        dialogManager.dialogs$.next([]);
      } catch (error: any) {
        const message = `Error opening book: ${error.message}`;

        logger.warn(message);

        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Error',
              message
            }
          }
        ]);

        return;
      }

      openBook(idToOpen);
      return;
    }

    selectedBookKeys = cloneMutateSet(selectedBookKeys, (set) => {
      if (set.has(key)) {
        set.delete(key);
        return;
      }
      set.add(key);
    });
  }

  function operationAllowed() {
    const connectivityPass = !(
      ($storageSource$ === StorageKey.GDRIVE || $storageSource$ === StorageKey.ONEDRIVE) &&
      !$isOnline$
    );

    if (!connectivityPass && !replicationToProgress) {
      const message = 'You have to be online for this operation';

      logger.warn(message);

      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Failure',
            message
          }
        }
      ]);
    }

    return !replicationToProgress && connectivityPass;
  }

  function openBook(bookId: number) {
    if (!bookId) {
      return;
    }

    database.putLastItem(bookId);
    void goto(getBookHref({ dataId: bookId }));
  }

  async function onFilesChange(fileList: FileList | File[]) {
    if (!operationAllowed()) {
      return;
    }

    cancelTooltip = `Cancels the current Import\nAlready imported data will not be deleted`;

    initializeReplicationProgressData();

    const allFiles = Array.from(fileList);
    const files = allFiles.filter((file) => !isPdfFile(file) && getBookImportFormat(file.name));
    const pdfFiles = allFiles.filter(isPdfFile);
    const canImportPdf = $storageSource$ === StorageKey.BROWSER && !$fileCountData$;
    const errors: string[] = [];
    if (pdfFiles.length && !canImportPdf) {
      errors.push(
        $storageSource$ !== StorageKey.BROWSER
          ? 'Switch to Browser DB to import PDFs.'
          : 'Turn off character counting mode to import PDFs.'
      );
    }
    const errorTitle = 'Bookimport failed';

    if (!files.length && !(canImportPdf && pdfFiles.length)) {
      resetProgress();

      showError(
        errorTitle,
        errors[0] ??
          (canImportPdf
            ? 'Choose an HTMLZ, TXT, EPUB, or PDF file.'
            : 'Choose an HTMLZ, TXT, or EPUB file.'),
        ''
      );
      return;
    }

    const error = files.length
      ? await importData(
          document,
          getStorageHandler(
            window,
            $storageSource$,
            '',
            $storageSource$ === StorageKey.BROWSER,
            $cacheStorageData$,
            $replicationSaveBehavior$,
            $statisticsMergeMode$,
            $readingGoalsMergeMode$
          ),
          files,
          cancelSignal,
          $fileCountData$
        ).catch((catchedError) => catchedError.message)
      : '';
    if (error) errors.push(error);

    if (canImportPdf && pdfFiles.length && !cancelSignal.aborted) {
      if ($requestPersistentStorage$) await storage.persist().catch(() => {});
      replicationProgress = 0;
      replicationProgress$.next({ progressBase: 1, maxProgress: pdfFiles.length });
      for (const file of pdfFiles) {
        if (cancelSignal.aborted) break;
        let opened: Awaited<ReturnType<typeof loadPdf>> | undefined;
        try {
          const data = await file.arrayBuffer();
          // PDF.js transfers its buffer to the worker. Keep the original bytes for storage.
          opened = await loadPdf(data.slice(0), cancelSignal);
          const pages = await readPdfDimensions(opened.document, cancelSignal);
          if (!pages.length) throw new Error('Empty PDF');
          await database.addPdfBook(
            {
              title: file.name.replace(/\.pdf$/i, '') || file.name,
              pages,
              page: 1,
              layout: 'cover',
              lastBookModified: file.lastModified,
              lastBookOpen: 0,
              lastBookmarkModified: 0
            },
            data,
            cancelSignal
          );
        } catch (cause) {
          if (!cancelSignal.aborted) {
            logger.warn('PDF import failed', cause);
            errors.push(
              `${file.name}: ${opened ? 'Could not import this PDF.' : pdfOpenError(cause)}`
            );
          }
        } finally {
          await opened?.destroy();
        }
        replicationProgress$.next({ progressToAdd: 1 });
      }
    }

    resetProgress();

    if (errors.length) {
      const message = errors.join(' ');
      showError(errorTitle, message, message);
    }
  }

  function showError(title: string, message: string, fallbackMessage: string) {
    const showReport = logger.errorCount > 1;

    logger.warn(message);

    dialogManager.dialogs$.next([
      {
        component: showReport ? LogReportDialog : MessageDialog,
        props: {
          title,
          message: showReport ? fallbackMessage : message
        }
      }
    ]);
  }

  function initializeReplicationProgressData() {
    replicationDone = new Subject<void>();
    replicationProgress$.pipe(takeUntil(replicationDone)).subscribe(updateProgress);
    replicationProgressRemaining = '~ ??:??:??';
    replicationProgress = 0;
    replicationToProgress = 1;
    executionStart = Date.now();

    logger.clearHistory();

    cancelToken = new AbortController();
  }

  function resetProgress() {
    replicationDone.next();
    replicationDone.complete();
    replicationToProgress = 0;
    replicationProgress = 0;
    cancelTooltip = '';
  }

  function onSelectAllBooks() {
    const bookCards = $bookCards$;
    selectedBookKeys = cloneMutateSet(selectedBookKeys, (set) => {
      bookCards.forEach((card) => set.add(cardKey(card)));
    });
  }

  function backToCurrentBook() {
    const item = $lastItem$;
    if (item) void goto(getBookHref(item));
  }

  async function removeBooks(books: BookCardProps[]) {
    if (!operationAllowed()) {
      return;
    }

    cancelTooltip = `Cancels the Deletion\nAlready deleted data will not be restored`;

    initializeReplicationProgressData();

    const currentBookCount = $bookCards$.length;
    const titles = books.filter((book) => book.format !== 'pdf').map((book) => book.title);
    const pdfBooks = books.filter((book) => book.format === 'pdf');
    const deleted: string[] = [];
    let error = '';
    try {
      if (titles.length) {
        const handler = getStorageHandler(window, $storageSource$, '');
        const result = await handler.deleteBookData(
          titles,
          cancelSignal,
          $keepLocalStatisticsOnDeletion$
        );
        error = result.error;
        deleted.push(...result.deleted.map((dataId) => getBookKey({ dataId })));
      }
      if (pdfBooks.length && !cancelSignal.aborted) {
        replicationProgress = 0;
        replicationProgress$.next({ progressBase: 1, maxProgress: pdfBooks.length });
        for (const book of pdfBooks) {
          if (cancelSignal.aborted) break;
          await database.deletePdfBook(book.id);
          deleted.push(cardKey(book));
          replicationProgress$.next({ progressToAdd: 1 });
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not delete the selected books.';
    }

    resetProgress();

    await tick();

    if (deleted.length === currentBookCount) {
      selectMode = false;
    } else {
      selectedBookKeys = cloneMutateSet(selectedBookKeys, (set) => {
        deleted.forEach((deletedBookId) => set.delete(deletedBookId));
      });
    }

    if (error) {
      showError('Deletion failed', error, 'Error(s) occurred during deletion');
    }
  }

  async function onImportBackup(file: File) {
    if (!operationAllowed()) {
      return;
    }

    const errorTitle = 'Import failed';

    cancelTooltip = `Cancels the current Import\nAlready imported data will not be deleted`;

    initializeReplicationProgressData();

    if (!file.name.endsWith('.zip')) {
      resetProgress();

      showError(errorTitle, 'Invalid file - expected zip archive', '');
      return;
    }

    const error = await importBackup(
      getStorageHandler(
        window,
        StorageKey.BACKUP,
        undefined,
        $storageSource$ === StorageKey.BROWSER,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      ),
      getStorageHandler(
        window,
        $storageSource$,
        '',
        $storageSource$ === StorageKey.BROWSER,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      ),
      file,
      cancelSignal
    ).catch((err) => err.message);

    resetProgress();

    if (error) {
      showError(errorTitle, error, 'Error(s) occurred during import');
    }
  }

  function onBugReportClick() {
    dialogManager.dialogs$.next([
      {
        component: LogReportDialog,
        props: {
          title: 'Bug Report',
          message: 'Please include the attached file for your report'
        }
      }
    ]);
  }

  function onReplicateData() {
    if (!eligibleBooks.length) return;
    dialogManager.dialogs$.next([{ component: BookExportDialog, disableCloseOnClick: true }]);
  }

  async function onDeleteStatistics() {
    const titles = eligibleBooks.map((book) => book.title);
    if (!titles.length) return;

    let wasCanceled = false;

    if ($confirmStatisticsDeletion$) {
      wasCanceled = await new Promise((resolver) => {
        dialogManager.dialogs$.next([
          {
            component: ConfirmDialog,
            props: {
              dialogHeader: 'Delete Data',
              dialogMessage: `This will delete all Statistics for the selected ${pluralize(
                titles.length,
                'Title',
                false
              )} (which may include start and/or completion Data)\n\nExecute a one time Sync with an export behavior of "replace" and/or statistics merge mode of "replace" to apply deletions to other devices`,
              contentStyles: 'white-space: pre-line;',
              resolver
            }
          }
        ]);
      });
    }

    if (wasCanceled) {
      return;
    }

    cancelTooltip = `Cancels the current Process`;

    initializeReplicationProgressData();

    const limiter = pLimit(1);
    const tasks: Promise<void>[] = [];

    let failed = 0;

    replicationProgress$.next({ progressBase: 1, maxProgress: titles.length });

    titles.forEach((title) => {
      tasks.push(
        limiter(async () => {
          try {
            throwIfAborted(cancelSignal);
            await database.deleteStatisticEntries([title], true);

            replicationProgress$.next({ progressToAdd: 1 });
          } catch (error) {
            handleErrorDuringReplication(error, `Error on deleting statistics for ${title}: `, [
              limiter
            ]);

            failed += 1;
          }
        })
      );
    });

    await Promise.all(tasks).catch(() => {});

    resetProgress();

    if (failed) {
      const errorMessage = `Unable to delete statistics of ${pluralize(failed, 'Title')}`;

      showError('Deletion Failed', errorMessage, errorMessage);
    }
  }

  function updateProgress(replicationProgressData: ReplicationProgress) {
    if (cancelSignal.aborted) {
      return;
    }

    progressBase = replicationProgressData.progressBase || progressBase || 0;
    replicationToProgress = replicationProgressData.maxProgress || replicationToProgress || 0;

    if (replicationProgressData.skipStep) {
      const progressDiffToAdd =
        Math.ceil(replicationProgress / progressBase) * progressBase - replicationProgress;

      replicationProgress =
        Math.floor(
          (replicationProgress + (progressDiffToAdd || progressBase) + Number.EPSILON) * 1000
        ) / 1000;
    } else if (replicationProgressData.completeStep) {
      const progressDiffToAdd = Math.ceil(replicationProgress) - replicationProgress;

      replicationProgress =
        Math.floor((replicationProgress + progressDiffToAdd + Number.EPSILON) * 1000) / 1000;
    } else if (replicationProgressData.progressToAdd && replicationProgressData.progressToAdd > 0) {
      replicationProgress =
        Math.floor(
          (replicationProgress + replicationProgressData.progressToAdd + Number.EPSILON) * 1000
        ) / 1000;
    }

    if (replicationProgressData.progressToAdd) {
      const duration = (Date.now() - executionStart) / 1000;
      const processPerSecond = replicationProgress / duration;
      const remainingTime = (replicationToProgress - replicationProgress) / processPerSecond;

      replicationProgressRemaining =
        replicationToProgress > replicationProgress
          ? `~ ${getTimestamp(Math.ceil(remainingTime))}`
          : '~ 00:00:01';
    }
  }

  const replicator$ = executeReplicate$.pipe(
    switchMap(async () => {
      const books = eligibleBooks;
      if (!books.length || !operationAllowed()) {
        return;
      }

      cancelTooltip = 'Cancels the current export';

      initializeReplicationProgressData();

      const handlers = [$storageSource$, $lastExportedTarget$].map((storageType) =>
        getStorageHandler(
          window,
          storageType,
          '',
          $lastExportedTarget$ === StorageKey.BROWSER,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        )
      );
      const error = await replicateData(
        handlers[0],
        handlers[1],
        false,
        books.map((book) => ({ title: book.title, imagePath: book.imagePath })),
        $lastExportedTypes$,
        cancelSignal
      ).catch((err) => err.message);

      resetProgress();

      if (error) {
        showError('Export failed', error, 'Error(s) occurred during export');
      }
    }),
    reduceToEmptyString()
  );

  function getTimestamp(seconds: number) {
    return seconds && Number.isFinite(seconds)
      ? new Date(seconds * 1000).toISOString().substr(11, 8)
      : '??:??:??';
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Book Manager')}</title>
</svelte:head>

{$replicator$ ?? ''}

<div class="elevation-4 fixed inset-x-0 top-0 z-10">
  <BookManagerHeader
    hasBookOpened={!!$lastItem$}
    selectedCount={selectedBooks.length}
    hasEligibleSelection={!!eligibleBooks.length}
    hasBooks={!!$bookCards$?.length}
    {cancelTooltip}
    {replicationProgress}
    {replicationToProgress}
    {replicationProgressRemaining}
    bind:selectMode
    onSelectAllClick={onSelectAllBooks}
    onBackToBookClick={backToCurrentBook}
    onRemoveClick={() => removeBooks(selectedBooks)}
    {onFilesChange}
    {onBugReportClick}
    onCancelReplication={() => {
      if (!cancelSignal.aborted) {
        cancelToken.abort();
        replicationProgressRemaining = 'Canceling ...';
      }
    }}
    onSelectionToStatistics={() => {
      $preFilteredTitlesForStatistics$ = new Set(eligibleBooks.map((book) => book.title));

      goto(`${pagePath}${mergeEntries.STATISTICS.routeId}`);
    }}
    {onDeleteStatistics}
    {onReplicateData}
    {onImportBackup}
  />
</div>

<div
  tabindex="0"
  role="button"
  class="{pxScreen} h-full pt-16 xl:pt-14"
  ondragenter={(ev) => ev.preventDefault()}
  ondragover={(ev) => ev.preventDefault()}
  ondragend={(ev) => ev.preventDefault()}
  ondrop={(event) => {
    event.preventDefault();
    getDropEventFiles(event).then(onFilesChange);
  }}
>
  {#if !$bookCards$ || $booksAreLoading$}
    Loading...
  {:else if $bookCards$.length}
    <BookCardList
      currentBookKey={$storageSource$ === StorageKey.BROWSER && $lastItem$
        ? getBookKey($lastItem$)
        : undefined}
      {selectedBookKeys}
      bookCards={$bookCards$}
      {onBookClick}
      onRemoveBookClick={(card) => removeBooks([card])}
    />
  {:else}
    <div class="flex justify-center pt-44 text-gray-400 text-opacity-40">
      <div class="flex w-3/6 justify-center xl:w-3/12">
        <Fa icon={faUpload} style="width: 100%; height: auto" />
      </div>
    </div>
    <label class="fixed inset-0 z-0">
      <input
        type="file"
        accept={$storageSource$ === StorageKey.BROWSER ? localBookImportAccept : bookImportAccept}
        multiple
        hidden
        use:inputFile={onFilesChange}
      />
    </label>
  {/if}
</div>
