---
title: "Link map · Playwright · Part 1 (all sections)"
sidebar_label: "01 · playwright"
sidebar_position: 1
---

# Link map · Playwright · Part 1 (all sections)

Covers all 16 sections of `docs/playwright/pages` (01 to 16), one topic page each, every one written. Block IDs are `T<section>-01`. Official means playwright.dev; third-party picks carry a date only where the page shows one.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

Version note. Our pages were verified 2026-09-06 against the Playwright docs; the links below point at the current unversioned playwright.dev docs. Component testing is still marked experimental there.

---

### T01-01 · Browser, context, page hierarchy — Topic · ✅ written `docs/playwright/pages/01-core-architecture/01-browser-automation-model.md`
- **Read this:** [Isolation](https://playwright.dev/docs/browser-contexts) · playwright.dev · a BrowserContext is an isolated incognito-like profile, each test gets its own, and several contexts can run in one browser · (*read*) · covers our angle: **partial — shows the context level, not the out-of-process driver or the protocol layer** · fetched 2026-10-14
- **Also good:** [BrowserType API](https://playwright.dev/docs/api/class-browsertype) · playwright.dev · launch versus connect, the entry point of the Browser object (headings only) · fetched 2026-10-14
- **Beyond the docs:** [Playwright BrowserContext vs Page: Tabs, Popups, and Isolation](https://macmyths.com/playwright-browsercontexts-and-pages-explained/) · MacMyths Team, 2026-09-29 · walks Browser to Context to Page with popups belonging to the parent context · fetched 2026-10-14 (*read*)
- **Our delta:** the out-of-process driver and why one Browser serves many cheap contexts.

### T02-01 · Test runner, built-in fixtures, projects — Topic · ✅ written `docs/playwright/pages/02-test-runner/01-playwright-test-fixtures.md`
- **Read this:** [Fixtures](https://playwright.dev/docs/test-fixtures) · playwright.dev · the built-in fixture table (`page`, `context`, `browser`, `request`) and how fixtures are requested by name · (*read*) · covers our angle: **partial — built-ins covered, matrix not** · fetched 2026-10-14
- **Also good:** [Projects](https://playwright.dev/docs/test-projects) · playwright.dev · the `projects` array, per-project `use`, browser and device matrix and dependencies (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright Fixtures: Guide to Setup, Scope & Test Helpers](https://testdino.com/blog/playwright-fixtures) · TestDino blog, no date shown · setup and teardown around `use`, with scope examples · fetched 2026-10-14 (*read*)
- **Our delta:** the projects matrix and the config-to-fixture option flow.

### T03-01 · Locators, getByRole, strictness — Topic · ✅ written `docs/playwright/pages/03-locators/01-locator-api.md`
- **Read this:** [Locators](https://playwright.dev/docs/locators) · playwright.dev · lazy re-resolving locators, `getByRole` first in the recommended order, strictness errors when more than one element matches · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Other locators](https://playwright.dev/docs/other-locators) · playwright.dev · CSS, XPath and legacy selectors, for when role queries do not fit (*read*) · fetched 2026-10-14
- **Beyond the docs:** [getByRole Playwright Locator Guide: Ladder and Examples](https://momentic.ai/resources/a-guide-to-playwright-locators-from-getbyrole-to-css-and-xpath) · Momentic, no date shown · a ladder from role queries down to CSS, with fixes for strict mode violations · fetched 2026-10-14 (*read*)
- **Our delta:** chaining and filtering as the cure for strict-mode errors.

### T04-01 · Actions, keyboard and mouse — Topic · ✅ written `docs/playwright/pages/04-actions-and-interactions/01-interaction-primitives.md`
- **Read this:** [Actions](https://playwright.dev/docs/input) · playwright.dev · `click`, `fill`, `check`, `selectOption`, `setInputFiles`, drag and the keyboard and mouse sections · (*read*) · covers our angle: **partial — low-level detail is in the API pages** · fetched 2026-10-14
- **Also good:** [Mouse class](https://playwright.dev/docs/api/class-mouse) · playwright.dev · `move`, `down`, `up`, `wheel` in CSS pixels from the viewport corner (headings only) · fetched 2026-10-14 and [Keyboard class](https://playwright.dev/docs/api/class-keyboard) · playwright.dev · `press`, `type`, `down`, `up`, `insertText` (headings only) · fetched 2026-10-14
- **Beyond the docs:** [How to Click, Type, and Hover with Playwright](https://www.browserstack.com/guide/playwright-click-type) · BrowserStack guide, no date shown · when to drop from locator actions to `page.mouse`, for canvas UIs · fetched 2026-10-14 (*read*)
- **Our delta:** choosing locator actions over raw input, and why `type` is not `fill`.

### T05-01 · Web-first assertions, actionability, soft — Topic · ✅ written `docs/playwright/pages/05-auto-waiting-and-assertions/01-web-first-assertions.md`
- **Read this:** [Assertions](https://playwright.dev/docs/test-assertions) · playwright.dev · auto-retrying versus non-retrying matchers, `expect.soft`, polling and timeouts · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Auto-waiting](https://playwright.dev/docs/actionability) · playwright.dev · the per-action checklist: Visible, Stable, Receives Events, Enabled, Editable (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright Assertions - Types & Best Practices](https://www.checklyhq.com/learn/playwright/assertions/) · Checkly Docs, no date shown · sorts assertions into retrying and one-shot, with fixes for the common mistake of awaiting a plain value · fetched 2026-10-14 (*read*)
- **Our delta:** tying actionability checks to the failing-assertion log lines.

### T06-01 · Navigation, route, HAR — Topic · ✅ written `docs/playwright/pages/06-navigation-and-network/01-navigation-and-interception.md`
- **Read this:** [Mock APIs](https://playwright.dev/docs/mock) · playwright.dev · `page.route`, `route.fulfill`, patching a real response, HAR record with `update: true` then replay · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Network](https://playwright.dev/docs/network) · playwright.dev · events, `waitForResponse`, `context.route` scope and the Service Workers exception (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Playwright Network Mocking Playbook](https://currents.dev/posts/the-playwright-network-mocking-playbook) · Currents Team, 2026-04-01 · when to mock versus hit the real API, and the risk of a green fully mocked suite · fetched 2026-10-14 (*read*)
- **Our delta:** `goto` wait states and the HAR matching rules.

### T07-01 · storageState and setup projects — Topic · ✅ written `docs/playwright/pages/07-authentication-and-state/01-session-reuse.md`
- **Read this:** [Authentication](https://playwright.dev/docs/auth) · playwright.dev · a setup project logs in once, saves `storageState` to `playwright/.auth`, dependent projects reuse it · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Global setup and teardown](https://playwright.dev/docs/test-global-setup-teardown) · playwright.dev · the older `globalSetup` route versus project dependencies (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to reuse authenticated state with playwright](https://abigailarmijo.substack.com/p/how-to-reuse-authenticated-state) · Abigail Armijo, Substack, 2024-02-13 · step-by-step reuse of a saved login; written before some docs changes · fetched 2026-10-14 (*read*)
- **Our delta:** per-role state files and keeping tokens out of git.

### T08-01 · Fixtures, scoping, isolation — Topic · ✅ written `docs/playwright/pages/08-fixtures-and-test-isolation/01-fixture-system.md`
- **Read this:** [Fixtures](https://playwright.dev/docs/test-fixtures) · playwright.dev · `test.extend`, `scope: 'worker'`, `auto: true`, fixture override and composition · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Isolation](https://playwright.dev/docs/browser-contexts) · playwright.dev · the fresh-context-per-test model that makes isolation the default (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright Fixtures: Guide to Setup, Scope & Test Helpers](https://testdino.com/blog/playwright-fixtures) · TestDino blog, no date shown · laziness of fixtures and the cost of worker scope · fetched 2026-10-14 (*read*)
- **Our delta:** when worker scope breaks isolation.

### T09-01 · toHaveScreenshot and baselines — Topic · ✅ written `docs/playwright/pages/09-visual-and-screenshot-testing/01-visual-regression.md`
- **Read this:** [Visual comparisons](https://playwright.dev/docs/test-snapshots) · playwright.dev · `toHaveScreenshot`, `--update-snapshots`, per-platform snapshot names, thresholds and masking · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Playwright visual regression testing in CI: complete guide](https://argos-ci.com/blog/playwright-visual-regression-testing-ci) · Argos, no date shown · why baselines must be made on the CI OS and browser, usually in Docker · fetched 2026-10-14 (*read*)
- **Our delta:** baseline review workflow across OSes.

### T10-01 · Trace viewer, inspector, codegen, UI mode — Topic · ✅ written `docs/playwright/pages/10-debugging-tools/01-diagnostic-tooling.md`
- **Read this:** [Trace viewer](https://playwright.dev/docs/trace-viewer) · playwright.dev · recording traces, opening them, the action list, DOM snapshots and network tabs · (*read*) · covers our angle: **partial — one tool of four** · fetched 2026-10-14
- **Also good:** [Debugging tests](https://playwright.dev/docs/debug) · playwright.dev · `--debug`, `PWDEBUG`, `page.pause()` and the Inspector (*read*) · fetched 2026-10-14 and [UI mode](https://playwright.dev/docs/test-ui-mode) · playwright.dev · watch mode with a live trace view (*read*) · fetched 2026-10-14 and [Codegen](https://playwright.dev/docs/codegen) · playwright.dev · recording and the locator picker (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Complete Playwright Debugging Tutorial: Inspector, Trace Viewer & Logs Explained](https://dev.to/adam_zampa_/complete-playwright-debugging-tutorial-inspector-trace-viewer-logs-explained-19i5) · Adam Zampa, DEV Community, 2026-02-04 · side-by-side use of the tools on a failing test · fetched 2026-10-14 (*read*)
- **Our delta:** choosing a tool for each failure type.

### T11-01 · Workers, serial, sharding — Topic · ✅ written `docs/playwright/pages/11-parallelism-and-sharding/01-scaling-test-runs.md`
- **Read this:** [Parallelism](https://playwright.dev/docs/test-parallel) · playwright.dev · files run in parallel, tests in a file in order, `fullyParallel`, `describe.configure` with `mode: 'serial'` · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Sharding](https://playwright.dev/docs/test-sharding) · playwright.dev · `--shard=N/M`, merging reports across machines (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright - Parallelism and sharding](https://dev.to/this-is-learning/playwright-parallelism-and-sharding-58h9) · Luca Del Puppo, DEV Community, 2023-02-09 · early explainer, older than the blob-report merge flow · fetched 2026-10-14 (*read*)
- **Our delta:** serial-mode traps and how shards interact with it.

### T12-01 · Component testing with mount — Topic · ✅ written `docs/playwright/pages/12-component-testing/01-experimental-ct-runner.md`
- **Read this:** [Components (experimental)](https://playwright.dev/docs/test-components) · playwright.dev · `mount` fixture, `@playwright/experimental-ct-react`, props, hooks config; the page is marked experimental · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the experimental caveat and how it differs from a unit runner. No English non-official page of quality turned up, so no Beyond line.

### T13-01 · APIRequestContext and API plus UI — Topic · ✅ written `docs/playwright/pages/13-api-testing/01-request-fixture.md`
- **Read this:** [API testing](https://playwright.dev/docs/api-testing) · playwright.dev · the `request` fixture, `baseURL`, `newContext`, and using API calls for setup and teardown · (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [The Playwright Playbook Part 4: API Testing](https://dev.to/sshhfaiz/the-playwright-playbook-part-4-api-testing-the-underrated-superpower-4c64) · Faizal, DEV Community, 2026-06-18 · API seeding before UI checks, beginner level · fetched 2026-10-14 (*read*)
- **Our delta:** `page.request` versus the `request` fixture cookie sharing.

### T14-01 · Reporters, retries, Docker — Topic · ✅ written `docs/playwright/pages/14-ci-integration/01-playwright-config.md`
- **Read this:** [Continuous Integration](https://playwright.dev/docs/ci) · playwright.dev · CI workflow, `workers`, browser install, GitHub Actions example · (*read*) · covers our angle: **partial — Docker and retries live on their own pages** · fetched 2026-10-14
- **Also good:** [Reporters](https://playwright.dev/docs/test-reporters) · playwright.dev · list, html, junit, blob and custom reporters (*read*) · fetched 2026-10-14 and [Retries](https://playwright.dev/docs/test-retries) · playwright.dev · flaky status, `retries` and serial interplay (*read*) · fetched 2026-10-14 and [Docker](https://playwright.dev/docs/docker) · playwright.dev · the `mcr.microsoft.com/playwright` image and tag pinning (*read*) · fetched 2026-10-14
- **Our delta:** how the three settings combine in one config. No separate good non-official source beat the official pages.

### T15-01 · POM, custom matchers, tags — Topic · ✅ written `docs/playwright/pages/15-advanced-patterns/01-scalable-test-architecture.md`
- **Read this:** [Page object models](https://playwright.dev/docs/pom) · playwright.dev · a class holding locators and actions, wired in by constructor · (*read*) · covers our angle: **partial — no matchers or tags** · fetched 2026-10-14
- **Also good:** [Annotations](https://playwright.dev/docs/test-annotations) · playwright.dev · `tag` and `annotation` options, `--grep` filtering (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Playwright Page Object Model: Pattern Guide & Code Examples](https://testdino.com/blog/playwright-page-object-model) · Ayush Mania, TestDino, 2026-04-30 · POMs delivered through fixtures · fetched 2026-10-14 (*read*)
- **Our delta:** `expect.extend` matchers, which the official pages above do not cover; see the assertions page.

### T16-01 · Flaky in CI, green locally — Topic · ✅ written `docs/playwright/pages/16-real-world-workflows-and-recipes/01-diagnosing-flaky-ci-tests.md`
- **Read this:** [Best Practices](https://playwright.dev/docs/best-practices) · playwright.dev · web-first assertions, isolation, debugging on CI with traces · (*read*) · covers our angle: **partial — general rules, no triage recipe** · fetched 2026-10-14
- **Also good:** [Retries](https://playwright.dev/docs/test-retries) · playwright.dev · flaky classification and the retry count (*read*) · fetched 2026-10-14 and [Timeouts](https://playwright.dev/docs/test-timeouts) · playwright.dev · test, expect and action budgets (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Reproduce CI Failures Locally in Playwright](https://dev.to/playwright/how-to-reproduce-ci-failures-locally-in-playwright-lfl) · Debbie O'Brien, DEV Community, 2025-02-19 · matches CI conditions locally; by a Playwright team member · fetched 2026-10-14 (*read*)
- **Our delta:** the triage order: reproduce, trace, classify, fix.
