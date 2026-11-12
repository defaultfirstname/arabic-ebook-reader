<script lang="ts">
  import { faArrowDown19 } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';
  import SettingsDimensionContent from './settings-dimension-content.svelte';

  interface Props {
    isFirstDimension?: boolean;
    dimensionValue?: number;
  }

  let { isFirstDimension = false, dimensionValue = $bindable(0) }: Props = $props();
</script>

<Popover>
  {#snippet icon()}
    <Fa icon={faArrowDown19} class="mx-2" />
  {/snippet}
  {#snippet content()}
    <SettingsDimensionContent {isFirstDimension} bind:dimensionValue />
  {/snippet}
</Popover>
