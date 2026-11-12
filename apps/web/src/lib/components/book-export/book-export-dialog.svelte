<script lang="ts">
  import { browser } from '$app/env';
  import BookExportSelection from '#lib/components/book-export/book-export-selection.svelte';
  import DialogTemplate from '#lib/components/dialog-template.svelte';
  import Ripple from '#lib/components/ripple.svelte';
  import { buttonClasses } from '#lib/css-classes';
  import { StorageKey } from '#lib/data/storage/storage-types';
  import {
    getStorageIconData,
    isStorageSourceAvailable,
    storageSource$
  } from '#lib/data/storage/storage-view';
  import {
    fsStorageSource$,
    gDriveStorageSource$,
    lastExportedTarget$,
    lastExportedTypes$,
    oneDriveStorageSource$
  } from '#lib/data/store';
  import { executeReplicate$ } from '#lib/functions/replication/replication-progress';

  let { onClose }: { onClose: () => void } = $props();

  let icons = $derived(
    [
      { ...getStorageIconData(StorageKey.BACKUP), source: StorageKey.BACKUP, label: 'Zip File' },
      {
        ...getStorageIconData(StorageKey.BROWSER),
        source: StorageKey.BROWSER,
        label: 'Browser DB'
      },
      ...(browser && isStorageSourceAvailable(StorageKey.GDRIVE, $gDriveStorageSource$, window)
        ? [{ ...getStorageIconData(StorageKey.GDRIVE), source: StorageKey.GDRIVE, label: 'GDrive' }]
        : []),
      ...(browser && isStorageSourceAvailable(StorageKey.ONEDRIVE, $oneDriveStorageSource$, window)
        ? [
            {
              ...getStorageIconData(StorageKey.ONEDRIVE),
              source: StorageKey.ONEDRIVE,
              label: 'OneDrive'
            }
          ]
        : []),
      ...(browser && isStorageSourceAvailable(StorageKey.FS, $fsStorageSource$, window)
        ? [{ ...getStorageIconData(StorageKey.FS), source: StorageKey.FS, label: 'Filesystem' }]
        : [])
    ].filter((icon) => icon.source !== $storageSource$)
  );

  function replicateData() {
    executeReplicate$.next();

    onClose();
  }
</script>

<DialogTemplate>
  {#snippet content()}
    <BookExportSelection
      {icons}
      bind:target={$lastExportedTarget$}
      bind:dataToReplicate={$lastExportedTypes$}
    />
  {/snippet}
  {#snippet footer()}
    <div class="flex grow justify-between">
      <button class={buttonClasses} onclick={() => onClose()}>
        Cancel
        <Ripple />
      </button>
      <button
        class={buttonClasses}
        class:cursor-not-allowed={!$lastExportedTypes$.length}
        disabled={!$lastExportedTypes$.length}
        onclick={replicateData}
      >
        Start
        <Ripple />
      </button>
    </div>
  {/snippet}
</DialogTemplate>
