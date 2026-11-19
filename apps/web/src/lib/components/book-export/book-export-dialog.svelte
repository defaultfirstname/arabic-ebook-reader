<script lang="ts">
  import { browser } from '$app/env';
  import BookExportSelection from '#lib/components/book-export/book-export-selection.svelte';
  import DialogTemplate from '#lib/components/dialog-template.svelte';
  import Ripple from '#lib/components/ripple.svelte';
  import { buttonClasses } from '#lib/css-classes';
  import { StorageDataType, StorageKey } from '#lib/data/storage/storage-types';
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

  let {
    onClose,
    hasPdfBooks = false,
    hasTextBooks = true
  }: { onClose: () => void; hasPdfBooks?: boolean; hasTextBooks?: boolean } = $props();
  const canExport = $derived(
    $lastExportedTypes$.length > 0 &&
      (hasTextBooks ||
        ($lastExportedTarget$ === StorageKey.BACKUP &&
          $lastExportedTypes$.includes(StorageDataType.DATA)))
  );

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
    {#if hasPdfBooks}
      <p class="mt-4">
        PDFs are included only in Zip File exports with Book Data selected, including their saved
        page and layout. PDF cloud sync is not supported.
      </p>
    {/if}
  {/snippet}
  {#snippet footer()}
    <div class="flex grow justify-between">
      <button class={buttonClasses} onclick={() => onClose()}>
        Cancel
        <Ripple />
      </button>
      <button
        class={buttonClasses}
        class:cursor-not-allowed={!canExport}
        disabled={!canExport}
        onclick={replicateData}
      >
        Start
        <Ripple />
      </button>
    </div>
  {/snippet}
</DialogTemplate>
