<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import SettingsCustomThemeInput from '$lib/components/settings/settings-custom-theme-input.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { customThemes$, theme$ } from '$lib/data/store';
  import {
    availableThemes,
    themePreviewText,
    type CustomThemeValue,
    type ThemeOption
  } from '$lib/data/theme-option';
  import { onMount, untrack } from 'svelte';

  interface Props {
    selectedTheme: string | undefined;
    existingThemes: { id: string; name: string }[];
    onClose: () => void;
  }

  let { selectedTheme, existingThemes, onClose }: Props = $props();

  let customTheme: Record<keyof ThemeOption, CustomThemeValue> = $state({
    fontColor: { hexExpression: '#ffffff', alphaValue: 1, rgbaExpression: 'rgba(255,255,255,1)' },
    backgroundColor: {
      hexExpression: '#000000',
      alphaValue: 1,
      rgbaExpression: 'rgba(0,0,0,1)'
    },
    selectionFontColor: {
      hexExpression: '#ffffff',
      alphaValue: 1,
      rgbaExpression: 'rgba(255,255,255,1)'
    },
    selectionBackgroundColor: {
      hexExpression: '#ffffff',
      alphaValue: 1,
      rgbaExpression: 'rgba(255,255,255,1)'
    },
    tooltipTextFontColor: {
      hexExpression: '#ffffff',
      alphaValue: 1,
      rgbaExpression: 'rgba(255,255,255,1)'
    }
  });

  let themeToCopy = $state(untrack(() => existingThemes[0].id));
  let themeName = $state('');
  let themeNameElm = $state<HTMLInputElement>();

  let themeStyle = $derived(
    `color: ${customTheme.fontColor.rgbaExpression}; background-color: ${customTheme.backgroundColor.rgbaExpression}`
  );

  onMount(() => {
    if (!selectedTheme) return;

    const existingThemeObject = $customThemes$[selectedTheme];

    if (!existingThemeObject) {
      return;
    }

    customTheme = getThemeData(existingThemeObject);
    themeName = selectedTheme;
  });

  function getThemeData(referenceObject: ThemeOption): Record<keyof ThemeOption, CustomThemeValue> {
    const result: any = {};
    const entries = [...Object.entries(referenceObject)];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const [key, value] = entries[index];
      const [r, g, b, a] = (value.match(/rgba\((.+)\)/)?.[1] || '0,0,0,1')
        .split(',')
        .map((x: string) => parseFloat(x.trim()));

      result[key as keyof ThemeOption] = {
        hexExpression: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
          .toString(16)
          .padStart(2, '0')}`,
        alphaValue: a,
        rgbaExpression: value
      };
    }

    return result;
  }

  function handleCopyTheme() {
    copyTheme(availableThemes.get(themeToCopy) || $customThemes$[themeToCopy]);
  }

  function handleColorValueChange(attribute: keyof ThemeOption, value: string) {
    const entry = customTheme[attribute];

    customTheme = {
      ...customTheme,
      ...{
        [attribute]: {
          hexExpression: value,
          alphaValue: entry.alphaValue,
          rgbaExpression: hexToRGB(value, entry.alphaValue)
        }
      }
    };
  }

  function handleAlphaValueChange(attribute: keyof ThemeOption, value: number) {
    const entry = customTheme[attribute];

    customTheme = {
      ...customTheme,
      ...{
        [attribute]: {
          hexExpression: entry.hexExpression,
          alphaValue: value,
          rgbaExpression: hexToRGB(entry.hexExpression, value)
        }
      }
    };
  }

  function handleSave() {
    if (!themeNameElm) return;

    themeNameElm.setCustomValidity('');

    if (!themeName) {
      themeNameElm.setCustomValidity('You have to enter a Name!');
      themeNameElm.reportValidity();
      return;
    }

    if (availableThemes.has(themeName)) {
      themeNameElm.setCustomValidity('This Name is reserved!');
      themeNameElm.reportValidity();
      return;
    }

    const newTheme: any = {};
    const entries = [...Object.entries(customTheme)];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const [key, value] = entries[index];

      newTheme[key] = value.rgbaExpression;
    }

    if (selectedTheme && selectedTheme !== themeName) {
      delete $customThemes$[selectedTheme];
    }

    $customThemes$ = { ...$customThemes$, ...{ [themeName]: newTheme } };
    $theme$ = themeName;
    onClose();
  }

  function copyTheme(theme: Record<keyof ThemeOption, string> | undefined) {
    if (!theme) {
      return;
    }

    customTheme = getThemeData(theme);
  }

  function hexToRGB(h: string, alpha: number) {
    let r = '0';
    let g = '0';
    let b = '0';

    if (h.length === 4) {
      r = `0x${h[1]}${h[1]}`;
      g = `0x${h[2]}${h[2]}`;
      b = `0x${h[3]}${h[3]}`;
    } else if (h.length === 7) {
      r = `0x${h[1]}${h[2]}`;
      g = `0x${h[3]}${h[4]}`;
      b = `0x${h[5]}${h[6]}`;
    }

    return `rgba(${+r},${+g},${+b},${alpha})`;
  }
</script>

<DialogTemplate>
  <div slot="content">
    <div
      class="grid grid-cols-1 gap-2 items-center overflow-auto max-h-[60vh] sm:grid-cols-[auto_auto_5rem] sm:gap-4"
    >
      <select aria-label="Theme to copy" class="sm:col-span-2" bind:value={themeToCopy}>
        {#each existingThemes as theme (theme.id)}
          <option value={theme.id}>
            {theme.name}
          </option>
        {/each}
      </select>
      <button class={buttonClasses} onclick={handleCopyTheme}
        >Copy
        <Ripple />
      </button>
      <span class="hidden sm:block">Attribute</span>
      <span class="hidden sm:block">Color</span>
      <span class="hidden sm:block">Alpha</span>
      <SettingsCustomThemeInput
        label="Font"
        attribute="fontColor"
        values={customTheme.fontColor}
        onColorChange={handleColorValueChange}
        onAlphaChange={handleAlphaValueChange}
      />
      <SettingsCustomThemeInput
        label="Background"
        attribute="backgroundColor"
        values={customTheme.backgroundColor}
        onColorChange={handleColorValueChange}
        onAlphaChange={handleAlphaValueChange}
      />
      <SettingsCustomThemeInput
        label="Footer Font"
        attribute="tooltipTextFontColor"
        values={customTheme.tooltipTextFontColor}
        onColorChange={handleColorValueChange}
        onAlphaChange={handleAlphaValueChange}
      />
      <input
        class="sm:col-span-2"
        type="text"
        placeholder="Theme Name"
        bind:value={themeName}
        bind:this={themeNameElm}
      />
      <button
        class="flex justify-center items-center rounded-md border-2 border-gray-400 p-2 text-lg"
        style={themeStyle}
      >
        <span lang="ar" dir="rtl">{themePreviewText}</span>
        <Ripple />
      </button>
    </div>
    <div class="flex mt-4"></div>
  </div>
  <div class="mt-2 flex grow justify-between" slot="footer">
    <button class={buttonClasses} onclick={onClose}>
      Cancel
      <Ripple />
    </button>
    <button class={buttonClasses} onclick={handleSave}>
      Save
      <Ripple />
    </button>
  </div>
</DialogTemplate>
