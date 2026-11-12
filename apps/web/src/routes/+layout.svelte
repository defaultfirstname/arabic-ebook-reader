<script lang="ts">
  import { page } from '$app/state';
  import { appName } from '#lib/functions/format-page-title';
  import { basePath, clearConsoleOnReload } from '#lib/data/env';
  import { dialogManager } from '#lib/data/dialog-manager';
  import { LocalFont, userFontsCacheName, type UserFont } from '#lib/data/fonts';
  import { fontFamilyGroupOne$, isOnline$, userFonts$ } from '#lib/data/store';
  import { dummyFn, isMobile, isMobile$ } from '#lib/functions/utils';
  import { MetaTags } from 'svelte-meta-tags';
  import { onMount, type Snippet } from 'svelte';
  import '../app.scss';
  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const { dialogs$ } = dialogManager;
  let path = $derived(page.url.pathname);
  let clickOnCloseDisabled = $derived($dialogs$[0]?.disableCloseOnClick ?? false);
  let zIndex = $derived($dialogs$[0]?.zIndex ?? '');

  if (clearConsoleOnReload && import.meta.hot) {
    // eslint-disable-next-line no-console
    import.meta.hot.on('vite:beforeUpdate', () => console.clear());
  }

  function addUserFonts(userFonts: UserFont[]) {
    let styleContent = '';

    for (let index = 0, { length } = userFonts; index < length; index += 1) {
      const userFont = userFonts[index];
      const ext = userFont.fileName.split('.').pop() || '';

      let format = '';

      switch (ext) {
        case 'otf':
          format = 'opentype';
          break;
        case 'ttf':
          format = 'truetype';
          break;
        default:
          format = ext;
          break;
      }

      styleContent += `@font-face{font-family: '${userFont.name}';font-style: normal;font-weight: 400;font-display: swap;src: local(''), url('${userFont.path}') format('${format}')}\n`;
    }

    let styleElement = document.getElementById(userFontsCacheName);

    if (!styleContent) {
      styleElement?.remove();
      return;
    }

    const textNode = document.createTextNode(styleContent);

    if (styleElement) {
      styleElement.replaceChild(textNode, styleElement.childNodes[0]);
    } else {
      styleElement = document.createElement('style');
      styleElement.id = userFontsCacheName;

      styleElement.appendChild(textNode);
      document.head.append(styleElement);
    }
  }

  function closeAllDialogs() {
    dialogs$.next([]);
  }

  onMount(() => isMobile$.next(isMobile(window)));
  $effect(() => {
    addUserFonts($userFonts$);
  });
</script>

<svelte:window bind:online={$isOnline$} />

<MetaTags
  title={appName}
  description="Offline-capable Arabic ebook reader with right-to-left reading and Yomitan support"
  canonical={basePath ? `${basePath}${path !== '/' ? path : ''}` : undefined}
  openGraph={{
    type: 'website',
    images: basePath
      ? [
          {
            url: `${basePath}/icons/regular-icon@512x512.png`,
            width: 512,
            height: 512
          }
        ]
      : undefined
  }}
/>

{@render children()}

{#if $dialogs$.length > 0}
  <div class="writing-horizontal-tb fixed inset-0 z-50 h-full w-full" style:z-index={zIndex}>
    <div
      tabindex="0"
      role="button"
      class="tap-highlight-transparent absolute inset-0 bg-black/[.32]"
      onclick={() => {
        if (!clickOnCloseDisabled) {
          closeAllDialogs();
        }
      }}
      onkeyup={dummyFn}
    ></div>

    <div
      class="relative top-1/2 left-1/2 inline-block max-w-[80vw] -translate-x-1/2 -translate-y-1/2"
    >
      {#each $dialogs$ as dialog}
        {#if typeof dialog.component === 'string'}
          {@html dialog.component}
        {:else}
          <dialog.component {...dialog.props} onClose={closeAllDialogs} />
        {/if}
      {/each}
    </div>
  </div>
{/if}

<span style={`font-family: ${$fontFamilyGroupOne$ || LocalFont.NOTONASKHARABIC}`}></span>
