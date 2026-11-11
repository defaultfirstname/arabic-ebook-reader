/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  getChapterData,
  type SectionWithProgress
} from '$lib/components/book-reader/book-toc/book-toc';
import { getWeightedAverage } from '$lib/functions/utils';

type ChapterProgressOptions = {
  exploredCharCount: number;
  showCharacterCounter: boolean;
  showPercentage: boolean;
};

export function formatChapterProgress(
  sectionData: SectionWithProgress[] | undefined,
  { exploredCharCount, showCharacterCounter, showPercentage }: ChapterProgressOptions
) {
  if ((!showCharacterCounter && !showPercentage) || !sectionData?.length) {
    return '';
  }

  let chapterProgress = '';
  let chapterCharacters = '';

  const [mainChapters, chapterIndex, referenceId] = getChapterData(sectionData);

  if (showPercentage) {
    const relevantSections = sectionData.filter(
      (section) => section.reference === referenceId || section.parentChapter === referenceId
    );

    chapterProgress = `${getWeightedAverage(
      relevantSections.map((section) => section.progress),
      relevantSections.map((section) => section.charactersWeight)
    ).toFixed(2)}%`;
  }

  const currentChapter = mainChapters[chapterIndex];
  if (showCharacterCounter && currentChapter) {
    const endCharacter = currentChapter.characters as number;

    chapterCharacters = `${Math.min(
      Math.max(exploredCharCount - (currentChapter.startCharacter as number), 0),
      endCharacter
    )} / ${endCharacter}`;
  }

  return [chapterCharacters, chapterProgress, 'C'].filter(Boolean).join(' ');
}
