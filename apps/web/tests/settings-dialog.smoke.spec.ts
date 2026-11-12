/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';

test('saves and dismisses the custom-theme dialog without a browser error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/settings');
  await expect(page).toHaveTitle('Settings | Arabic Ebook Reader');

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
