/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { formatBookProgress } from '../src/routes/b/format-book-progress';

const options = {
  exploredCharCount: 1,
  bookCharCount: 3,
  showCharacterCounter: true,
  showPercentage: true,
  showTotalLabel: false
};

test('formats book progress and keeps the total label out of copied text', () => {
  expect(formatBookProgress(options)).toEqual({
    displayText: '1 / 3 33.33%',
    copyText: '1 / 3 33.33%'
  });
  expect(formatBookProgress({ ...options, showTotalLabel: true })).toEqual({
    displayText: '1 / 3 33.33% T',
    copyText: '1 / 3 33.33%'
  });
});

test('honors independent character count and percentage settings', () => {
  expect(formatBookProgress({ ...options, showPercentage: false }).displayText).toBe('1 / 3');
  expect(
    formatBookProgress({ ...options, exploredCharCount: 0, showCharacterCounter: false })
      .displayText
  ).toBe('0.00%');
  expect(
    formatBookProgress({
      ...options,
      showCharacterCounter: false,
      showPercentage: false,
      showTotalLabel: true
    })
  ).toEqual({ displayText: 'T', copyText: '' });
});
