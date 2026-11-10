/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { getParagraphNodes } from '$lib/components/book-reader/get-paragraph-nodes';
import type {
  BooksDbBookData,
  BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';
import { countArabicCharacters, getLegacyCharacterCount } from '../get-character-count';

export function getArabicBookMetrics(book: BooksDbBookData, document: Document) {
  if (!/\p{Script_Extensions=Arabic}/u.test(book.elementHtml)) return undefined;

  const container = document.createElement('template');
  container.innerHTML = book.elementHtml;
  const sections = new Map(
    (book.sections ?? []).map((section) => [section.reference, { ...section }])
  );
  const bookmarkOffsets = new Map<number, number>();
  let oldCount = 0;
  let newCount = 0;
  let arabicCount = 0;

  for (const element of container.content.children) {
    const start = newCount;
    for (const node of getParagraphNodes(element)) {
      const legacy = getLegacyCharacterCount(node);
      const arabic = countArabicCharacters(node.textContent ?? '');
      oldCount += legacy;
      newCount += legacy + arabic;
      arabicCount += arabic;
      if (legacy) bookmarkOffsets.set(oldCount, newCount);
    }

    const section = sections.get(element.id);
    if (!section) continue;

    const characters = newCount - start;
    section.charactersWeight = characters || 1;
    if (!section.parentChapter) {
      section.startCharacter = start;
      section.characters = characters;
    } else {
      const parent = sections.get(section.parentChapter);
      if (parent) parent.characters = (parent.characters ?? 0) + characters;
    }
  }

  if (!arabicCount) return undefined;

  return {
    sections: [...sections.values()],
    restoreBookmark(bookmark: BooksDbBookmarkData | undefined) {
      if (!bookmark?.exploredCharCount || bookmark.includesArabicCharacters) return bookmark;

      const exploredCharCount = bookmarkOffsets.get(bookmark.exploredCharCount);
      if (exploredCharCount === undefined) return bookmark;

      return {
        ...bookmark,
        exploredCharCount,
        includesArabicCharacters: true,
        progress: exploredCharCount / newCount
      };
    }
  };
}
