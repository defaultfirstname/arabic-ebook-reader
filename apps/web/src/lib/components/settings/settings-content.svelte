<script lang="ts">
  import { browser } from '$app/env';
  import { faComputer, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import {
    TrackerAutoPause,
    TrackerSkipThresholdAction
  } from '#lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import MessageDialog from '#lib/components/message-dialog.svelte';
  import SettingsCustomTheme from '#lib/components/settings/settings-custom-theme.svelte';
  import SettingsDimensionPopover from '#lib/components/settings/settings-dimension-popover.svelte';
  import SettingsFontSelector from '#lib/components/settings/settings-font-selector.svelte';
  import SettingsReadingGoals from '#lib/components/settings/settings-reading-goals.svelte';
  import SettingsItemGroup from '#lib/components/settings/settings-item-group.svelte';
  import SettingsSection from '#lib/components/settings/settings-section.svelte';
  import SettingsStorageSourceList from '#lib/components/settings/settings-storage-source-list.svelte';
  import SettingsUserFontDialog from '#lib/components/settings/settings-user-font-dialog.svelte';
  import { inputClasses } from '#lib/css-classes';
  import { BlurMode } from '#lib/data/blur-mode';
  import { dialogManager } from '#lib/data/dialog-manager';
  import { arabicReaderFonts, LocalFont } from '#lib/data/fonts';
  import { ImportHTMLFixMode } from '#lib/data/import-html-fix-mode';
  import { logger } from '#lib/data/logger';
  import { MergeMode } from '#lib/data/merge-mode';
  import { isAppDefault } from '#lib/data/storage/storage-source-manager';
  import { defaultStorageSources } from '#lib/data/storage/storage-types';
  import { isStorageSourceAvailable } from '#lib/data/storage/storage-view';
  import {
    customThemes$,
    database,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    horizontalCustomReadingPosition$,
    textMarginMode$,
    textMarginValue$
  } from '#lib/data/store';
  import type { TextMarginMode } from '#lib/data/text-margin-mode';
  import { availableThemes } from '#lib/data/theme-option';
  import { ViewMode } from '#lib/data/view-mode';
  import { secondsToMinutes } from '#lib/functions/statistic-util';
  import { dummyFn } from '#lib/functions/utils';
  import {
    ReplicationSaveBehavior,
    AutoReplicationType
  } from '#lib/functions/replication/replication-options';
  import { map } from 'rxjs';
  import Fa from 'svelte-fa';
  import { onDestroy } from 'svelte';

  interface Props {
    selectedTheme: string;
    viewMode: ViewMode;
    fontFamilyGroupOne: string;
    fontFamilyGroupTwo: string;
    fontWeight: number | null;
    fontSize: number;
    lineHeight: number;
    textIndentation: number;
    textMarginValue: number;
    blurImage: boolean;
    blurImageMode: string;
    prioritizeReaderStyles: boolean;
    enableTextJustification: boolean;
    enableTextWrapPretty: boolean;
    textMarginMode: TextMarginMode;
    enableReaderWakeLock: boolean;
    showCharacterCounter: boolean;
    showPercentage: boolean;
    showFooterChapterCharacterCounter: boolean;
    showFooterChapterPercentage: boolean;
    secondDimensionMaxValue: number;
    firstDimensionMargin: number;
    swipeThreshold: number;
    disableWheelNavigation: boolean;
    autoPositionOnResize: boolean;
    avoidPageBreak: boolean;
    pauseTrackerOnCustomPointChange: boolean;
    customReadingPointEnabled: boolean;
    selectionToBookmarkEnabled: boolean;
    enableTapEdgeToFlip: boolean;
    pageColumns: number;
    storageQuota: string;
    persistentStorage: boolean;
    hideExternalReadHint: boolean;
    confirmClose: boolean;
    manualBookmark: boolean;
    autoBookmark: boolean;
    autoBookmarkTime: number;
    activeSettings: string;
    importHTMLFixMode: string;
    restrictImportFixToAnchor: boolean;
    cacheStorageData: boolean;
    autoReplication: string;
    replicationSaveBehavior: string;
    showExternalPlaceholder: boolean;
    keepLocalStatisticsOnDeletion: boolean;
    overwriteBookCompletion: boolean;
    startDayHoursForTracker: number;
    statisticsMergeMode: string;
    readingGoalsMergeMode: string;
    statisticsEnabled: boolean;
    trackerAutoPause: string;
    openTrackerOnCompletion: boolean;
    addCharactersOnCompletion: boolean;
    trackerAutoStartTime: number;
    trackerIdleTime: number;
    trackerForwardSkipThreshold: number;
    trackerBackwardSkipThreshold: number;
    trackerSkipThresholdAction: string;
    trackerPopupDetection: boolean;
    adjustStatisticsAfterIdleTime: boolean;
  }

  let {
    selectedTheme = $bindable(),
    viewMode = $bindable(),
    fontFamilyGroupOne = $bindable(),
    fontFamilyGroupTwo = $bindable(),
    fontWeight = $bindable(),
    fontSize = $bindable(),
    lineHeight = $bindable(),
    textIndentation = $bindable(),
    textMarginValue = $bindable(),
    blurImage = $bindable(),
    blurImageMode = $bindable(),
    prioritizeReaderStyles = $bindable(),
    enableTextJustification = $bindable(),
    enableTextWrapPretty = $bindable(),
    textMarginMode = $bindable(),
    enableReaderWakeLock = $bindable(),
    showCharacterCounter = $bindable(),
    showPercentage = $bindable(),
    showFooterChapterCharacterCounter = $bindable(),
    showFooterChapterPercentage = $bindable(),
    secondDimensionMaxValue = $bindable(),
    firstDimensionMargin = $bindable(),
    swipeThreshold = $bindable(),
    disableWheelNavigation = $bindable(),
    autoPositionOnResize = $bindable(),
    avoidPageBreak = $bindable(),
    pauseTrackerOnCustomPointChange = $bindable(),
    customReadingPointEnabled = $bindable(),
    selectionToBookmarkEnabled = $bindable(),
    enableTapEdgeToFlip = $bindable(),
    pageColumns = $bindable(),
    storageQuota,
    persistentStorage = $bindable(),
    hideExternalReadHint = $bindable(),
    confirmClose = $bindable(),
    manualBookmark = $bindable(),
    autoBookmark = $bindable(),
    autoBookmarkTime = $bindable(),
    activeSettings,
    importHTMLFixMode = $bindable(),
    restrictImportFixToAnchor = $bindable(),
    cacheStorageData = $bindable(),
    autoReplication = $bindable(),
    replicationSaveBehavior = $bindable(),
    showExternalPlaceholder = $bindable(),
    keepLocalStatisticsOnDeletion = $bindable(),
    overwriteBookCompletion = $bindable(),
    startDayHoursForTracker = $bindable(),
    statisticsMergeMode = $bindable(),
    readingGoalsMergeMode = $bindable(),
    statisticsEnabled = $bindable(),
    trackerAutoPause = $bindable(),
    openTrackerOnCompletion = $bindable(),
    addCharactersOnCompletion = $bindable(),
    trackerAutoStartTime = $bindable(),
    trackerIdleTime = $bindable(),
    trackerForwardSkipThreshold = $bindable(),
    trackerBackwardSkipThreshold = $bindable(),
    trackerSkipThresholdAction = $bindable(),
    trackerPopupDetection = $bindable(),
    adjustStatisticsAfterIdleTime = $bindable()
  }: Props = $props();

  const selectClasses =
    'w-full rounded-md border-gray-400 bg-background-color text-sm focus:border-blue-500 focus:ring-blue-500';
  const builtInThemes = [...availableThemes.keys()].map((id) => ({
    id,
    name: id.replace(/-theme$/, '').replace(/^./, (letter) => letter.toUpperCase())
  }));

  let themeChoices = $derived([
    ...builtInThemes,
    ...(browser ? Object.keys($customThemes$).map((name) => ({ id: name, name })) : [])
  ]);

  onDestroy(() => dialogManager.dialogs$.next([]));

  function openThemeEditor(theme?: string) {
    dialogManager.dialogs$.next([
      {
        component: SettingsCustomTheme,
        props: {
          selectedTheme: theme,
          existingThemes: themeChoices
        }
      }
    ]);
  }

  function deleteSelectedTheme() {
    const themes = { ...$customThemes$ };
    delete themes[selectedTheme];
    selectedTheme = 'light-theme';
    $customThemes$ = themes;
  }

  const storageSources$ = database.storageSourcesChanged$.pipe(
    map((storageSources) => [
      ...defaultStorageSources
        .filter((defaultStorageSource) =>
          isStorageSourceAvailable(defaultStorageSource.type, defaultStorageSource.name, window)
        )
        .map((defaultStorageSource) => ({
          name: defaultStorageSource.name,
          type: defaultStorageSource.type,
          storedInManager: false,
          encryptionDisabled: false,
          data: new ArrayBuffer(0),
          lastSourceModified: 0
        })),
      ...storageSources.filter((storageSource) => !isAppDefault(storageSource.name))
    ])
  );

  let showSpinner = $state(false);
  let requestedStorageSources = false;

  $effect(() => {
    if ($textMarginMode$ === 'auto' && $textMarginValue$ !== 0) {
      $textMarginValue$ = 0;
    }
  });

  let autoBookmarkTooltip = $derived(
    `If enabled sets a bookmark after ${autoBookmarkTime} seconds without scrolling/page change`
  );
  const wakeLockSupported = browser && 'wakeLock' in navigator;
  const fontCacheSupported = browser && 'caches' in window;
  let avoidPageBreakTooltip = $derived(
    avoidPageBreak
      ? 'Avoids breaking words/sentences into different pages'
      : 'Allow words/sentences to break into different pages'
  );
  let persistentStorageTooltip = $derived(
    persistentStorage
      ? 'Reader uses higher storage limit for local data'
      : 'Uses lower temporary storage for local data.\nMay require bookmark or notification permissions for enablement'
  );
  let importHTMLFixModeTooltip = $derived.by(() => {
    switch (importHTMLFixMode) {
      case ImportHTMLFixMode.OFF:
        return 'Imports epub files as is';
      case ImportHTMLFixMode.EXTENDED:
        return 'Applies additional fixes for epub imports like removing control characters, replacing html entities etc.';
      default:
        return 'Applies fixes for epub imports like wrong self closing elements etc.';
    }
  });
  let cacheStorageDataTooltip = $derived(
    cacheStorageData
      ? 'Storage data is cached. Saves network traffic/latency but requires to reload current/open a new tab to retrieve data changes'
      : 'Storage data is refetched on every action. May consume more network traffic/latency but ensures current data'
  );
  let replicationSaveBehaviorTooltip = $derived(
    replicationSaveBehavior === ReplicationSaveBehavior.Overwrite
      ? 'Data will always be overwritten'
      : 'Data will only be written if none exist on target, no time data is present or if target data is older'
  );
  let autoReplicationTypeTooltip = $derived.by(() => {
    switch (autoReplication) {
      case AutoReplicationType.Up:
        return 'Updated data will be exported to sync target when reading once per minute';
      case AutoReplicationType.Down:
        return 'Data will be imported from sync target when opening a book';
      case AutoReplicationType.All:
        return 'Data will be synced in both directions';
      default:
        return 'No automatic import/export of data';
    }
  });
  let showExternalPlaceholderToolTip = $derived(
    showExternalPlaceholder
      ? 'Placeholder data for external books is shown in the browser source manager'
      : 'Placeholder data for external books is hidden'
  );

  let startOfDayHours = $derived(`${`${startDayHoursForTracker}`.padStart(2, '0')}:00`);

  let trackerIdleTimeInMin = $derived(secondsToMinutes(trackerIdleTime));

  let trackerAutoPauseTooltip = $derived.by(() => {
    switch (trackerAutoPause) {
      case TrackerAutoPause.OFF:
        return 'Tracker does not auto pause except for certain reader events';
      case TrackerAutoPause.STRICT:
        return 'Tracker will auto pause on certain reader events and any kind of site focus loss (e. g. dictionary popup)';
      default:
        return 'Tracker will auto pause on certain reader events and when the reader tab loses focus';
    }
  });

  $effect(() => {
    // Subscribe while Reader is open too, so we retain any earlier storage update.
    const storageSources = $storageSources$;
    if (
      (activeSettings === 'Data' || activeSettings === 'Statistics') &&
      !storageSources &&
      !requestedStorageSources
    ) {
      requestedStorageSources = true;
      database
        .getStorageSources()
        .then((storageSources) => {
          database.storageSourcesChanged$.next(storageSources);
        })
        .catch((error) => {
          logger.error(`Failed to retrieve storage sources: ${error.message}`);
          database.storageSourcesChanged$.next([]);
        });
    }
  });
</script>

<div class="space-y-6">
  {#if activeSettings === 'Reader'}
    <SettingsSection title="Appearance">
      <SettingsItemGroup inputId="setting-theme" title="Theme">
        <select id="setting-theme" class={selectClasses} bind:value={selectedTheme}>
          {#each themeChoices as theme (theme.id)}
            <option value={theme.id}>{theme.name}</option>
          {/each}
        </select>
        {#if browser}
          <div class="mt-2 flex flex-wrap gap-x-3 text-sm">
            <button type="button" class="underline" onclick={() => openThemeEditor()}>
              New custom theme
            </button>
            {#if !availableThemes.has(selectedTheme) && $customThemes$[selectedTheme]}
              <button
                type="button"
                class="underline"
                onclick={() => openThemeEditor(selectedTheme)}
              >
                Edit theme
              </button>
              <button type="button" class="underline" onclick={deleteSelectedTheme}
                >Delete theme</button
              >
            {/if}
          </div>
        {/if}
      </SettingsItemGroup>
      <SettingsItemGroup inputId="setting-view-mode" title="View mode">
        <select id="setting-view-mode" class={selectClasses} bind:value={viewMode}>
          <option value={ViewMode.Continuous}>Continuous</option>
          <option value={ViewMode.Paginated}>Paginated</option>
        </select>
      </SettingsItemGroup>
      <SettingsItemGroup inputId="setting-font-family-group-one" title="Reading font">
        {#snippet header()}
          <div class="flex items-center">
            <SettingsFontSelector
              availableFonts={[...arabicReaderFonts, LocalFont.SERIF]}
              bind:fontValue={fontFamilyGroupOne}
            />
            {#if fontCacheSupported}
              <div
                tabindex="0"
                role="button"
                title="Open Custom Font Dialog"
                onclick={() =>
                  dialogManager.dialogs$.next([
                    {
                      component: SettingsUserFontDialog,
                      props: { fontFamily: fontFamilyGroupOne$ }
                    }
                  ])}
                onkeyup={dummyFn}
              >
                <Fa icon={faComputer} />
              </div>
            {/if}
          </div>
        {/snippet}
        <input
          id="setting-font-family-group-one"
          type="text"
          class={inputClasses}
          placeholder={LocalFont.NOTONASKHARABIC}
          bind:value={fontFamilyGroupOne}
        />
      </SettingsItemGroup>
      <SettingsItemGroup inputId="setting-font-family-group-two" title="Sans-serif font">
        {#snippet header()}
          <div class="flex items-center">
            <SettingsFontSelector
              availableFonts={[...arabicReaderFonts, LocalFont.SANSSERIF]}
              bind:fontValue={fontFamilyGroupTwo}
            />
            {#if fontCacheSupported}
              <div
                tabindex="0"
                role="button"
                onclick={() =>
                  dialogManager.dialogs$.next([
                    {
                      component: SettingsUserFontDialog,
                      props: { fontFamily: fontFamilyGroupTwo$ }
                    }
                  ])}
                onkeyup={dummyFn}
              >
                <Fa icon={faComputer} />
              </div>
            {/if}
          </div>
        {/snippet}
        <input
          id="setting-font-family-group-two"
          type="text"
          class={inputClasses}
          placeholder={LocalFont.NOTONASKHARABIC}
          bind:value={fontFamilyGroupTwo}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        inputId="setting-font-weight"
        title="Font weight"
        tooltip={'Sets a font weight - leave empty to fallback to default'}
      >
        <input
          id="setting-font-weight"
          type="number"
          placeholder="default"
          class={inputClasses}
          step="100"
          min="100"
          max="1000"
          bind:value={fontWeight}
          onchange={() => {
            if (fontWeight === null) {
              return;
            }

            if (fontWeight < 100) {
              fontWeight = 100;
            } else if (fontWeight > 1000) {
              fontWeight = 1000;
            }
          }}
        />
      </SettingsItemGroup>
      <SettingsItemGroup inputId="setting-font-size" title="Font size">
        <input
          id="setting-font-size"
          type="number"
          class={inputClasses}
          step="1"
          min="1"
          bind:value={fontSize}
        />
      </SettingsItemGroup>
      <SettingsItemGroup inputId="setting-line-height" title="Line height">
        <input
          id="setting-line-height"
          type="number"
          class={inputClasses}
          step="0.05"
          min="1"
          bind:value={lineHeight}
          onchange={() => {
            if (!lineHeight || lineHeight < 1) {
              lineHeight = 1.65;
            }
          }}
        />
      </SettingsItemGroup>
    </SettingsSection>
    <SettingsSection title="Text layout">
      <SettingsItemGroup
        inputId="setting-text-indentation"
        title="First-line indent"
        tooltip="# of rem added as text indentation of new paragraphs"
      >
        <input
          id="setting-text-indentation"
          type="number"
          class={inputClasses}
          step=".5"
          min="0"
          bind:value={textIndentation}
          onblur={() => {
            const newValue = Number.parseFloat(`${textIndentation ?? 0}`);

            if (isNaN(newValue) || newValue < 1) {
              textIndentation = 0;
            }
          }}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        inputId="setting-text-margin-mode"
        title="Paragraph spacing mode"
        tooltip={'When set to manual it allows to specify a margin value which should be applied to paragraphs'}
      >
        <select id="setting-text-margin-mode" class={selectClasses} bind:value={textMarginMode}>
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </select>
      </SettingsItemGroup>
      {#if textMarginMode === 'manual'}
        <SettingsItemGroup
          inputId="setting-text-margin-value"
          title="Paragraph spacing"
          tooltip="# of rem added as margin to paragraphs"
        >
          <input
            id="setting-text-margin-value"
            type="number"
            class={inputClasses}
            step=".5"
            min="0"
            bind:value={textMarginValue}
            onblur={() => {
              const newValue = Number.parseFloat(`${textMarginValue ?? 0}`);

              if (isNaN(newValue) || newValue < 1) {
                textMarginValue = 0;
              }
            }}
          />
        </SettingsItemGroup>
      {/if}
      <SettingsItemGroup inputId="setting-first-dimension-margin" title="Top and bottom margin">
        {#snippet header()}
          <SettingsDimensionPopover isFirstDimension bind:dimensionValue={firstDimensionMargin} />
        {/snippet}
        <input
          id="setting-first-dimension-margin"
          type="number"
          class={inputClasses}
          step="1"
          min="0"
          bind:value={firstDimensionMargin}
        />
      </SettingsItemGroup>
      <SettingsItemGroup inputId="setting-second-dimension-max-value" title="Maximum text width">
        {#snippet header()}
          <SettingsDimensionPopover bind:dimensionValue={secondDimensionMaxValue} />
        {/snippet}
        <input
          id="setting-second-dimension-max-value"
          type="number"
          class={inputClasses}
          step="1"
          min="0"
          bind:value={secondDimensionMaxValue}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Prefer reader formatting"
        tooltip={'When enabled the "important" declaration is added to certain rules like margins or justification which makes it more likely to be applied in case of conflicting book styles'}
        bind:checked={prioritizeReaderStyles}
      />
      <SettingsItemGroup
        title="Justify paragraphs"
        tooltip={'When enabled the reader adds styles to justify text content of paragraphs'}
        bind:checked={enableTextJustification}
      />
      <SettingsItemGroup
        title="Improve line breaks"
        tooltip={'When enabled the reader adds the pretty text wrap style to supported browsers'}
        bind:checked={enableTextWrapPretty}
      />
    </SettingsSection>
    <SettingsSection title="Navigation and bookmarks">
      {#if wakeLockSupported}
        <SettingsItemGroup
          title="Keep screen awake"
          tooltip={'When enabled the reader site attempts to request a WakeLock that prevents device screens from dimming or locking'}
          bind:checked={enableReaderWakeLock}
        />
      {/if}
      <SettingsItemGroup
        inputId="setting-swipe-threshold"
        title="Swipe distance to turn a page"
        tooltip={'Distance which you need to swipe in order trigger a navigation'}
      >
        <input
          id="setting-swipe-threshold"
          type="number"
          step="1"
          min="10"
          class={inputClasses}
          bind:value={swipeThreshold}
          onblur={() => {
            if (swipeThreshold < 10 || typeof swipeThreshold !== 'number') {
              swipeThreshold = 10;
            }
          }}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Disable mouse-wheel navigation"
        bind:checked={disableWheelNavigation}
      />
      <SettingsItemGroup
        title="Warn before closing with unsaved progress"
        tooltip={`When enabled asks for confirmation on closing/reloading a reader tab and unsaved changes were detected`}
        bind:checked={confirmClose}
      />
      <SettingsItemGroup
        title="Save manually when leaving"
        tooltip={'If enabled current position will not be bookmarked when leaving the reader via menu elements'}
        bind:checked={manualBookmark}
      />
      <SettingsItemGroup
        title="Save reading position automatically"
        tooltip={autoBookmarkTooltip}
        bind:checked={autoBookmark}
      />
      {#if autoBookmark}
        <SettingsItemGroup
          inputId="setting-auto-bookmark-time"
          title="Auto-bookmark delay (seconds)"
          tooltip="How long to wait after scrolling or turning a page before saving your place."
        >
          <input
            id="setting-auto-bookmark-time"
            type="number"
            step="1"
            min="1"
            class={inputClasses}
            bind:value={autoBookmarkTime}
            onblur={() => {
              if (autoBookmarkTime < 1 || typeof autoBookmarkTime !== 'number') {
                autoBookmarkTime = 3;
              }
            }}
          />
        </SettingsItemGroup>
      {/if}
      {#if statisticsEnabled}
        <SettingsItemGroup
          title="Pause tracking while setting a reading point"
          tooltip={'When enabled the tracker will auto pause and unpause while setting a custom reading point'}
          bind:checked={pauseTrackerOnCustomPointChange}
        />
      {/if}
      {#if viewMode === ViewMode.Continuous}
        <SettingsItemGroup
          title="Custom reading point"
          tooltip={'Allows to set a persistent custom point in the reader from which the current progress and bookmark is calculated when enabled'}
          bind:checked={customReadingPointEnabled}
        >
          <div class="flex items-center">
            {#if customReadingPointEnabled}
              <div
                tabindex="0"
                role="button"
                class="ml-4 hover:underline"
                onclick={() => {
                  horizontalCustomReadingPosition$.next(0);
                }}
                onkeyup={dummyFn}
              >
                Reset Points
              </div>
            {/if}
          </div>
        </SettingsItemGroup>
        <SettingsItemGroup
          title="Keep reading position on resize"
          bind:checked={autoPositionOnResize}
        />
      {:else}
        <SettingsItemGroup
          title="Avoid splitting text across pages"
          tooltip={avoidPageBreakTooltip}
          bind:checked={avoidPageBreak}
        />
        <SettingsItemGroup
          title="Bookmark selected text"
          tooltip={'When enabled bookmarks will be placed to a near paragraph of current/previous selected text instead of page start'}
          bind:checked={selectionToBookmarkEnabled}
        />
        <SettingsItemGroup
          title="Tap screen edges to turn pages"
          tooltip="Reserves small margins on the left and right on which you can tap to turn pages"
          bind:checked={enableTapEdgeToFlip}
        />
        <SettingsItemGroup
          inputId="setting-page-columns"
          title="Page columns"
          tooltip="Use 0 to let the reader choose the number of columns for your screen."
        >
          <input
            id="setting-page-columns"
            type="number"
            class={inputClasses}
            step="1"
            min="0"
            bind:value={pageColumns}
          />
        </SettingsItemGroup>
      {/if}
    </SettingsSection>
    <SettingsSection title="Progress and images">
      <SettingsItemGroup title="Show book character count" bind:checked={showCharacterCounter} />
      <SettingsItemGroup title="Show book percentage" bind:checked={showPercentage} />
      <SettingsItemGroup
        title="Show chapter character count"
        bind:checked={showFooterChapterCharacterCounter}
      />
      <SettingsItemGroup
        title="Show chapter percentage"
        bind:checked={showFooterChapterPercentage}
      />
      <SettingsItemGroup title="Blur book images" bind:checked={blurImage} />
      {#if blurImage}
        <SettingsItemGroup
          inputId="setting-blur-image-mode"
          title="Which images to blur"
          tooltip="Determines if all or only images after the table of contents will be blurred"
        >
          <select id="setting-blur-image-mode" class={selectClasses} bind:value={blurImageMode}>
            <option value={BlurMode.ALL}>All images</option>
            <option value={BlurMode.AFTER_TOC}>After the table of contents</option>
          </select>
        </SettingsItemGroup>
      {/if}
    </SettingsSection>
  {:else if activeSettings === 'Data'}
    <SettingsSection title="Browser storage">
      <SettingsItemGroup
        title="Persistent browser storage"
        tooltip={persistentStorageTooltip}
        bind:checked={persistentStorage}
      >
        <div class="flex items-center">
          {#if storageQuota}
            <div class="ml-4">{storageQuota}</div>
          {/if}
        </div>
      </SettingsItemGroup>
    </SettingsSection>
    <SettingsSection title="EPUB import">
      <SettingsItemGroup
        inputId="setting-epub-repair"
        title="EPUB repair options"
        tooltip={importHTMLFixModeTooltip}
      >
        <select id="setting-epub-repair" class={selectClasses} bind:value={importHTMLFixMode}>
          <option value={ImportHTMLFixMode.OFF}>Off</option>
          <option value={ImportHTMLFixMode.STANDARD}>Standard</option>
          <option value={ImportHTMLFixMode.EXTENDED}>Extended</option>
        </select>
      </SettingsItemGroup>
      {#if importHTMLFixMode !== ImportHTMLFixMode.OFF}
        <SettingsItemGroup
          title="Limit tag repairs to links"
          tooltip="Restricts epub fixes for self closing tags to links only"
          bind:checked={restrictImportFixToAnchor}
        />
      {/if}
    </SettingsSection>
    <SettingsSection title="Sync and external books">
      <SettingsItemGroup
        title="Cache external data"
        tooltip={cacheStorageDataTooltip}
        bind:checked={cacheStorageData}
      />
      <SettingsItemGroup
        inputId="setting-auto-replication"
        title="Automatic sync"
        tooltip={autoReplicationTypeTooltip}
      >
        <select id="setting-auto-replication" class={selectClasses} bind:value={autoReplication}>
          <option value={AutoReplicationType.Off}>Off</option>
          <option value={AutoReplicationType.Up}>Upload</option>
          <option value={AutoReplicationType.Down}>Download</option>
          <option value={AutoReplicationType.All}>Both</option>
        </select>
      </SettingsItemGroup>
      <SettingsItemGroup
        inputId="setting-replication-save-behavior"
        title="When to overwrite data"
        tooltip={replicationSaveBehaviorTooltip}
      >
        <select
          id="setting-replication-save-behavior"
          class={selectClasses}
          bind:value={replicationSaveBehavior}
        >
          <option value={ReplicationSaveBehavior.NewOnly}>Newer data only</option>
          <option value={ReplicationSaveBehavior.Overwrite}>Overwrite</option>
        </select>
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Show external books in local library"
        tooltip={showExternalPlaceholderToolTip}
        bind:checked={showExternalPlaceholder}
      />
      <SettingsItemGroup
        title="Hide external storage notice"
        tooltip="Hides the user warning when opening a book from an external storage source"
        bind:checked={hideExternalReadHint}
      />
    </SettingsSection>
    <SettingsStorageSourceList storageSources={$storageSources$} />
  {:else}
    <SettingsSection title="Reading tracker">
      <SettingsItemGroup
        title="Track reading statistics"
        tooltip="Enables the tracker icon in the bottom left corner of the reader which you need to use to start tracking your reading session"
        bind:checked={statisticsEnabled}
      />
      {#if statisticsEnabled}
        <SettingsItemGroup
          inputId="setting-tracker-auto-pause"
          title="Pause tracking automatically"
          tooltip={trackerAutoPauseTooltip}
        >
          <select
            id="setting-tracker-auto-pause"
            class={selectClasses}
            bind:value={trackerAutoPause}
          >
            <option value={TrackerAutoPause.OFF}>Off</option>
            <option value={TrackerAutoPause.MODERATE}>Moderate</option>
            <option value={TrackerAutoPause.STRICT}>Strict</option>
          </select>
        </SettingsItemGroup>
        <SettingsItemGroup
          inputId="setting-tracker-auto-start-time"
          title="Auto-start delay (seconds)"
          tooltip={'Time in seconds without a change to the character count after which the tracker will initially auto start (0 = disabled, higher value recommended to avoid racing conditions)'}
        >
          <input
            id="setting-tracker-auto-start-time"
            type="number"
            class={inputClasses}
            step="1"
            min="0"
            bind:value={trackerAutoStartTime}
            onblur={() => {
              const newValue = Number.parseFloat(`${trackerAutoStartTime ?? 0}`);

              if (isNaN(newValue) || newValue < 1) {
                trackerAutoStartTime = 0;
              }
            }}
          />
        </SettingsItemGroup>
        <SettingsItemGroup
          inputId="setting-tracker-idle-time-in-min"
          title="Pause after inactivity (minutes)"
          tooltip={'Time in minutes after which the tracker will auto pause without page interaction (0 = disabled, max 12h)'}
        >
          <input
            id="setting-tracker-idle-time-in-min"
            type="number"
            class={inputClasses}
            step="0.5"
            min="0"
            bind:value={trackerIdleTimeInMin}
            onblur={() => {
              if (!trackerIdleTimeInMin || trackerIdleTimeInMin < 0) {
                trackerIdleTime = 0;
              } else if (trackerIdleTimeInMin > 43200) {
                trackerIdleTime = 900;
              } else {
                trackerIdleTime = Math.floor(trackerIdleTimeInMin * 60);
              }
            }}
          />
        </SettingsItemGroup>
        <SettingsItemGroup
          inputId="setting-tracker-forward-skip-threshold"
          title="Forward jump limit (characters)"
          tooltip={'Amount of positive characters passed between a tick after which a threshold action is triggered (0 = disabled)'}
        >
          <input
            id="setting-tracker-forward-skip-threshold"
            type="number"
            class={inputClasses}
            step="1"
            min="0"
            bind:value={trackerForwardSkipThreshold}
            onblur={() => {
              if (trackerForwardSkipThreshold === 0) {
                trackerForwardSkipThreshold = 0;
              } else if (!trackerForwardSkipThreshold || trackerForwardSkipThreshold < 0) {
                trackerForwardSkipThreshold = 2700;
              }
            }}
          />
        </SettingsItemGroup>
        <SettingsItemGroup
          inputId="setting-tracker-backward-skip-threshold"
          title="Backward jump limit (characters)"
          tooltip={'Amount of negative characters passed between a tick after which a threshold action is triggered (0 = disabled)'}
        >
          <input
            id="setting-tracker-backward-skip-threshold"
            type="number"
            class={inputClasses}
            step="1"
            bind:value={trackerBackwardSkipThreshold}
            onblur={() => {
              if (trackerBackwardSkipThreshold < 0) {
                trackerBackwardSkipThreshold = Math.abs(trackerBackwardSkipThreshold);
              } else if (trackerBackwardSkipThreshold === 0) {
                trackerBackwardSkipThreshold = 0;
              } else if (!trackerBackwardSkipThreshold) {
                trackerBackwardSkipThreshold = 2700;
              }
            }}
          />
        </SettingsItemGroup>
        {#if trackerForwardSkipThreshold || trackerBackwardSkipThreshold}
          <SettingsItemGroup
            inputId="setting-tracker-skip-threshold-action"
            title="When a jump exceeds the limit"
            tooltip={`Determines what action will be executed in case a skip threshold was triggered`}
          >
            <select
              id="setting-tracker-skip-threshold-action"
              class={selectClasses}
              bind:value={trackerSkipThresholdAction}
            >
              <option value={TrackerSkipThresholdAction.IGNORE}>Ignore</option>
              <option value={TrackerSkipThresholdAction.PAUSE}>Pause tracker</option>
            </select>
          </SettingsItemGroup>
        {/if}
        {#if trackerAutoPause !== TrackerAutoPause.OFF}
          <SettingsItemGroup
            title="Keep tracking during Yomitan lookups"
            tooltip="When enabled, the tracker keeps running while a detected Yomitan popup is open. Detection works when Yomitan’s Secure Container setting is off."
            bind:checked={trackerPopupDetection}
          />
        {/if}
        {#if trackerIdleTime > 0}
          <SettingsItemGroup
            title="Subtract idle time"
            tooltip={`If enabled attempts to rollback statistics by subtracting the idled time value back from the session`}
            bind:checked={adjustStatisticsAfterIdleTime}
          />
        {/if}
      {/if}
      <SettingsItemGroup
        inputId="setting-start-day-hours-for-tracker"
        title={`Reading day starts at ${startOfDayHours}`}
        tooltip={'Determines at which time a new day starts.\nData before this point will be counted towards the previous day'}
      >
        <input
          id="setting-start-day-hours-for-tracker"
          type="range"
          step="1"
          min="0"
          max="23"
          class={inputClasses}
          bind:value={startDayHoursForTracker}
        />
      </SettingsItemGroup>
    </SettingsSection>
    <SettingsSection title="Book completion and history">
      <SettingsItemGroup
        title="Keep statistics when removing a book"
        tooltip={'Determines if local statistics will be deleted or not when removing a local book copy'}
        bind:checked={keepLocalStatisticsOnDeletion}
      >
        <div class="flex items-center">
          <div
            tabindex="0"
            role="button"
            class="ml-4 hover:underline"
            onclick={() => {
              showSpinner = true;
              database
                .clearZombieStatistics()
                .catch(({ message }) =>
                  dialogManager.dialogs$.next([
                    {
                      component: MessageDialog,
                      props: {
                        title: 'Error',
                        message: `Could not clear statistics for removed books: ${message}`
                      }
                    }
                  ])
                )
                .finally(() => (showSpinner = false));
            }}
            onkeyup={() => {}}
          >
            Clear statistics for removed books
          </div>
        </div>
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Use latest completion date"
        tooltip={`Determines if only the first Book Completion will be tracked or if it always updates to the latest one`}
        bind:checked={overwriteBookCompletion}
      />
      {#if statisticsEnabled}
        <SettingsItemGroup
          title="Show tracker when finishing a book"
          bind:checked={openTrackerOnCompletion}
        />
        <SettingsItemGroup
          title="Count remaining characters when finishing"
          tooltip={`Determines if the missing amount of characters between the current position and the book total will be added to the statistics or not`}
          bind:checked={addCharactersOnCompletion}
        />
      {/if}
    </SettingsSection>
    {#if statisticsEnabled}
      <SettingsReadingGoals
        storageSources={$storageSources$}
        onSpinner={(show) => (showSpinner = show)}
      />
    {/if}
    <SettingsSection title="Sync">
      <SettingsItemGroup
        inputId="setting-statistics-merge-mode"
        title="Statistics sync"
        tooltip={`Determines if statistics will be merged entry by entry or replaced completely on a sync`}
      >
        <select
          id="setting-statistics-merge-mode"
          class={selectClasses}
          bind:value={statisticsMergeMode}
        >
          <option value={MergeMode.MERGE}>Merge</option>
          <option value={MergeMode.REPLACE}>Replace</option>
        </select>
      </SettingsItemGroup>
      <SettingsItemGroup
        inputId="setting-reading-goals-merge-mode"
        title="Reading goal sync"
        tooltip={`Determines if reading goals will be merged entry by entry or replaced completely on a sync`}
      >
        <select
          id="setting-reading-goals-merge-mode"
          class={selectClasses}
          bind:value={readingGoalsMergeMode}
        >
          <option value={MergeMode.MERGE}>Merge</option>
          <option value={MergeMode.REPLACE}>Replace</option>
        </select>
      </SettingsItemGroup>
    </SettingsSection>
  {/if}
  {#if showSpinner}
    <div class="tap-highlight-transparent fixed inset-0 bg-black/[.2]"></div>
    <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
      <Fa icon={faSpinner} spin />
    </div>
  {/if}
</div>
