<script lang="ts">
  import Fa from 'svelte-fa';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { mergeEntries } from '#lib/components/merged-header-icon/merged-entries';
  import Popover from '#lib/components/popover/popover.svelte';
  import { baseIconClasses } from '#lib/css-classes';
  import { pagePath } from '#lib/data/env';
  import { dummyFn } from '#lib/functions/utils';

  interface Props {
    onAction?: (value: string) => void;
    leavePageLink?: string;
    items?: (typeof mergeEntries)[keyof typeof mergeEntries][];
    mergeTo?: (typeof mergeEntries)[keyof typeof mergeEntries];
    disableRouteNavigation?: boolean;
  }

  let {
    onAction,
    leavePageLink = '',
    items = [mergeEntries.MANAGE, mergeEntries.SETTINGS, mergeEntries.BUG_REPORT],
    mergeTo = mergeEntries.MANAGE,
    disableRouteNavigation = false
  }: Props = $props();

  let actionItems = $derived(items.filter((item) => item.routeId !== page.route.id));
  let backLink = $derived(
    actionItems.length === 1 && actionItems[0].routeId ? actionItems[0].routeId : leavePageLink
  );

  let menuElm = $state<ReturnType<typeof Popover>>();

  function handleActionMenuItem(target: string) {
    onAction?.(target);

    if (
      !(target === mergeEntries.FILE_IMPORT.label || target === mergeEntries.FOLDER_IMPORT.label)
    ) {
      menuElm?.toggleOpen();
    }

    if (!disableRouteNavigation) {
      const action = actionItems.find((item) => item.label === target);

      if (action?.routeId) {
        goto(`${pagePath}${action.routeId}`);
      }
    }
  }
</script>

{#if backLink}
  <a href={backLink}>
    <div class={baseIconClasses}>
      <Fa icon={mergeTo.icon} />
    </div>
  </a>
{:else}
  <div class="hidden sm:flex">
    {#each actionItems as actionItem (actionItem.label)}
      <div
        tabindex="0"
        role="button"
        title={actionItem.title}
        class={baseIconClasses}
        onclick={() => handleActionMenuItem(actionItem.label)}
        onkeyup={dummyFn}
      >
        <Fa icon={actionItem.icon} />
      </div>
    {/each}
  </div>
  <div class="flex sm:hidden">
    <Popover
      placement="bottom"
      fallbackPlacements={['bottom-end', 'bottom-start']}
      yOffset={0}
      bind:this={menuElm}
    >
      {#snippet icon()}
        <div class={baseIconClasses}>
          <Fa icon={mergeTo.icon} />
        </div>
      {/snippet}
      {#snippet content()}
        <div class="w-40 bg-gray-700 md:w-32">
          {#each actionItems as actionItem (actionItem.label)}
            <div
              tabindex="0"
              role="button"
              class="px-4 py-2 text-sm hover:bg-white hover:text-gray-700"
              title={actionItem.title}
              onclick={() => handleActionMenuItem(actionItem.label)}
              onkeyup={dummyFn}
            >
              {actionItem.label}
            </div>
          {/each}
        </div>
      {/snippet}
    </Popover>
  </div>
{/if}
