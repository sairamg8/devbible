---
title: "Link map · Storybook · Part 1 (phases 0–5)"
sidebar_label: "01 · how it runs and composing"
sidebar_position: 1
---

# Link map · Storybook · Part 1 (phases 0–5)

Covers every topic row of phases 0 to 5 in `docs/storybook/syllabus/01-how-storybook-runs.md` (T00-01 to T02-06) and `docs/storybook/syllabus/02-composing-stories.md` (T03-01 to T05-06). That is 34 rows. Phases 0 to 3 have a page of ours each. Phases 4 and 5 map onto older chapter pages (`08-documentation`, `13-build-and-configuration`, `17-theming-colors-and-fonts`) that cover them only in part; rows with no matching page are marked not written.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200 and only the headings or opening were confirmed. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages were verified 2026-08-14. Official links are the current storybook.js.org docs (the 10.x line; the page chrome showed 10.3 and 10.4 beta). Several third-party picks predate Storybook 8 and use `@storybook/test`, `DecoratorFn` or `ComponentMeta`; each such block says so. In the 10 docs the packages are `storybook/test`, `storybook/theming` and `storybook/manager-api`, and doc blocks come from `@storybook/addon-docs/blocks`. Tier tag `[vite]` on T00-04 is shown as Understand and `[use]` on T04-05 as When Needed.

---

## Phase 0 — What Storybook is and how it runs

### T00-01 · What Storybook is — Master · ✅ written `docs/storybook/pages/phase-0-how-storybook-runs/01-what-storybook-is.md`
- **Read this:** [Why Storybook?](https://storybook.js.org/docs/get-started/why-storybook) · Storybook docs · isolated iframe free of app logic, a story as one declared variation, every state reachable without reproducing it in the app (*read*) · covers our angle: **partial** — no URL-addressability point · fetched 2026-10-14
- **Also good:** [Get started with Storybook](https://storybook.js.org/docs) · Storybook docs · the "frontend workshop for building UI components and pages in isolation" definition (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Component Driven User Interfaces](https://www.componentdriven.org/) · Chromatic and contributors, no date shown · the bottom-up method (component, then screen, then page) that the workshop idea comes from · fetched 2026-10-14 (*read*)
- **Our delta:** every story as a URL and the "without booting the app" framing.

### T00-02 · Two processes: manager and preview — Understand · ✅ written `docs/storybook/pages/phase-0-how-storybook-runs/02-manager-and-preview.md`
- **Read this:** [Configure Storybook](https://storybook.js.org/docs/configure) · Storybook docs · `preview.js` runs in the preview iframe, `manager.js` configures the UI, `main.js` the project (*read*) · covers our angle: **partial** — never says which side an error belongs to · fetched 2026-10-14
- **Also good:** [Types of addons](https://storybook.js.org/docs/addons/addon-types) · Storybook docs · panels, toolbars and tabs live in `manager.js`; it does not explain the two environments (*headings only*) · fetched 2026-10-14
- **Our delta:** triage by symptom: which process an error belongs to. No good non-official explainer found.

### T00-03 · The renderer architecture — Know · ✅ written `docs/storybook/pages/phase-0-how-storybook-runs/03-renderers-and-builders.md`
- **Read this:** [Framework support](https://storybook.js.org/docs/configure/integration/frameworks) · Storybook docs · frameworks auto-configure a builder plus renderer; the table groups frameworks by Webpack and Vite (*read*) · covers our angle: **partial** — the word "renderer" is not used, and why the story format is identical is not argued · fetched 2026-10-14
- **Beyond the docs:** [How to use the Storybook Framework API](https://blog.logrocket.com/use-storybook-framework-api) · Chak Shun Yu, LogRocket, 2023-05-19 · defines builder, renderer and framework package and shows the `preset.js` that pairs them; pre-8 era · fetched 2026-10-14 (*read*)
- **Our delta:** one core, swappable renderers, and the CSF consequence.

### T00-04 · Builders: Vite vs Webpack 5 — Understand · ✅ written `docs/storybook/pages/phase-0-how-storybook-runs/03-renderers-and-builders.md`
- **Read this:** [Storybook for React with Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite) · Storybook docs · `@storybook/react-vite`, requirements (React 16.8+, Vite 5+), the `builder` option, migrating from the webpack framework (*read*) · covers our angle: **partial** — no word on how aliases and env vars resolve · fetched 2026-10-14
- **Also good:** [Framework support](https://storybook.js.org/docs/configure/integration/frameworks) · Storybook docs · lists which frameworks sit on Webpack and which on Vite (*read*) · fetched 2026-10-14
- **Our delta:** aliases and env vars follow the builder you already use.

### T00-05 · `storybook init` into an existing app — Master · ✅ written `docs/storybook/pages/phase-0-how-storybook-runs/04-installing-into-an-existing-app.md`
- **Read this:** [Install Storybook](https://storybook.js.org/docs/get-started/install) · Storybook docs · what the installer detects (package manager, framework), `--type` and `--package-manager` overrides, what it adds (scripts, config, boilerplate stories) (*read*) · covers our angle: **partial** — no file list and no monorepo coverage · fetched 2026-10-14
- **Beyond the docs:** [Using Storybook in a Monorepo](https://dev.to/kamranayub/using-storybook-in-a-monorepo-38l0) · Kamran Ayub, DEV Community, 2019-09-17 · story discovery cannot loop over packages and a broad glob matches nested `node_modules`; Webpack-era, so use it for the idea only · fetched 2026-10-14 (*read*)
- **Our delta:** the three monorepo mistakes. A Turborepo walkthrough turned up in search but was not fetched.

### T00-06 · Storybook 10 and the 9.0 package consolidation — Master · ✅ written `docs/storybook/pages/phase-0-how-storybook-runs/05-storybook-10-and-package-consolidation.md`
- **Read this:** [Addon migration guide for Storybook 10.0](https://storybook.js.org/docs/addons/addon-migration-guide) · Storybook docs · says `addon-essentials`, `addon-interactions`, `addon-links` and `blocks` are empty since 9 and no longer published; ESM-only builds (*read*) · covers our angle: **partial** — no full `@storybook/*` to `storybook/*` map · fetched 2026-10-14
- **Also good:** [Migration guide for Storybook 10](https://storybook.js.org/docs/releases/migration-guide) · Storybook docs · ESM-only, Node 20.19+ or 22.12+, valid-ESM config; defers the package map to GitHub notes (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Storybook is going ESM-only](https://storybook.js.org/blog/storybook-is-going-esm-only/) · Norbert de Langen, Storybook blog, 2025-09-22 · the why behind ESM-only; it names 20.16, 22.19 and 24 as the floor, which differs from the migration guide's 20.19 and 22.12, so trust the guide · fetched 2026-10-14 (*read*)
- **Our delta:** the import map and the Node floor, taken from the migration guide.

## Phase 1 — The story format

### T01-01 · Component Story Format (CSF) — Master · ✅ written `docs/storybook/pages/phase-1-story-format/01-component-story-format.md`
- **Read this:** [Component Story Format (CSF)](https://storybook.js.org/docs/api/csf) · Storybook docs · default export is metadata, every named export is a story, `includeStories` and `excludeStories` (*read*) · covers our angle: **partial** — not why it is a module · fetched 2026-10-14
- **Beyond the docs:** [Component Story Format 3 is here](https://storybook.js.org/blog/storybook-csf3-is-here/) · Michael Shilman, Storybook blog, 2023-01-25 · stories become objects, `render` optional, `play` attached to a story · fetched 2026-10-14 (*read*)
- **Our delta:** why a module and not a config file.

### T01-02 · File structure and the stories glob — Master · ✅ written `docs/storybook/pages/phase-1-story-format/02-file-structure-and-the-glob.md`
- **Read this:** [stories (main config)](https://storybook.js.org/docs/api/main-config/main-config-stories) · Storybook docs · array of globs or a `directory`/`files`/`titlePrefix` object, picomatch syntax, default `files` pattern (*read*) · covers our angle: **partial** — does not say what a non-matching file does · fetched 2026-10-14
- **Also good:** [How to write stories](https://storybook.js.org/docs/writing-stories) · Storybook docs · where to put stories, beside the component (*read*) · fetched 2026-10-14
- **Our delta:** the silent "file outside the glob does not exist" failure. No good non-official source found.

### T01-03 · Typing stories — Understand · ✅ written `docs/storybook/pages/phase-1-story-format/03-typing-stories.md`
- **Read this:** [Writing stories in TypeScript](https://storybook.js.org/docs/writing-stories/typescript) · Storybook docs · `Meta`, `StoryObj`, `satisfies`, passing `typeof meta` (*read*) · covers our angle: **full** — fetched 2026-10-14
- **Beyond the docs:** [Improved type safety in Storybook 7](https://storybook.js.org/blog/improved-type-safety-in-storybook-7/) · Kasper Peulen, Storybook blog, 2023-02-08 · why `satisfies` catches missing required args that old types missed; TypeScript 4.9+ · fetched 2026-10-14 (*read*)
- **Our delta:** none beyond the 10.x CSF factories note.

### T01-04 · CSF factories — Understand · ✅ written `docs/storybook/pages/phase-1-story-format/04-csf-factories.md`
- **Read this:** [Component Story Format (CSF Next)](https://storybook.js.org/docs/api/csf/csf-next) · Storybook docs · `definePreview`, `preview.meta`, `meta.story`; labelled a preview feature; React, Vue, Angular and Web Components tabs (*read*) · covers our angle: **full** — the old `csf-factories` URL returned 404, so the page is now named CSF Next · fetched 2026-10-14
- **Our delta:** the docs say "preview"; our syllabus says experimental, and CSF 1/2/3 stay supported. No third-party explainer worth linking.

### T01-05 · Naming, `title` and the sidebar — Understand · ✅ written `docs/storybook/pages/phase-1-story-format/05-naming-and-the-sidebar.md`
- **Read this:** [Naming components and hierarchy](https://storybook.js.org/docs/writing-stories/naming-components-and-hierarchy) · Storybook docs · slash paths, roots, single-story hoisting, `storySort` function and object forms (*read*) · covers our angle: **partial** — tags are on a separate page · fetched 2026-10-14
- **Also good:** [Tags](https://storybook.js.org/docs/writing-stories/tags) · Storybook docs · built-in tags, applying and removing, sidebar filtering (*read*) · fetched 2026-10-14
- **Our delta:** none. Search returned only copies of the official page.

### T01-06 · Reusing stories — Know · ✅ written `docs/storybook/pages/phase-1-story-format/06-reusing-stories.md`
- **Read this:** [Portable stories in Vitest](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest) · Storybook docs · `composeStories`, `composeStory`, `setProjectAnnotations`, `run()` (*read*) · covers our angle: **full** for the test side · fetched 2026-10-14
- **Also good:** [Args](https://storybook.js.org/docs/writing-stories/args) · Storybook docs · args composition by spreading `Primary.args` and across files (*read*) · fetched 2026-10-14
- **Also good:** [Portable stories in Jest](https://storybook.js.org/docs/api/portable-stories/portable-stories-jest) · Storybook docs · same API for Jest (*read*) · fetched 2026-10-14
- **Our delta:** none. No stronger third-party piece found.

## Phase 2 — Args, argTypes and controls

### T02-01 · Args as the source of truth — Master · ✅ written `docs/storybook/pages/phase-2-args-and-controls/01-args-as-the-source-of-truth.md`
- **Read this:** [How to write stories](https://storybook.js.org/docs/writing-stories) · Storybook docs · args as the generic term for props, `render` should spread `args` so Controls keep working (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Args](https://storybook.js.org/docs/writing-stories/args) · Storybook docs · story, component and global args, setting args by URL (*headings only*) · fetched 2026-10-14
- **Our delta:** none. Search turned up only low-quality skill-file pages.

### T02-02 · `argTypes` and inference — Understand · ✅ written `docs/storybook/pages/phase-2-args-and-controls/02-argtypes-and-inference.md`
- **Read this:** [ArgTypes](https://storybook.js.org/docs/api/arg-types) · Storybook docs · control types, `options`, `mapping`, automatic inference from react-docgen or vue-docgen-api, manual override wins (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Improving ArgTypes with Metadata](https://stevekinney.com/courses/storybook/arg-types) · Steve Kinney, course page, modified 2025-04-16 · a worked case of inference missing a default and the manual fix · fetched 2026-10-14 (*read*)
- **Our delta:** the three cases (unions, callbacks, `.d.ts` types) as a checklist.

### T02-03 · The Controls panel — Understand · ✅ written `docs/storybook/pages/phase-2-args-and-controls/03-the-controls-panel.md`
- **Read this:** [Controls](https://storybook.js.org/docs/essentials/controls) · Storybook docs · `control: false` keeps the docs row, `table.disable` drops control and docs, `include`, `exclude`, `disable` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [ArgTypes](https://storybook.js.org/docs/api/arg-types) · Storybook docs · `control: false` and `table.disable` defined (*read*) · fetched 2026-10-14
- **Our delta:** the designer-review angle. No better third-party page found.

### T02-04 · Actions and spies — Master · ✅ written `docs/storybook/pages/phase-2-args-and-controls/04-actions-and-spies.md`
- **Read this:** [Actions](https://storybook.js.org/docs/essentials/actions) · Storybook docs · `fn()` from `storybook/test` as the recommended way; `argTypesRegex` discouraged because inferred args are not spies in `play` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none. The Storybook Test blog URL I tried returned 404, so it is not linked.

### T02-05 · Globals and toolbars — Understand · ✅ written `docs/storybook/pages/phase-2-args-and-controls/05-globals-and-toolbars.md`
- **Read this:** [Toolbars and globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) · Storybook docs · `globalTypes` toolbar annotation, `context.globals`, rerun of decorators on change (*read*) · covers our angle: **partial** — does not say where the state is stored · fetched 2026-10-14
- **Beyond the docs:** [How to add a theme switcher to Storybook](https://storybook.js.org/blog/how-to-add-a-theme-switcher-to-storybook/) · Yann Braga, Storybook blog, 2022-06-22 · global decorator reading `parameters.theme` then `globals.theme`, side-by-side mode; Storybook 6 era APIs · fetched 2026-10-14 (*read*)
- **Our delta:** where the state lives.

### T02-06 · Parameters and the merge order — Understand · ✅ written `docs/storybook/pages/phase-2-args-and-controls/06-parameters-and-merge-order.md`
- **Read this:** [Parameters](https://storybook.js.org/docs/api/parameters) · Storybook docs · project, then meta, then story; objects deep-merge, arrays are replaced (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the "did not apply" debugging recipe. No good non-official source found.

## Phase 3 — Decorators and context

### T03-01 · What a decorator is — Master · ✅ written `docs/storybook/pages/phase-3-decorators/01-what-a-decorator-is.md`
- **Read this:** [Decorators](https://storybook.js.org/docs/writing-stories/decorators) · Storybook docs · wrap a story in extra markup, story/component/global levels (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Mocking providers](https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-providers) · Storybook docs · a `ThemeProvider` global decorator (*read*) · fetched 2026-10-14
- **Our delta:** the provider-tree comparison.

### T03-02 · The three levels and their order — Understand · ✅ written `docs/storybook/pages/phase-3-decorators/02-decorator-order.md`
- **Read this:** [Decorators](https://storybook.js.org/docs/writing-stories/decorators) · Storybook docs · lists global, then component, then story-innermost-outward order, and a "Decorator inheritance" section (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** reasoning about a double-wrapped story. No good non-official source found.

### T03-03 · Providers in decorators — Master · ✅ written `docs/storybook/pages/phase-3-decorators/03-providers-in-decorators.md`
- **Read this:** [Mocking providers](https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-providers) · Storybook docs · apply a mock provider to all stories from `preview.tsx`, vary it per story through `parameters` (*read*) · covers our angle: **partial** — only a theme provider is shown · fetched 2026-10-14
- **Beyond the docs:** [How to build connected components in Storybook](https://storybook.js.org/blog/how-to-build-connected-components-in-storybook/) · Varun Vachhar, Storybook blog, 2022-07-06 · a mock Redux store fed different state per story through decorators; older APIs · fetched 2026-10-14 (*read*)
- **Our delta:** router, i18n and TanStack Query client in one `preview.ts`. The search also returned a Storybook TanStack blog post that was not fetched.

### T03-04 · The story context — Understand · ✅ written `docs/storybook/pages/phase-3-decorators/04-the-story-context.md`
- **Read this:** [Decorators](https://storybook.js.org/docs/writing-stories/decorators) · Storybook docs · the second argument holds `args`, `argTypes`, `globals`, `hooks`, `parameters`, `viewMode` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Toolbars and globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) · Storybook docs · branching on `context.globals.theme` (*read*) · fetched 2026-10-14
- **Our delta:** none.

### T03-05 · `loaders` and `beforeEach` — Know · ✅ written `docs/storybook/pages/phase-3-decorators/05-loaders-and-beforeeach.md`
- **Read this:** [Loaders](https://storybook.js.org/docs/writing-stories/loaders) · Storybook docs · loaders are an "escape hatch", results land in `loaded`, later levels win (*read*) · covers our angle: **partial** — no mention of `beforeEach` on this page · fetched 2026-10-14
- **Beyond the docs:** [Loaders (Building Design Systems in Storybook)](https://stevekinney.com/courses/storybook/loaders) · Steve Kinney, course page, modified 2025-04-16 · a loader fetches, a decorator consumes `loaded`; no `beforeEach` either · fetched 2026-10-14 (*read*)
- **Our delta:** `beforeEach`, and why a decorator is the wrong place for a `fetch`.

## Phase 4 — Documentation

### T04-01 · Autodocs — Master · ✅ written `docs/storybook/pages/08-documentation/01-docs-generation.md`
- **Read this:** [Automatic documentation and Storybook](https://storybook.js.org/docs/writing-docs/autodocs) · Storybook docs · `tags: ['autodocs']` per component or project-wide, `!autodocs` opt-out (*read*) · covers our angle: **partial** — "two sources" is only implied · fetched 2026-10-14
- **Also good:** [Tags](https://storybook.js.org/docs/writing-stories/tags) · Storybook docs · `autodocs` is built in but not applied by default (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Storybook 7 Docs: New architecture, streamlined UX, and readymade doc blocks](https://storybook.js.org/blog/storybook-7-docs/) · Tom Coleman, Storybook blog, 2023-02-22 · the component-not-story idea behind autodocs; written for 7, so the `docs.autodocs` option it names is gone · fetched 2026-10-14 (*read*)
- **Our delta:** the two sources, types and stories.

### T04-02 · Doc blocks — Understand · ✅ written `docs/storybook/pages/08-documentation/01-docs-generation.md`
- **Read this:** [Doc blocks](https://storybook.js.org/docs/writing-docs/doc-blocks) · Storybook docs · the block list and the `@storybook/addon-docs/blocks` import path (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Controls (doc block)](https://storybook.js.org/docs/api/doc-blocks/doc-block-controls) · Storybook docs · same import path confirmed for `Controls` (*read*) · fetched 2026-10-14
- **Our delta:** the moved import is the main point. No better third-party page found.

### T04-03 · MDX pages — Understand · ✅ written `docs/storybook/pages/08-documentation/01-docs-generation.md`
- **Read this:** [MDX](https://storybook.js.org/docs/writing-docs/mdx) · Storybook docs · attached versus unattached pages, `Meta` props, remove the autodocs tag when overriding (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Meta (doc block)](https://storybook.js.org/docs/api/doc-blocks/doc-block-meta) · Storybook docs · `of`, `title`, `name`, `isTemplate` (*read*) · fetched 2026-10-14
- **Also good:** [How to document components](https://storybook.js.org/docs/writing-docs) · Storybook docs · autodocs as baseline, MDX for free-form (*read*) · fetched 2026-10-14
- **Our delta:** a decision rule for when a hand-written page beats autodocs.

### T04-04 · Docgen and the missing prop description — Understand · ✅ written `docs/storybook/pages/08-documentation/01-docs-generation.md`
- **Read this:** [typescript (main config)](https://storybook.js.org/docs/api/main-config/main-config-typescript) · Storybook docs · `reactDocgen` chooses `react-docgen` (fast, incomplete), `react-docgen-typescript` (slow, accurate) or off; `propFilter` (*read*) · covers our angle: **partial** — never lists the four missing-prop cases · fetched 2026-10-14
- **Our delta:** the four causes. Search found only GitHub issues (for example a case of types in a separate file); none was fetched.

### T04-05 · Writing docs a designer will actually read — When Needed · 🔲 not written
- **Read this:** [MDX](https://storybook.js.org/docs/writing-docs/mdx) · Storybook docs · unattached pages and `Meta` for prose-first guidance (*read*) · covers our angle: **partial** — nothing on usage/don't-use pairs · fetched 2026-10-14
- **Our delta:** usage and don't-use pairs over prop tables. Search surfaced a Grafana contributor style guide and a WordPress design-system feedback post; neither was fetched, so neither is linked.

## Phase 5 — Theming, colors and fonts

### T05-01 · Two different things are called "theme" — Master · ✅ written `docs/storybook/pages/17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md`
- **Read this:** [Theming](https://storybook.js.org/docs/configure/user-interface/theming) · Storybook docs · manager theme via `addons.setConfig` in `manager.js`, docs theme separately in `preview` under `parameters.docs.theme`; says nothing about the app's own tokens (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Configure Storybook](https://storybook.js.org/docs/configure) · Storybook docs · `preview.js` versus `manager.js` (*read*) · fetched 2026-10-14
- **Our delta:** app tokens versus UI chrome, and why they never share a variable. No third-party source stated it.

### T05-02 · Theming the manager — Understand · ✅ written `docs/storybook/pages/13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md`
- **Read this:** [Theming](https://storybook.js.org/docs/configure/user-interface/theming) · Storybook docs · `themes` and `create()` from `storybook/theming`, `brandTitle`, `brandImage`, a theme replaces rather than merges (*read*) · covers our angle: **full** · the examples use `manager.js`, ours says `manager.ts` · fetched 2026-10-14
- **Beyond the docs:** [How to Customize the Storybook React Theme for Your Brand](https://www.newline.co/courses/storybook-for-react-apps/theming-the-storybook-app) · newline course lesson, no author or date shown · a manager file, dark theme, `create`, and `manager-head.html` for a favicon; version unknown · fetched 2026-10-14 (*read*)
- **Our delta:** the `@storybook/theming` to `storybook/theming` move.

### T05-03 · Getting design tokens into every story — Understand · ✅ written `docs/storybook/pages/17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md`
- **Read this:** [Styling and CSS](https://storybook.js.org/docs/configure/styling-and-css) · Storybook docs · imports in `preview` get hot reload; `preview-head.html` does not; tags go to the iframe, not the manager (*read*) · covers our angle: **full** for the hot-reload point · fetched 2026-10-14
- **Also good:** [Story rendering](https://storybook.js.org/docs/configure/story-rendering) · Storybook docs · code in `preview` runs for every story, `preview-head.html` and `preview-body.html` (*read*) · fetched 2026-10-14
- **Our delta:** the decorator route. No good non-official source found.

### T05-04 · A working theme switcher — Understand · ✅ written `docs/storybook/pages/17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md`
- **Read this:** [Toolbars and globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) · Storybook docs · `globalTypes` toolbar plus a decorator reading `context.globals.theme` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Themes (addon)](https://storybook.js.org/addons/@storybook/addon-themes) · Storybook integrations · the packaged option; override with `globals: theme` per story (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to add a theme switcher to Storybook](https://storybook.js.org/blog/how-to-add-a-theme-switcher-to-storybook/) · Yann Braga, Storybook blog, 2022-06-22 · hand-rolled decorator with a side-by-side mode; Storybook 6 era · fetched 2026-10-14 (*read*)
- **Our delta:** one global decorator and no per-story prop.

### T05-05 · Custom fonts — Understand · ✅ written `docs/storybook/pages/17-theming-colors-and-fonts/02-custom-fonts-and-typography.md`
- **Read this:** [Images, fonts, and assets](https://storybook.js.org/docs/configure/integration/images-and-assets) · Storybook docs · `staticDirs`, then a `preview-head.html` link to the font (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Font loading](https://www.chromatic.com/docs/font-loading) · Chromatic docs · preload tags, local `@font-face`, checking `document.fonts` in a loader (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Using fonts in Storybook for Next.JS and Tailwind Projects](https://dev.to/timreach/using-fonts-in-storybook-for-nextjs-and-tailwind-projects-4f1p) · timreach, DEV Community, 2024-02-29 · why the font loads in the app (root layout) but not in the iframe, and the `preview-head.html` fix · fetched 2026-10-14 (*read*)
- **Our delta:** CDN versus self-hosted trade-offs.

### T05-06 · Dark mode across both processes — Understand · ✅ written `docs/storybook/pages/17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md`
- **Read this:** [storybook-dark-mode](https://storybook.js.org/addons/storybook-dark-mode) · Storybook integrations (community addon) · class on the manager plus class on the preview body, `classTarget`, `stylePreview`, `useDarkMode` hook (*read*) · covers our angle: **full** · supported Storybook versions are not stated on the page; forks exist for 9 and 10 · fetched 2026-10-14
- **Also good:** [Theming](https://storybook.js.org/docs/configure/user-interface/theming) · Storybook docs · built-in light, dark and a normal theme that follows the user's scheme (*read*) · fetched 2026-10-14
- **Our delta:** keeping manager and preview in step without the community addon. The npm page for the addon returned 403 and is not linked.
