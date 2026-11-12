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
  <Fa icon={faArrowDown19} slot="icon" class="mx-2" />
  <SettingsDimensionContent slot="content" {isFirstDimension} bind:dimensionValue />
</Popover>
