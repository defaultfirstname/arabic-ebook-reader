/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '#lib/components/book-card/book-card-props';
import type { BooksDbBookmarkData } from '#lib/data/database/books-db/versions/books-db';
import { SortDirection, type SortOption } from '#lib/data/sort-types';

type SortableBookCard = Pick<BookCardProps, SortOption['property']>;
type BookmarkProgress = Pick<BooksDbBookmarkData, 'progress' | 'lastBookmarkModified'>;

export function compareBookCards(
  a: SortableBookCard,
  b: SortableBookCard,
  { property, direction }: SortOption
) {
  const [first, second] = direction === SortDirection.ASC ? [a, b] : [b, a];
  const difference =
    property === 'title'
      ? compareTitles(first.title, second.title)
      : (first[property] || 0) - (second[property] || 0);

  return difference || compareTitles(a.title, b.title);
}

function compareTitles(a: string, b: string) {
  return a.localeCompare(b, 'ar', { numeric: true });
}

export function bookmarkToProgress(bookmark: BookmarkProgress | undefined) {
  return bookmark?.progress
    ? {
        progress:
          typeof bookmark.progress === 'string'
            ? +bookmark.progress.slice(0, -1)
            : bookmark.progress,
        lastBookmarkModified: bookmark.lastBookmarkModified || 0
      }
    : { progress: 0, lastBookmarkModified: 0 };
}
