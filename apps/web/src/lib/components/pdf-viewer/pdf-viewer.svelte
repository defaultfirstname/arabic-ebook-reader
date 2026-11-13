<script lang="ts">
  import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
  import type { PdfPageDimensions, PdfReadingPosition } from '#lib/data/storage/pdf-book';
  import { loadPdf, pdfOpenError, readPdfDimensions } from './pdf-document';
  import { getPdfSpreads, type PdfLayout } from './pdf-spreads';

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
  let loadId = 0;
  let loadController: AbortController | undefined;

  const widePages = $derived(dimensions.map(({ width, height }) => width > height));
  const spreads = $derived(getPdfSpreads(widePages, layout));
  const spreadIndex = $derived(spreads.findIndex((spread) => spread.includes(pageNumber)));
  const viewports = $derived(visiblePages.map((page) => dimensions[page.pageNumber - 1]));
  const spreadWidth = $derived(viewports.reduce((total, viewport) => total + viewport.width, 0));
  const spreadHeight = $derived(Math.max(...viewports.map((viewport) => viewport.height)));
  const scale = $derived(spreadWidth ? Math.min(width / spreadWidth, height / spreadHeight) : 0);

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

  function drawPage(
    canvas: HTMLCanvasElement,
    { page, displayScale }: { page: PDFPageProxy; displayScale: number }
  ) {
    const viewport = page.getViewport({ scale: displayScale });
    const density = Math.min(
      window.devicePixelRatio || 1,
      2,
      4096 / Math.max(viewport.width, viewport.height)
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
    savePosition();
  }

  function onKeydown(event: KeyboardEvent) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.defaultPrevented ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLInputElement ||
      spreadIndex < 0
    )
      return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      turn(event.key === 'ArrowLeft' ? 1 : -1);
    }
  }

  let touchStart: { x: number; y: number } | undefined;

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
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
  <title>{saved?.title ?? 'PDF spread preview'} | Arabic Ebook Reader</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<main class="viewer">
  <header>
    <div class="heading">
      <h1>{saved?.title ?? 'PDF spread preview'}</h1>
      {#if libraryHref}
        <a class="open" href={libraryHref}>Book Manager</a>
      {:else}
        <label class="open">
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
    </div>
    {#if dimensions.length}
      <div class="controls">
        <label>
          Page layout
          <select
            value={layout}
            onchange={(event) => {
              layout = event.currentTarget.value as PdfLayout;
              renderError = false;
              savePosition();
            }}
          >
            <option value="single">Single page</option>
            <option value="cover">Cover alone, then spreads</option>
            <option value="paired">Spread starts at page 1</option>
          </select>
        </label>
        <nav aria-label="Page navigation" dir="rtl">
          <button disabled={spreadIndex <= 0} onclick={() => turn(-1)}>Previous</button>
          <output dir="ltr" aria-live="polite">
            {spreads[spreadIndex]?.join('–')} / {dimensions.length}
          </output>
          <button disabled={spreadIndex >= spreads.length - 1} onclick={() => turn(1)}>Next</button>
        </nav>
      </div>
    {/if}
    {#if saveError}
      <p role="alert">Could not save your reading position.</p>
    {/if}
  </header>

  <section
    aria-label="PDF pages"
    class="stage"
    bind:clientWidth={width}
    bind:clientHeight={height}
    onpointerdown={onPointerDown}
    onpointerup={onPointerUp}
    onpointercancel={() => (touchStart = undefined)}
  >
    {#if loading}
      <p role="status">Opening {filename}…</p>
    {:else if error}
      <p role="alert">{error}</p>
    {:else if !dimensions.length && !saved}
      <p>Choose a PDF from your device to preview its pages.</p>
    {:else if scale > 0}
      <div class="spread" dir="rtl">
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
    {/if}
    {#if renderError}
      <p class="render-error" role="alert">Could not render this page.</p>
    {/if}
  </section>
</main>

<style>
  .viewer {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto minmax(18rem, 1fr);
    height: 100dvh;
    background: #15252b;
    color: #ecf4f1;
    font-family: 'Instrument Sans', system-ui, sans-serif;
  }

  header {
    display: grid;
    gap: 0.75rem;
    padding: 0.85rem clamp(0.75rem, 4vw, 3rem);
    background: #21373c;
    border-bottom: 1px solid #45605f;
  }

  .heading,
  .controls,
  nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  h1 {
    font-size: clamp(1.15rem, 3vw, 1.55rem);
    font-weight: 650;
  }

  .open,
  select,
  button {
    padding: 0.5rem 0.75rem;
    border: 1px solid #64827e;
    border-radius: 0.35rem;
    background: #172b30;
    color: inherit;
  }

  .open {
    position: relative;
    cursor: pointer;
    background: #e1ebd7;
    color: #203530;
    font-weight: 650;
  }

  .open input {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .open:focus-within {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  button:disabled {
    opacity: 0.45;
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
  }

  .spread {
    display: flex;
    align-items: flex-start;
    box-shadow: 0 0.5rem 2rem #081318;
  }

  canvas {
    display: block;
    flex: none;
    background: white;
  }

  .render-error {
    position: absolute;
    bottom: 0.5rem;
    padding: 0.5rem;
    background: #622d2d;
  }
</style>
