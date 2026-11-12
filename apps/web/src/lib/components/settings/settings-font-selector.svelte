<script lang="ts">
  import { faFont } from '@fortawesome/free-solid-svg-icons';
  import Popover from '#lib/components/popover/popover.svelte';
  import type { LocalFont } from '#lib/data/fonts';
  import Fa from 'svelte-fa';

  interface Props {
    availableFonts: LocalFont[];
    fontValue: string;
  }

  let { availableFonts, fontValue = $bindable() }: Props = $props();

  let element = $state<Popover>();
</script>

<Popover bind:this={element} placement="bottom">
  <button
    slot="icon"
    type="button"
    class="mx-2"
    title="Show font choices"
    aria-label="Show font choices"
  >
    <Fa icon={faFont} />
  </button>
  <div slot="content" class="max-h-[min(26rem,60vh)] overflow-y-auto">
    {#each availableFonts as font (font)}
      <button
        type="button"
        aria-pressed={fontValue === font}
        class="block w-full px-4 py-2 text-left hover:bg-gray-900"
        onclick={() => {
          fontValue = font;
          element?.toggleOpen();
        }}
      >
        <span>{font}</span>
        <span
          lang="ar"
          dir="rtl"
          aria-hidden="true"
          class="block text-right text-xl font-normal"
          style:font-family={font}>القِرَاءَةُ بِاللُّغَةِ العَرَبِيَّةِ</span
        >
      </button>
    {/each}
  </div>
</Popover>
