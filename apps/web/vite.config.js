import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'vite';

const bundledNotices = 'third-party-licenses.txt';
const staticAdapter = adapter({ fallback: '404.html' });
const pdfAssetNotices = [
  'LICENSE',
  'cmaps/LICENSE',
  'standard_fonts/LICENSE_FOXIT',
  'standard_fonts/LICENSE_LIBERATION',
  'wasm/LICENSE_JBIG2',
  'wasm/LICENSE_OPENJPEG',
  'wasm/LICENSE_PDFJS_JBIG2',
  'wasm/LICENSE_PDFJS_OPENJPEG',
  'wasm/LICENSE_PDFJS_QCMS',
  'wasm/LICENSE_QCMS'
];

export default defineConfig({
  // The service worker also builds into the client output directory.
  environments: {
    client: { build: { license: { fileName: bundledNotices } } }
  },
  plugins: [
    sveltekit({
      adapter: {
        ...staticAdapter,
        async adapt(builder) {
          const client = builder.getClientDirectory();
          await copyFile(new URL('../../LICENSE', import.meta.url), `${client}/LICENSE.txt`);

          // Vite inventories imported code. PDF.js also ships separate binary assets.
          const noticePath = `${client}/${bundledNotices}`;
          const bundled = await readFile(noticePath, 'utf8');
          const notices = await Promise.all(
            pdfAssetNotices.map(async (path) => {
              const url = new URL(`./node_modules/pdfjs-dist/${path}`, import.meta.url);
              return `pdfjs-dist/${path}\n\n${await readFile(url, 'utf8')}`;
            })
          );
          // zip.js carries its notice in the entry file instead of a separate LICENSE file.
          const zipEntry = await readFile(
            new URL('./node_modules/@zip.js/zip.js/index.js', import.meta.url),
            'utf8'
          );
          const zipNotice = zipEntry.match(/\/\*\s*(Copyright[\s\S]*?)\*\//)?.[1]?.trim();
          if (!zipNotice) throw new Error('Could not find the zip.js license notice');
          notices.push(`@zip.js/zip.js/index.js\n\n${zipNotice}`);
          await writeFile(noticePath, `${bundled}\n\n${notices.join('\n\n')}`);
          await staticAdapter.adapt(builder);
        }
      },
      preprocess: vitePreprocess()
    })
  ],
  ssr: {
    // https://github.com/FortAwesome/Font-Awesome/issues/18677
    noExternal: ['@fortawesome/*', '@popperjs/*']
  }
});
