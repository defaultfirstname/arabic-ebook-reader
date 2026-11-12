<script lang="ts">
  import { untrack } from 'svelte';
  import { quintOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';

  let diameter = $state(0);
  let rippleLeft = $state(0);
  let rippleTop = $state(0);
  let ripples: {
    id: number;
  }[] = $state([]);
  let hold = $state(false);
  let focus = $state(false);

  let containerEl: HTMLElement | undefined = $state();

  let listeners: {
    el: HTMLElement;
    type: string;
    listener: (event: any) => void;
  }[] = [];

  function addEventListener<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void
  ) {
    // Removing a focused button can fire focusout during Svelte's DOM update.
    const handleEvent = (event: HTMLElementEventMap[K]) => untrack(() => listener(event));
    el.addEventListener(type, handleEvent);
    listeners.push({ el, type, listener: handleEvent });
  }

  function clearEventListeners() {
    listeners.forEach(({ el, type, listener }) => el.removeEventListener(type, listener));
    listeners = [];
  }

  function createRipple(
    eventX: number,
    eventY: number,
    targetX: number,
    targetY: number,
    width: number,
    height: number
  ) {
    diameter = Math.max(width, height);
    const radius = diameter / 2;
    rippleLeft = eventX - targetX - radius;
    rippleTop = eventY - targetY - radius;
    ripples = [
      {
        id: Date.now()
      }
    ];
    hold = true;
    focus = false;
  }

  function createRippleFromMouseEvent(ev: MouseEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    createRipple(ev.clientX, ev.clientY, rect.left, rect.top, rect.width, rect.height);
  }

  function createRippleFromTouchEvent(ev: TouchEvent, el: HTMLElement) {
    const touch = ev.touches[0];
    const rect = el.getBoundingClientRect();
    createRipple(touch.clientX, touch.clientY, rect.left, rect.top, rect.width, rect.height);
  }

  function animateRipple(_node: HTMLElement) {
    return {
      delay: 0,
      duration: 400,
      css: (t: number, u: number) => `
          transform: scale(${t * 4});
          opacity: ${u}
        `
    };
  }
  let target = $derived(containerEl?.parentElement);
  $effect(() => {
    if (!target) return;
    target.classList.add('relative', 'overflow-hidden');
    const el = target;
    addEventListener(el, 'focusin', () => (focus = true));
    addEventListener(el, 'focusout', () => (focus = false));
    addEventListener(el, 'mouseenter', () => (focus = true));
    addEventListener(el, 'mouseleave', () => {
      hold = false;
      focus = false;
    });
    addEventListener(el, 'mousedown', (ev) => createRippleFromMouseEvent(ev, el));
    addEventListener(el, 'mouseup', () => (hold = false));
    addEventListener(el, 'touchstart', (ev) => createRippleFromTouchEvent(ev, el));
    addEventListener(el, 'touchend', () => (hold = false));
    addEventListener(el, 'touchcancel', () => (hold = false));
    return clearEventListeners;
  });
</script>

<span bind:this={containerEl} class="absolute inset-0 h-full w-full">
  {#each ripples as _ (_.id)}
    <span
      class="absolute rounded-full bg-gray-400/50"
      style:width="{diameter}px"
      style:height="{diameter}px"
      style:top="{rippleTop}px"
      style:left="{rippleLeft}px"
      in:animateRipple|local
      onintroend={() => (ripples = [])}
    ></span>
  {/each}
  {#if hold}
    <span
      class="absolute inset-0 h-full w-full bg-gray-400/25"
      transition:fade|local={{ easing: quintOut }}
    ></span>
  {/if}
  {#if hold || focus}
    <span
      class="absolute inset-0 h-full w-full bg-gray-400/[.10]"
      transition:fade|local={{ easing: quintOut }}
    ></span>
  {/if}
</span>
