/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export function getParagraphNodes(node: Node): Text[] {
  if (node instanceof Text) {
    return node.data.trim() ? [node] : [];
  }
  if (
    node instanceof HTMLElement &&
    (node.nodeName === 'RT' || node.hasAttribute('aria-hidden') || node.hasAttribute('hidden'))
  ) {
    return [];
  }

  return Array.from(node.childNodes).flatMap(getParagraphNodes);
}
