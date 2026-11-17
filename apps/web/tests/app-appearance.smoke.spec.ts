/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { createEpub, epubTitle, firstChapter } from './fixtures/arabic-book-formats';

test('defaults to dark and preserves independent reading themes across offline reopening', async ({
  page,
  context
}) => {
  await page.goto('/settings');
  const appAppearance = page.getByRole('combobox', { name: 'App appearance', exact: true });
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  const root = page.locator('html');
  const body = page.locator('body');
  await expect(appAppearance).toHaveValue('dark');
  await expect(theme).toHaveValue('');
  await expect(root).toHaveCSS('color-scheme', 'dark');

  await page.goto('/manage');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Files', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: `${epubTitle}.epub`,
    mimeType: 'application/epub+zip',
    buffer: await createEpub(epubTitle, 'h1 { color: #000; }')
  });
  await page.getByRole('button', { name: epubTitle, exact: true }).click();
  const heading = page.locator('.book-content').getByText(firstChapter, { exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('color', 'rgb(237, 242, 248)');
  await expect(body).toHaveCSS('background-color', 'rgb(32, 42, 54)');
  const bookUrl = page.url();

  await page.goto('/settings');
  await theme.selectOption('ecru-theme');
  await page.goto(bookUrl);
  await expect(body).toHaveCSS('background-color', 'rgb(247, 246, 235)');
  await expect(heading).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(root).toHaveCSS('color-scheme', 'dark');

  await page.evaluate(() => {
    const custom = {
      fontColor: 'rgb(239, 229, 219)',
      backgroundColor: 'rgb(30, 25, 20)',
      selectionFontColor: 'white',
      selectionBackgroundColor: 'navy',
      tooltipTextFontColor: 'white'
    };
    localStorage.setItem('customThemes', JSON.stringify({ 'Saved theme': custom }));
    localStorage.setItem('theme', 'Saved theme');
  });
  await page.goto('/settings');
  await expect(theme).toHaveValue('Saved theme');
  await appAppearance.selectOption('light');
  await page.goto(bookUrl);
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(body).toHaveCSS('background-color', 'rgb(30, 25, 20)');

  await page.goto('/settings');
  await theme.selectOption({ label: 'Follow app' });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);
  await page.goto(bookUrl);
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(heading).toBeVisible();
  await page.reload();
  await expect(heading).toBeVisible();
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

function luminance(color: string) {
  const channels = color.match(/\d+/g)!.slice(0, 3).map(Number);
  const [red, green, blue] = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const appearance of ['dark', 'light']) {
  test(`uses readable ${appearance} form, dialog, focus, and selection colors`, async ({
    page
  }) => {
    await page.goto('/settings');
    const select = page.getByRole('combobox', { name: 'App appearance', exact: true });
    await select.selectOption(appearance);
    await expect(page.locator('html')).toHaveCSS('color-scheme', appearance);
    await select.focus();
    await expect(select).toHaveCSS('outline-style', 'solid');
    const form = await select.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        text: style.color,
        border: style.borderColor,
        focus: style.outlineColor,
        surrounding: getComputedStyle(document.body).backgroundColor
      };
    });
    expect(contrast(form.text, form.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(form.border, form.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(form.focus, form.surrounding)).toBeGreaterThanOrEqual(3);

    await page.getByRole('button', { name: 'New custom theme', exact: true }).click();
    const dialog = page.locator('section').filter({ has: page.getByPlaceholder('Theme Name') });
    const colors = await dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      const selection = getComputedStyle(element, '::selection');
      return [style.color, style.backgroundColor, selection.color, selection.backgroundColor];
    });
    expect(contrast(colors[0], colors[1])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors[2], colors[3])).toBeGreaterThanOrEqual(4.5);
  });
}
