<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';

  interface Props {
    dimensionValue?: number;
    isFirstDimension?: boolean;
  }

  let { dimensionValue = $bindable(0), isFirstDimension = false }: Props = $props();

  const progressStep = 5;

  let presetValue = $state(0);

  function getDimension() {
    return isFirstDimension ? 'innerHeight' : 'innerWidth';
  }

  async function setToValue(val = 0) {
    presetValue = val;
    await tick();
    dimensionValue = calculatedValue;
  }

  onMount(() => {
    const currentPercentage = Math.min(
      Math.max(
        Math.round(((dimensionValue * (isFirstDimension ? 2 : 1)) / window[getDimension()]) * 100),
        !isFirstDimension && !dimensionValue ? max : min
      ),
      max
    );
    setToValue(Math.round(currentPercentage / progressStep) * progressStep);
  });
  let calculatedValue = $derived(
    Math.ceil(
      (browser ? window[getDimension()] : 0) * (presetValue / 100 / (isFirstDimension ? 2 : 1))
    )
  );
  let min = $derived(isFirstDimension ? 5 : 50);
  let max = $derived(isFirstDimension ? 50 : 95);
  let quarter = $derived(isFirstDimension ? 25 : 75);
</script>

<div class="text-center">
  {presetValue}% - {calculatedValue}px
</div>
<input
  class="mb-2 mt-4"
  type="range"
  step={progressStep}
  {min}
  {max}
  bind:value={presetValue}
  onchange={() => (dimensionValue = calculatedValue)}
/>
<div class="flex justify-evenly">
  <button onclick={() => setToValue(quarter)}>
    {quarter}%
  </button>
  <button onclick={() => setToValue(50)}> 50% </button>
</div>
