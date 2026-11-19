<script lang="ts">
  import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
  import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
  import { mergeEntries } from '#lib/components/merged-header-icon/merged-entries';
  import type { PdfPageDimensions, PdfReadingPosition } from '#lib/data/storage/pdf-book';
  import { baseIconClasses, buttonClasses, headerSurfaceClasses } from '#lib/css-classes';
  import { formatPageTitle } from '#lib/functions/format-page-title';
  import { clickOutside } from '#lib/functions/use-click-outside';
  import { loadPdf, pdfOpenError, readPdfDimensions } from './pdf-document';
  import { getPdfSpreads, type PdfLayout } from './pdf-spreads';
  import { tick } from 'svelte';
  import Fa from 'svelte-fa';

  interface Props {
    saved?: {
      title: string;
      file: Blob | ArrayBuffer;
      pages: PdfPageDimensions[];
    } & PdfReadingPosition;
    libraryHref?: string;
    onPositionChange?: (position: PdfReadingPosition) => Promise<void>;
  }

  let { saved, libraryHref, onPositionChange }: Props = $props();
  let layout: PdfLayout = $state('cover');
  let dimensions: PdfPageDimensions[] = $state.raw([]);
  let document: PDFDocumentProxy | undefined = $state.raw();
  let visiblePages: PDFPageProxy[] = $state.raw([]);
  let pageNumber = $state(1);
  let filename = $state('');
  let loading = $state(false);
  let error = $state('');
  let renderError = $state(false);
  let saveError = $state(false);
  let width = $state(0);
  let height = $state(0);
  const zoomLevels = [1, 1.25, 1.5, 2, 2.5, 3, 4];
  let zoomIndex = $state(0);
  let viewportElement: HTMLDivElement | undefined = $state();
  let spreadElement: HTMLDivElement | undefined = $state();
  let layoutMenu: HTMLDetailsElement | undefined = $state();
  const layoutOptions: { value: PdfLayout; label: string }[] = [
    { value: 'single', label: 'Single page' },
    { value: 'cover', label: 'Cover alone, then spreads' },
    { value: 'paired', label: 'Spread starts at page 1' }
  ];
  let loadId = 0;
  let loadController: AbortController | undefined;

  const widePages = $derived(dimensions.map(({ width, height }) => width > height));
  const spreads = $derived(getPdfSpreads(widePages, layout));
  const spreadIndex = $derived(spreads.findIndex((spread) => spread.includes(pageNumber)));
  const viewports = $derived(visiblePages.map((page) => dimensions[page.pageNumber - 1]));
  const spreadWidth = $derived(viewports.reduce((total, viewport) => total + viewport.width, 0));
  const spreadHeight = $derived(Math.max(...viewports.map((viewport) => viewport.height)));
  const fitScale = $derived(spreadWidth ? Math.min(width / spreadWidth, height / spreadHeight) : 0);
  const zoom = $derived(zoomLevels[zoomIndex]);
  const scale = $derived(fitScale * zoom);

  async function openPdf(
    file: Blob | ArrayBuffer,
    title: string,
    initial?: { pages: PdfPageDimensions[] } & PdfReadingPosition
  ) {
    const id = ++loadId;
    loadController?.abort();
    const { signal } = (loadController = new AbortController());
    document = undefined;
    dimensions = [];
    pageNumber = initial?.page ?? 1;
    zoomIndex = 0;
    if (initial) layout = initial.layout;
    filename = title;
    error = '';
    renderError = false;
    loading = true;

    try {
      const opened = await loadPdf(file, signal);
      const pages = initial?.pages ?? (await readPdfDimensions(opened.document, signal));
      if (id !== loadId) return;
      dimensions = pages;
      document = opened.document;
    } catch (cause) {
      if (id !== loadId) return;
      error = pdfOpenError(cause);
      loadController?.abort();
    } finally {
      if (id === loadId) loading = false;
    }
  }

  $effect(() => {
    if (saved) void openPdf(saved.file, saved.title, saved);
    return () => {
      loadId += 1;
      loadController?.abort();
    };
  });

  $effect(() => {
    const current = document;
    const spread = spreads[spreadIndex];
    if (!current || !spread) {
      visiblePages = [];
      return;
    }
    let active = true;
    visiblePages = [];
    void Promise.all(spread.map((page) => current.getPage(page))).then(
      (pages) => {
        if (active) visiblePages = pages;
      },
      () => {
        if (active) renderError = true;
      }
    );
    return () => {
      active = false;
    };
  });

  function savePosition() {
    void onPositionChange?.({ page: pageNumber, layout }).catch(() => (saveError = true));
  }

  async function setZoom(index: number) {
    const viewport = viewportElement;
    const spread = spreadElement;
    if (!viewport || !spread || index === zoomIndex) return;

    const bounds = viewport.getBoundingClientRect();
    const before = spread.getBoundingClientRect();
    const anchorX = (bounds.left + viewport.clientWidth / 2 - before.left) / before.width;
    const anchorY = (bounds.top + viewport.clientHeight / 2 - before.top) / before.height;

    renderError = false;
    zoomIndex = index;
    await tick();
    if (viewportElement !== viewport || spreadElement !== spread || zoomIndex !== index) return;
    const after = spread.getBoundingClientRect();
    viewport.scrollBy(
      after.left + after.width * anchorX - bounds.left - viewport.clientWidth / 2,
      after.top + after.height * anchorY - bounds.top - viewport.clientHeight / 2
    );
  }

  function drawPage(
    canvas: HTMLCanvasElement,
    { page, displayScale }: { page: PDFPageProxy; displayScale: number }
  ) {
    const viewport = page.getViewport({ scale: displayScale });
    const density = Math.min(
      window.devicePixelRatio || 1,
      8192 / Math.max(viewport.width, viewport.height),
      Math.sqrt(16_000_000 / (viewport.width * viewport.height))
    );
    canvas.width = Math.max(1, Math.round(viewport.width * density));
    canvas.height = Math.max(1, Math.round(viewport.height * density));
    const render: RenderTask = page.render({
      canvas,
      viewport,
      transform: [canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0]
    });
    let active = true;
    void render.promise.then(
      () => {
        if (active) canvas.dataset.ready = 'true';
      },
      () => {
        if (active) renderError = true;
      }
    );
    return {
      destroy() {
        active = false;
        render.cancel();
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }

  function turn(offset: -1 | 1) {
    const next = spreads[spreadIndex + offset];
    if (spreadIndex < 0 || !next) return;
    renderError = false;
    pageNumber = next[0];
    viewportElement?.scrollTo({ top: 0 });
    savePosition();
  }

  function closeLayoutMenu(returnFocus = false) {
    if (!layoutMenu?.open) return;
    layoutMenu.open = false;
    if (returnFocus) layoutMenu.querySelector('summary')?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented && layoutMenu?.open) {
      closeLayoutMenu(true);
      return;
    }
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.defaultPrevented ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLInputElement ||
      (layoutMenu?.open && layoutMenu.contains(event.target as Node)) ||
      spreadIndex < 0
    )
      return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      turn(event.key === 'ArrowLeft' ? 1 : -1);
    }
  }

  function wheelNavigation(node: HTMLElement) {
    let lastTurn = -Infinity;
    const onWheel = (event: WheelEvent) => {
      if (
        zoom !== 1 ||
        layoutMenu?.open ||
        spreadIndex < 0 ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? -event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastTurn < 150) return;
      lastTurn = now;
      turn(delta > 0 ? 1 : -1);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return { destroy: () => node.removeEventListener('wheel', onWheel) };
  }

  let touchStart: { x: number; y: number } | undefined;

  function onPointerDown(event: PointerEvent) {
    if (zoom !== 1 || event.pointerType !== 'touch' || !event.isPrimary) return;
    touchStart = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    if (!touchStart || event.pointerType !== 'touch' || !event.isPrimary) return;
    const x = event.clientX - touchStart.x;
    const y = event.clientY - touchStart.y;
    touchStart = undefined;
    if (Math.abs(x) >= 50 && Math.abs(x) > Math.abs(y)) turn(x > 0 ? 1 : -1);
  }
</script>

<svelte:head>
  <title>{formatPageTitle(saved?.title ?? 'PDF Viewer')}</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<main class="viewer">
  <header class={headerSurfaceClasses}>
    <div class="heading">
      <div class="min-w-0 flex-1">
        <h1 class="font-semibold">PDF Viewer</h1>
        {#if saved || filename}
          <p class="truncate text-sm text-app-muted" title={saved?.title ?? filename}>
            {saved?.title ?? filename}
          </p>
        {/if}
      </div>
      {#if libraryHref}
        <a
          class={baseIconClasses}
          href={libraryHref}
          aria-label={mergeEntries.MANAGE.title}
          title={mergeEntries.MANAGE.title}
        >
          <Fa icon={mergeEntries.MANAGE.icon} />
        </a>
      {:else}
        <label class="open {buttonClasses}">
          Open PDF
          <input
            type="file"
            accept=".pdf,application/pdf"
            onchange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void openPdf(file, file.name);
            }}
          />
        </label>
      {/if}
      {#if dimensions.length}
        <details class="relative" bind:this={layoutMenu} use:clickOutside={() => closeLayoutMenu()}>
          <summary
            class="{baseIconClasses} list-none [&::-webkit-details-marker]:hidden"
            aria-label="PDF options"
            title="PDF options"
          >
            <Fa icon={faEllipsisVertical} />
          </summary>
          <div
            class="absolute right-0 top-full z-20 w-max max-w-[calc(100vw-2rem)] rounded border border-app-divider bg-app-surface p-3 shadow-lg"
          >
            <fieldset class="flex flex-col gap-1 text-sm">
              <legend class="mb-2 font-medium">Page layout</legend>
              {#each layoutOptions as option (option.value)}
                <label
                  class="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-app-hover"
                >
                  <input
                    type="radio"
                    name="pdf-page-layout"
                    value={option.value}
                    checked={layout === option.value}
                    onchange={() => {
                      layout = option.value;
                      renderError = false;
                      savePosition();
                      closeLayoutMenu(true);
                    }}
                  />
                  {option.label}
                </label>
              {/each}
            </fieldset>
          </div>
        </details>
      {/if}
    </div>
    {#if dimensions.length}
      <div class="controls">
        <div class="zoom-controls" role="group" aria-label="PDF zoom">
          <button
            class={buttonClasses}
            aria-label="Zoom out"
            disabled={zoomIndex === 0}
            onclick={() => setZoom(zoomIndex - 1)}>−</button
          >
          <button
            class={buttonClasses}
            aria-label="Fit to window"
            disabled={zoomIndex === 0}
            onclick={() => setZoom(0)}
          >
            {zoomIndex === 0 ? 'Fit' : `${Math.round(zoom * 100)}% of fit`}
          </button>
          <button
            class={buttonClasses}
            aria-label="Zoom in"
            disabled={zoomIndex === zoomLevels.length - 1}
            onclick={() => setZoom(zoomIndex + 1)}>+</button
          >
        </div>
        <output dir="ltr" aria-label="Page progress" aria-live="polite">
          {spreads[spreadIndex]?.join('–')} / {dimensions.length}
        </output>
      </div>
    {/if}
    {#if saveError}
      <p class="text-app-danger" role="alert">Could not save your reading position.</p>
    {/if}
  </header>

  <section
    aria-label="PDF pages"
    class="stage"
    class:zoomed={zoom > 1}
    bind:clientWidth={width}
    bind:clientHeight={height}
    use:wheelNavigation
    onpointerdown={onPointerDown}
    onpointerup={onPointerUp}
    onpointercancel={() => (touchStart = undefined)}
  >
    {#if loading}
      <p role="status">Opening {filename}…</p>
    {:else if error}
      <p class="text-app-danger" role="alert">{error}</p>
    {:else if !dimensions.length && !saved}
      <p>Choose a PDF from your device to preview its pages.</p>
    {:else if scale > 0}
      <div class="viewport" bind:this={viewportElement}>
        <div class="surface">
          <div class="spread" dir="rtl" bind:this={spreadElement}>
            {#each visiblePages as page, index (page.pageNumber)}
              {#key scale}
                <canvas
                  aria-label={`Page ${page.pageNumber}`}
                  style:width={`${viewports[index].width * scale}px`}
                  style:height={`${viewports[index].height * scale}px`}
                  use:drawPage={{ page, displayScale: scale }}
                ></canvas>
              {/key}
            {/each}
          </div>
        </div>
      </div>
    {/if}
    {#if renderError}
      <p class="render-error rounded bg-app-surface p-2 text-app-danger" role="alert">
        Could not render this page.
      </p>
    {/if}
  </section>
</main>

<style>
  .viewer {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto minmax(18rem, 1fr);
    height: 100dvh;
  }

  header {
    display: grid;
    gap: 0.75rem;
    padding: 0.5rem clamp(0.75rem, 4vw, 3rem);
  }

  .heading,
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  .zoom-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .open {
    position: relative;
  }

  .open input {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .open:focus-within {
    outline: 2px solid var(--focus-color);
    outline-offset: 2px;
  }

  output {
    min-width: 4.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .stage {
    display: grid;
    position: relative;
    place-items: center;
    margin: clamp(0.35rem, 2vw, 1rem);
    touch-action: pan-y pinch-zoom;
    min-width: 0;
  }

  .stage.zoomed {
    touch-action: pan-x pan-y pinch-zoom;
  }

  .viewport {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: inherit;
  }

  .zoomed .viewport {
    overflow: auto;
  }

  .surface {
    display: flex;
    width: max-content;
    min-width: 100%;
    min-height: 100%;
  }

  .spread {
    display: flex;
    align-items: flex-start;
    box-shadow: 0 0.5rem 2rem var(--page-shadow);
    margin: auto;
  }

  canvas {
    display: block;
    flex: none;
    background: white;
  }

  .render-error {
    position: absolute;
    bottom: 0.5rem;
  }
</style>
