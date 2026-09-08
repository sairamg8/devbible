---
title: "An ejected or CRACO-customized CRA app has no automatic converter to Vite because the customization lives inside a webpack config function, not a declarative list, so the migration is reading what each override actually does and reproducing the intent rather than the mechanism"
sidebar_label: "01f · Eject and CRACO apps"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Create React App documentation — [Available Scripts](https://create-react-app.dev/docs/available-scripts/), and the [CRACO](https://github.com/dilanx/craco) README. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Ejected and CRACO codebases: there is no converter, only a reading

**Every migration item so far in this topic has a mechanical shape: rename this, replace that, install a plugin for the other thing.** An ejected or CRACO-customized CRA app breaks that pattern entirely, because what you are migrating is not a known, documented CRA feature — it is whatever a specific team, at a specific past date, needed webpack to do that CRA's defaults did not. There is no list to check off, because the list is different for every ejected app. This chunk is about the *method* for reading one, not a checklist, because a checklist implies the customizations are enumerable in advance, and they are not.

## `eject`: CRA's config becomes your config, permanently

CRA's own documentation is blunt about what `eject` actually does:

> *"Note: this is a one-way operation. Once you `eject`, you can't go back!"* — [Available Scripts](https://create-react-app.dev/docs/available-scripts/)

> Ejecting will *"copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc.) into your project as dependencies in `package.json`."*

After `eject`, the project has a `config/webpack.config.js` (often 500+ lines), `config/jest/`, and a real `.babelrc`-equivalent — all previously invisible, now fully exposed and, critically, **already modified** by whoever ejected in the first place. Nobody ejects and then leaves the config untouched; the entire reason to eject is to change something CRA's defaults did not allow. The migration task is finding what changed relative to CRA's stock ejected output, not migrating the whole 500-line file.

### The reading strategy: diff against a stock eject, not against nothing

```bash
# In a throwaway directory: scaffold a fresh CRA app at the SAME react-scripts
# version the real app was ejected from, and eject that too. This gives you a
# baseline to diff the real app's webpack.config.js against — the diff IS the
# list of deliberate customizations; everything else is CRA's own boilerplate.
npx create-react-app@<matching-version> scratch-baseline
cd scratch-baseline && npm run eject
diff config/webpack.config.js /path/to/real-app/config/webpack.config.js
```

Every hunk in that diff is a customization someone made on purpose, and each one maps to a known category:

| What the diff shows changed | Likely reason | Vite equivalent |
|---|---|---|
| A new `resolve.alias` entry | absolute imports beyond `baseUrl` | `resolve.alias`, or **[01c](01c-absolute-imports-and-path-aliases.md)** |
| A new webpack `loader` entry for a file type | a custom asset type (`.graphql`, `.wasm`, a font format) | a Vite plugin for that type, or `assetsInclude` |
| A `DefinePlugin` entry beyond `NODE_ENV`/`REACT_APP_*` | a build-time constant CRA didn't expose | `define` in `vite.config.ts` |
| `output.publicPath` changed from the default | a subpath deploy | `base` in `vite.config.ts` |
| A `devServer.proxy` block | the same proxy need as **[01e](01e-dev-proxy-tests-and-pwa.md)** | `server.proxy` |
| A new `plugins` entry (`CopyWebpackPlugin`, `BundleAnalyzerPlugin`) | a build-time side effect | the matching Vite/Rollup-ecosystem plugin, or `vite-plugin-static-copy` |
| A changed `optimization.splitChunks` config | manual chunking strategy | `build.rolldownOptions.output.manualChunks` |

Each row is a **category**, not a translation table — the actual fix still requires reading what the specific loader, plugin, or `DefinePlugin` entry does and finding (or writing) the Vite-side thing that does the same job, because webpack's plugin API and Rolldown's are different enough that no line-for-line mapping exists in general.

## CRACO: read the config keys, one at a time, by what they touch

CRACO exists specifically so a team never has to eject:

> *"Get all the benefits of Create React App **and** customization without using 'eject' by adding a single configuration (e.g. `craco.config.js`) file at the root of your application and customize your ESLint, Babel, PostCSS configurations and many more."* — [CRACO](https://github.com/dilanx/craco)

This is actually the **easier** case of the two, precisely because CRACO's whole design forces every customization into one file, organised by which underlying tool each key targets:

```javascript
// craco.config.js — a realistic shape. Every top-level key targets ONE tool.
module.exports = {
  webpack: {
    alias: {
      '@components': require('path').resolve(__dirname, 'src/components'),
      '@utils': require('path').resolve(__dirname, 'src/utils'),
    },
    configure: (webpackConfig) => {
      // arbitrary further mutation of the raw webpack config object
      webpackConfig.resolve.fallback = { crypto: false };
      return webpackConfig;
    },
  },
  babel: {
    plugins: ['babel-plugin-styled-components'],
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^@components/(.*)$': '<rootDir>/src/components/$1',
      },
    },
  },
  style: {
    postcss: {
      plugins: [require('postcss-nesting')],
    },
  },
};
```

Read this file top-level key by top-level key, because each key is a self-contained migration item, not one that needs the others:

- **`webpack.alias`** → `resolve.alias` in `vite.config.ts`, or **[01c](01c-absolute-imports-and-path-aliases.md)** if it should instead become a `tsconfig.json`-driven alias.
- **`webpack.configure`** → the hardest case, because it's an arbitrary function over the whole webpack config object; there is no equivalent surface to "arbitrarily mutate the equivalent Rolldown config" in general. Read what the function actually does (in the example above: disabling a Node core-module polyfill fallback for `crypto`) and find the specific Vite/Rolldown option for that specific thing — `resolve.alias` mapping `crypto` to `false` has a direct analogue, but a `webpack.configure` callback that does five unrelated things needs to be split into five separate lookups.
- **`babel.plugins`** → if `@vitejs/plugin-react`'s default transform doesn't cover the plugin's job (most style/CSS-in-JS Babel plugins have Vite-native equivalents — `babel-plugin-styled-components`'s day-to-day behaviour, for instance, is largely superseded by `vite-plugin-styled-components` or the library's own SWC/Babel-free modes in recent versions), find that equivalent rather than trying to keep Babel running as a second transform pipeline alongside Vite's own.
- **`jest.configure.moduleNameMapper`** → `resolve.alias`, translated by hand — this is the exact case **[14 · Migrating from Jest](../14-testing-integration/01i-migrating-from-jest.md)** already documents as needing manual, per-entry translation, with no automatic converter, because `moduleNameMapper`'s regex-capture-group style has no structural equivalent in `resolve.alias`'s prefix-matching style.
- **`style.postcss.plugins`** → Vite's own `css.postcss` config in `vite.config.ts`, which accepts the same PostCSS plugin objects directly — this is the one row on this list that is close to a drop-in, because Vite's PostCSS integration and CRA's (via CRACO) both wrap the same underlying `postcss` package.

## What "no automatic converter" actually means in practice

There is no tool that reads `craco.config.js` or an ejected `webpack.config.js` and emits a working `vite.config.ts`. Community migration write-ups describing real CRACO-to-Vite migrations consistently describe the same manual process this chunk lays out — reading `craco.config.js` key by key and re-implementing each behind the Vite-native option that does the same job — rather than pointing at a codemod. Budget this category of the migration as **reading and understanding time**, not typing time: the actual `vite.config.ts` entries that come out of it are usually short, but arriving at them requires understanding *why* each override existed in the first place, since some of them may no longer be necessary at all (a webpack workaround for a bug that was fixed in a dependency years ago, for instance) and porting a now-unnecessary workaround forward is wasted, confusing config.

## A complete `vite.config.ts` for a typical, non-ejected CRA app

Bringing every earlier chunk in this topic together — this is the config a realistic CRA app (env vars, a path alias, an SVG plugin, a dev proxy, PWA, Vitest) lands on:

```typescript
// vite.config.ts — complete, for a CRA app with no eject/CRACO history
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    VitePWA({
      registerType: 'prompt', // matches CRA's conservative default — see 01e
      manifest: {
        name: 'Acme Dashboard',
        short_name: 'Acme',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    // this app's tsconfig.json has a real `paths` map, not just baseUrl —
    // see 01c for when to use this vs. vite-tsconfig-paths
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  define: {
    // this app had one dependency reading process.env.NODE_ENV directly — see 01a
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

```json
// package.json — final scripts, react-scripts fully removed
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "devDependencies": {
    "vite": "^8.2.2",
    "@vitejs/plugin-react": "latest",
    "vite-plugin-svgr": "latest",
    "vite-plugin-pwa": "latest",
    "vitest": "latest"
  }
}
```

`react-scripts`, `@testing-library/jest-dom`'s Jest-specific setup (if any), and any CRACO/eject-era webpack dependencies (`webpack`, `webpack-dev-server`, `babel-loader`, and whatever the diff in the eject section above turned up as no-longer-needed) are removed entirely — none of them are dependencies of a Vite-built app.

## Gotchas

**★ Symptom: an ejected app's `config/webpack.config.js` is 500+ lines, and the team estimates the migration will take as long as reading and understanding all 500.** Cause: most of an ejected `webpack.config.js` is CRA's own boilerplate, unchanged from what `eject` produces for any app at that `react-scripts` version — the actual customizations are a small diff against that boilerplate, not the whole file. Fix: eject a fresh, unmodified scaffold at the matching `react-scripts` version and diff against it; migrate only the hunks that differ.

**★ Symptom: a `craco.config.js` `webpack.configure` callback does several unrelated things in one function body, and the team tries to find one Vite option that replaces the whole callback.** Cause: `webpack.configure` is an arbitrary escape hatch — there is no single Vite surface that corresponds to "run arbitrary code against the whole config object," because Rolldown's plugin and config model does not expose an equivalent all-at-once mutation point in the same shape. Fix: split the callback's body into its individual concerns and find the specific Vite option (or plugin) for each one separately, rather than searching for a one-to-one equivalent of the callback itself.

**★ Symptom: a `craco.config.js` `jest.configure.moduleNameMapper` entry using a regex capture group has no obvious `resolve.alias` equivalent.** Cause: identical to the Jest-migration case already documented — Jest's `moduleNameMapper` is regex-based with capture-group substitution, while `resolve.alias` matches prefixes, not arbitrary regex. Fix: translate each entry by hand, per **[14 · Migrating from Jest](../14-testing-integration/01i-migrating-from-jest.md)**'s already-documented gotcha for this exact mismatch.

**★ Symptom: a webpack workaround from years ago (a Node polyfill fallback, a specific loader version pin) gets carried into the new `vite.config.ts` even though the dependency it worked around was upgraded or removed long ago.** Cause: nobody re-evaluates *why* an override exists during a mechanical migration — only *what* it currently does. Fix: for every hunk in the eject-diff or every `craco.config.js` key, ask whether the underlying dependency or bug it addressed still exists before porting the workaround forward; a migration is the cheapest point to delete now-dead configuration, because you are already reading every line of it anyway.

**★ Symptom: after removing `react-scripts` and every CRACO/webpack dependency, `npm ls` or a lockfile diff still shows `webpack`-family packages installed.** Cause: something else in the dependency tree (a testing library, a Storybook addon, an unrelated tool) also depends on webpack directly, independent of CRA/CRACO. Fix: check `npm ls webpack` for what's still requiring it before assuming the removal was incomplete — a leftover `webpack` in the tree is not automatically a leftover CRA artifact.

## Interview questions

**★ Why is there no automated converter from a CRACO config or an ejected webpack config to a Vite config, when so much else in this migration (env vars, SVG imports) has a documented, near-mechanical translation?**
Because the earlier items in this migration are translating between two systems that both expose a small, well-known, *declarative* surface for the same job — an env var prefix, an asset import suffix — where the mapping is knowable in advance because both sides are constrained. `webpack.configure` and an ejected `webpack.config.js` are, by design, arbitrary imperative code with access to the entire webpack config object and no constraint on what it does to it. A converter would have to understand the *intent* behind arbitrary JavaScript, which is not a translation problem, it's a program-understanding problem — which is exactly why every real-world writeup of this migration describes reading the config by hand rather than pointing at a tool.

**★ A team wants to migrate an ejected CRA app and considers just deleting the ejected config wholesale and starting `vite.config.ts` from scratch, reasoning that "we'll find out what breaks." What's wrong with that approach specifically for an ejected app, compared to a non-ejected one?**
For a non-ejected CRA app, "start from scratch and see what breaks" is roughly what every chunk in this topic already describes — CRA's defaults are well-documented, so the gaps between a minimal `vite.config.ts` and a working app are the known categories (env vars, JSX extensions, aliases, SVGs). For an ejected app, the config *is* the specification of what that team needed beyond CRA's defaults — there is no other record of it, because ejecting was the point at which the team stopped relying on CRA's documented behaviour and started relying on their own, undocumented, in-repo one. Deleting it and waiting for breakage means waiting for runtime or build failures to reveal customizations that used to be enforced silently (a `DefinePlugin` constant nothing errors on the absence of, a `resolve.fallback` disabling a Node polyfill that only fails deep in one rarely-exercised code path) — the failure signal is much weaker than "read the diff first."

**★ Why is diffing an ejected app's webpack config against a freshly-ejected scaffold at the same `react-scripts` version a better strategy than reading the ejected config from the top, line by line?**
Because an ejected `webpack.config.js` is mostly CRA's own generated boilerplate — hundreds of lines that exist in every ejected app at that version, regardless of what any specific team customized. Reading it top to bottom means re-deriving "is this line CRA's default or someone's customization?" for every single line, which is exactly the question a diff answers directly and for free. The diff *is* the list of decisions a past team made on purpose; everything CRA generates identically for every app is noise a manual read has to filter out by eye, and a diff filters it out mechanically.

---

← [01e · Proxy, tests, PWA](01e-dev-proxy-tests-and-pwa.md) · [Vite overview](../../README.md) · Next → [01g · entry & output → index.html](01g-entry-output-and-base.md)
