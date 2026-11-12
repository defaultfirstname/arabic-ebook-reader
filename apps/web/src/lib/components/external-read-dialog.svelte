<script lang="ts">
  import DialogTemplate from '#lib/components/dialog-template.svelte';
  import Ripple from '#lib/components/ripple.svelte';
  import { buttonClasses } from '#lib/css-classes';
  import { hideExternalReadHint$ } from '#lib/data/store';

  interface Props {
    onClose: () => void;
    resolver: (arg0: string) => void;
  }

  let { onClose, resolver }: Props = $props();

  function closeDialog(result = '') {
    resolver(result);
    onClose();
  }
</script>

<DialogTemplate>
  {#snippet header()}
    External Read
  {/snippet}
  {#snippet content()}
    <p class="my-2">You are opening a book from an external storage Source.</p>
    <p class="my-2">
      Note: This will redownload the complete book every time and may override other configured sync
      target configurations.
    </p>
    <p class="my-2">
      Consider an export to the local browser and switching to / reading from browser storage view
      to prevent such behaviour.
    </p>
    <p class="flex items-center mt-4">
      <input id="show-hint" type="checkbox" bind:checked={$hideExternalReadHint$} />
      <label class="ml-2" for="show-hint">Remember and hide this message</label>
    </p>
  {/snippet}
  {#snippet footer()}
    <div class="flex flex-col sm:flex-row grow sm:justify-between">
      <button class={buttonClasses} onclick={() => closeDialog('cancel')}>
        Cancel
        <Ripple />
      </button>
      <button class={buttonClasses} onclick={() => closeDialog('export')}>
        Open Export
        <Ripple />
      </button>
      <button class={buttonClasses} onclick={() => closeDialog()}>
        Confirm
        <Ripple />
      </button>
    </div>
  {/snippet}
</DialogTemplate>
