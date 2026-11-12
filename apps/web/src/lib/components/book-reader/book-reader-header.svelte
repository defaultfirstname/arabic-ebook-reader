<script lang="ts">
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookmark as fasBookmark,
    faCrosshairs,
    faExpand,
    faFlag,
    faList,
    faRotateLeft
  } from '@fortawesome/free-solid-svg-icons';
  import { readerImageGalleryPictures$ } from '#lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import { mergeEntries } from '#lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '#lib/components/merged-header-icon/merged-header-icon.svelte';
  import Popover from '#lib/components/popover/popover.svelte';
  import {
    baseHeaderClasses,
    baseIconClasses,
    nTranslateXHeaderFa,
    translateXHeaderFa
  } from '#lib/css-classes';
  import { customReadingPointEnabled$, viewMode$ } from '#lib/data/store';
  import { ViewMode } from '#lib/data/view-mode';
  import { dummyFn, isMobile$ } from '#lib/functions/utils';
  import Fa from 'svelte-fa';

  interface Props {
    onTocClick: () => void;
    onBookmarkClick: () => void;
    onScrollToBookmarkClick: () => void;
    onJumpClick: () => void;
    onCompleteBook: () => void;
    onFullscreenClick: () => void;
    onShowCustomReadingPoint: () => void;
    onSetCustomReadingPoint: () => void;
    onResetCustomReadingPoint: () => void;
    onStatisticsClick: () => void;
    onReaderImageGalleryClick: () => void;
    onSettingsClick: () => void;
    onBookManagerClick: () => void;
    hasChapterData: boolean;
    hasText: boolean;
    autoScrollMultiplier: number;
    hasCustomReadingPoint: boolean;
    showFullscreenButton: boolean;
    isBookmarkScreen: boolean;
    hasBookmarkData: boolean;
  }

  let {
    onTocClick,
    onBookmarkClick,
    onScrollToBookmarkClick,
    onJumpClick,
    onCompleteBook,
    onFullscreenClick,
    onShowCustomReadingPoint,
    onSetCustomReadingPoint,
    onResetCustomReadingPoint,
    onStatisticsClick,
    onReaderImageGalleryClick,
    onSettingsClick,
    onBookManagerClick,
    hasChapterData,
    hasText,
    autoScrollMultiplier,
    hasCustomReadingPoint,
    showFullscreenButton,
    isBookmarkScreen,
    hasBookmarkData
  }: Props = $props();

  let customReadingPointMenuItems = $derived([
    ...(hasCustomReadingPoint ? [{ label: 'Show Point', action: onShowCustomReadingPoint }] : []),
    { label: 'Set Point', action: onSetCustomReadingPoint },
    ...(hasCustomReadingPoint ? [{ label: 'Reset Point', action: onResetCustomReadingPoint }] : [])
  ]);

  let customReadingPointMenuElm = $state<ReturnType<typeof Popover>>();

  let menuItems = $derived([
    mergeEntries.STATISTICS,
    ...(hasText ? [mergeEntries.JUMP_TO_POSITION] : []),
    ...($readerImageGalleryPictures$.length ? [mergeEntries.READER_IMAGE_GALLERY] : []),
    mergeEntries.SETTINGS,
    mergeEntries.MANAGE
  ]);

  function runCustomReadingPointAction(action: () => void) {
    action();
    customReadingPointMenuElm?.toggleOpen();
  }
</script>

<div class="flex justify-between bg-gray-700 px-4 md:px-8 {baseHeaderClasses}">
  <div class="flex transform-gpu {nTranslateXHeaderFa}">
    {#if hasChapterData}
      <div
        tabindex="0"
        role="button"
        title="Open Table of Contents"
        class={baseIconClasses}
        onclick={() => onTocClick()}
        onkeyup={dummyFn}
      >
        <Fa icon={faList} />
      </div>
    {/if}
    <div
      tabindex="0"
      role="button"
      title="Create Bookmark"
      class={baseIconClasses}
      onclick={() => onBookmarkClick()}
      onkeyup={dummyFn}
    >
      <Fa icon={isBookmarkScreen ? fasBookmark : farBookmark} />
    </div>
    {#if hasBookmarkData}
      <div
        tabindex="0"
        role="button"
        title="Return to Bookmark"
        class={baseIconClasses}
        onclick={() => onScrollToBookmarkClick()}
        onkeyup={dummyFn}
      >
        <Fa icon={faRotateLeft} />
      </div>
    {/if}
    {#if $viewMode$ === ViewMode.Continuous && !$isMobile$}
      <div
        class="flex items-center px-4 text-xl xl:px-3 xl:text-lg"
        title="Current Autoscroll Speed"
      >
        {autoScrollMultiplier}x
      </div>
    {/if}
  </div>

  <div class="flex transform-gpu {translateXHeaderFa}">
    <div
      tabindex="0"
      role="button"
      title="Complete Book"
      class={baseIconClasses}
      onclick={() => onCompleteBook()}
      onkeyup={dummyFn}
    >
      <Fa icon={faFlag} />
    </div>
    {#if $customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated}
      <div class="flex">
        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={0}
          bind:this={customReadingPointMenuElm}
        >
          {#snippet icon()}
            <div title="Open Custom Point Actions" class={baseIconClasses}>
              <Fa icon={faCrosshairs} />
            </div>
          {/snippet}
          {#snippet content()}
            <div class="w-40 bg-gray-700 md:w-32">
              {#each customReadingPointMenuItems as actionItem (actionItem.label)}
                <div
                  tabindex="0"
                  role="button"
                  class="px-4 py-2 text-sm hover:bg-white hover:text-gray-700"
                  onclick={() => runCustomReadingPointAction(actionItem.action)}
                  onkeyup={dummyFn}
                >
                  {actionItem.label}
                </div>
              {/each}
            </div>
          {/snippet}
        </Popover>
      </div>
    {/if}
    {#if showFullscreenButton}
      <div
        tabindex="0"
        role="button"
        title="Toggle Fullscreen"
        class={baseIconClasses}
        onclick={() => onFullscreenClick()}
        onkeyup={dummyFn}
      >
        <Fa icon={faExpand} />
      </div>
    {/if}
    <MergedHeaderIcon
      disableRouteNavigation
      items={menuItems}
      onAction={(detail) => {
        if (detail === mergeEntries.STATISTICS.label) {
          onStatisticsClick();
        } else if (detail === mergeEntries.JUMP_TO_POSITION.label) {
          onJumpClick();
        } else if (detail === mergeEntries.READER_IMAGE_GALLERY.label) {
          onReaderImageGalleryClick();
        } else if (detail === mergeEntries.SETTINGS.label) {
          onSettingsClick();
        } else if (detail === mergeEntries.MANAGE.label) {
          onBookManagerClick();
        }
      }}
    />
  </div>
</div>
