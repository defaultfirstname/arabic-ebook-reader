/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test, type Locator } from '@playwright/test';
import { Buffer } from 'node:buffer';

function spreadFixture() {
  const drawing = [
    '0 0 0 rg 115 100 70 90 re f',
    '0 0.5 0 rg 0 120 180 60 re f',
    '0 0.5 0 rg 120 120 180 60 re f',
    '0 0 1 rg 0 120 300 60 re f',
    '0 0 1 rg 0 120 300 60 re f'
  ];
  const ids = drawing.map((_, index) => 3 + index * 2);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${ids.length} /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] >>`
  ];
  for (const [index, content] of drawing.entries()) {
    const wide = index === 3;
    const stream = wide ? 'q 480 0 0 300 0 0 cm /Scan Do Q' : content;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wide ? '480 300' : '300 400'}] /Resources << ${wide ? '/XObject << /Scan 13 0 R >>' : ''} >> /Contents ${ids[index] + 1} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    if (index === drawing.length - 1) {
      objects.push(
        '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 7 >>\nstream\n0000ff>\nendstream'
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

test.describe('touch navigation', () => {
  test.use({ viewport: { width: 390, height: 740 }, hasTouch: true, isMobile: true });

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
