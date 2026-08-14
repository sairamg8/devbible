---
title: "Core Architecture: Browser/Context/Page Hierarchy & Out-of-Process Drivers"
sidebar_label: "Core Architecture"
sidebar_position: 1
---

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
Playwright doesn't inject a JS script into the page to control it (the older, more fragile Selenium-style approach) — it communicates with each browser engine via that engine's own native automation protocol, over a WebSocket, from a **separate process**. This out-of-process architecture is what enables Playwright's auto-waiting and actionability checks (covered in the [assertions doc](../05-auto-waiting-and-assertions/01-web-first-assertions.md)) to work reliably — the automation layer isn't fighting for the same execution context as the page's own JavaScript, and isn't vulnerable to a page's script blocking or interfering with the automation commands themselves.

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
