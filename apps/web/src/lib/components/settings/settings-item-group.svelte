<script lang="ts">
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';

  interface Props {
    title: string;
    tooltip?: string;
    inputId?: string;
    checked?: boolean | undefined;
    header?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }

  let {
    title,
    tooltip = '',
    inputId = '',
    checked = $bindable(undefined),
    header,
    children
  }: Props = $props();
</script>

<div
  class="min-w-0 border-app-divider"
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
        {#snippet icon()}
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded opacity-70 hover:opacity-100"
            aria-label={`Help for ${title}`}
          >
            <Fa icon={faCircleQuestion} />
          </button>
        {/snippet}
      </Popover>
    {/if}
    {@render header?.()}
    {#if checked !== undefined}
      <label class="ml-auto flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center">
        <input type="checkbox" role="switch" class="peer sr-only" aria-label={title} bind:checked />
        <span
          aria-hidden="true"
          class="h-5 w-9 rounded-full bg-app-muted p-0.5 transition-colors after:block after:h-4 after:w-4 after:rounded-full after:bg-app-surface after:transition-transform peer-checked:bg-app-accent peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-app-focus"
        ></span>
      </label>
    {/if}
  </div>
  {@render children?.()}
</div>
