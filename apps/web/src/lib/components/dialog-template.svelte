<script lang="ts">
  interface Props {
    header?: import('svelte').Snippet;
    content?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  }

  let { header, content, footer }: Props = $props();
</script>

<section class=" mdc-elevation--z24 rounded bg-white p-6">
  <h2 class="weight-medium mb-5 text-xl">{@render header?.()}</h2>
  {@render content?.()}
  <footer class="flex flex-wrap items-center justify-end pt-5">
    {@render footer?.()}
  </footer>
</section>
