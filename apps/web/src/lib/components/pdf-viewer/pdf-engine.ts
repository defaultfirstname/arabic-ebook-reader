/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import './pdf-promise';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from './pdf.worker?worker&url';

GlobalWorkerOptions.workerSrc = workerUrl;

export { getDocument };
