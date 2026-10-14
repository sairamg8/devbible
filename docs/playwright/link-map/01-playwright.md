---
title: "Link map · Playwright · Part 1 (all sections)"
sidebar_label: "01 · playwright"
sidebar_position: 1
---

# Link map · Playwright · Part 1 (all sections)

Covers all 16 sections of `docs/playwright/pages` (01 to 16). Each section is one page of ours, so a section with several distinct sub-topics is split into blocks with ids `T05-01a`, `T05-01b` and so on; the header path is the page they all point to. Official means playwright.dev; third-party picks carry author and date only where the page shows them.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Two Beyond picks first proposed (the TestDino fixtures and page-object articles) loaded only a title and a "Loading blog post" placeholder, and the Argos CI visual guide returned 404, so none of the three is listed.

Version note. Pages 01 to 06 carry a `> Verified: 2026-09-06` line; pages 07 to 16 carry none. The links point at the current unversioned playwright.dev docs, whose release notes list 1.64 as the latest. 🔴 **Component testing changed after our page was written**: the current Components page describes a story-gallery model and says the `@playwright/experimental-ct-*` packages "have been removed and are no longer published" (see T12-01). The earlier claim here that the page is "still marked experimental" was wrong for the page body, though its title still says experimental.

---

### T01-01 · Browser, context, page hierarchy — Topic · ✅ written `docs/playwright/pages/01-core-architecture/01-browser-automation-model.md`
- **Read this:** [Isolation](https://playwright.dev/docs/browser-contexts) · playwright.dev · contexts are "equivalent to incognito-like profiles", each test has its own, several can coexist in one browser and in one test · (*read*) · covers our angle: **partial — the context level only; the page never mentions the out-of-process driver or the protocol** · fetched 2026-10-14
- **Also good:** [BrowserType API](https://playwright.dev/docs/api/class-browsertype) · playwright.dev · `launch` starts a browser; `connect` attaches to one started by `launchServer`; also `connectOverCDP` and `launchPersistentContext` (headings only) · fetched 2026-10-14
- **Beyond the docs:** [Playwright BrowserContexts and Pages Explained](https://macmyths.com/playwright-browsercontexts-and-pages-explained/) · MacMyths Team, 2026-09-29 · Browser as process, context as isolated session, page as tab or popup; says to register the popup wait before the click; does not discuss the driver or protocol · fetched 2026-10-14 (*read*)
- **Our delta:** the Node-versus-browser process split and why one Browser serves many cheap contexts. Our own page says the transport is unconfirmed, and none of these picks confirms it either.

### T02-01a · Test runner, built-in and custom fixtures — Topic · ✅ written `docs/playwright/pages/02-test-runner/01-playwright-test-fixtures.md`
- **Read this:** [Fixtures](https://playwright.dev/docs/test-fixtures) · playwright.dev · the built-in table lists `page`, `context`, `browser`, `browserName` and `request`; then creating, using, overriding, worker-scoped, automatic and timeout sections · (*read*) · covers our angle: **full for mechanics, partial for our gotchas** (aliasing does not clone, setup billed to the test timeout) · fetched 2026-10-14
- **Beyond the docs:** [Playwright Fixtures: The Ultimate Guide for Test Automation](https://testomat.io/?p=11663) · Michael Bodnarchuk, Testomat.io, updated 2026-04-15 · setup before and teardown after `await use()`, test versus worker scope, `{ auto: true }`, dependent fixtures torn down in reverse; gives no isolation warning of its own · fetched 2026-10-14 (*read*)
- **Our delta:** the login-through-UI fixture that costs one login per test, and `request` being an isolated client, not the page's network.

### T02-01b · Projects matrix — Topic · ✅ written `docs/playwright/pages/02-test-runner/01-playwright-test-fixtures.md`
- **Read this:** [Projects](https://playwright.dev/docs/test-projects) · playwright.dev · multi-browser and multi-environment projects, `--project`, dependencies with teardown, custom project parameters · (*read*) · covers our angle: **partial — shows the matrix; does not say how a project's `use` feeds the built-in fixtures** (that is the Fixtures-options section of the page above) · fetched 2026-10-14
- **Our delta:** a test's identity becomes test-plus-project, so snapshot names, shared paths and retries must account for it.

### T03-01 · Locators, getByRole, strictness — Topic · ✅ written `docs/playwright/pages/03-locators/01-locator-api.md`
- **Read this:** [Locators](https://playwright.dev/docs/locators) · playwright.dev · "Every time a locator is used for an action, an up-to-date DOM element is located"; `getByRole` first in the quick guide; strictness throws when more than one element matches; filtering, chaining, `and`, `or`; `first`, `last`, `nth` flagged "not recommended" · (*read*) · covers our angle: **full on mechanics; partial on pitfalls** (accessible-name matching, `count()` as a one-shot) · fetched 2026-10-14
- **Also good:** [Other locators](https://playwright.dev/docs/other-locators) · playwright.dev · CSS, XPath, n-th and parent locators, legacy text selectors, id and `data-testid` shorthands; no React or Vue selectors; steers back to role locators (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright locators: getByRole first, CSS and XPath last](https://momentic.ai/resources/a-guide-to-playwright-locators-from-getbyrole-to-css-and-xpath) · Wei-Wei Wu, Momentic, last updated 2026-09-11 · ranked ladder from role down to XPath; mentions the strict-mode error and that `first`/`last`/`nth` opt out, but presents chaining and `filter()` as general scoping, not as a strict-mode cure · fetched 2026-10-14 (*read*)
- **Our delta:** `.first()` is selection, not disambiguation, so scoping by container is the cure; locators fail where used, not where created.

### T04-01a · Actions and actionability — Topic · ✅ written `docs/playwright/pages/04-actions-and-interactions/01-interaction-primitives.md`
- **Read this:** [Actions](https://playwright.dev/docs/input) · playwright.dev · `fill` "focuses the element and triggers an `input` event", `pressSequentially` types character by character, plus checkboxes, `selectOption`, `setInputFiles`, drag and drop, scrolling · (*read*) · covers our angle: **partial — no per-action check table; low-level input is only touched for manual drag and wheel** · fetched 2026-10-14
- **Also good:** [Auto-waiting](https://playwright.dev/docs/actionability) · playwright.dev · the table: `fill` checks Visible, Enabled, Editable; `press`, `pressSequentially` and `setInputFiles` run no checks (*read*) · fetched 2026-10-14
- **Our delta:** which fill-versus-keystroke difference changes a test's verdict (live counters, masks), and a click that times out with no detail. I did not check the claim that `locator.type` is deprecated on any fetched page.

### T04-01b · Low-level mouse and keyboard — Topic · ✅ written `docs/playwright/pages/04-actions-and-interactions/01-interaction-primitives.md`
- **Read this:** [Mouse class](https://playwright.dev/docs/api/class-mouse) · playwright.dev · operates "in main-frame CSS pixels relative to the top-left corner of the viewport"; `click`, `dblclick`, `down`, `move`, `up`, `wheel` (*read*) · covers our angle: **partial — the primitives, not when to use them** · fetched 2026-10-14
- **Also good:** [Keyboard class](https://playwright.dev/docs/api/class-keyboard) · playwright.dev · `press`, `type`, `down`, `up`, `insertText`; says to prefer `locator.press`, `locator.fill`, or `pressSequentially` for special key handling (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Click, Type, and Hover with Playwright](https://www.browserstack.com/guide/playwright-click-type) · Venkatesh Raghunathan, BrowserStack, last updated 2026-07-30 · has a section on `page.mouse.click()` instead of `locator.click()` for canvas and map positions, and `fill` versus keystrokes · fetched 2026-10-14 (*read*)
- **Our delta:** drawing on a canvas with `steps` for a smooth drag, and giving up all actionability checks when you drop to raw input.

### T05-01a · Web-first assertions and soft assertions — Topic · ✅ written `docs/playwright/pages/05-auto-waiting-and-assertions/01-web-first-assertions.md`
- **Read this:** [Assertions](https://playwright.dev/docs/test-assertions) · playwright.dev · auto-retrying versus non-retrying matchers, soft assertions ("do not terminate test execution, but mark the test as failed"), `expect.poll`, `expect.toPass`, custom message, 5-second assertion timeout · (*read*) · covers our angle: **full on the mechanisms; our symptom gotchas are ours** · fetched 2026-10-14
- **Beyond the docs:** [Playwright Assertions - Types & Best Practices](https://www.checklyhq.com/learn/playwright/assertions/) · Checkly Docs, no author or date shown · retrying versus one-shot groups, treats extract-then-assert as a mistake because it "doesn't include waiting at all", also soft, poll, `toPass` · fetched 2026-10-14 (*read*)
- **Our delta:** the missing-`await` assertion that cannot fail, transient states (spinner, toast), and fallout after a failed soft assertion.

### T05-01b · Actionability and the timeout budgets — Topic · ✅ written `docs/playwright/pages/05-auto-waiting-and-assertions/01-web-first-assertions.md`
- **Read this:** [Auto-waiting](https://playwright.dev/docs/actionability) · playwright.dev · the five checks (Visible, Stable, Receives Events, Enabled, Editable), the per-action table, `TimeoutError` when checks never pass, `force` · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Timeouts](https://playwright.dev/docs/test-timeouts) · playwright.dev · test 30,000 ms, expect 5,000 ms; action, navigation, global and fixture: no timeout (*read*) · fetched 2026-10-14
- **Our delta:** the table of defaults and how they interact (a 5 s assertion inside a 30 s test). The page does not tie checks to failing-assertion log lines, and neither does our page.

### T06-01a · What `goto` waits for — Topic · ✅ written `docs/playwright/pages/06-navigation-and-network/01-navigation-and-interception.md`
- **Read this:** [Page class](https://playwright.dev/docs/api/class-page) · playwright.dev · `waitUntil` defaults to `load`; `domcontentloaded`, `commit`, and `networkidle` marked "DISCOURAGED"; read only the first part of a very long page, the `goto` options · (*read*) · covers our angle: **full for `goto`; `waitForURL` not checked** · fetched 2026-10-14
- **Our delta:** `commit` plus a web-first assertion instead of `networkidle`, and registering `waitForResponse` before the action.

### T06-01b · Routing and mocking — Topic · ✅ written `docs/playwright/pages/06-navigation-and-network/01-navigation-and-interception.md`
- **Read this:** [Mock APIs](https://playwright.dev/docs/mock) · playwright.dev · `page.route` with `route.fulfill`, and `route.fetch` to patch a real response · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Network](https://playwright.dev/docs/network) · playwright.dev · network events, `waitForResponse`, glob patterns, context-level routes also cover popups, and the last section: set `serviceWorkers` to `'block'` when events go missing (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Playwright Network Mocking Playbook](https://currents.dev/posts/the-playwright-network-mocking-playbook) · Currents Team, 2026-04-01 · a five-level mocking spectrum, "mock debt is invisible until it becomes expensive", a small real-API contract suite alongside mocked feature tests · fetched 2026-10-14 (*read*)
- **Our delta:** registering the route before `goto`, the dropped handler promise, and a glob that silently stops matching after an endpoint rename.

### T06-01c · HAR replay — Topic · ✅ written `docs/playwright/pages/06-navigation-and-network/01-navigation-and-interception.md`
- **Read this:** [Mock APIs, HAR section](https://playwright.dev/docs/mock) · playwright.dev · recording, modifying and replaying with `routeFromHAR`; `update: true` records instead of serving; the `url` glob limits what is served; unmatched requests abort; `notFound` is not documented by name there · (*read*) · covers our angle: **partial — our page shows only a `routeFromHAR` line and omits how recording is done** · fetched 2026-10-14
- **Beyond the docs:** [The Playwright Network Mocking Playbook](https://currents.dev/posts/the-playwright-network-mocking-playbook) · Currents Team, 2026-04-01 · HAR as a static snapshot that drifts, `notFound`, update modes, scrubbing tokens from HAR files before commit · fetched 2026-10-14 (*read*)
- **Our delta:** a HAR keeps passing after the backend changes shape. The matching and `notFound` rules are not on our page.

### T07-01 · storageState and setup projects — Topic · ✅ written `docs/playwright/pages/07-authentication-and-state/01-session-reuse.md`
- **Read this:** [Authentication](https://playwright.dev/docs/auth) · playwright.dev · a setup project saves `storageState` under `playwright/.auth` which is added to `.gitignore`; dependent projects reuse it; per-worker accounts, multiple roles, API login, a session-storage workaround · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Global setup and teardown](https://playwright.dev/docs/test-global-setup-teardown) · playwright.dev · project dependencies are "the recommended approach"; `globalSetup` is the alternative, with a comparison table (report visibility, fixtures support) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to reuse authenticated state with playwright](https://abigailarmijo.substack.com/p/how-to-reuse-authenticated-state) · Abigail Armijo, Substack, 2024-02-13 · mentions the setup-project route but chooses `globalSetup`, logging in by API as two roles into separate JSON files · fetched 2026-10-14 (*read*)
- **Our delta:** a stale state file surviving between CI runs and tests that must check different auth states. The official page does not cover either.

### T08-01 · Fixtures, scoping, isolation — Topic · ✅ written `docs/playwright/pages/08-fixtures-and-test-isolation/01-fixture-system.md`
- **Read this:** [Fixtures](https://playwright.dev/docs/test-fixtures) · playwright.dev · worker-scoped, automatic, overriding, fixture options, execution order, `mergeTests`, box fixtures · (*read*) · covers our angle: **full on mechanics** · fetched 2026-10-14
- **Also good:** [Isolation](https://playwright.dev/docs/browser-contexts) · playwright.dev · "Each test has its own Browser Context", how isolation is achieved (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright Fixtures](https://bug0.com/knowledge-base/playwright-fixtures) · bug0 knowledge base, no author shown, updated 2026-07-30 · worker scope only for read-only resources, "Used casually, it is where flake comes from"; does not cover auto fixtures · fetched 2026-10-14 (*read*)
- **Our delta:** when worker scope breaks isolation, and the cost of auto fixtures charged to every test.

### T09-01 · toHaveScreenshot and baselines — Topic · ✅ written `docs/playwright/pages/09-visual-and-screenshot-testing/01-visual-regression.md`
- **Read this:** [Visual comparisons](https://playwright.dev/docs/test-snapshots) · playwright.dev · `toHaveScreenshot`, `--update-snapshots`, platform and browser suffix such as `chromium-darwin`, `maxDiffPixels` and `threshold`, `stylePath`; advises the same environment for baselines · (*read*) · covers our angle: **partial — the page does not document the `mask` option our page uses, and never mentions Docker or CI** · fetched 2026-10-14
- **Beyond the docs:** [Playwright Visual Regression Testing: A Production Guide to Baselines, Flake, and CI](https://testquality.com/playwright-visual-regression-guide/) · Jose Amoros, TestQuality, 2026-05-08 (updated 2026-05-12) · cross-OS font rendering, official Docker image for local and CI parity, `maxDiffPixels` versus `maxDiffPixelRatio`, `mask`, and baseline image diffs being unreviewable in Git hosts · fetched 2026-10-14 (*read*)
- **Our delta:** the deliberate baseline-update workflow and masking dynamic content.

### T10-01a · Trace viewer — Topic · ✅ written `docs/playwright/pages/10-debugging-tools/01-diagnostic-tooling.md`
- **Read this:** [Trace viewer](https://playwright.dev/docs/trace-viewer) · playwright.dev · `on-first-retry` for CI, `retain-on-failure`, `show-trace`, actions, DOM snapshots, network and console tabs, trace.playwright.dev loads traces in the browser · (*read*) · covers our angle: **full for this tool** · fetched 2026-10-14
- **Our delta:** post-mortem on a CI failure, and the cost of tracing every run.

### T10-01b · Inspector, debug mode and UI mode — Topic · ✅ written `docs/playwright/pages/10-debugging-tools/01-diagnostic-tooling.md`
- **Read this:** [Debugging tests](https://playwright.dev/docs/debug) · playwright.dev · `--debug` opens the Inspector in headed mode, `page.pause()`, actionability logs, VS Code debugger; `PWDEBUG=console` exposes a `playwright` object. The page does not show `PWDEBUG=1`, which our page uses · (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [UI mode](https://playwright.dev/docs/test-ui-mode) · playwright.dev · watch mode, timeline, pick locator, filter by `@tag` and status (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Complete Playwright Debugging Tutorial](https://dev.to/adam_zampa_/complete-playwright-debugging-tutorial-inspector-trace-viewer-logs-explained-19i5) · Adam Zampa, DEV Community, posted Feb 4 (year not shown), originally on testgrid.io · covers `PWDEBUG=1`, `page.pause()`, DevTools, trace viewer and `DEBUG=pw:api`; no UI mode and no single failing test worked through · fetched 2026-10-14 (*read*)
- **Our delta:** a local `PWDEBUG=1` left in a CI script hangs every run.

### T10-01c · Codegen — Topic · ✅ written `docs/playwright/pages/10-debugging-tools/01-diagnostic-tooling.md`
- **Read this:** [Codegen](https://playwright.dev/docs/codegen) · playwright.dev · recording in VS Code or the Inspector, pick locator, assertion icons, locators prioritising role, text and test id, device and auth emulation · (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** treat output as a draft; refine locators and add assertions before committing.

### T11-01a · Workers and serial mode — Topic · ✅ written `docs/playwright/pages/11-parallelism-and-sharding/01-scaling-test-runs.md`
- **Read this:** [Parallelism](https://playwright.dev/docs/test-parallel) · playwright.dev · files run in parallel, tests in a file in order in one worker, `fullyParallel`, serial mode "not recommended", limiting workers on CI, worker index · (*read*) · covers our angle: **full, but spelling differs** · fetched 2026-10-14
- **Also good:** [Test API](https://playwright.dev/docs/api/class-test) · playwright.dev · `test.describe.parallel()` and `test.describe.serial()` sit in the Deprecated section as "Discouraged"; use `test.describe.configure` with `mode` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright - Parallelism and sharding](https://dev.to/this-is-learning/playwright-parallelism-and-sharding-58h9) · Luca Del Puppo, DEV Community, 2023-02-09 · workers, `fullyParallel`, serial and shard with the `configure` form; no blob reports · fetched 2026-10-14 (*read*)
- **Our delta:** our page teaches the discouraged `describe.parallel()` and `describe.serial()` forms and should be moved to `configure`. Serial as a patch for poor isolation.

### T11-01b · Sharding across machines — Topic · ✅ written `docs/playwright/pages/11-parallelism-and-sharding/01-scaling-test-runs.md`
- **Read this:** [Sharding](https://playwright.dev/docs/test-sharding) · playwright.dev · `--shard=x/y`, `fullyParallel` shards per test and otherwise per file, blob reporter and `merge-reports`, GitHub Actions matrix · (*read*) · covers our angle: **partial — our page has the matrix and imbalance but no blob merge** · fetched 2026-10-14
- **Beyond the docs:** [Playwright Parallel Test Execution](https://www.deviqa.com/blog/playwright-parallel-test-execution-how-to-speed-up-the-test-suite/) · Anastasiia Sokolinska, DeviQA, 2026-06-25 · one 60-test file leaving shards idle under file-level sharding, test-level sharding, `--shard-weights` (the article's claim: since 1.57), `fail-fast: false` for blobs · fetched 2026-10-14 (*read*)
- **Our delta:** uneven shards. No fetched source states how a serial block interacts with shards, so our page should not claim it.

### T12-01 · Component testing with mount — Topic · ✅ written `docs/playwright/pages/12-component-testing/01-experimental-ct-runner.md`
- **Read this:** [Components](https://playwright.dev/docs/test-components) · playwright.dev · a component test is "a regular Playwright end-to-end test that runs against a small story gallery page", driven by the built-in `mount(id, props)` fixture; the old packages "have been removed and are no longer published", with a migration table (hooks, `hooksConfig`, `playwright/index.html`, `ctPort` all gone) · (*read*) · covers our angle: **no — our page teaches the removed `@playwright/experimental-ct-react` JSX flow** · fetched 2026-10-14
- **Also good:** [Release notes](https://playwright.dev/docs/release-notes) · playwright.dev · 1.62 introduced the gallery `mount` fixture, 1.63 said the experimental packages will no longer be updated; latest listed 1.64 (first half of a very long page read) · fetched 2026-10-14
- **Beyond the docs:** [Playwright Component Testing in Large Frontend Codebases](https://currents.dev/posts/playwright-component-testing) · Currents Team, 2026-07-09 · real browser versus jsdom layout, the Node-browser serialization boundary, cost model; written for the experimental packages before the 1.62 change, so read it for concepts only · fetched 2026-10-14 (*read*)
- **Our delta:** the real-browser-versus-jsdom argument still holds; the API, config and hooks on our page need a currency pass.

### T13-01 · APIRequestContext and API plus UI — Topic · ✅ written `docs/playwright/pages/13-api-testing/01-request-fixture.md`
- **Read this:** [API testing](https://playwright.dev/docs/api-testing) · playwright.dev · `request` fixture with `baseURL` and `extraHTTPHeaders`, setup and teardown, preconditions and postconditions from UI tests, `page.request` using the browser's cookies, a new `APIRequestContext` having separate cookies · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [The Playwright Playbook Part 4: API Testing](https://dev.to/sshhfaiz/the-playwright-playbook-part-4-api-testing-the-underrated-superpower-4c64) · Faizal, DEV Community, posted June 18 (year not shown), part 4 of 9 · API seeding before UI checks; contrasts the isolated `request` fixture with `page.request` sharing cookies; assumes some prior Playwright and TypeScript · fetched 2026-10-14 (*read*)
- **Our delta:** the `request` fixture sharing no auth with `page`. Our page never mentions `page.request`, which the official page and Faizal cover.

### T14-01a · Reporters — Topic · ✅ written `docs/playwright/pages/14-ci-integration/01-playwright-config.md`
- **Read this:** [Reporters](https://playwright.dev/docs/test-reporters) · playwright.dev · list is the default, `dot` on CI; multiple reporters; line, dot, html, blob, json, junit, github, custom · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** junit for CI dashboards alongside html; no good non-official page found for reporters.

### T14-01b · Retries — Topic · ✅ written `docs/playwright/pages/14-ci-integration/01-playwright-config.md`
- **Read this:** [Retries](https://playwright.dev/docs/test-retries) · playwright.dev · no retries by default, flaky status, a failed test discards the worker, serial groups retry together, `testInfo.retry`; the page does not mention `on-first-retry` traces (that is the trace viewer page) · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [How to fix hidden flakes when retries make failures pass in Playwright](https://webcrawlerapi.com/glossary/playwright/how-to-fix-playwright-retries-masking-flakes) · WebCrawlerAPI glossary, no author or date shown · one retry in CI and none locally, traces on first retry, reviewing tests with non-zero retry counts, `--repeat-each` · fetched 2026-10-14 (*read*)
- **Our delta:** high global retries mask flaky tests.

### T14-01c · CI workflow and the Docker image — Topic · ✅ written `docs/playwright/pages/14-ci-integration/01-playwright-config.md`
- **Read this:** [Continuous Integration](https://playwright.dev/docs/ci) · playwright.dev · `workers` of 1 on CI for stability, `install --with-deps`, GitHub Actions, sharding, "Caching browser binaries is not recommended"; no retries or traces on this page · (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Docker](https://playwright.dev/docs/docker) · playwright.dev · image at `mcr.microsoft.com/playwright`, "always pin your Docker image to a specific version", `--ipc=host` for Chromium, `--init`, seccomp, non-root for untrusted sites (*read*) · fetched 2026-10-14
- **Our delta:** how the three settings combine in one config. Searched for a third-party Docker guide; the readable results were stale or did not load, so no Beyond line.

### T15-01a · Page object model — Topic · ✅ written `docs/playwright/pages/15-advanced-patterns/01-scalable-test-architecture.md`
- **Read this:** [Page object models](https://playwright.dev/docs/pom) · playwright.dev · a `PlaywrightDevPage` class holding locators and methods, built from `page` in the constructor; no fixtures there · (*read*) · covers our angle: **partial — no fixture delivery** · fetched 2026-10-14
- **Beyond the docs:** [Combine Fixtures & Page Object Models for DRYer Test Code in Playwright](https://checklyhq.com/blog/page-object-models-and-fixtures-with-playwright) · Nočnica Mellifera, Checkly, 2025-03-13 (updated 2025-07-23) · `base.extend` fixtures that build `LoginPage` and `DashboardPage` so tests request them by name, plus the downsides of POM · fetched 2026-10-14 (*read*)
- **Our delta:** one locator change fixed in one file instead of many.

### T15-01b · Custom matchers — Topic · ✅ written `docs/playwright/pages/15-advanced-patterns/01-scalable-test-architecture.md`
- **Read this:** [Assertions, expect.extend section](https://playwright.dev/docs/test-assertions) · playwright.dev · custom matchers return `pass` and a `message`; combining matchers from several modules; use Playwright's own `expect` · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Playwright Assertions - Types & Best Practices](https://www.checklyhq.com/learn/playwright/assertions/) · Checkly Docs, no author or date shown · has "How to Add Custom Matchers Using expect.extend" and a worked example (*headings only* for that section) · fetched 2026-10-14
- **Our delta:** a domain matcher such as `toBeValidOrder`. An earlier note here said the official pages do not cover `expect.extend`; that was wrong.

### T15-01c · Test tags and filtering — Topic · ✅ written `docs/playwright/pages/15-advanced-patterns/01-scalable-test-architecture.md`
- **Read this:** [Annotations](https://playwright.dev/docs/test-annotations) · playwright.dev · tags via a details object or an `@` token in the title, `--grep` and `--grep-invert`, `annotation` with type and description, `skip`, `fixme`, `fail`, `slow` · (*read*) · covers our angle: **full, but our page only shows the title-token form** · fetched 2026-10-14
- **Our delta:** `@smoke` and `@regression` as CI stages, and inconsistent casing breaking `--grep`. No good non-official page found.

### T16-01 · Flaky in CI, green locally — Topic · ✅ written `docs/playwright/pages/16-real-world-workflows-and-recipes/01-diagnosing-flaky-ci-tests.md`
- **Read this:** [Best Practices](https://playwright.dev/docs/best-practices) · playwright.dev · web-first assertions, isolation, "use the Playwright trace viewer instead of videos and screenshots" on CI, `--debug` locally; no flaky-test triage recipe · (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Retries](https://playwright.dev/docs/test-retries) · playwright.dev · flaky classification (*read*) · fetched 2026-10-14 and [Timeouts](https://playwright.dev/docs/test-timeouts) · playwright.dev · test, expect, action budgets (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Reproduce CI Failures Locally in Playwright](https://dev.to/playwright/how-to-reproduce-ci-failures-locally-in-playwright-lfl) · Debbie O'Brien, DEV Community, 2025-02-19 · `--repeat-each=100`, `--workers=10` and `-x` to expose intermittent failures; does not cover Docker, `CI=true`, traces or throttling · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [How to Detect and Avoid Playwright Flaky Tests](https://www.browserstack.com/guide/playwright-flaky-tests) · Grandel Robert, BrowserStack, last updated 2026-08-21 · CI runners with less CPU and memory, retries flag but do not fix, `on-first-retry` traces, shared-state interference between workers · fetched 2026-10-14 (*read*)
- **Our delta:** the triage order (reproduce, trace, classify, fix), a CDP CPU-throttle fixture, and visual flake having a different cause set.
