/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

interface BookProgressOptions {
  exploredCharCount: number;
  bookCharCount: number;
  showCharacterCounter: boolean;
  showPercentage: boolean;
  showTotalLabel: boolean;
}

export function formatBookProgress({
  exploredCharCount,
  bookCharCount,
  showCharacterCounter,
  showPercentage,
  showTotalLabel
}: BookProgressOptions) {
  const copyText = [
    showCharacterCounter ? `${exploredCharCount} / ${bookCharCount}` : '',
    showPercentage ? `${((exploredCharCount / bookCharCount) * 100).toFixed(2)}%` : ''
  ]
    .filter(Boolean)
    .join(' ');

  return {
    copyText,
    displayText: showTotalLabel ? [copyText, 'T'].filter(Boolean).join(' ') : copyText
  };
}
