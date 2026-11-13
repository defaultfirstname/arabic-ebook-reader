/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { Buffer } from 'node:buffer';

test('reopens a book and its bookmark from a pre-Arabic-counting backup', async ({ page }) => {
  const title = 'كتاب قديم';
  const paragraph = 'test كتاب';
  const book = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await book.add(
    'staticdata.json',
    new TextReader(
      JSON.stringify({
        title,
        elementHtml: `<div id="section-1">${`<p>${paragraph}</p>`.repeat(100)}</div>`
      })
    )
  );

  // The older bookmark counts the four Latin letters in each paragraph.
  const backup = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await backup.add(`${title}/bookdata_1_6_400_1_0.zip`, new Uint8ArrayReader(await book.close()));
  await backup.add(
    `${title}/progress_1_6_2_0.1.json`,
    new TextReader(
      JSON.stringify({ dataId: 9, exploredCharCount: 40, progress: 0.1, lastBookmarkModified: 2 })
    )
  );
  const buffer = Buffer.from(await backup.close());

  await page.goto('/manage');
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await (
    await fileChooser
  ).setFiles({
    name: 'older-library.zip',
    mimeType: 'application/zip',
    buffer
  });

  const bookCard = page.getByRole('button', { name: title, exact: true });
  await expect(bookCard.locator('div[style*="width"]')).toHaveAttribute('style', /width:\s*10%/);
  await page.reload();
  await bookCard.click();
  await expect(page.locator('.book-content')).toContainText(paragraph);
  await expect(page.getByTitle('Click to copy Progress', { exact: true })).toHaveText(
    /^\s*80\s*\/\s*800\b/
  );
});
