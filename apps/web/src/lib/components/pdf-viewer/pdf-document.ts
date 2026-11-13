/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfPageDimensions } from '#lib/data/storage/pdf-book';

const assetUrls = import.meta.glob<string>(
  '../../../../node_modules/pdfjs-dist/{cmaps/*.bcmap,standard_fonts/*.{pfb,ttf},wasm/{jbig2,openjpeg,qcms_bg}.wasm}',
  { query: '?url&no-inline', import: 'default', eager: true }
);

const assetDirectories = {
  cMapUrl: 'cmaps',
  standardFontDataUrl: 'standard_fonts',
  wasmUrl: 'wasm'
};

class PdfBinaryDataFactory {
  async fetch({ kind, filename }: { kind: keyof typeof assetDirectories; filename: string }) {
    const url =
      assetUrls[`../../../../node_modules/pdfjs-dist/${assetDirectories[kind]}/${filename}`];
    if (!url) throw new Error(`PDF asset unavailable: ${filename}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load PDF asset: ${filename}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

export async function loadPdf(file: Blob, signal: AbortSignal) {
  const [pdfjs, { default: workerUrl }, data] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    file.arrayBuffer()
  ]);
  signal.throwIfAborted();
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data,
    disableWorkerRendering: true,
    useWorkerFetch: false,
    BinaryDataFactory: PdfBinaryDataFactory
  });
  let destruction: Promise<void> | undefined;
  const destroy = () => {
    signal.removeEventListener('abort', cancel);
    return (destruction ??= task.destroy().catch(() => {}));
  };
  const cancel = () => void destroy();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    return { document: await task.promise, destroy };
  } catch (error) {
    await destroy();
    throw error;
  }
}

export async function readPdfDimensions(document: PDFDocumentProxy, signal: AbortSignal) {
  const dimensions: PdfPageDimensions[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    signal.throwIfAborted();
    const page = await document.getPage(number);
    const { width, height } = page.getViewport({ scale: 1 });
    dimensions.push({ width, height });
    page.cleanup();
  }
  return dimensions;
}

export function pdfOpenError(cause: unknown) {
  return cause instanceof Error && cause.name === 'PasswordException'
    ? 'This PDF needs a password.'
    : 'Could not open this PDF.';
}
