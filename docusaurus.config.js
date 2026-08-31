// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {themes as prismThemes} from 'prism-react-renderer';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// One search context per technology, derived from the folders in docs/ rather
// than hard-coded, so a technology added by any session gets its own index
// without anyone remembering to edit this list.
//
// These strings are matched against the route with the baseUrl stripped, i.e.
// `docs/react/pages/...` — so the context path is `docs/<technology>`. That is
// the plugin's own rule: `uri === path || uri.startsWith(path + '/')`.
const searchContexts = fs
  .readdirSync(path.join(dirname, 'docs'), {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => `docs/${entry.name}`)
  .sort();

// Verification builds skip the search index — see the `themes` note below.
const FAST_BUILD = process.env.FAST_BUILD === 'true';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Dev Bible',
  tagline: 'Frontend to fullstack — MERN and PERN, explained properly',
  favicon: 'img/favicon.ico',

  future: {v4: true},

  // Published to GitHub Pages as a project site, so the repo name is part of
  // the path: https://sairamg8.github.io/devbible/
  url: 'https://sairamg8.github.io',
  baseUrl: '/devbible/',
  organizationName: 'sairamg8',
  projectName: 'devbible',
  trailingSlash: false,

  onBrokenLinks: 'warn',

  markdown: {
    hooks: {onBrokenMarkdownLinks: 'warn'},
  },

  i18n: {defaultLocale: 'en', locales: ['en']},

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          // Content lives in docs/, one folder per language, each holding its
          // own syllabus/ and pages/ — served under /docs, leaving / for the
          // custom language-picker homepage.
          path: 'docs',
          routeBasePath: '/docs',
          sidebarPath: './sidebars.js',
          showLastUpdateTime: false,
          // `reviews/` folders stay in the repo next to the content they
          // review, but are working records rather than reference material —
          // never built, never in the sidebar. The rest of this list is
          // Docusaurus's own default, which `exclude` would otherwise replace.
          exclude: [
            '**/reviews/**',
            '**/_*.{js,jsx,ts,tsx,md,mdx}',
            '**/_*/**',
            '**/*.test.{js,jsx,ts,tsx}',
            '**/__tests__/**',
          ],
        },
        blog: false,
        theme: {customCss: './src/css/custom.css'},
      }),
    ],
  ],

  // Offline, client-side search. Deliberately NOT Algolia: no API key, no
  // crawler, no external service — the index is built from the local corpus
  // and shipped as a static asset alongside the pages.
  //
  // It registers as a THEME, not a plugin, because it swizzles the navbar
  // search box in.
  //
  // The index is generated in the postBuild hook, which means it exists only
  // after `yarn build`. `yarn start` shows a search box that finds nothing —
  // that is the documented behaviour, not a fault. Verify with
  // `yarn build && yarn serve`.
  //
  // ⚡ Skipped entirely when FAST_BUILD=true (`yarn build:fast`). The plugin's
  // postBuild hook re-parses every built HTML file with Cheerio in the MAIN
  // process, after SSG has already peaked — at ~4,900 pages that is the single
  // longest and heaviest stage of the build. A verification build only needs
  // to know that routes resolve and MDX compiles, so it does not pay for it.
  // 🔴 The output of a FAST_BUILD is therefore NOT deployable: search finds
  // nothing. `yarn build` (no flag) is the one that ships.
  themes: FAST_BUILD ? [] : [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */
      ({
        // Content-hashed index filename, so a rebuilt index is never served
        // from a client's cache next to freshly rebuilt pages.
        hashed: true,
        language: ['en'],

        // Must match the `docs` preset above: `routeBasePath: '/docs'`. The
        // plugin's default happens to be the same string, but it is spelled
        // out because the two would silently drift apart otherwise — and a
        // mismatch indexes nothing rather than failing loudly.
        indexDocs: true,
        docsRouteBasePath: '/docs',

        // `blog: false` in the preset, so there is nothing to index and
        // leaving this at its `true` default would make the plugin look for a
        // /blog route that does not exist.
        indexBlog: false,

        // src/pages holds the homepage language picker and little else —
        // navigation, not reference material worth searching.
        indexPages: false,

        // 🔴 One index PER TECHNOLOGY instead of one for the whole site.
        //
        // A single whole-site index measured 94.7 MB (24.5 MB gzipped) at
        // ~2,900 pages, which is two problems at once: every visitor downloads
        // all of it before their first result, and `yarn deploy` commits the
        // built site to gh-pages, where GitHub hard-blocks any file over
        // 100 MB. At 94.7 MB and a corpus several sessions grow daily, that
        // ceiling was weeks away, not months.
        //
        // Split, a reader inside docs/react fetches only React's index.
        searchContextByPaths: searchContexts,

        // ⚠️ Deliberately left OFF, and it is the whole reason the split works.
        //
        // With this ON the plugin adds every document to the ROOT index *as
        // well as* its own context index (see postBuildFactory: it `continue`s
        // past the root push only when this is false). The root index would
        // then be the full 94.7 MB again — back over the GitHub limit, with
        // total output roughly doubled.
        //
        // The cost is real and worth stating: there is no single search that
        // spans all technologies at once. The search box gets a context
        // switcher instead, so you pick the technology and search inside it.
        useAllContextsWithNoSearchContext: false,

        // Both of these earn their keep specifically because the corpus is
        // ~2,900 pages across 15+ technologies, where the same headings
        // ("Gotchas", "Interview questions") recur in hundreds of places:
        // the path disambiguates otherwise identical-looking hits, and the
        // highlight saves a second search once you land on a long page.
        explicitSearchResultPath: true,
        highlightSearchTermsOnTargetPage: true,
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        respectPrefersColorScheme: true,
      },
      docs: {
        sidebar: {hideable: true, autoCollapseCategories: false},
      },
      navbar: {
        title: 'Dev Bible',
        hideOnScroll: false,
        // No nav items: the homepage is the language picker, and the sidebar
        // appears once you're inside a language.
        items: [],
      },
      footer: {
        style: 'light',
        copyright:
          'Dev Bible — a personal reference. Content verified August 2026.',
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.vsDark,
        additionalLanguages: ['bash', 'json', 'sql', 'nginx', 'docker'],
      },
      tableOfContents: {minHeadingLevel: 2, maxHeadingLevel: 3},
    }),
};

export default config;
