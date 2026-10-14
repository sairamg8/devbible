---
title: "Link map · Storybook · Part 2 (phases 6–10)"
sidebar_label: "02 · testing config shipping"
sidebar_position: 2
---

# Link map · Storybook · Part 2 (phases 6–10)

Covers every topic row of phases 6 to 10 in `docs/storybook/syllabus/03-testing-with-storybook.md` (T06-01 to T08-04) and `04-configuration-and-shipping.md` (T09-01 to T10-05). That is 24 rows. Tiers are taken from the syllabus tables. Our pages for these phases are coarser than the topic rows: one page covers several rows, so several blocks point at the same page. Only T09-06 has no page of ours.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200, headings or opening checked. Dates are given only where the page shows one. No `#anchors` are given. Where no good non-official explanation was verified, the block has no "Beyond the docs" line.

🔴 **Version note.** Our syllabus targets Storybook 10. The official links below are the unversioned (current) docs on storybook.js.org, fetched 2026-10-14. Two things changed under older third-party pages: the test helpers moved from `@storybook/test` to `storybook/test` in 9.0, and the Vitest addon is now the recommended runner for Vite projects, with the test-runner as the fallback. Picks written for 6.x to 8.x say so in their block.

---

## Phase 6 — Interaction testing with play functions

### T06-01 · The `play` function — Master · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · a story sets the state, `play` simulates clicks, typing and submits, then asserts (*read*) · covers our angle: **partial** — no "demo and test cannot drift" argument · fetched 2026-10-14
- **Beyond the docs:** [How to do interaction testing with React 18 and Storybook](https://blog.logrocket.com/interaction-testing-react-storybook/) · David Ekanem, LogRocket, 2022-08-03 · a form story whose `play` fills and submits, then asserts; written for 6.x with `@storybook/testing-library`, so the imports are stale · fetched 2026-10-14 (*read*)
- **Our delta:** one file as demo and test; the current import path.

### T06-02 · `storybook/test` — the play context — Master · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [How to test UIs with Storybook](https://storybook.js.org/docs/writing-tests) · Storybook docs · its examples import `expect` and `fn` from `storybook/test`; the page does not explain the module itself (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · `userEvent` and `expect` are awaited inside `play`, and spies come from `fn` (*read*) · fetched 2026-10-14
- **Our delta:** the 9.0 rename from `@storybook/test`, and which names are imported versus delivered on the play context (`canvas`, `args`, `step`, `mount`).

### T06-03 · `userEvent` over `fireEvent`, awaiting every interaction — Understand · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Introduction (user-event)](https://testing-library.com/docs/user-event/intro) · Testing Library · `fireEvent` dispatches DOM events, `user-event` simulates full interactions with visibility checks; call `setup()` first (*read*) · covers our angle: **partial** — the page gives no reason for `await` · fetched 2026-10-14
- **Also good:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · `userEvent` and `expect` must be awaited so steps are logged and debuggable (*read*) · fetched 2026-10-14
- **Beyond the docs:** [FireEvent vs UserEvent in Testing](https://stevekinney.com/courses/testing/user-event) · Steve Kinney, last modified 2025-04-28 · typing triggers focus, keydown, keyup and change; `user.click()` returns a Promise, so an un-awaited call lets the assertion run first · fetched 2026-10-14 (*read*)
- **Our delta:** the flaky-not-failing symptom inside a play function.

### T06-04 · Assertions and spies, `waitFor` and `findBy*` — Understand · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async/) · Testing Library · `findBy` is `getBy` plus `waitFor`; `waitFor` gives up after 1000ms, retries every 50ms, and only retries when the callback throws (*read*) · covers our angle: **partial** — no spies · fetched 2026-10-14
- **Also good:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · spying on a function arg to assert on its behaviour; `findByRole` awaited; it does not discuss `waitFor` (*read*) · fetched 2026-10-14
- **Our delta:** `toHaveBeenCalledWith` against an `fn()` arg, and when `waitFor` is needed.

### T06-05 · Debugging in the Interactions panel — Understand · ✅ written `docs/storybook/pages/05-interaction-testing/01-play-functions.md`
- **Read this:** [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing) · Storybook docs · the panel offers UI controls to pause, resume, rewind and step through each interaction (*read*) · covers our angle: **partial** — one sentence on the controls, nothing on reading a failure · fetched 2026-10-14
- **Our delta:** reading a failure in the panel versus the CI stack trace.

---

## Phase 7 — Accessibility testing

### T07-01 · `@storybook/addon-a11y` — Master · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) · Storybook docs · built on Deque axe-core, which catches up to 57% of WCAG issues; results land in the Accessibility panel (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Accessibility Testing in Storybook](https://stevekinney.com/courses/storybook/accessibility-testing) · Steve Kinney, last modified 2025-04-16 · the addon adds an addon-panel tab backed by axe-core; written for the older test-runner path (*read*) · fetched 2026-10-14
- **Our delta:** none material.

### T07-02 · Reading a violation — Understand · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [Axe API documentation](https://www.deque.com/axe/core-documentation/api-documentation) · Deque · impact is minor, moderate, serious or critical (null on a pass); `id` is the rule id; `nodes` lists the elements tested; `incomplete` needs manual review (*read*) · covers our angle: **partial** — the panel's three tabs are in the Storybook page · fetched 2026-10-14
- **Also good:** [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/html/4.10/color-contrast) · Deque University · rule `color-contrast`, impact serious, 4.5:1 for small text and 3:1 for large (*read*) · fetched 2026-10-14
- **Our delta:** which impact levels are genuinely blocking is our judgement, not a source claim.

### T07-03 · Configuring and disabling rules — Understand · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) · Storybook docs · `parameters.a11y.config` configures individual rules (`region` is off by default); `parameters.a11y.test` is `off`, `todo` or `error` (*read*) · covers our angle: **full** for the mechanics · fetched 2026-10-14
- **Our delta:** the "axe cannot see this" versus "we are hiding it" line is editorial.

### T07-04 · A11y in CI — Know · ✅ written `docs/storybook/pages/07-accessibility-testing/01-a11y-addon.md`
- **Read this:** [The accessibility pipeline for frontend teams](https://storybook.js.org/blog/the-accessibility-pipeline-for-frontend-teams/) · Dominic Nguyen, Storybook blog, 2025-07-01 · plain CI reports every violation, fine for pristine projects and noisy under inherited debt; Chromatic baselines flag only new ones (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Accessibility Tests: Baselines That Flag Only New Issues](https://www.chromatic.com/docs/accessibility) · Chromatic docs · a baseline is the set of violations detected for a story; only new or changed ones are flagged (*read*) · fetched 2026-10-14
- **Also good:** [Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) · Storybook docs · in CI only stories set to `error` fail; `todo` reports nothing in CI (*read*) · fetched 2026-10-14
- **Our delta:** none material.

---

## Phase 8 — Visual regression testing

### T08-01 · Why visual regression exists — Understand · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Visual tests](https://storybook.js.org/docs/writing-tests/visual-testing) · Storybook docs · compares rendered pixels against baselines; markup snapshots can false-positive when code changes do not affect output (*read*) · covers our angle: **partial** — no named bug classes such as a token or an overflow · fetched 2026-10-14
- **Our delta:** the bug class list: changed token, shifted margin, overflow at one breakpoint.

### T08-02 · Chromatic — snapshots, baselines, review and accept — Understand · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Branches and baselines](https://www.chromatic.com/docs/branching-and-baselines) · Chromatic docs · a baseline is the last known good state of a story in a mode; baselines only update when changes are accepted (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Visual Testing with Chromatic](https://dev.to/duarten/visual-testing-with-chromatic-4i0m) · Duarte Nunes, DEV Community, 2022-03-28 · the review screen puts old and new side by side; `main` runs with `--auto-accept-changes` because the PR already reviewed it · fetched 2026-10-14 (*read*)
- **Our delta:** none material.

### T08-03 · Making snapshots deterministic — Understand · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Unstable tests debugging](https://www.chromatic.com/docs/unstable-tests) · Chromatic docs · animations, current date, randomness, web fonts, late-loading resources; fix with mockdate, seedrandom, static preloaded fonts (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Delay](https://www.chromatic.com/docs/delay) · Chromatic docs · a fixed minimum wait before capture; prefer assertions or `play` for precision (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Spurious diffs](https://docs.happo.io/docs/legacy/spurious-diffs) · Happo docs, legacy section, undated · same four causes from another vendor: fixed dates, hidden random data, disabled animation, locally hosted fonts (*read*) · fetched 2026-10-14
- **Our delta:** none material.

### T08-04 · Cost control and `chromatic.disableSnapshot` — Know · ✅ written `docs/storybook/pages/06-visual-testing/01-chromatic-integration.md`
- **Read this:** [Disable snapshots](https://www.chromatic.com/docs/disable-snapshots) · Chromatic docs · `chromatic: { disableSnapshot: true }` at story, component or project level; the story stays indexed (*read*) · covers our angle: **partial** — no billing figures · fetched 2026-10-14
- **Also good:** [Billing](https://www.chromatic.com/docs/billing) · Chromatic docs · captured costs 1, copied TurboSnap 0.2, bypassed 0; `disableSnapshot` costs 0; ignored areas are still billed; interaction tests are not billed (*read*) · fetched 2026-10-14
- **Our delta:** none material.

---

## Phase 9 — Configuration, builders and CI

### T09-01 · `main.ts` — Master · ✅ written `docs/storybook/pages/13-build-and-configuration/01-storybook-main.md`
- **Read this:** [Main configuration](https://storybook.js.org/docs/api/main-config/main-config) · Storybook docs · "This file must be valid ESM": use `import`, no `__dirname` or `__filename`; `stories` and `framework` required, `addons` and `staticDirs` optional (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Configure Storybook](https://storybook.js.org/docs/configure) · Storybook docs · what each of `main`, `preview` and `manager` is for (*read*) · fetched 2026-10-14
- **Our delta:** the 8.x to 10.x `require()` migration story.

### T09-02 · `preview.ts` — Understand · ✅ written `docs/storybook/pages/13-build-and-configuration/02-advanced-main-and-preview-customization.md`
- **Read this:** [Configure Storybook](https://storybook.js.org/docs/configure) · Storybook docs · `preview` controls story rendering and holds global decorators, parameters and globalTypes (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Toolbars and globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) · Storybook docs · `globalTypes` define toolbar menus; `initialGlobals` sets starting values; decorators read `context.globals` (*read*) · fetched 2026-10-14
- **Our delta:** why a thin `preview.ts` keeps every story cheap.

### T09-03 · `manager.ts` — Know · ✅ written `docs/storybook/pages/13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md`
- **Read this:** [Theming](https://storybook.js.org/docs/configure/user-interface/theming) · Storybook docs · `addons.setConfig` in `manager`; `create()` from `storybook/theming`; the theme is replaced, not combined (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none material.

### T09-04 · Environment variables — Understand · ✅ written `docs/storybook/pages/13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md`
- **Read this:** [Environment variables](https://storybook.js.org/docs/configure/environment-variables) · Storybook docs · only `STORYBOOK_` variables reach preview code; Webpack gives `process.env`, the Vite builder `import.meta.env`; values are embedded in the build (*read*) · covers our angle: **partial** — no mention of the app's own `.env` not carrying over · fetched 2026-10-14
- **Our delta:** why the app's `.env` is not the preview's, and the `undefined` that follows.

### T09-05 · `@storybook/test-runner` — Understand · ✅ written `docs/storybook/pages/11-testing-integration/01-test-runner.md`
- **Read this:** [Test runner](https://storybook.js.org/docs/writing-tests/integrations/test-runner) · Storybook docs · Jest plus Playwright; a story with `play` also fails on `play` errors or failed assertions; CI against a built `storybook-static`; notes the Vitest addon supersedes it (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Continuous Integration](https://playwright.dev/docs/ci) · Playwright docs · `npx playwright install --with-deps` in CI, plus a pre-built Docker image (*read*) · fetched 2026-10-14
- **Our delta:** none material.

### T09-06 · Build performance — Understand · 🔲 not written
- **Read this:** [How to make Storybook 2-4x faster](https://storybook.js.org/blog/optimize-storybook-7-6) · Kasper Peulen, Storybook blog, 2023-12-20, updated 2025-05-27 · TypeScript docgen is slow, `react-docgen` is faster, `--test` builds skip docgen and docs; reports 25% to 50% gains (*read*) · covers our angle: **partial** — written for 7.6, and says nothing on glob breadth or a heavy `preview.ts` · fetched 2026-10-14
- **Our delta:** page not written; glob breadth and `preview.ts` weight have no source here.

---

## Phase 10 — Design systems and shipping

### T10-01 · Storybook as the design system hub — Understand · ✅ written `docs/storybook/pages/10-composition-and-design-systems/01-storybook-as-a-design-system-hub.md`
- **Read this:** [Bridging Design and Development with Storybook](https://storybook.js.org/docs/sharing/design-integrations) · Storybook docs · links stories to design tools: Storybook Connect for Figma, the Designs addon, Zeplin (*read*) · covers our angle: **partial** — design and engineering only, nothing on QA · fetched 2026-10-14
- **Our delta:** the shared vocabulary across QA too, and what the hub replaces.

### T10-02 · Composition via `refs` — Know · ✅ written `docs/storybook/pages/10-composition-and-design-systems/01-storybook-as-a-design-system-hub.md`
- **Read this:** [Storybook Composition](https://storybook.js.org/docs/sharing/storybook-composition) · Storybook docs · `refs` in `main` takes a title and URL; `refs` can be a function; addons do not behave normally in composed Storybooks (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none material.

### T10-03 · Building and publishing a static Storybook — Understand · ✅ written `docs/storybook/pages/14-publishing-and-deployment/01-shipping-a-static-storybook.md`
- **Read this:** [Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook) · Storybook docs · build a static app any web server can host; Chromatic recommended; CI gives a link in PR checks (*read*) · covers our angle: **full** — the page shows `build-storybook`, where the syllabus says `storybook build` · fetched 2026-10-14
- **Our delta:** use the current `storybook build` spelling.

### T10-04 · Bootstrapping into an existing app — Master · ✅ written `docs/storybook/pages/16-real-world-workflows-and-recipes/01-bootstrapping-into-an-existing-app.md`
- **Read this:** [Install Storybook](https://storybook.js.org/docs/get-started/install) · Storybook docs · run init from the project root; `--type`, `--package-manager` and `--features` flags; no monorepo coverage (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Storybook in a Turborepo](https://turborepo.dev/docs/guides/tools/storybook) · Turborepo docs · a dedicated Storybook app, UI package installed by workspace filter, optional co-located stories (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Migrating from Styleguidist to Storybook](https://engineeringblog.yelp.com/2022/07/migrating-from-styleguidist-to-storybook.html) · Kedar Vaidya and Benson Pan, Yelp Engineering, 2022-07-06 · codemods moved thousands of examples in a React monorepo without blocking developers (*read*) · fetched 2026-10-14
- **Our delta:** which components to story first, and avoiding the "later" trap; no source found.

### T10-05 · The component-driven workflow end to end — Know · ✅ written `docs/storybook/pages/15-advanced-patterns/01-component-driven-workflow.md`
- **Read this:** [Component Driven User Interfaces](https://www.componentdriven.org/) · componentdriven.org · bottom-up: components, composites, pages with mock data, then integration with data and backend (*read*) · covers our angle: **partial** — no static-build review step · fetched 2026-10-14
- **Also good:** [Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook) · Storybook docs · the published build and PR link supply the review step (*read*) · fetched 2026-10-14
- **Our delta:** review the static build before assembling into the app.
