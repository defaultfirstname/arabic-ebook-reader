/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { expect, test } from '@playwright/test';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { Buffer } from 'node:buffer';

const title = 'Arabic EPUB Smoke Test';
const firstChapter = 'الفصل الأول';
const secondChapter = 'الفصل الثاني';

function chapter(heading: string) {
  const paragraphs = '<p>هٰذَا نَصٌّ عَرَبِيٌّ لِلتَّجْرِبَةِ.</p>'.repeat(60);
  return `<html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl">
    <body><h1>${heading}</h1>${paragraphs}</body>
  </html>`;
}

async function createEpub() {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false, level: 0 });
  const entries = {
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
  };
  for (const [name, content] of Object.entries(entries)) {
    await zip.add(name, new TextReader(content));
  }
  return Buffer.from(await zip.close());
}

test('opens the Arabic EPUB chapter menu after the first chapter renders', async ({ page }) => {
  await page.goto('/manage');
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Files', exact: true }).click();
  await (
    await fileChooser
  ).setFiles({
    name: `${title}.epub`,
    mimeType: 'application/epub+zip',
    buffer: await createEpub()
  });
  await page.getByRole('button', { name: title, exact: true }).click();
  const content = page.locator('.book-content');
  await expect(content.getByRole('heading', { name: firstChapter })).toBeVisible();
  await page.getByRole('button', { name: 'Show reader controls', exact: true }).click();
  await page.getByTitle('Open Table of Contents', { exact: true }).click();
  await page.getByTitle(`Go to ${secondChapter}`, { exact: true }).click();
  await expect(content.getByRole('heading', { name: secondChapter })).toBeVisible();
});
