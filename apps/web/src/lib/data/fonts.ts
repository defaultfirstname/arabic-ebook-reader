/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export enum LocalFont {
  NOTONASKHARABIC = 'Noto Naskh Arabic',
  AMIRI = 'Amiri',
  SCHEHERAZADENEW = 'Scheherazade New',
  NOTOSANSARABIC = 'Noto Sans Arabic',
  CAIRO = 'Cairo',
  READEXPRO = 'Readex Pro',
  IBMPLEXSANSARABIC = 'IBM Plex Sans Arabic',
  SERIF = 'Serif',
  SANSSERIF = 'Sans-Serif'
}

export const arabicReaderFonts = [
  LocalFont.NOTONASKHARABIC,
  LocalFont.AMIRI,
  LocalFont.SCHEHERAZADENEW,
  LocalFont.NOTOSANSARABIC,
  LocalFont.CAIRO,
  LocalFont.READEXPRO,
  LocalFont.IBMPLEXSANSARABIC
];

export interface UserFont {
  name: string;
  path: string;
  fileName: string;
}

export const userFontsCacheName = 'ttu-userfonts';

export const reservedFontNames = new Set<string>(Object.values(LocalFont));

export function getReaderFontStack(fontName: string, generic: 'serif' | 'sans-serif') {
  const preferred = fontName.trim();
  const fallback = `"${LocalFont.NOTONASKHARABIC}", ${generic}`;
  return preferred && preferred !== LocalFont.NOTONASKHARABIC
    ? `${preferred}, ${fallback}`
    : fallback;
}

export function isStoredFont(fontName: string, userFonts: UserFont[]) {
  return (
    reservedFontNames.has(fontName) || !!userFonts.find((userFont) => userFont.name === fontName)
  );
}
