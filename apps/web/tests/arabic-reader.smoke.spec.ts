/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';

const bookTitle = 'Arabic Reading Smoke Test';
const paragraph =
  'هٰذَا نَصٌّ عَرَبِيٌّ لِلتَّجْرِبَةِ. نَقْرَأُ الْكِتَابَ وَنَنْتَقِلُ إِلَى الصَّفْحَةِ التَّالِيَةِ.';

async function importAndOpenBook(page: Page) {
  await page.goto('/manage');
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Files', exact: true }).click();
  const chooser = await fileChooser;
  await chooser.setFiles({
    name: `${bookTitle}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from(`${paragraph}\n\n`.repeat(120))
  });
  await page.getByRole('button', { name: bookTitle, exact: true }).click();
  await expect(page.locator('.book-content')).toContainText(paragraph);
}

test('reads an Arabic book and resumes from a saved bookmark', async ({ page, context }) => {
  await page.goto('/settings');
  const autoBookmark = page.getByRole('switch', { name: 'Save reading position automatically' });
  const showPercentage = page.getByRole('switch', { name: 'Show book percentage' });
  await expect(autoBookmark).toBeChecked();
  await expect(showPercentage).toBeChecked();
  await autoBookmark.press('Space');
  await showPercentage.press('Space');
  await expect(autoBookmark).not.toBeChecked();
  await expect(showPercentage).not.toBeChecked();
  await page.reload();
  await expect(autoBookmark).not.toBeChecked();
  await expect(showPercentage).not.toBeChecked();

  await importAndOpenBook(page);

  const progress = page.getByTitle('Click to copy Progress', { exact: true });
  await expect(progress).toHaveText(/^\s*0\s*\/\s*[1-9]\d*\s*$/);
  await page.keyboard.press('ArrowLeft');
  await expect(progress).toHaveText(/^\s*[1-9]\d*\s*\/\s*[1-9]\d*\s*$/);
  const savedProgress = await progress.innerText();
  const savedCount = Number.parseInt(savedProgress, 10);

  const showControls = page.getByRole('button', { name: 'Show reader controls', exact: true });
  const createBookmark = page.getByTitle('Create Bookmark', { exact: true });
  await showControls.click();
  await createBookmark.click();
  await expect(createBookmark).toBeHidden();
  await showControls.click();
  await expect(page.getByTitle('Return to Bookmark', { exact: true })).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(async () => Number.parseInt(await progress.innerText(), 10))
    .toBeGreaterThan(savedCount);

  const reopened = await context.newPage();
  await reopened.goto('/manage');
  await reopened.getByRole('button', { name: bookTitle, exact: true }).click();
  await expect(reopened.getByTitle('Click to copy Progress', { exact: true })).toHaveText(
    savedProgress
  );
});

test('updates Arabic reading progress while scrolling in continuous mode', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveTitle('Settings | Arabic Ebook Reader');
  await page.getByRole('combobox', { name: 'View mode', exact: true }).selectOption('continuous');
  await importAndOpenBook(page);

  const progress = page.getByTitle('Click to copy Progress', { exact: true });
  await expect(progress).toHaveText(/^\s*0\s*\/\s*[1-9]\d*\s+0\.00%\s*$/);
  await expect(page.locator('.book-content-container')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.mouse.move(480, 360);
  await page.mouse.wheel(0, 600);
  await expect(progress).toHaveText(/^\s*[1-9]\d*\s*\/\s*[1-9]\d*\s+[\d.]+%\s*$/);
});
