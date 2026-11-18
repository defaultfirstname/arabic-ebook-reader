/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';

test('serves the app and third-party license notices linked from Settings', async ({ page }) => {
  await page.goto('/settings');
  const appLicense = page.getByRole('link', { name: 'App license', exact: true });
  const thirdPartyLicenses = page.getByRole('link', { name: 'Third-party licenses', exact: true });
  await expect(appLicense).toHaveAttribute('href', '/LICENSE.txt');
  await expect(thirdPartyLicenses).toHaveAttribute('href', '/third-party-licenses.txt');

  const app = await page.request.get('/LICENSE.txt');
  expect(app.ok()).toBe(true);
  expect(await app.text()).toContain('BSD 3-Clause License');

  const thirdParty = await page.request.get('/third-party-licenses.txt');
  expect(thirdParty.ok()).toBe(true);
  const notices = await thirdParty.text();
  expect(notices).toContain('@fortawesome/free-solid-svg-icons');
  expect(notices).toContain('pdfjs-dist/cmaps/LICENSE');
  expect(notices).toContain('pdfjs-dist/standard_fonts/LICENSE_FOXIT');
  expect(notices).toContain('pdfjs-dist/wasm/LICENSE_QCMS');
});

test('saves and dismisses the custom-theme dialog without a browser error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/settings');
  await expect(page).toHaveTitle('Settings | Iliktruni');

  const name = page.getByPlaceholder('Theme Name');
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  await page.getByRole('button', { name: 'New custom theme', exact: true }).click();
  await name.fill('Smoke Test Theme');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(name).toBeHidden();
  await expect(theme).toHaveValue('Smoke Test Theme');

  await page.getByRole('button', { name: 'Edit theme', exact: true }).click();
  await name.fill('Discarded Theme Name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(name).toBeHidden();
  await expect(theme).toHaveValue('Smoke Test Theme');
  expect(errors).toEqual([]);
});
