<script lang="ts">
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';

  export let title: string;
  export let tooltip = '';
  export let inputId = '';
  export let checked: boolean | undefined = undefined;
</script>

<div
  class="min-w-0 border-gray-500/25"
  class:border-b={checked !== undefined}
  class:pb-2={checked === undefined}
>
  <div class="flex min-h-8 items-center gap-1 text-sm font-medium">
    {#if inputId}
      <label for={inputId}>{title}</label>
    {:else}
      <span>{title}</span>
    {/if}
    {#if tooltip}
      <Popover contentText={tooltip} contentStyles="padding: 0.5rem;">
        <button
          slot="icon"
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded opacity-70 hover:opacity-100"
          aria-label={`Help for ${title}`}
        >
          <Fa icon={faCircleQuestion} />
        </button>
      </Popover>
    {/if}
    <slot name="header" />
    {#if checked !== undefined}
      <label class="ml-auto flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center">
        <input type="checkbox" role="switch" class="peer sr-only" aria-label={title} bind:checked />
        <span
          aria-hidden="true"
          class="h-5 w-9 rounded-full bg-gray-500 p-0.5 transition-colors after:block after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-green-700 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2"
        ></span>
      </label>
    {/if}
  </div>
  <slot />
</div>
