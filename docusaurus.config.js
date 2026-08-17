// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

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
  themes: [
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
