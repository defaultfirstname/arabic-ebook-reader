/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '#lib/components/book-card/book-card-props';
import type { MergeMode } from '#lib/data/merge-mode';
import { ApiStorageHandler } from '#lib/data/storage/handler/api-handler';
import { getStorageHandler } from '#lib/data/storage/storage-handler-factory';
import { StorageKey } from '#lib/data/storage/storage-types';
import type { ReplicationSaveBehavior } from '#lib/functions/replication/replication-options';

interface OpenLibraryBookOptions {
  window: Window;
  source: StorageKey;
  book: Pick<BookCardProps, 'id' | 'title' | 'imagePath'>;
  cacheStorageData: boolean;
  saveBehavior: ReplicationSaveBehavior;
  statisticsMergeMode: MergeMode;
  readingGoalsMergeMode: MergeMode;
}

export async function openLibraryBook({
  window,
  source,
  book,
  cacheStorageData,
  saveBehavior,
  statisticsMergeMode,
  readingGoalsMergeMode
}: OpenLibraryBookOptions) {
  const isForBrowser = source === StorageKey.BROWSER;
  const handler = getStorageHandler(
    window,
    source,
    '',
    isForBrowser,
    cacheStorageData,
    saveBehavior,
    statisticsMergeMode,
    readingGoalsMergeMode
  );
  handler.startContext({
    id: isForBrowser ? book.id : 0,
    title: book.title,
    imagePath: book.imagePath
  });
  return {
    id: await handler.prepareBookForReading(),
    isCloudBook: handler instanceof ApiStorageHandler
  };
}
