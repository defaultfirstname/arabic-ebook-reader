/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

test.use({ viewport: { width: 390, height: 740 }, hasTouch: true, isMobile: true });

test('imports a book, swipes forward, and bookmarks in Arabic on a phone', async ({
  page,
  context
}) => {
  await page.goto('/manage');
  await page.getByRole('button', { name: 'Import File(s) menu', exact: true }).tap();
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByText('Import File(s)', { exact: true }).tap();
  const paragraph = 'هذا نص عربي للاختبار. ننتقل الآن إلى الصفحة التالية.';
  await (
    await fileChooser
  ).setFiles({
    name: 'Arabic Phone Test.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(`${paragraph}\n\n`.repeat(150))
  });
  await page.getByRole('button', { name: 'Arabic Phone Test', exact: true }).tap();
  await expect(page.locator('.book-content')).toContainText(paragraph);

  const progress = page.getByTitle('Click to copy Progress', { exact: true });
  await expect(progress).toHaveText(/^\s*0\s*\//);
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 80, y: 350 }]
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 180, y: 350 }]
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 300, y: 350 }]
  });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(progress).toHaveText(/^\s*[1-9]\d*\s*\//);

  const controls = page.getByRole('button', { name: 'Show reader controls', exact: true });
  const createBookmark = page.getByTitle('Create Bookmark', { exact: true });
  await controls.tap();
  await createBookmark.tap();
  await expect(createBookmark).toBeHidden();
  await controls.tap();
  await expect(page.getByTitle('Return to Bookmark', { exact: true })).toBeVisible();
});
