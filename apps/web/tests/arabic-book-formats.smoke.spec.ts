/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import {
  chapter,
  createEpub,
  epubTitle,
  firstChapter,
  secondChapter,
  zipBook
} from './fixtures/arabic-book-formats';

const htmlzTitle = 'Arabic HTMLZ Smoke Test';
const books = [
  {
    format: 'epub',
    title: epubTitle,
    mimeType: 'application/epub+zip',
    create: createEpub
  },
  {
    format: 'htmlz',
    title: htmlzTitle,
    mimeType: 'application/zip',
    create: () =>
      zipBook({
        'index.html': chapter(firstChapter),
        'metadata.opf': `<package xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>${htmlzTitle}</dc:title><dc:language>ar</dc:language>
          </metadata>
        </package>`
      })
  }
];

for (const book of books) {
  for (const mode of ['paginated', 'continuous']) {
    test(`reads and resumes Arabic ${book.format.toUpperCase()} in ${mode} mode`, async ({
      page,
      context
    }) => {
      await page.goto('/settings');
      await page.getByRole('combobox', { name: 'View mode', exact: true }).selectOption(mode);
      const autoBookmark = page.getByRole('switch', {
        name: 'Save reading position automatically'
      });
      await expect(autoBookmark).toBeChecked();
      await autoBookmark.press('Space');
      await expect(autoBookmark).not.toBeChecked();

      await page.goto('/manage');
      const fileChooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Import Files', exact: true }).click();
      await (
        await fileChooser
      ).setFiles({
        name: `${book.title}.${book.format}`,
        mimeType: book.mimeType,
        buffer: await book.create()
      });
      const card = page.getByRole('button', { name: book.title, exact: true });
      await expect(card).toBeVisible();
      if (book.format === 'epub') {
        if (mode === 'continuous') {
          await page.reload();
          await page.setViewportSize({ width: 390, height: 740 });
        }
        const image = card.locator('img');
        await expect
          .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
          .toBeGreaterThan(0);
        await expect(image).toHaveCSS('filter', 'none');
        await page.setViewportSize({ width: 960, height: 720 });
      } else {
        await expect(card.locator('img')).toHaveCount(0);
      }
      await card.click();
      const content = page.locator('.book-content');
      await expect(content.getByText(firstChapter, { exact: true })).toBeVisible();

      const progress = page.getByTitle('Click to copy Progress', { exact: true });
      const count = async () => Number.parseInt(await progress.innerText(), 10);
      const advance = async () => {
        if (mode === 'paginated') {
          await page.keyboard.press('ArrowLeft');
        } else {
          await page.mouse.move(480, 360);
          await page.mouse.wheel(0, 480);
        }
      };

      await expect.poll(count).toBe(0);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await advance();
      await expect.poll(count).toBeGreaterThan(0);

      const controls = page.getByRole('button', { name: 'Show reader controls', exact: true });
      const createBookmark = page.getByTitle('Create Bookmark', { exact: true });
      await controls.click();
      await createBookmark.click();
      await expect(createBookmark).toBeHidden();
      await controls.click();
      await expect(page.getByTitle('Return to Bookmark', { exact: true })).toBeVisible();
      const savedCount = await count();
      await advance();
      await expect.poll(count).toBeGreaterThan(savedCount);

      const reopened = await context.newPage();
      await reopened.goto(page.url());
      const reopenedProgress = reopened.getByTitle('Click to copy Progress', { exact: true });
      await expect
        .poll(async () => Number.parseInt(await reopenedProgress.innerText(), 10))
        .toBe(savedCount);

      if (book.format === 'epub') {
        await reopened.getByRole('button', { name: 'Show reader controls', exact: true }).click();
        await reopened.getByTitle('Open Table of Contents', { exact: true }).click();
        await reopened.getByTitle(`Go to ${secondChapter}`, { exact: true }).click();
        await expect(
          reopened.locator('.book-content').getByRole('heading', { name: secondChapter })
        ).toBeInViewport();
      }
    });
  }
}
