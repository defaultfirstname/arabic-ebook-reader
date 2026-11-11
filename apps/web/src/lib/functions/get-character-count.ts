/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export function getCharacterCount(node: Node) {
  return countTextCharacters(node.textContent ?? '');
}

export function countTextCharacters(text: string) {
  return countLatinLettersAndDigits(text) + countArabicCharacters(text);
}

export function countLatinLettersAndDigits(text: string) {
  // Keep the same Latin letters and digits as the original bookmark counter.
  return text.match(/[0-9a-z０-９ａ-ｚ]/giu)?.length ?? 0;
}

export function countArabicCharacters(text: string) {
  // Count base letters and digits, leaving combining marks and tatweel uncounted.
  return (
    text.match(/(?!\u0640)(?=\p{Script_Extensions=Arabic})[\p{Letter}\p{Decimal_Number}]/gu)
      ?.length ?? 0
  );
}
