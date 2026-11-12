# Svelte migration goals

Upgrade the Arabic Ebook Reader in small pull requests. Each step should leave a working reader and a clear point to roll back to.

## Versions

Targets checked on November 11, 2026. Recheck patch versions and package compatibility when starting each upgrade.

| Technology         | Current                                  | Target                                                 | What it does                                                                                                                                              |
| ------------------ | ---------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte             | 4.2.20 in the app, 5.0.5 in root tooling | 5.57.3 across the workspace                            | Renders components and updates the interface when state changes. [Release](https://github.com/sveltejs/svelte/releases/tag/svelte@5.57.3)                 |
| SvelteKit          | 2.70.3                                   | Latest 2.x patch during the Svelte upgrade, then 3.2.0 | Handles routes, static site generation, and service worker integration. [Release](https://github.com/sveltejs/kit/releases/tag/%40sveltejs%2Fkit%403.2.0) |
| Vite               | 5.4.21                                   | 8.3.8 with SvelteKit 3                                 | Runs the local development server and builds the production site. [Release](https://github.com/vitejs/vite/releases/tag/v8.3.8)                           |
| Svelte Vite plugin | 3.1.2                                    | Compatible 7.x release with Vite 8                     | Connects the Svelte compiler to Vite. [Kit 3 requirements](https://svelte.dev/docs/kit/migrating-to-sveltekit-3#Updated-dependencies)                     |
| Node.js            | 20.11 in Docker, 24.22.0 in CI           | Node 24 for Docker and CI                              | Runs the build tools. [Kit 3 requirements](https://svelte.dev/docs/kit/migrating-to-sveltekit-3#Updated-dependencies)                                     |
| TypeScript         | 6.0.3                                    | 6.x                                                    | Checks types. The current major meets Kit 3's minimum. [Kit 3 requirements](https://svelte.dev/docs/kit/migrating-to-sveltekit-3#Updated-dependencies)    |

## Milestones

- [x] **1. Record a baseline (½–1 day).** Run both web type checks in CI and verify Arabic TXT import, page turns, bookmark resume, and saved settings in a Chromium smoke test.
- [x] **2. Upgrade Svelte (½–1 day).** Align the app and tooling on Svelte 5, verify the metadata, icon, and gesture packages, and remove the temporary `Snippet` declaration. Existing components can use Svelte 4 syntax during this step. [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [x] **3. Migrate Settings (½–1 day).** Convert the shared settings components and their callers in small groups. Verify dropdowns, switches, custom themes, and persistence.
- [x] **4. Upgrade SvelteKit and Vite (1–2 days).** Update Docker's Node version, move Kit configuration into Vite, migrate `$app/stores` and the service worker, and verify the static build on an upgrade from the existing app. [Kit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3)
- [ ] **5. Migrate the remaining app (1½–3 days).** Convert the library and statistics first, then paginated and continuous reading separately. Remove migration-only compatibility code once its callers are converted.
  - [x] Library and statistics
  - [x] Paginated reader
  - [x] Continuous reader
  - [ ] Shared reader route and controls
  - [ ] Remaining legacy routes and components

Allow **4–8 focused working days** for the full migration, including verification. The first Svelte 5 build should take **1–2 days** including the baseline. The biggest unknowns are library compatibility, service worker updates for existing installs, and bookmark resume across both reading modes.

## What counts as done

- [ ] A clean install, lint, both type checks, and the production build pass.
- [ ] Arabic EPUB, TXT, and HTMLZ import and open in both modes. Verify RTL page turns, chapter navigation where available, progress, and bookmark resume.
- [ ] A current browser profile retains its books and settings after upgrading. An older ZIP backup restores books, bookmarks, and statistics into a fresh profile.
- [ ] Direct book links and offline reopening work after the static deployment updates. Verify phone navigation and Yomitan lookups in a browser with the extension installed.

Run the build and type checks for each pull request. Run the browser smoke test and verify the flows affected by that step before merging.

## Run the baseline smoke test locally

From the repository root, install the workspace dependencies and Playwright's headless Chromium once:

```sh
pnpm install
pnpm --filter web exec playwright install --only-shell chromium
```

Build the current checkout, then run the test. Playwright starts and stops its own production preview.

```sh
pnpm build
pnpm --filter web test:smoke
```
