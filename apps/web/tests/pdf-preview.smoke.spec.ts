/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test, type Locator } from '@playwright/test';
import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { createEpub, firstChapter } from './fixtures/arabic-book-formats';

function spreadFixture(extraPages = 0) {
  const drawing = [
    '0 0 0 rg 115 100 70 90 re f',
    '0 0.5 0 rg 0 120 180 60 re f',
    '0 0.5 0 rg 120 120 180 60 re f',
    '0 0 1 rg 0 120 300 60 re f',
    '0 0 1 rg 0 120 300 60 re f'
  ];
  drawing.push(...Array<string>(extraPages).fill(drawing[3]));
  const ids = drawing.map((_, index) => 3 + index * 2);
  const scanId = 3 + ids.length * 2;
  const scanWidth = extraPages ? 1600 : 1;
  const scanHeight = extraPages ? 1000 : 1;
  const pixels = Buffer.alloc(scanWidth * scanHeight * 3);
  for (let index = 2; index < pixels.length; index += 3) pixels[index] = 255;
  const raster = deflateSync(pixels).toString('hex') + '>';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${ids.length} /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] >>`
  ];
  for (const [index, content] of drawing.entries()) {
    const wide = index === 3 || index >= 5;
    const stream = wide ? 'q 480 0 0 300 0 0 cm /Scan Do Q' : content;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wide ? '480 300' : '300 400'}] /Resources << ${wide ? `/XObject << /Scan ${scanId} 0 R >>` : ''} >> /Contents ${ids[index] + 1} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    if (index === drawing.length - 1) {
      objects.push(
        `<< /Type /XObject /Subtype /Image /Width ${scanWidth} /Height ${scanHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${raster.length} >>\nstream\n${raster}\nendstream`
      );
    }
  }

  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset.toString().padStart(10, '0') + ' 00000 n \n';
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function edgePixel(page: Locator, edge: 'left' | 'right') {
  return page.evaluate((canvas: HTMLCanvasElement, edge) => {
    const x = edge === 'left' ? 1 : canvas.width - 2;
    const y = Math.round(canvas.height * 0.625);
    return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
  }, edge);
}

test('renders RTL spreads with matching inner edges and keeps a wide scan whole offline', async ({
  page,
  context
}) => {
  await page.goto('/pdf-preview');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await context.setOffline(true);
  await page.getByLabel('Open PDF').setInputFiles({
    name: 'spread-check.pdf',
    mimeType: 'application/pdf',
    buffer: spreadFixture()
  });

  const first = page.getByLabel('Page 1', { exact: true });
  const right = page.getByLabel('Page 2', { exact: true });
  const left = page.getByLabel('Page 3', { exact: true });
  const wide = page.getByLabel('Page 4', { exact: true });
  const final = page.getByLabel('Page 5', { exact: true });
  const next = page.getByRole('button', { name: 'Next' });
  const previous = page.getByRole('button', { name: 'Previous' });
  const layout = page.getByLabel('Page layout');
  await expect(first).toHaveAttribute('data-ready', 'true');
  await expect(previous).toBeDisabled();

  await next.click();
  await expect(right).toHaveAttribute('data-ready', 'true');
  await expect(left).toHaveAttribute('data-ready', 'true');
  const rightBox = (await right.boundingBox())!;
  const leftBox = (await left.boundingBox())!;
  expect(rightBox.x).toBeCloseTo(leftBox.x + leftBox.width, 1);
  expect(rightBox.y).toBeCloseTo(leftBox.y, 1);
  expect(await edgePixel(right, 'left')).toEqual([0, 128, 0, 255]);
  expect(await edgePixel(left, 'right')).toEqual([0, 128, 0, 255]);

  await page.keyboard.press('ArrowLeft');
  await expect(wide).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await edgePixel(wide, 'left')).toEqual([0, 0, 255, 255]);
  expect(await edgePixel(wide, 'right')).toEqual([0, 0, 255, 255]);
  await next.click();
  await expect(final).toHaveAttribute('data-ready', 'true');
  await expect(next).toBeDisabled();

  await previous.click();
  await previous.click();
  await layout.selectOption('paired');
  await expect(first).toBeVisible();
  await expect(right).toBeVisible();
  await expect(left).toHaveCount(0);
  await layout.selectOption('single');
  await expect(right).toBeVisible();
  await expect(first).toHaveCount(0);
});

test('imports mixed books, saves PDF layout and page, and reopens offline', async ({
  page,
  context
}) => {
  await page.goto('/manage');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Files', exact: true }).click();
  await (
    await chooser
  ).setFiles([
    { name: 'كتاب.pdf', mimeType: 'application/pdf', buffer: spreadFixture(200) },
    { name: 'كتاب.epub', mimeType: 'application/epub+zip', buffer: await createEpub('كتاب') }
  ]);
  const pdf = page.getByRole('button', { name: 'كتاب PDF', exact: true });
  const text = page.getByRole('button', { name: 'كتاب', exact: true });
  await expect(text).toBeVisible();
  await pdf.click();
  await expect(page.getByLabel('Page 1', { exact: true })).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  const url = page.url();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel('Page 3', { exact: true })).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Page layout').selectOption('paired');
  await expect(page.getByLabel('Page 1', { exact: true })).toHaveAttribute('data-ready', 'true');
  await page.getByRole('link', { name: 'Book Manager', exact: true }).click();
  await page.getByTitle('Back to Book', { exact: true }).getByRole('button').click();
  await expect(page).toHaveURL(url);
  await expect(page.getByLabel('Page layout')).toHaveValue('paired');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);
  const reopened = await context.newPage();
  await reopened.goto('/');
  await expect(reopened).toHaveURL(url);
  await expect(reopened.getByLabel('Page layout')).toHaveValue('paired');
  await reopened.goto(url);
  await expect(reopened.getByLabel('Page layout')).toHaveValue('paired');
  await reopened.getByLabel('Page layout').selectOption('single');
  await expect(reopened.getByLabel('Page 2', { exact: true })).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(reopened.locator('canvas')).toHaveCount(1);
  await reopened.reload();
  await expect(reopened.getByLabel('Page 2', { exact: true })).toHaveAttribute(
    'data-ready',
    'true'
  );
  await context.setOffline(false);

  await page.goto('/manage');
  await page.getByTitle('Enable Book Selection').getByRole('button').click();
  await pdf.click();
  await expect(page.getByTitle('Open Export Menu')).toHaveCount(0);
  await expect(page.getByTitle('Delete Statistics for selected Books')).toHaveCount(0);
  await text.click();
  await expect(page.getByTitle('Open Export Menu')).toBeVisible();
  await expect(page.getByTitle('Delete Statistics for selected Books')).toBeVisible();
  await page.getByTitle('Open Export Menu').click();
  await page.getByRole('checkbox', { name: 'Book Data', exact: true }).check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const archive = new ZipReader(
    new BlobReader(new Blob([await readFile((await (await download).path())!)]))
  );
  const entries = await archive.getEntries();
  expect(entries.filter((entry) => entry.filename.includes('/bookdata_'))).toHaveLength(1);
  expect(entries.some((entry) => entry.filename.endsWith('.pdf'))).toBe(false);
  await archive.close();
  await page.getByTitle('Disable Book Selection').click();

  await text.hover();
  await page.getByTitle('Delete book', { exact: true }).click();
  await expect(text).toHaveCount(0);
  await pdf.click();
  await expect(page.getByLabel('Page 2', { exact: true })).toHaveAttribute('data-ready', 'true');

  await page.getByRole('link', { name: 'Book Manager', exact: true }).click();
  const textChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Files', exact: true }).click();
  await (
    await textChooser
  ).setFiles({
    name: 'كتاب.epub',
    mimeType: 'application/epub+zip',
    buffer: await createEpub('كتاب')
  });
  await expect(text).toBeVisible();
  await text.click();
  await expect(page.locator('.book-content')).toContainText(firstChapter);
  await page.keyboard.press('ArrowLeft');
  const progress = page.getByTitle('Click to copy Progress', { exact: true });
  await expect(progress).toHaveText(/^\s*[1-9]\d*\s*\//);
  await page.getByRole('button', { name: 'Show reader controls', exact: true }).click();
  await page.getByTitle('Create Bookmark', { exact: true }).click();
  await expect(page.getByTitle('Create Bookmark', { exact: true })).toBeHidden();
  const savedProgress = await progress.innerText();
  await page.goto('/manage');
  await pdf.click();
  await expect(page.getByLabel('Page 2', { exact: true })).toHaveAttribute('data-ready', 'true');
  await page.getByRole('link', { name: 'Book Manager', exact: true }).click();
  await pdf.hover();
  await page.getByTitle('Delete book', { exact: true }).click();
  await expect(pdf).toHaveCount(0);
  await expect(text).toBeVisible();
  await page.goto(url);
  await expect(page.getByRole('alert')).toHaveText('This PDF is no longer in your library.');
  await page.goto('/');
  await expect(page).toHaveURL(/\/manage$/);
  await text.click();
  await expect(progress).toHaveText(savedProgress);
});

test('opens a v6 library and preserves its bookmark and last-opened book', async ({ page }) => {
  await page.route('**/seed-v6-library', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Library fixture</title>' })
  );
  await page.goto('/seed-v6-library');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('books', 6);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('data', { keyPath: 'id', autoIncrement: true }).createIndex(
          'title',
          'title'
        );
        db.createObjectStore('bookmark', { keyPath: 'dataId' });
        db.createObjectStore('lastItem');
        db.createObjectStore('storageSource', { keyPath: 'name' });
        const statistics = db.createObjectStore('statistic', { keyPath: ['title', 'dateKey'] });
        statistics.createIndex('dateKey', 'dateKey');
        statistics.createIndex('completedBook', ['completedBook', 'title']);
        db.createObjectStore('readingGoal', { keyPath: 'goalStartDate' }).createIndex(
          'goalEndDate',
          'goalEndDate'
        );
        db.createObjectStore('lastModified', { keyPath: ['title', 'dataType'] });
        db.createObjectStore('audioBook', { keyPath: 'title' });
        db.createObjectStore('subtitle', { keyPath: 'title' });
        db.createObjectStore('handle', { keyPath: ['title', 'dataType'] });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['data', 'bookmark', 'lastItem'], 'readwrite');
      tx.objectStore('data').put({
        id: 7,
        title: 'كتاب قديم',
        language: 'ar',
        styleSheet: '',
        elementHtml: `<div id="section-1">${'<p>كتاب</p>'.repeat(100)}</div>`,
        blobs: {},
        hasThumb: false,
        characters: 400,
        lastBookModified: 1,
        lastBookOpen: 1
      });
      tx.objectStore('bookmark').put({
        dataId: 7,
        exploredCharCount: 40,
        progress: 0.1,
        includesArabicCharacters: true,
        lastBookmarkModified: 2
      });
      tx.objectStore('lastItem').put({ dataId: 7 }, 0);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/b\?id=7$/);
  await expect(page.getByTitle('Click to copy Progress', { exact: true })).toHaveText(
    /^\s*40\s*\/\s*400\b/
  );
  await page.goto('/manage');
  await expect(page.getByRole('button', { name: 'كتاب قديم', exact: true })).toBeVisible();
});

test('accepts a dropped PDF and reports an invalid PDF without saving it', async ({ page }) => {
  await page.goto('/manage');
  await expect(page.locator('input[type="file"][accept*=".pdf"]')).toHaveCount(2);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Files', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('Invalid PDF')
  });
  await expect(
    page.getByText('broken.pdf: Could not open this PDF.', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'broken PDF', exact: true })).toHaveCount(0);

  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], 'dropped.pdf', { type: 'application/pdf' }));
    return data;
  }, Array.from(spreadFixture()));
  const dropzone = page
    .locator('label')
    .filter({ has: page.locator('input[accept*=".pdf"]') })
    .last();
  await dropzone.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.getByRole('button', { name: 'dropped PDF', exact: true })).toBeVisible();
});

test.describe('touch navigation', () => {
  test.use({ viewport: { width: 390, height: 740 }, hasTouch: true, isMobile: true });

  test('imports a phone picker PDF supplied by MIME type without a filename extension', async ({
    page
  }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(Promise, 'withResolvers');
      Reflect.deleteProperty(AbortSignal.prototype, 'throwIfAborted');
    });
    await page.goto('/manage');
    const menu = page.getByRole('button', { name: 'Import File(s) menu', exact: true });
    const importFiles = page.getByText('Import File(s)', { exact: true });
    await expect(async () => {
      if (!(await importFiles.isVisible())) await menu.tap();
      await expect(importFiles).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });
    const fileChooser = page.waitForEvent('filechooser');
    await importFiles.tap();
    await (
      await fileChooser
    ).setFiles({
      name: 'كتاب الهاتف',
      mimeType: 'application/pdf',
      buffer: spreadFixture()
    });
    const card = page.getByRole('button', { name: 'كتاب الهاتف PDF', exact: true });
    await expect(card).toBeVisible();
    await page.reload();
    await card.tap();
    await expect(page.getByLabel('Page 1', { exact: true })).toHaveAttribute('data-ready', 'true');
  });

  test('swipes right to advance and left to return', async ({ page, context }) => {
    await page.goto('/pdf-preview');
    await page.getByLabel('Open PDF').setInputFiles({
      name: 'spread-check.pdf',
      mimeType: 'application/pdf',
      buffer: spreadFixture()
    });
    const cover = page.getByLabel('Page 1', { exact: true });
    await expect(cover).toHaveAttribute('data-ready', 'true');

    const session = await context.newCDPSession(page);
    async function swipe(from: number, to: number) {
      const y = 400;
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: from, y }]
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: (from + to) / 2, y }]
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: to, y }]
      });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }

    await swipe(80, 300);
    await expect(page.getByLabel('Page 2', { exact: true })).toHaveAttribute('data-ready', 'true');
    await expect(page.getByLabel('Page 3', { exact: true })).toHaveAttribute('data-ready', 'true');
    await swipe(300, 80);
    await expect(cover).toHaveAttribute('data-ready', 'true');
  });
});
