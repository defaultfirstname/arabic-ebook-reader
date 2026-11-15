/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { pagePath } from '#lib/data/env';

export interface BookReference {
  dataId: number;
  format?: 'pdf';
}

export function getBookHref({ dataId, format }: BookReference) {
  return `${pagePath}/${format === 'pdf' ? 'pdf' : 'b'}?id=${dataId}`;
}

export function getBookKey({ dataId, format }: BookReference) {
  return `${format ?? 'html'}:${dataId}`;
}
