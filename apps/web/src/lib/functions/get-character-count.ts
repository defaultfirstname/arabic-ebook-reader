/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { isNodeGaiji } from './is-node-gaiji';

export function getCharacterCount(node: Node) {
  return isNodeGaiji(node) ? 1 : countTextCharacters(node.textContent ?? '');
}

export function countTextCharacters(text: string) {
  return countLegacyTextCharacters(text) + countArabicCharacters(text);
}

export function getLegacyCharacterCount(node: Node) {
  return isNodeGaiji(node) ? 1 : countLegacyTextCharacters(node.textContent ?? '');
}

export function countArabicCharacters(text: string) {
  // Count base letters and digits, leaving combining marks and tatweel uncounted.
  return (
    text.match(/(?!\u0640)(?=\p{Script_Extensions=Arabic})[\p{Letter}\p{Decimal_Number}]/gu)
      ?.length ?? 0
  );
}

const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

function countLegacyTextCharacters(text: string) {
  return countUnicodeCharacters(text.replace(isNotJapaneseRegex, ''));
}

/**
 * Because '𠮟る'.length = 3
 * Reference: https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/#length-and-surrogate-pairs
 */
function countUnicodeCharacters(s: string) {
  return Array.from(s).length;
}
