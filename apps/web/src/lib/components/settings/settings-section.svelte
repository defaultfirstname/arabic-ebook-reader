<script lang="ts">
  interface Props {
    title: string;
    children?: import('svelte').Snippet;
  }

  let { title, children }: Props = $props();
</script>

<section class="border-t border-gray-500/25 pt-4">
  <h2 class="mb-3 text-lg font-semibold">{title}</h2>
  <div class="grid grid-cols-1 items-start gap-x-6 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
    {@render children?.()}
  </div>
</section>
