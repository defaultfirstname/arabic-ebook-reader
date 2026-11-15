/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { Buffer } from 'node:buffer';

export const epubTitle = 'Arabic EPUB Smoke Test';
export const firstChapter = 'الفصل الأول';
export const secondChapter = 'الفصل الثاني';
const cover = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR4sAAAAASUVORK5CYII=',
  'base64'
);

export function chapter(heading: string) {
  const paragraphs = '<p>هٰذَا نَصٌّ عَرَبِيٌّ لِلتَّجْرِبَةِ.</p>'.repeat(60);
  return `<html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl">
    <body><h1>${heading}</h1>${paragraphs}</body>
  </html>`;
}

export async function createEpub(title = epubTitle) {
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
        <item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>
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
    'two.xhtml': chapter(secondChapter),
    'cover.png': new Uint8Array(cover)
  });
}

export async function zipBook(entries: Record<string, string | Uint8Array>) {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false, level: 0 });
  for (const [name, content] of Object.entries(entries)) {
    await zip.add(
      name,
      typeof content === 'string' ? new TextReader(content) : new Uint8ArrayReader(content)
    );
  }
  return Buffer.from(await zip.close());
}
