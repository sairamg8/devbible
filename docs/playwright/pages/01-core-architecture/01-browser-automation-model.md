---
title: "Core Architecture: Browser/Context/Page Hierarchy & Out-of-Process Drivers"
sidebar_label: "Core Architecture"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Playwright documentation —
> [Test fixtures](https://playwright.dev/docs/test-fixtures),
> [Actionability](https://playwright.dev/docs/actionability),
> [Locators](https://playwright.dev/docs/locators) and the project home page
> ([playwright.dev](https://playwright.dev/)). Documentation-validated; **no sandbox run** —
> `@playwright/test` is not installed in this checkout, so every claim below is a documentation
> quote, never a runtime probe. The track carries **no pinned version** (`policy: latest`) and
> playwright.dev publishes only the current release, so this page asserts no version number.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🎭 Core Architecture: Browser/Context/Page Hierarchy & Out-of-Process Drivers

## 1. Under-The-Hood Mechanics

Playwright automates real browser engines through a three-level hierarchy, each level providing a genuinely different isolation guarantee — understanding which level a given piece of state lives at is essential for correctly reasoning about test isolation.

```
Browser                    ──► ONE actual browser process (Chromium/Firefox/WebKit) — expensive to start,
                                 typically launched ONCE per test suite/worker, reused across many tests
        │
        ▼
BrowserContext             ──► an ISOLATED session within that browser — like a fresh incognito window:
                                 its OWN cookies, localStorage, cache — completely separate from other
                                 contexts in the SAME browser process
        │
        ▼
Page                          ──► a single TAB within a context — can have MULTIPLE pages per context
                                    (simulating multiple tabs), but they SHARE that context's cookies/storage
```

### Multi-Browser Engine Support From One API
Playwright drives Chromium, Firefox, and WebKit (Safari's engine) through the **same** API surface — a test written once runs identically against all three engines by simply changing which browser is launched, letting cross-browser coverage come from configuration (the `projects` matrix, covered in the [test runner doc](../02-test-runner/01-playwright-test-fixtures.md)) rather than separate, engine-specific test code.

### Out-of-Process Drivers: Why This Design Is Fast and Reliable
Your test code runs in Node, in a **different process from the browser it drives**, and it does not steer the page by injecting a script that executes inside the page's own JavaScript context. That separation is what enables Playwright's auto-waiting and actionability checks (covered in the [assertions doc](../05-auto-waiting-and-assertions/01-web-first-assertions.md)) to work reliably — the automation layer isn't fighting for the same execution context as the page's own JavaScript, and isn't vulnerable to a page's script blocking or interfering with the automation commands themselves.

⚠️ **The transport is NOT confirmed here, and this page used to assert it.** An earlier revision said the driver talks to each engine *"over a WebSocket"*. None of the documentation pages read on 2026-09-06 (fixtures, actionability, locators, network, the `Page` API reference, the home page) states the wire protocol, or whether a locally launched browser is driven over a socket or an OS pipe. Treat the transport as an unspecified implementation detail. What the documentation does commit to is the surface:

> *"Chromium, Firefox, and WebKit on Linux, macOS, and Windows. Headless and headed."*
> — [playwright.dev](https://playwright.dev/)

---

## 2. Real-World Engineering Scenario

**Scenario**: A Flaky Test Suite Traced to Tests Sharing Browser State Across Test Runs.
A team's E2E suite exhibited intermittent, hard-to-reproduce failures — one test's login session occasionally "leaked" into a completely unrelated test, causing assertions about an unauthenticated state to fail unpredictably. The root cause: an early, ad-hoc setup reused a single `BrowserContext` across multiple tests to save startup time, inadvertently sharing cookies/localStorage between tests that were supposed to be fully independent. Switching to Playwright's default behavior — a **fresh `BrowserContext` per test** (see [fixtures and test isolation](../08-fixtures-and-test-isolation/01-fixture-system.md)) — eliminated the leakage entirely, since each test now genuinely started with a clean, isolated session, exactly like a brand-new incognito window.

---

## 3. Production-Grade Code Example

```typescript
// playwright.config.ts — configuring which browser ENGINES to run the same suite against
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

```typescript
// Manually demonstrating the Browser → BrowserContext → Page hierarchy (most tests use
// the built-in `page` fixture, which already handles this — shown explicitly here for clarity)
import { chromium } from '@playwright/test';

const browser = await chromium.launch(); // ONE browser process

const contextA = await browser.newContext(); // isolated session A — own cookies/storage
const contextB = await browser.newContext(); // isolated session B — COMPLETELY separate from A

const pageA1 = await contextA.newPage(); // tab 1 in session A
const pageA2 = await contextA.newPage(); // tab 2 in session A — SHARES contextA's cookies with pageA1
const pageB1 = await contextB.newPage(); // tab 1 in session B — has NO access to contextA's cookies at all

await browser.close();
```

```typescript
// A test relying on genuine context isolation — two "users" in the same test, fully independent
test('two users see independent sessions', async ({ browser }) => {
  const adminContext = await browser.newContext();
  const guestContext = await browser.newContext();

  const adminPage = await adminContext.newPage();
  const guestPage = await guestContext.newPage();

  await adminPage.goto('/login');
  await adminPage.fill('#username', 'admin');
  await adminPage.click('button[type=submit]');

  await guestPage.goto('/dashboard');
  await expect(guestPage.getByText('Please log in')).toBeVisible(); // guest is NOT logged in, despite admin being logged in
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reusing a `BrowserContext` Across Tests to "Save Time"
```typescript
// ❌ RISKY: sharing a context across tests means cookies/localStorage/session state LEAKS
// between tests that should be fully independent — exactly the flakiness scenario above
let sharedContext; // module-level, reused across every test — DON'T do this
test.beforeAll(async ({ browser }) => { sharedContext = await browser.newContext(); });

// ✅ CORRECT: let Playwright's default per-test context creation handle isolation —
// the built-in `page`/`context` fixtures already provide a FRESH context per test automatically
test('my test', async ({ page }) => { /* page's context is ALREADY fresh and isolated */ });
```

### ⚠️ Pitfall 2: Launching a New `Browser` Process Per Test Instead of Per Worker
```typescript
// ❌ WASTEFUL: launching an entire browser PROCESS per individual test is unnecessarily slow —
// browser startup is the expensive part; contexts are cheap and fast to create by comparison
test('slow pattern', async () => {
  const browser = await chromium.launch(); // ❌ new browser PROCESS for every single test
  // ...
  await browser.close();
});

// ✅ CORRECT: Playwright's test runner already launches ONE browser per WORKER process,
// reusing it across many tests within that worker, creating only a fresh CONTEXT per test —
// use the built-in fixtures rather than manually launching browsers in test bodies
```

### ⚠️ Pitfall 3: Assuming Multiple Pages in One Context Are Isolated From Each Other
```typescript
// ❌ WRONG ASSUMPTION: two pages (tabs) within the SAME context SHARE cookies/localStorage —
// a test simulating "two independent tabs" using pages from ONE context won't see genuine isolation
const page1 = await context.newPage();
const page2 = await context.newPage(); // SAME context — shares login/session state with page1

// ✅ CORRECT: for genuinely independent sessions (simulating two different users), use
// separate BrowserContexts, not just separate pages within one shared context
```

---

## Gotchas

**★ Symptom: a test that asserts "logged out" passes on its own and fails in a full run.** Cause: something is holding a `BrowserContext` across tests — a module-level variable filled in `beforeAll`, or a helper that caches one "to save time". Cookies and `localStorage` live on the *context*, so the previous test's session is simply still there. Fix: take the session from a fixture rather than from a variable. The fixtures table documents `context` as *"Isolated context for this test run"* and `page` as *"Isolated page for this test run"* — a test that only ever destructures `{ page }` cannot leak, because it never holds a reference that outlives itself.

**★ Symptom: a "two tabs" test proves nothing.** Two `newPage()` calls on the same context are two tabs of one profile — one cookie jar, one storage area. If the second page renders a logged-in header, that is not evidence the app restored a session; it is the *same* session. Fix: for two **users**, call `browser.newContext()` twice and take one page from each, exactly as the two-users example above does.

**★ Symptom: the suite is slow and CI runners run out of memory.** Cause: `chromium.launch()` in the test body — one browser **process** per test. The browser is the expensive object; the fixtures reference describes `browser` as *"Browsers are shared across tests to optimize resources."* Fix: never launch inside a test. Declare `{ browser }` and call `newContext()` when you genuinely need a bespoke profile, otherwise just take `{ page }`.

**A context you create by hand is yours to close.** Fixture teardown covers fixtures — *"Setup is executed before the test/hook requiring it is run, and teardown is executed when the fixture is no longer being used by the test/hook."* A context you obtained by calling `browser.newContext()` yourself is not a fixture. ⚠️ The pages checked in this pass do not state whether such a context is closed when the worker's browser is torn down, so do not rely on it: `await context.close()` in the test, or wrap the creation in your own fixture so the teardown is written down exactly once.

**Clearing cookies in `beforeEach` is a smell, not a safety net.** With a fresh context per test there is nothing to clear. A `beforeEach` that clears state almost always exists because something *else* in the suite is sharing a context — deleting the clearing step and watching what breaks is how you find the real leak.

**`projects` multiplies the run; it does not deduplicate it.** Three browser projects execute the whole suite three times, and a failure is reported per project — so "this test is flaky" very often means "this test fails only under WebKit". Fix: read the project name off the failing test *before* debugging it, and gate genuinely engine-specific behaviour on the `browserName` fixture, documented as *"The name of the browser currently running the test."*

## Interview questions

**★ What does a `BrowserContext` give you that a second `Page` does not?**
A context is an isolated profile: its own cookie jar, its own `localStorage`, its own cache. Two pages inside one context are two tabs of the *same* profile and share all of it. So the isolation boundary you care about in tests — "this test cannot see the previous test's login" — is the context, not the page. The practical consequence is that simulating two different users needs two contexts, while simulating one user with two tabs open needs two pages in one context, and the two setups look almost identical in code.

**★ Per-test isolation is famously expensive in other tools. Why is it the default here?**
Because the expensive object is not the one being recreated. Starting a browser process is the slow part, and the `browser` fixture is documented as shared — *"Browsers are shared across tests to optimize resources."* What each test gets fresh is a context, which is a profile inside that already-running process. You therefore pay the browser start-up cost roughly once per worker rather than once per test, while still getting a genuinely clean profile per test. ⚠️ Note that this is the architecture argument; the pages checked on 2026-09-06 give no per-context timing figure, so do not quote one.

**★ How would you test two users interacting inside a single test — say, a chat message from A appearing for B?**
Take the `browser` fixture, create two contexts, and take a page from each. Log A in on one, B in on the other, act on A's page, and assert on B's page. Both live inside one browser process, so the cost is two profiles, not two browsers. The thing that makes this work at all is that the two contexts genuinely cannot see each other's cookies — which is the same property that makes per-test isolation trustworthy.

**★ What exactly runs out-of-process here, and what does that buy?**
Your test code runs in Node; the page runs in the browser. Nothing in the automation layer executes inside the page's own JavaScript context, so a page script that blocks the event loop, throws, or overwrites globals cannot disable the automation driving it. That is the structural reason auto-waiting can be trusted: the thing doing the waiting is not the thing being waited on. ⚠️ Do not extend this into a claim about the wire protocol — the documentation checked here does not specify it.

**When is sharing state between tests still the right answer?**
When you share *serialized* state rather than a live context. Reusing one logged-in `BrowserContext` across tests couples them; saving the authenticated state to a file and seeding each test's fresh context from it does not — every test still starts from an isolated profile, it just starts from an isolated profile that is already logged in. That distinction is the whole subject of [authentication and state](../07-authentication-and-state/01-session-reuse.md).

**What does adding an entry to `projects` change about a test's identity?**
It stops the test being one thing. The same file, the same title, now runs once per project, and the project name becomes part of how the run reports and retries it. Anything that keys off "the test" — a snapshot name, a fixture that writes to a shared path, a test-scoped external record — has to include the project, or two projects will collide on the same key.

---

← [Playwright index](../../README.md) · Next → [Test runner](../02-test-runner/01-playwright-test-fixtures.md)
