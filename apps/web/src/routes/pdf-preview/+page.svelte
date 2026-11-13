<script lang="ts">
  import type { PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from 'pdfjs-dist';
  import { getPdfSpreads, type PdfLayout } from './pdf-spreads';

  let layout: PdfLayout = $state('cover');
  let pages: PDFPageProxy[] = $state.raw([]);
  let widePages: boolean[] = $state.raw([]);
  let pageNumber = $state(1);
  let filename = $state('');
  let loading = $state(false);
  let error = $state('');
  let renderError = $state(false);
  let width = $state(0);
  let height = $state(0);
  let loadId = 0;
  let task: PDFDocumentLoadingTask | undefined;

  const spreads = $derived(getPdfSpreads(widePages, layout));
  const spreadIndex = $derived(spreads.findIndex((spread) => spread.includes(pageNumber)));
  const visiblePages = $derived(spreads[spreadIndex]?.map((page) => pages[page - 1]) ?? []);
  const viewports = $derived(visiblePages.map((page) => page.getViewport({ scale: 1 })));
  const spreadWidth = $derived(viewports.reduce((total, viewport) => total + viewport.width, 0));
  const spreadHeight = $derived(Math.max(...viewports.map((viewport) => viewport.height)));
  const scale = $derived(spreadWidth ? Math.min(width / spreadWidth, height / spreadHeight) : 0);

  async function openPdf(file: File) {
    const id = ++loadId;
    const previous = task;
    task = undefined;
    pages = [];
    widePages = [];
    pageNumber = 1;
    filename = file.name;
    error = '';
    renderError = false;
    loading = true;

    try {
      await previous?.destroy();
      const [pdfjs, { default: workerUrl }, data] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        file.arrayBuffer()
      ]);
      if (id !== loadId) return;

      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const currentTask = pdfjs.getDocument({ data, disableWorkerRendering: true });
      task = currentTask;
      const document = await currentTask.promise;
      const loadedPages: PDFPageProxy[] = [];
      for (let number = 1; number <= document.numPages; number += 1) {
        loadedPages.push(await document.getPage(number));
        if (id !== loadId) return;
      }
      pages = loadedPages;
      widePages = pages.map((page) => {
        const viewport = page.getViewport({ scale: 1 });
        return viewport.width > viewport.height;
      });
    } catch (cause) {
      if (id !== loadId) return;
      error =
        cause instanceof Error && cause.name === 'PasswordException'
          ? 'This PDF needs a password.'
          : 'Could not open this PDF.';
      const failed = task;
      task = undefined;
      await failed?.destroy().catch(() => {});
    } finally {
      if (id === loadId) loading = false;
    }
  }

  $effect(() => {
    return () => {
      loadId += 1;
      void task?.destroy().catch(() => {});
    };
  });

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
        canvas.dataset.ready = 'true';
      },
      () => {
        if (active) renderError = true;
      }
    );
    return {
      destroy() {
        active = false;
        render.cancel();
      }
    };
  }

  function turn(offset: -1 | 1) {
    const next = spreads[spreadIndex + offset];
    if (spreadIndex < 0 || !next) return;
    renderError = false;
    pageNumber = next[0];
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
  <title>PDF spread preview | Arabic Ebook Reader</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<main class="viewer">
  <header>
    <div class="heading">
      <h1>PDF spread preview</h1>
      <label class="open">
        Open PDF
        <input
          type="file"
          accept=".pdf,application/pdf"
          onchange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void openPdf(file);
          }}
        />
      </label>
    </div>
    {#if pages.length}
      <div class="controls">
        <label>
          Page layout
          <select bind:value={layout} onchange={() => (renderError = false)}>
            <option value="single">Single page</option>
            <option value="cover">Cover alone, then spreads</option>
            <option value="paired">Spread starts at page 1</option>
          </select>
        </label>
        <nav aria-label="Page navigation" dir="rtl">
          <button disabled={spreadIndex <= 0} onclick={() => turn(-1)}>Previous</button>
          <output dir="ltr" aria-live="polite">
            {spreads[spreadIndex]?.join('–')} / {pages.length}
          </output>
          <button disabled={spreadIndex >= spreads.length - 1} onclick={() => turn(1)}>Next</button>
        </nav>
      </div>
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
    {:else if !pages.length}
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
      {#if renderError}
        <p class="render-error" role="alert">Could not render this page.</p>
      {/if}
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
