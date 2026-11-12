<script lang="ts">
  import { buttonClasses } from '#lib/css-classes';
  import DialogTemplate from '#lib/components/dialog-template.svelte';
  import Ripple from '#lib/components/ripple.svelte';

  interface Props {
    onClose: () => void;
    title: string;
    message: string;
  }

  let { onClose, title, message }: Props = $props();
</script>

<DialogTemplate>
  {#snippet header()}
    {title}
  {/snippet}
  {#snippet content()}
    <p>{message}</p>
  {/snippet}
  {#snippet footer()}
    <button class={buttonClasses} onclick={() => onClose()}>
      Close
      <Ripple />
    </button>
  {/snippet}
</DialogTemplate>
