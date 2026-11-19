<script lang="ts">
  import { page } from '$app/state';
  import { mergeEntries } from '#lib/components/merged-header-icon/merged-entries';
  import PdfViewer from '#lib/components/pdf-viewer/pdf-viewer.svelte';
  import { baseIconClasses, headerSurfaceClasses } from '#lib/css-classes';
  import { pagePath } from '#lib/data/env';
  import { database } from '#lib/data/store';
  import type { PdfBook } from '#lib/data/storage/pdf-book';
  import Fa from 'svelte-fa';

  const libraryHref = `${pagePath}/manage`;
  const id = $derived(Number(page.url.searchParams.get('id')));
  let saved: { book: PdfBook; file: Blob | ArrayBuffer } | undefined = $state.raw();
  let loading = $state(true);
  let error = $state('');

  $effect(() => {
    const bookId = id;
    let active = true;
    loading = true;
    saved = undefined;
    error = '';
    const request =
      Number.isSafeInteger(bookId) && bookId > 0
        ? database.openPdfBook(bookId)
        : Promise.resolve(undefined);
    void request.then(
      (result) => {
        if (!active) return;
        saved = result;
        loading = false;
        if (!result) error = 'This PDF is no longer in your library.';
      },
      () => {
        if (!active) return;
        loading = false;
        error = 'Could not load this PDF from your library.';
      }
    );
    return () => {
      active = false;
    };
  });
</script>

{#if saved}
  {@const { book, file } = saved}
  {#key book.id}
    <PdfViewer
      saved={{ ...book, file }}
      {libraryHref}
      onPositionChange={(position) => database.savePdfPosition(book.id, position)}
    />
  {/key}
{:else}
  <header class="flex items-center justify-between px-4 py-2 {headerSurfaceClasses}">
    <h1 class="font-semibold">PDF Viewer</h1>
    <a
      href={libraryHref}
      class={baseIconClasses}
      aria-label={mergeEntries.MANAGE.title}
      title={mergeEntries.MANAGE.title}
    >
      <Fa icon={mergeEntries.MANAGE.icon} />
    </a>
  </header>
  <main class="p-6">
    {#if loading}
      <p role="status">Opening PDF…</p>
    {:else}
      <p class="text-app-danger" role="alert">{error}</p>
    {/if}
  </main>
{/if}
