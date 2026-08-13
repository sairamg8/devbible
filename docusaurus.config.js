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
