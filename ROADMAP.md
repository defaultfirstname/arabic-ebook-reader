# Arabic Ebook Reader checklist

## Implemented

- [x] Horizontal Arabic reading in paginated and continuous modes, including RTL page turns and Arabic progress counts.
- [x] Seven bundled Arabic fonts with previews in Settings.
- [x] EPUB imports that tolerate missing embedded fonts and still report missing chapter files.
- [x] Arabic theme samples and app icons, with JPDB and Yomichan popup detection removed from the tracker.
- [x] Keep EPUB, TXT, and HTMLZ as reading formats.
- [x] Remove Japanese character and glyph-image counting. Keep Arabic letters, Latin letters, and digits in the counter.
- [x] Use the default Arabic font when the selected font is unavailable, while allowing installed system fonts and uploaded fonts.

## Verify next

- [x] Use a fresh Chromium profile with the production build. Import an Arabic EPUB, read in both modes, and check the table of contents, page turns, and progress.
- [x] Test Yomitan lookup on Arabic with and without diacritics in both modes. Check popup interactions and tracker behavior separately.
- [x] Save a bookmark, go offline, reopen the app, and verify the passage, progress, and chosen font. Check whether font or column changes reproduce the slight resume offset seen in continuous mode.
- [x] Export a ZIP backup and restore it into a fresh profile. Confirm books, bookmarks, and statistics come back.
- [ ] After the counting cleanup, check Arabic EPUB, TXT, and HTMLZ in both modes and restore a backup made before the change.
- [x] Resolve the project-wide type-check errors. Both web type-check commands pass.

## Simplify after verification

- [ ] Review optional cloud and filesystem sync independently. Check how existing users can export their data before removing any storage integration.
- [ ] Revisit publisher-colored backgrounds only if requested.
