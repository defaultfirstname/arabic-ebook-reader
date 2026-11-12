/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { Buffer } from 'node:buffer';

const title = 'Arabic EPUB Smoke Test';
const htmlzTitle = 'Arabic HTMLZ Smoke Test';
const firstChapter = 'الفصل الأول';
const secondChapter = 'الفصل الثاني';

function chapter(heading: string) {
  const paragraphs = '<p>هٰذَا نَصٌّ عَرَبِيٌّ لِلتَّجْرِبَةِ.</p>'.repeat(60);
  return `<html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl">
    <body><h1>${heading}</h1>${paragraphs}</body>
  </html>`;
}

async function createEpub() {
  return zipBook({
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
      <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
    </container>`,
    'content.opf': `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="book">arabic-epub-smoke</dc:identifier>
        <dc:title>${title}</dc:title><dc:language>ar</dc:language>
      </metadata>
      <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="one" href="one.xhtml" media-type="application/xhtml+xml"/>
        <item id="two" href="two.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine page-progression-direction="rtl"><itemref idref="one"/><itemref idref="two"/></spine>
    </package>`,
    'nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
      <body><nav epub:type="toc" id="toc"><ol>
        <li><a href="one.xhtml">${firstChapter}</a></li>
        <li><a href="two.xhtml">${secondChapter}</a></li>
      </ol></nav></body>
    </html>`,
    'one.xhtml': chapter(firstChapter),
    'two.xhtml': chapter(secondChapter)
  });
}

async function zipBook(entries: Record<string, string>) {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false, level: 0 });
  for (const [name, content] of Object.entries(entries)) {
    await zip.add(name, new TextReader(content));
  }
  return Buffer.from(await zip.close());
}

const books = [
  {
    format: 'epub',
    title,
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
      await page.getByRole('button', { name: book.title, exact: true }).click();
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
