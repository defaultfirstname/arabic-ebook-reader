/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

test('sorts Arabic book cards, keeps bookmark progress, and selects the reordered card', async ({
  page
}) => {
  const titles = ['كتاب 2', 'كتاب 3', 'كتاب 10'];
  const paragraph = 'هذا نص عربي للتجربة. نقرأ الكتاب وننتقل إلى الصفحة التالية.';
  await page.goto('/manage');
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Files', exact: true }).click();
  await (
    await fileChooser
  ).setFiles(
    titles.map((title) => ({
      name: `${title}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`${paragraph}\n\n`.repeat(120))
    }))
  );

  const cards = page.getByRole('button', { name: /^كتاب \d+$/ });
  await expect(cards).toHaveCount(titles.length);
  const readCard = page.getByRole('button', { name: titles[0], exact: true });
  await readCard.click();
  await expect(page.locator('.book-content')).toContainText(paragraph);
  await page.keyboard.press('ArrowLeft');
  const progress = page.getByTitle('Click to copy Progress', { exact: true });
  await expect(progress).toHaveText(/^\s*[1-9]\d*\s*\//);
  const [position, total] = (await progress.innerText()).match(/\d+/g)!.map(Number);
  await page.getByRole('button', { name: 'Show reader controls', exact: true }).click();
  await page.getByTitle('Create Bookmark', { exact: true }).click();
  await expect(page.getByTitle('Create Bookmark', { exact: true })).toBeHidden();

  await page.goto('/manage');
  const progressBar = readCard.locator('div[style*="width"]');
  await expect
    .poll(async () => progressBar.evaluate((bar: HTMLElement) => parseFloat(bar.style.width)))
    .toBeCloseTo((position / total) * 100);

  await page.getByTitle('Select Sort Options').click();
  const titleSort = page.getByText('Title', { exact: true }).locator('..').getByRole('button');
  await titleSort.last().click();
  await expect(page.getByText('Title', { exact: true })).toBeHidden();
  await page.reload();
  await expect(cards).toHaveText([...titles].reverse());
  await expect
    .poll(async () => progressBar.evaluate((bar: HTMLElement) => parseFloat(bar.style.width)))
    .toBeCloseTo((position / total) * 100);

  await page.getByTitle('Enable Book Selection').getByRole('button').click();
  await readCard.click();
  const selectedCard = page.getByRole('banner').filter({ has: readCard });
  await expect(selectedCard.getByTitle('Book selected', { exact: true })).toBeVisible();
});
