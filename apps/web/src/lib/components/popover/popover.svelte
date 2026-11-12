<script lang="ts">
  import { popovers } from '#lib/components/popover/popover';
  import { CLOSE_POPOVER } from '#lib/data/events';
  import { clickOutside } from '#lib/functions/use-click-outside';
  import type { Instance, Placement } from '@popperjs/core';
  import flip from '@popperjs/core/lib/modifiers/flip';
  import offset from '@popperjs/core/lib/modifiers/offset';
  import { createPopper } from '@popperjs/core/lib/popper-lite';
  import { onDestroy, tick, type Snippet } from 'svelte';

  interface Props {
    onOpen?: () => void;
    contentText?: string;
    containerStyles?: string;
    innerContainerStyles?: string;
    contentStyles?: string;
    eventType?: string;
    fallbackPlacements?: Placement[];
    placement?: Placement;
    singlePopover?: boolean;
    xOffset?: number;
    yOffset?: number;
    icon?: Snippet;
    children?: Snippet;
    content?: Snippet;
  }

  let {
    onOpen,
    contentText = '',
    containerStyles = '',
    innerContainerStyles = '',
    contentStyles = 'padding: 0',
    eventType = 'click',
    fallbackPlacements = ['left', 'bottom', 'right'],
    placement = 'top',
    singlePopover = true,
    xOffset = 0,
    yOffset = 10,
    icon,
    children,
    content
  }: Props = $props();

  let contentElement = $state<HTMLElement>();
  let iconElement = $state<HTMLElement>();
  let popoverElement = $state<HTMLElement>();

  const id = Symbol('popover');
  let instance: Instance | undefined;
  let isOpen = $state(false);

  function close() {
    isOpen = false;
    instance?.destroy();
    instance = undefined;
  }

  $effect(() => {
    if (isOpen && singlePopover && !$popovers.includes(id)) close();
  });

  onDestroy(() => {
    if (isOpen) popovers.remove(id);
    instance?.destroy();
  });

  export async function toggleOpen(referenceElement?: HTMLElement | Event) {
    if (isOpen) {
      popovers.remove(id);
      close();
      return;
    }

    if (singlePopover) popovers.replace(id);
    else popovers.add(id);
    isOpen = true;
    await tick();

    const reference = getTargetElement(referenceElement);
    if (!isOpen || !reference || !popoverElement) return;

    instance = createPopper(reference, popoverElement, {
      placement,
      modifiers: [
        flip,
        { name: 'flip', options: { fallbackPlacements } },
        offset,
        { name: 'offset', options: { offset: [xOffset, yOffset] } }
      ]
    });

    await instance.update();
    if (isOpen) onOpen?.();
  }

  function conditionalClickHandlerAndClass(node: HTMLElement, conditionFulfilled: boolean) {
    if (conditionFulfilled) {
      node.classList.add('cursor-pointer');
      if (eventType === 'click') {
        node.addEventListener('click', toggleOpen, false);
      } else {
        node.addEventListener('pointerenter', toggleOpen, false);
        node.addEventListener('pointerleave', toggleOpen, false);
      }
    } else {
      node.classList.remove('cursor-pointer');
      if (eventType === 'click') {
        node.removeEventListener('click', toggleOpen, false);
      } else {
        node.removeEventListener('pointerenter', toggleOpen, false);
        node.removeEventListener('pointerleave', toggleOpen, false);
      }
    }

    return {
      destroy() {
        if (eventType === 'click') {
          node.removeEventListener('click', toggleOpen, false);
        } else {
          node.removeEventListener('pointerenter', toggleOpen, false);
          node.removeEventListener('pointerleave', toggleOpen, false);
        }
      }
    };
  }

  function externalClose(node: HTMLElement) {
    node.addEventListener(CLOSE_POPOVER, toggleOpen, false);

    return {
      destroy() {
        node.removeEventListener(CLOSE_POPOVER, toggleOpen, false);
      }
    };
  }

  function getTargetElement(referenceElement?: HTMLElement | Event) {
    let targetElement;

    if (referenceElement instanceof HTMLElement) {
      targetElement = referenceElement;
    } else {
      targetElement = icon ? iconElement : contentElement;
    }

    return targetElement;
  }
</script>

<div data-popover class="flex items-center" style={containerStyles}>
  <div
    style={innerContainerStyles}
    use:conditionalClickHandlerAndClass={!icon}
    bind:this={contentElement}
  >
    {@render children?.()}
  </div>
  <div use:conditionalClickHandlerAndClass={!!icon} bind:this={iconElement}>
    {@render icon?.()}
  </div>
</div>

{#if isOpen}
  <div
    data-popover
    class="max-w-60vw absolute z-10 rounded bg-[#333] text-sm font-bold text-white md:max-w-lg"
    class:whitespace-pre-wrap={contentText}
    bind:this={popoverElement}
  >
    <div
      style={contentStyles}
      use:externalClose
      use:clickOutside={({ target }) => {
        if (!(target instanceof Element && target.closest('[data-popover]'))) {
          toggleOpen();
        }
      }}
    >
      {contentText}
      {@render content?.()}
    </div>
  </div>
{/if}
