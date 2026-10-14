---
title: "Link map · Storybook · Part 2 (phases 6–10)"
sidebar_label: "02 · testing config shipping"
sidebar_position: 2
---

# Link map · Storybook · Part 2 (phases 6–10)

Covers every topic row of phases 6 to 10 in `docs/storybook/syllabus/03-testing-with-storybook.md` (T06-01 to T08-04) and `04-configuration-and-shipping.md` (T09-01 to T10-05). That is 24 rows, each checked against the syllabus tables. Tiers are taken from those tables. Our pages for these phases are coarser than the topic rows: one page covers several rows, so several blocks point at the same page. Only T09-06 has no page of ours (a few hints sit in the advanced main and preview page: `check: false`, `reactDocgen`, an `autodocs` pitfall).
*read* = the claim appears in the fetched text (the fetch tool returns a summary, so a claim only counts as read where that summary carried it); *headings only* = fetched at 200, headings or opening checked. Dates are given only where the page shows one. No `#anchors` are given. Where no good non-official explanation was verified, the block has no "Beyond the docs" line.

🔴 **Version note.** Our syllabus targets Storybook 10. The official links below are the unversioned (current) docs on storybook.js.org (the main-config page is labelled 10.6), fetched 2026-10-14. Three things changed under older third-party pages: the test helpers moved from `@storybook/test` to `storybook/test` in 9.0 (the npm package `@storybook/test` stops at 8.6.x), the Vitest addon is now the recommended runner for Vite projects with the test-runner as the fallback, and `main.ts` must be valid ESM from 10. Picks written for 6.x to 8.x say so in their block.

🔴 **`storybook build` versus `build-storybook`.** The command is `storybook build` (CLI options page: "Compiles your Storybook instance so it can be deployed"). The npm registry lists a single executable, `storybook`, for the current release (10.6.2), so `build-storybook` is not a binary any more. It survives as the npm script name that `init` writes (ours: `"build-storybook": "storybook build"`), and several docs pages still show `npm run build-storybook`. Both spellings are therefore right, in different places.

---

## Phase 6 — Interaction testing with play functions

### T06-01 · The `play` function — Master · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · the play function is where you simulate user behaviour and assert; when a component is tested, `play` runs and its assertions are validated (*read*) · covers our angle: **partial** — states what `play` is, not the argument that demo and test cannot drift · fetched 2026-10-14
- **Beyond the docs:** [How to do interaction testing with React 18 and Storybook](https://blog.logrocket.com/interaction-testing-react-storybook/) · David Ekanem, LogRocket, 2022-08-03 · a `Form` story whose `play` types an email and password, clicks submit, then asserts a success message; written for 6.4 with `@storybook/testing-library` and `@storybook/jest`, so the imports are stale · fetched 2026-10-14 (*read*)
- **Our delta:** our page already makes the one-artifact argument (documentation, demo and regression test in one story). Its code samples still import from `@storybook/test`.

### T06-02 · `storybook/test` — the play context — Master · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [How to test UIs with Storybook](https://storybook.js.org/docs/writing-tests) · Storybook docs · its samples use `import { fn, expect } from 'storybook/test'`; the page does not explain the module (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · `expect` is imported from `storybook/test`, `fn` supplies the spy, and `userEvent` arrives as a parameter of the play function (*read*) · fetched 2026-10-14
- **Our delta:** the 9.0 rename and which names are imported versus delivered on the play context (`canvas`, `args`, `step`, `mount`). Our page notes the rename and the `canvas` and `userEvent` parameters in a version note, but its examples still import `@storybook/test` and say it "still works"; npm froze that package at 8.6.x, so the samples need the new path.

### T06-03 · `userEvent` over `fireEvent`, awaiting every interaction — Understand · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Introduction (user-event)](https://testing-library.com/docs/user-event/intro/) · Testing Library · `fireEvent` dispatches DOM events, `user-event` simulates full interactions and checks visibility and interactability; call `userEvent.setup()` before render (*read*) · covers our angle: **partial** — the page gives no reason for `await` · fetched 2026-10-14
- **Also good:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · `userEvent` methods and `expect` calls "should always be awaited" inside `play`, so they are logged and debuggable (*read*) · fetched 2026-10-14
- **Beyond the docs:** [FireEvent vs UserEvent in Testing](https://stevekinney.com/courses/testing/user-event) · Steve Kinney, last modified 2025-04-28 · typing triggers focus, keydown, keyup and change; `user.click()` returns a Promise, so the test must be async and await it (*read*) · fetched 2026-10-14
- **Our delta:** the flaky-not-failing symptom of a missing `await` inside a play function. Our page prefers `userEvent` over `fireEvent` in a table row but never describes that symptom.

### T06-04 · Assertions and spies, `waitFor` and `findBy*` — Understand · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async/) · Testing Library · `findBy` combines `getBy` with `waitFor`; defaults are 1000ms timeout and 50ms interval; the callback must throw to trigger a retry (*read*) · covers our angle: **partial** — no spies (its example uses a mock function, not the word spy) · fetched 2026-10-14
- **Also good:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · `onSubmit: fn()` as an arg, then an assertion on `args.onSubmit`; `await canvas.findByRole(...)`; the page does not mention `waitFor` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · use `find*` for anything not available right away (it is `waitFor` underneath, with better errors); keep side effects out of `waitFor` callbacks because they may run many times; no Storybook content (*read*) · fetched 2026-10-14
- **Our delta:** `toHaveBeenCalledWith` against an `fn()` arg and `findBy*` are on our page; the retry rules (1000ms, 50ms, must throw) and the no-side-effects-in-`waitFor` rule are not.

### T06-05 · Debugging in the Interactions panel — Understand · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · the panel offers UI controls to pause, resume, rewind and step through each interaction (*read*) · covers our angle: **partial** — one sentence on the controls, nothing on reading a failure · fetched 2026-10-14
- **Our delta:** reading a failure in the panel versus the CI stack trace. Our page lists "pause, step over, go to end" (no rewind) and a one-line debugging workflow; the CI comparison is not made.

---

## Phase 7 — Accessibility testing

### T07-01 · `@storybook/addon-a11y` — Master · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) · Storybook docs · built on Deque axe-core, which "automatically catches up to 57% of WCAG issues"; results land in the Accessibility panel's Violations, Passes and Incomplete tabs (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Accessibility Testing in Storybook](https://stevekinney.com/courses/storybook/accessibility-testing) · Steve Kinney, last modified 2025-04-16 · the addon adds a panel tab backed by axe-core; a test-runner setup with `axe-playwright`; written for the older test-runner path (*read*) · fetched 2026-10-14
- **Our delta:** none material.

### T07-02 · Reading a violation — Understand · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [Axe API documentation](https://www.deque.com/axe/core-documentation/api-documentation/) · Deque · `impact` is minor, moderate, serious or critical (null on a pass); `id` is the rule id; `nodes` lists the elements tested; `incomplete` holds results axe could not decide (*read*) · covers our angle: **partial** — the panel's three tabs are in the Storybook page · fetched 2026-10-14
- **Also good:** [Axe Rules: color-contrast](https://dequeuniversity.com/rules/axe/html/4.10/color-contrast) · Deque University · rule `color-contrast`, impact serious, 4.5:1 for small text and 3:1 for large (*read*) · fetched 2026-10-14
- **Our delta:** which impact levels are genuinely blocking is our judgement, not a source claim. Our page lists rule id, impact and node count in its UI table.

### T07-03 · Configuring and disabling rules — Understand · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) · Storybook docs · `parameters.a11y.config.rules` changes individual rules (`region` is off by default); `parameters.a11y.test` is `off`, `todo` or `error` (*read*) · covers our angle: **full** for the mechanics · fetched 2026-10-14
- **Our delta:** the "axe cannot see this" versus "we are hiding it" line is editorial; our page carries it in its pitfalls.

### T07-04 · A11y in CI — Know · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [The accessibility pipeline for frontend teams](https://storybook.js.org/blog/the-accessibility-pipeline-for-frontend-teams/) · Dominic Nguyen, Storybook blog, 2025-07-01 · CI tools surface every violation, fine for clean projects and noisy under inherited debt; Chromatic baselines compare new builds and flag only new or changed issues (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Accessibility Tests](https://www.chromatic.com/docs/accessibility/) · Chromatic docs · a baseline is the set of violations detected for a story; only new or changed ones are flagged (*read*) · fetched 2026-10-14
- **Also good:** [Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) · Storybook docs · in CI only stories set to `error` fail; `todo` produces no CI output (*read*) · fetched 2026-10-14
- **Our delta:** our page covers `error` and `todo` and the test-runner and Vitest paths, but has no Chromatic baseline argument (new violations only), which is the core of this row.

---

## Phase 8 — Visual regression testing

### T08-01 · Why visual regression exists — Understand · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Visual tests](https://storybook.js.org/docs/writing-tests/visual-testing) · Storybook docs · compares rendered pixels against baselines; markup snapshots compare HTML, not what the user sees, and give more false positives (*read*) · covers our angle: **partial** — names no bug classes such as tokens, margins or overflow · fetched 2026-10-14
- **Beyond the docs:** [Catching UI Bugs with Visual Regression Testing](https://blog.openreplay.com/catch-ui-bugs-visual-regression-testing/) · OpenReplay Team, 2026-06-28 · unit and end-to-end tests cannot see a wrong colour, a position shift or a button hidden by a stacking context; markup snapshots miss a colour token swap or z-index change; margins and overflow are not named (*read*) · fetched 2026-10-14
- **Our delta:** the bug class list from the syllabus (changed token, shifted margin, overflow at one breakpoint); no source names all three. Our page frames per-story baselines but does not list bug classes.

### T08-02 · Chromatic — snapshots, baselines, review and accept — Understand · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Branches and baselines](https://www.chromatic.com/docs/branching-and-baselines/) · Chromatic docs · a baseline is the last known good state of a story in a mode; baselines only update when changes are accepted (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Visual Testing with Chromatic](https://dev.to/duarten/visual-testing-with-chromatic-4i0m) · Duarte Nunes, DEV Community, 2022-03-28 · the review screen puts the previous snapshot on the left and the changed one on the right; `main` runs with `--auto-accept-changes` because the PR already reviewed it (*read*) · fetched 2026-10-14
- **Our delta:** none material; our page covers accept as new baseline and review discipline.

### T08-03 · Making snapshots deterministic — Understand · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Unstable tests debugging](https://www.chromatic.com/docs/unstable-tests/) · Chromatic docs · randomness, current date, web fonts, animations, slow resources, late UI settling; fixes include seedrandom, mockdate and static preloaded fonts (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Delay](https://www.chromatic.com/docs/delay/) · Chromatic docs · a fixed minimum wait before capture; prefer assertions or `play`, which Chromatic waits on (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Spurious/flaky diffs](https://docs.happo.io/docs/legacy/spurious-diffs) · Happo docs, legacy section, undated · the same causes from another vendor: freeze dates with mockdate, hide random values, disable animations, host fonts locally (*read*) · fetched 2026-10-14
- **Our delta:** our page covers `delay`, fonts, `disableSnapshot` and ignore regions; it has no mockdate or seedrandom recipe, which this row needs.

### T08-04 · Cost control and `chromatic.disableSnapshot` — Know · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Disable snapshots](https://www.chromatic.com/docs/disable-snapshots/) · Chromatic docs · `chromatic: { disableSnapshot: true }` at story, component or project level; the story stays indexed in the Library (*read*) · covers our angle: **partial** — no billing figures · fetched 2026-10-14
- **Also good:** [Billing](https://www.chromatic.com/docs/billing/) · Chromatic docs · captured costs 1, TurboSnap copied 0.2, bypassed 0; `disableSnapshot` costs 0; ignored regions are still billed; interaction tests are not billed (*read*) · fetched 2026-10-14
- **Our delta:** our page shows `disableSnapshot` and TurboSnap but none of the billing figures above.

---

## Phase 9 — Configuration, builders and CI

### T09-01 · `main.ts` — Master · ✅ written `docs/storybook/pages/13-build-and-configuration/01-storybook-main.md`
- **Read this:** [Main configuration](https://storybook.js.org/docs/api/main-config/main-config) · Storybook docs · "This file must be valid ESM": use `import`, no `__dirname` or `__filename`; `stories` and `framework` required, `addons` and `staticDirs` optional (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Configure Storybook](https://storybook.js.org/docs/configure) · Storybook docs · what each of `main`, `preview` and `manager` is for (*read*) · fetched 2026-10-14
- **Also good:** [Storybook is going ESM-only](https://storybook.js.org/blog/storybook-is-going-esm-only/) · Norbert de Langen, Storybook blog, 2025-09-22 · config and story files must be valid ESM from 10; needs Node 20.16, 22.19 or 24 for `require()` of ESM (*read*) · fetched 2026-10-14
- **Our delta:** the 8.x to 10.x `require()` migration story. Our three configuration pages have no ESM or `require()` section at all, and the main page is written against `main.js`.

### T09-02 · `preview.ts` — Understand · ✅ written `docs/storybook/pages/13-build-and-configuration/02-advanced-main-and-preview-customization.md`
- **Read this:** [Configure Storybook](https://storybook.js.org/docs/configure) · Storybook docs · `preview` controls story rendering and exports `decorators`, `parameters` and `globalTypes` (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Toolbars & globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) · Storybook docs · `globalTypes` define toolbar menus; `initialGlobals` sets starting values; decorators read `context.globals` (*read*) · fetched 2026-10-14
- **Our delta:** why a thin `preview.ts` keeps every story cheap. Neither the docs nor our page argues it; our page covers decorators, parameters, globalTypes and `initialGlobals` but not the weight argument.

### T09-03 · `manager.ts` — Know · ✅ written `docs/storybook/pages/13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md`
- **Read this:** [Theming](https://storybook.js.org/docs/configure/user-interface/theming) · Storybook docs · `addons.setConfig` in `manager`; `create()` from `storybook/theming`; "The theme is replaced, not combined" (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none material.

### T09-04 · Environment variables — Understand · ✅ written `docs/storybook/pages/13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md`
- **Read this:** [Environment variables](https://storybook.js.org/docs/configure/environment-variables) · Storybook docs · only `STORYBOOK_` variables are exposed; Webpack gives `process.env`, the Vite builder `import.meta.env`; values are embedded in the build; `.env.development` and `.env.production` per mode (*read*) · covers our angle: **partial** — nothing on the app's own `.env` not carrying over · fetched 2026-10-14
- **Our delta:** why the app's `.env` is not the preview's, and the `undefined` that follows. Our page covers the prefix and both access forms but not that failure; it also names `.env.storybook`, which the docs page does not list.

### T09-05 · `@storybook/test-runner` — Understand · ✅ written `docs/storybook/pages/11-testing-integration/01-test-runner.md`
- **Read this:** [Test runner](https://storybook.js.org/docs/writing-tests/integrations/test-runner) · Storybook docs · Jest plus Playwright; a story with `play` also fails on errors or failed assertions; CI builds with `build-storybook`, serves `storybook-static`, runs `test-storybook`; "superseded by the Vitest addon" (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Migrating to Vitest addon from test-runner](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon/migration-guide) · Storybook docs · stories need no change; no build step; Vite builder frameworks only, Angular and Webpack stay on the test-runner (*read*) · fetched 2026-10-14
- **Also good:** [Continuous Integration](https://playwright.dev/docs/ci) · Playwright docs · `npx playwright install --with-deps` in CI, plus a pre-built Docker image (*read*) · fetched 2026-10-14
- **Our delta:** our page has no Vitest addon comparison.

### T09-06 · Build performance — Understand · 🔲 not written
- **Read this:** [How to make Storybook 2-4x faster](https://storybook.js.org/blog/optimize-storybook-7-6) · Kasper Peulen, Storybook blog, 2023-12-20, updated 2025-05-27 · TypeScript-based docgen is slow and `react-docgen` is faster; `--test` builds skip docgen and docs; reports 25% to 50% gains and 2-4x for test builds (*read*) · covers our angle: **partial** — written for 7.6; nothing on glob breadth or a heavy `preview.ts` · fetched 2026-10-14
- **Beyond the docs:** [Improve local Storybook performance (pull request 10762)](https://github.com/linode/manager/pull/10762) · hana-akamai, Linode Cloud Manager, merged 2024-08-27 · `react-docgen-typescript` was parsing every file; limiting it to files with stories cut load from over a minute to about 30 seconds on the author's machine, reviewers saw smaller or mixed gains (*read*) · fetched 2026-10-14
- **Our delta:** page not written; glob breadth and `preview.ts` weight have no source here. The advanced main and preview page has scattered hints only.

---

## Phase 10 — Design systems and shipping

### T10-01 · Storybook as the design system hub — Understand · ✅ written `docs/storybook/pages/10-composition-and-design-systems/01-storybook-as-a-design-system-hub.md`
- **Read this:** [Design integrations](https://storybook.js.org/docs/sharing/design-integrations) · Storybook docs · links stories to design tools: Storybook Connect for Figma (needs a Chromatic-published Storybook), the Designs addon, the Zeplin addon; no mention of QA (*read*) · covers our angle: **partial** — design and engineering only · fetched 2026-10-14
- **Beyond the docs:** [A UX designer's guide to Storybook](https://blog.logrocket.com/ux-design/ux-designers-guide-storybook) · Eric Chung, LogRocket, 2024-04-15 · Figma and code become "two sources of truth" when teams work in silos; Storybook is the one place both can contribute; QA is not named (*read*) · fetched 2026-10-14
- **Our delta:** the shared vocabulary across QA too, and what the hub replaces. Our page covers token stories and variant matrices; it does not mention the design-tool links.

### T10-02 · Composition via `refs` — Know · ✅ written `docs/storybook/pages/10-composition-and-design-systems/01-storybook-as-a-design-system-hub.md`
- **Read this:** [Storybook Composition](https://storybook.js.org/docs/sharing/storybook-composition) · Storybook docs · `refs` in `main` takes a title and URL; `refs` can be a function of the config; addons "will not work as they normally do" in composed Storybooks (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Storybook Composition](https://www.chromatic.com/blog/storybook-composition/) · Dominic Nguyen, Chromatic blog, 2020-06-24, updated 2020-09-02 · why hundreds of components scattered across Storybooks hurt reuse; `refs` with a Chromatic permalink; written for 6.0 and `main.js` (*read*) · fetched 2026-10-14
- **Our delta:** our page shows `refs` with title and URL only; the function form and the addon caveat are not on it.

### T10-03 · Building and publishing a static Storybook — Understand · ✅ written `docs/storybook/pages/14-publishing-and-deployment/01-shipping-a-static-storybook.md`
- **Read this:** [Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook) · Storybook docs · build a static app any web server can host; Chromatic recommended; "whenever you open a PR you'll get a handy link"; the page shows `npm run build-storybook` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [CLI options](https://storybook.js.org/docs/api/cli-options) · Storybook docs · `storybook build [options]`, run from the project root; `--test` for a stripped build (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Super GitHub Pages: budget frontend staging, with Storybook and more](https://evilmartians.com/chronicles/super-github-pages-budget-frontend-staging-with-storybook-and-more) · Ekaterina Shibakova and Travis Turner, Evil Martians, 2023-08-04 · a workflow builds Storybook into a folder named after the branch on a Pages branch, posts the link on the PR, and a second workflow removes it on close; no Storybook version given (*read*) · fetched 2026-10-14
- **Our delta:** none on the command: our page's script is `"build-storybook": "storybook build"`, matching the CLI page. Its Chromatic per-PR link is covered; a self-hosted per-PR preview is not.

### T10-04 · Bootstrapping into an existing app — Master · ✅ written `docs/storybook/pages/16-real-world-workflows-and-recipes/01-bootstrapping-into-an-existing-app.md`
- **Read this:** [Install Storybook](https://storybook.js.org/docs/get-started/install) · Storybook docs · `npm create storybook@latest`; `--type`, `--package-manager` and `--features` flags; no monorepo coverage (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Storybook](https://turborepo.dev/docs/guides/tools/storybook) · Turborepo docs · a dedicated Storybook app, UI package installed by workspace filter, optional co-located stories (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Migrating from Styleguidist to Storybook](https://engineeringblog.yelp.com/2022/07/migrating-from-styleguidist-to-storybook.html) · Kedar Vaidya and Benson Pan, Yelp Engineering, 2022-07-06 · codemods turned thousands of Styleguidist files in a React monorepo into stories without blocking developers (*read*) · fetched 2026-10-14
- **Our delta:** which components to story first, and avoiding the "later" trap; no source found. Our page covers provider wiring after `init` but has no monorepo section and no ordering advice.

### T10-05 · The component-driven workflow end to end — Know · ✅ written `docs/storybook/pages/15-advanced-patterns/01-component-driven-workflow.md`
- **Read this:** [Component Driven User Interfaces](https://www.componentdriven.org/) · componentdriven.org · bottom-up: build one component at a time, combine, assemble pages with mock data, then integrate with backend services (*read*) · covers our angle: **partial** — no static-build review step · fetched 2026-10-14
- **Also good:** [Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook) · Storybook docs · the published build and PR link supply the review step (*read*) · fetched 2026-10-14
- **Our delta:** review the static build before assembling into the app. Our page covers outside-in development and PR merge gates; the static-build review is only implied.
