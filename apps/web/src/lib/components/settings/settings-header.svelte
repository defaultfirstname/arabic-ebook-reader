<script lang="ts">
  import { faBookOpenReader, faClock, faDatabase } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { baseHeaderClasses, pxScreen } from '$lib/css-classes';

  interface Props {
    leavePageLink: string;
    activeSettings: string;
  }

  let { leavePageLink, activeSettings = $bindable() }: Props = $props();

  const settingItems = [
    {
      label: 'Reader',
      icon: faBookOpenReader
    },
    {
      label: 'Data',
      icon: faDatabase
    },
    {
      label: 'Statistics',
      icon: faClock
    }
  ];
</script>

<div class={baseHeaderClasses}>
  <div class="{pxScreen} flex px-0 md:px-5">
    <nav aria-label="Settings" class="flex h-12 grow justify-evenly xl:h-10">
      {#each settingItems as settingItem (settingItem.label)}
        <button
          type="button"
          aria-pressed={activeSettings === settingItem.label}
          class="flex grow flex-col items-center justify-center text-xs"
          class:bg-gray-900={activeSettings === settingItem.label}
          class:hover:bg-gray-900={activeSettings !== settingItem.label}
          onclick={() => {
            if (activeSettings === settingItem.label) return;
            activeSettings = settingItem.label;
            window.scrollTo(0, 0);
          }}
        >
          <Fa class="mb-1" icon={settingItem.icon} />
          {settingItem.label}
          <Ripple />
        </button>
      {/each}
    </nav>
    <MergedHeaderIcon {leavePageLink} />
  </div>
</div>
