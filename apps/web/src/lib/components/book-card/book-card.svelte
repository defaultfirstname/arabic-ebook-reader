<script lang="ts">
  import { faImage } from '@fortawesome/free-regular-svg-icons';
  import Fa from 'svelte-fa';

  interface Props {
    imagePath: string | Blob;
    title: string;
    progress: number;
    format?: 'pdf';
    isPlaceholder: boolean;
    onclick: () => void;
  }

  let { imagePath, title, progress, format, isPlaceholder, onclick }: Props = $props();

  let objectUrl = $state('');
  let failedSource = $state('');
  let source = $derived(typeof imagePath === 'string' ? imagePath : objectUrl);

  $effect(() => {
    failedSource = '';
    if (typeof imagePath === 'string') {
      objectUrl = '';
      return;
    }

    const blob = imagePath.type ? imagePath : new Blob([imagePath], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    objectUrl = url;
    return () => URL.revokeObjectURL(url);
  });
</script>

<div
  tabindex="0"
  role="button"
  aria-label={format === 'pdf' ? `${title} PDF` : undefined}
  class="aspect-w-2 aspect-h-3 relative bg-app-surface focus-visible:-outline-offset-2"
  {onclick}
  onkeyup={(event) => {
    if (event.key === 'Enter' || event.key === ' ') onclick();
  }}
>
  <div class="inline">
    <div class="h-full w-full text-5xl sm:text-7xl" class:opacity-60={isPlaceholder}>
      {#if source && source !== failedSource}
        <img
          decoding="async"
          loading="lazy"
          referrerpolicy="no-referrer"
          class="book-cover relative h-full w-full object-cover"
          src={source}
          alt=""
          onerror={(event) => (failedSource = event.currentTarget.getAttribute('src') ?? '')}
        />
      {:else}
        <Fa class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" icon={faImage} />
      {/if}
    </div>

    <div class="absolute inset-x-0 bottom-0">
      <div
        class="sm:h-21 flex h-16 items-start gap-1 bg-app-surface px-1.5 py-0.5 text-sm text-app-text sm:p-1.5 sm:text-base"
      >
        <span class="line-clamp-3 min-w-0 flex-1 text-start" dir="auto">{title}</span>
        {#if format === 'pdf'}
          <span class="shrink-0 rounded bg-app-selected px-1 text-xs text-app-selected-text"
            >PDF</span
          >
        {/if}
      </div>
      <div class="h-2.5 bg-app-divider">
        <div class="h-full rounded bg-app-accent" style:width="{progress * 100}%"></div>
      </div>
    </div>
  </div>
</div>
