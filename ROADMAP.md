# Arabic Ebook Reader roadmap

First make the existing reader easier to understand, maintain, and extend. Then add Arabic PDF reading with correct right-to-left page turns and facing pages. The [Svelte migration record](GOALS.md) tracks the previous upgrade and its remaining deployment and device checks.

## Phase 1: Refactor and review

Keep SvelteKit for the web app. The portability goal is to make core rules reusable in another TypeScript framework if needed. Put rules such as sorting, progress, and page navigation in plain TypeScript when they can take ordinary data and return a result. These modules can move with their types and tests to another TypeScript app. Svelte handles screens and interactions. Routing, rendering, browser storage, sync, and offline caching stay behind the existing web-facing code where practical.

Review the whole codebase in stages. Change code where it makes a flow easier to follow, test, or extend. Remove confirmed duplication and obsolete code. Keep format-specific behavior explicit when combining it would make the rules harder to follow. File count and line count are secondary to clarity.

| Order | Work                                                                                                                                                                                                                                                                                                                                                                     | How to verify it                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **Book Manager.** Extract sorting and bookmark-to-card progress into plain TypeScript. Keep one comparison for local and external book lists.                                                                                                                                                                                                                            | Check Arabic numeric title ordering, ties, older bookmark values, selection, covers, and reopening.                                                                                                                      |
| 2     | **Reader.** Simplify the shared reader route one flow at a time. Extract position and progress rules where they can be tested independently. Keep DOM measurements, scrolling, and gestures in the reader UI.                                                                                                                                                            | Compare saved character positions and resume behavior in paginated and continuous modes. Check Arabic page turns, chapter navigation, and tracking.                                                                      |
| 3     | **Import and storage.** Trace how a book gets imported, listed, opened, bookmarked, and backed up. Start with smaller list and open APIs and named options where arguments are hard to follow. Identify where a future fixed-page format can enter the flow.                                                                                                             | Import EPUB, TXT, and HTMLZ. Reopen an existing library and restore an older ZIP before changing shared storage code. Verify each affected storage provider if its behavior changes.                                     |
| 4     | **Remaining app.** Review settings, statistics, shared UI, sync, and hosting for confusing dependencies, duplication, and dead code. Keep service worker and hosting details at the web boundary.                                                                                                                                                                        | Verify the affected settings and statistics. Check direct links and offline reopening on a production deployment, and verify the static build on a second host. Record physical-phone results separately from emulation. |
| 5     | **Architecture review.** Add a short contributor guide with entry points and examples for following import → open → bookmark → reopen. Use it for a second review, including with an AI chat if useful. Ask the reviewer to trace each flow, locate the format boundary, and identify fragile assumptions or missing checks. Verify findings against the code and tests. | A reviewer can follow the main flows and identify where to add a format and its tests. Resolve findings that would obstruct PDF work and record the remaining cleanup.                                                   |

Use small, reviewable PRs. Preserve stored settings, book data, character offsets, and the existing ZIP backup format. Run lint, both web type checks, the production build, and the [browser smoke tests](GOALS.md#run-the-smoke-tests-locally) before opening each refactor PR. Add targeted checks where the existing suite misses behavior being moved.

Start PDF development once the main flows are documented, the baseline passes, and the format boundary and any PDF-blocking review findings are resolved. Treat the rest of the cleanup as a follow-up list so the refactor has a clear finish.

Use the [contributor guide](CONTRIBUTING.md) to review the current reader and trace where fixed-page content needs its own storage and rendering paths.

Local Nginx verification covered direct book links, offline resume, and legacy ZIP restore. The phone-emulation check timed out after swiping on Nginx while the same test passed in the Vite preview. Keep the deployed-site check and physical-phone navigation check open.

## Phase 2: Arabic PDF reading

### First release

Import and reopen local PDFs offline. Offer a single-page view and a facing-page view, with fit-to-page or fit-to-spread zoom and page-based resume. Start with a PDF.js prototype after Phase 1. Its display API can render individual PDF pages and read layout preferences when the file includes them. Keep the original file and render visible pages on demand so large scans can be tested on a phone without rendering the entire book. [PDF.js examples](https://mozilla.github.io/pdf.js/examples/) · [PDF.js document API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html) · [PDF.js rendering guidance](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)

### What a correct spread looks like

- **Reading direction and placement.** For a typical Arabic PDF stored in reading order, Next advances through file pages in increasing order. In a spread containing pages 2 and 3, page 2 sits on the right and page 3 on the left. Turning forward in spread view opens the next group. Test the navigation buttons, keyboard, and touch on this same sequence.
- **Which pages belong together.** Some files start with a standalone cover and pair 2–3, 4–5, and so on. Others start with a spread and pair 1–2, 3–4, and so on. Offer a per-book pairing control and retain a lone final page when present. Use PDF direction and layout hints when available and let the reader correct the layout. [PDF Reference](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/pdfreference1.7old.pdf)
- **The center of the spread.** Keep the original page bounds and place the inner edges together with no added gap in spread view. Verify with Arabic text or an illustration crossing the seam. If a scan already contains both printed pages in one wide PDF page, display it whole. Printed margins or content missing from the scan require separate crop or repair work.
- **Position and progress.** Save the PDF page as the reading position and show page-based progress. Reopen at the same page, including when switching between single-page and spread view. Keep EPUB, TXT, and HTMLZ bookmarks based on character positions.

### How to test it

Use a small, shareable fixture with a cover, numbered pages, and a picture that joins across the center. Check both starting pairs, right/left placement, forward and backward turns, and a lone final page. Also test a wide scan, an Arabic PDF with selectable text, and a representative large scanned book. Reopen offline, verify resume after a reload and a view change, and check layout and memory on a phone. Confirm the existing three formats still pass their smoke tests.

### Follow-up features

Arabic text selection, Yomitan, and PDF backup and sync are follow-up work. Text selection depends on a usable PDF text layer. An image-only scan needs OCR for lookup. PDF backup and sync require explicit handling of the original file and page-based position.

Use the numbered test fixture to verify the layout. If a shareable example of the broken spread is available, use it to confirm the expected right and left sides and see whether unusual page sequences need an additional control.

## Planning estimates

- Book Manager is the smallest refactor. Allow roughly 1–2 focused hours with the browser test setup ready.
- Allow roughly 4–8 focused working days for the refactor and review, including compatibility checks. Re-estimate after tracing the reader and storage flows. Device and deployment access can affect elapsed time.
- Allow roughly 1–2 focused days for a PDF prototype with representative files, then several more days for local library integration, offline resume, and verification. Re-estimate after testing spread alignment and large scans on a phone.

## Arabic reading baseline

- [x] Horizontal Arabic reading in paginated and continuous modes, including RTL page turns and Arabic progress counts.
- [x] Seven bundled Arabic fonts with previews in Settings.
- [x] EPUB imports that tolerate missing embedded fonts and still report missing chapter files.
- [x] Arabic theme samples and app icons, with JPDB and Yomichan popup detection removed from the tracker.
- [x] Keep EPUB, TXT, and HTMLZ as reading formats.
- [x] Remove Japanese character and glyph-image counting. Keep Arabic letters, Latin letters, and digits in the counter.
- [x] Use the default Arabic font when the selected font is unavailable, while allowing installed system fonts and uploaded fonts.

### Verification checklist

- [x] Use a fresh Chromium profile with the production build. Import an Arabic EPUB, read in both modes, and check the table of contents, page turns, and progress.
- [x] Test Yomitan lookup on Arabic with and without diacritics in both modes. Check popup interactions and tracker behavior separately.
- [x] Save a bookmark, go offline, reopen the app, and verify the passage, progress, and chosen font. Check whether font or column changes reproduce the slight resume offset seen in continuous mode.
- [x] Export a ZIP backup and restore it into a fresh profile. Confirm books, bookmarks, and statistics come back.
- [ ] After the counting cleanup, check Arabic EPUB, TXT, and HTMLZ in both modes and restore a backup made before the change.
- [x] Resolve the project-wide type-check errors. Both web type-check commands pass.

### Other follow-ups

- [ ] Review optional cloud and filesystem sync independently. Check how existing users can export their data before removing any storage integration.
- [ ] Revisit publisher-colored backgrounds only if requested.
