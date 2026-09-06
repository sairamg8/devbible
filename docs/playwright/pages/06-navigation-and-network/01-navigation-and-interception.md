---
title: "Navigation & Network: `page.goto()`, `page.route()` & HAR Replay"
sidebar_label: "Navigation & Network"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Playwright documentation —
> [Network](https://playwright.dev/docs/network) (routing, the Service Workers exception),
> the [`Page` API reference](https://playwright.dev/docs/api/class-page) (`goto`'s `waitUntil`
> default and the DISCOURAGED note on `networkidle`) and
> [Mock APIs](https://playwright.dev/docs/mock) for HAR. Documentation-validated; **no sandbox
> run** — `@playwright/test` is not installed in this checkout. The track carries **no pinned
> version** (`policy: latest`).
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🎭 Navigation & Network: `page.goto()`, `page.route()` & HAR Replay

## 1. Under-The-Hood Mechanics

Beyond simple navigation, Playwright provides direct control over the network layer itself — intercepting, modifying, mocking, and asserting against real HTTP traffic the page generates, at a lower level than application-side tools like MSW (which intercept within the JS runtime; Playwright intercepts at the browser's own network layer, one level further out).

```
page.goto(url)              ──► navigates, waits for the 'load' event by default (configurable via waitUntil)
page.waitForURL(pattern)       ──► waits for navigation to REACH a specific URL (e.g. after a client-side redirect)
page.waitForLoadState(state)     ──► waits for a specific readiness signal: 'load' | 'domcontentloaded' | 'networkidle'

page.route(pattern, handler)       ──► intercepts EVERY request matching the pattern, BEFORE it reaches the network —
                                          can fulfill with a mock response, modify the real request, or let it through
page.waitForResponse(pattern)        ──► waits for and returns a SPECIFIC response, for asserting on real network activity
```

### `page.route()`: Intercepting at the Browser's Network Layer
Because interception happens at the browser's network layer rather than by monkey-patching `fetch`/`XMLHttpRequest` inside the page's own JS context, `page.route()` sees requests the page's own code knows nothing about — a `fetch` call, an `<img>` tag, a stylesheet — without that code cooperating with, or even being aware of, the interception.

🔴 **"Every request" is too strong, and the documentation names the exception:**

> *"If you're using Playwright's native `browserContext.route()` and `page.route()`, and it appears network events are missing, disable Service Workers by setting `serviceWorkers` to `'block'`."*
> — [Network](https://playwright.dev/docs/network)

⚠️ WebSocket traffic is a separate question that this pass did **not** settle: none of the pages read on 2026-09-06 states whether `route()` covers a WebSocket handshake, and Playwright exposes WebSocket-specific API surface. Do not assume either way — check the `Page` API reference before writing a test that depends on it.

### HAR Replay: Deterministic, Recorded Network Traffic
Recording a real session's network traffic into a HAR (HTTP Archive) file, then replaying it during tests, provides a **realistic**, previously-recorded response dataset without depending on a real backend being available/stable during test runs — useful for genuinely deterministic E2E tests against complex, slow, or rate-limited third-party APIs.

---

## 2. Real-World Engineering Scenario

**Scenario**: Testing an Error State for a Third-Party Payment Gateway Without Ever Actually Triggering a Real Failed Charge.
An E2E test needed to verify the checkout flow's behavior when a payment gateway returns a decline response — triggering a REAL decline against the actual payment provider's sandbox would be slow, potentially rate-limited, and awkward to reliably reproduce on demand. `page.route()` intercepted the specific payment API endpoint and returned a mocked "card declined" response directly, letting the test deterministically verify the app's error-handling UI without any dependency on the real payment gateway's actual behavior, uptime, or sandbox test-card quirks.

---

## 3. Production-Grade Code Example

```typescript
// page.route() — mocking a specific API response to test an error state deterministically
test('shows an error message when payment is declined', async ({ page }) => {
  await page.route('**/api/payments/charge', async (route) => {
    await route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'card_declined', message: 'Your card was declined.' }),
    });
  });

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Pay Now' }).click();

  await expect(page.getByText('Your card was declined.')).toBeVisible();
});
```

```typescript
// page.waitForResponse() — asserting on REAL network activity, not just UI state
test('triggers exactly one analytics call on page view', async ({ page }) => {
  const analyticsPromise = page.waitForResponse((response) =>
    response.url().includes('/analytics/pageview') && response.status() === 200
  );

  await page.goto('/products');
  const response = await analyticsPromise; // waits for and returns the matching response
  expect(response.ok()).toBeTruthy();
});
```

```typescript
// HAR replay — deterministic tests against previously-recorded network traffic
test('renders products from recorded network traffic', async ({ page, context }) => {
  await context.routeFromHAR('./har/products.har', { url: '**/api/products' });
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
});
```

⚠️ **How the HAR was recorded is deliberately not shown here.** An earlier revision of this page named an `npx playwright test --save-har=…` flag as the recording step; that flag could not be confirmed against the documentation on 2026-09-06, so it has been **removed rather than corrected from memory**. Read the recording half of [Mock APIs](https://playwright.dev/docs/mock) before recording, and do not copy a command out of this page.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `page.route()` Must Be Set Up BEFORE the Navigation That Triggers the Request
```typescript
// ❌ WRONG: setting up the route AFTER navigating means the initial page-load requests
// have ALREADY fired before the interception was ever registered — too late to catch them
await page.goto('/checkout'); // requests already fired
await page.route('**/api/payments/charge', handler); // registered too late for THIS page's initial load

// ✅ CORRECT: register the route BEFORE navigating, so it's active for every subsequent request
await page.route('**/api/payments/charge', handler);
await page.goto('/checkout');
```

### ⚠️ Pitfall 2: Using `waitForLoadState('networkidle')` as a General-Purpose "Wait for Everything" Hammer
```typescript
// ❌ RISKY: networkidle waits for NO network activity for a period — but modern apps with
// polling, analytics beacons, or long-lived WebSocket connections may NEVER go fully idle,
// causing this to time out unnecessarily, or to wait far longer than actually needed
await page.waitForLoadState('networkidle'); // can hang/timeout on apps with persistent background activity

// ✅ CORRECT: prefer specific, targeted waits — a web-first assertion for the actual UI
// state that matters, or waitForResponse for a SPECIFIC request, rather than a blanket "idle" wait
await expect(page.getByText('Products loaded')).toBeVisible();
```

### ⚠️ Pitfall 3: Over-Relying on HAR Replay, Never Testing Against the Real Backend
HAR replay provides deterministic, fast tests — but a recorded HAR file can drift out of sync with the real backend's actual current behavior (a changed response shape, a new required field) without any test ever failing, since the test only ever verifies against the frozen, recorded snapshot. Reserve HAR replay for specific, deliberately-isolated scenarios (third-party APIs, hard-to-reproduce edge cases) rather than replacing all real-backend E2E coverage — a suite testing exclusively against replayed HAR files can pass consistently while the actual live integration is silently broken.

---

## What `goto` actually waits for

> *"`'load'` - consider operation to be finished when the `load` event is fired."* — the default for
> `waitUntil`. The alternatives are `'domcontentloaded'`, `'commit'` (*"consider operation to be
> finished when network response is received and the document started loading"*) and `'networkidle'`.
> — [`Page` API reference](https://playwright.dev/docs/api/class-page)

And on that last one, the documentation carries a warning in its own text rather than in a footnote:

> *"`'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network
> connections for at least `500` ms. Don't use this method for testing, rely on web assertions to
> assess readiness instead."*
> — [`Page` API reference](https://playwright.dev/docs/api/class-page)

`'commit'` is the useful one nobody reaches for: it returns as soon as the document starts loading,
which is what you want when the very next line is a web-first assertion that will do the real
waiting anyway.

## Gotchas

**★ Symptom: a route handler that never fires, on an app that uses a Service Worker.** Cause: requests served or issued by a Service Worker are the documented blind spot of native routing — including the one introduced by an in-page mocking library. Fix: set `serviceWorkers: 'block'` in the context options, as the network guide recommends, and re-run; if the handler starts firing, that was the cause and not your glob.

**★ Symptom: `waitForLoadState('networkidle')` hangs, or passes far too late.** Cause: it waits for *"no network connections for at least `500` ms"*, and a page with polling, analytics beacons or an open stream never gets there. The documentation marks it **DISCOURAGED** and tells you what to do instead: *"rely on web assertions to assess readiness instead."* Fix: assert the UI state you actually care about; the assertion polls, and it fails with a message naming what was missing rather than with a timeout naming nothing.

**★ Symptom: the mock applies "sometimes", or the real endpoint gets hit anyway.** Cause: a handler whose promise is dropped. `page.route('…', (route) => { route.fulfill(…); })` starts the fulfilment and returns immediately; the documentation's own examples either return the promise (`route => route.fulfill(…)`) or await it inside an `async` handler. Fix: write handlers `async` and `await` every `route.*` call — the same rule as the assertions chapter, for the same reason.

**★ Symptom: the interception has no effect on the first page load.** Cause: registration order. A route registered after `goto()` cannot catch requests that `goto()` already issued, including the document request itself. Fix: register every route before the navigation that triggers it — and note that this applies to `context.route()` too if the very first navigation is what you are mocking.

**★ Symptom: the test passes after the API endpoint was renamed.** Cause: the glob stopped matching, the mock silently stopped applying, and the real (now 404-ing) request went through to an app that handles the error gracefully. A route that never fires is indistinguishable from a route that fires and works. Fix: make the mock's use observable — count invocations in the handler and assert the count, or use `route.fetch()` to hit the real endpoint and fulfil from a modified copy of the real response, so a renamed route breaks the test instead of quietly bypassing it.

**★ Symptom: `waitForResponse` times out even though the request definitely happened.** Cause: the promise was created *after* the action that triggered the response, so the event had already fired by the time anyone was listening. The example above gets this right — the `waitForResponse` promise is created first, the navigation runs second, and only then is the promise awaited. Fix: keep that order; never `await page.click(...)` and then start waiting for the response it caused.

**A HAR file is a snapshot with no expiry.** The page's third pitfall is the important one and bears repeating in one line: a recorded HAR keeps passing after the real backend has changed shape, so a suite tested exclusively against replay can be green against an integration that has been broken for weeks. Reserve replay for third-party and hard-to-reproduce cases, and keep at least one path exercising the real backend.

**Route scope is per object, not global.** `page.route()` is registered on that page and `browserContext.route()` on the context. ⚠️ This pass did not verify how either behaves for a popup or a page opened later in the same context, so if your flow opens a second window, check the API reference rather than assuming the opener's routes are inherited.

## Interview questions

**★ Where does `page.route()` intercept, and what does that buy you over an in-page mock?**
At the browser's network layer, outside the page's JavaScript context — so it applies to requests the application code never issued itself and cannot be defeated by the app not cooperating. An in-page library that patches `fetch` only sees what goes through `fetch`. The trade-off is that Playwright's routing is the *test's* mock, not the app's: it lives in the test file, so a developer running the app by hand does not get it, whereas a Service Worker-based mock runs in both places. The documented catch is that a Service Worker-based mock and native routing interfere — if events go missing, the recommendation is `serviceWorkers: 'block'`.

**★ Why must a route be registered before the navigation, and what breaks if it is not?**
Because interception is not retroactive: `goto()` issues the document request and the resource requests it discovers, and a handler registered afterwards was not there when they went out. What breaks is subtle rather than loud — the page renders with real data, your assertions about the mocked error state fail, and the natural instinct is to blame the glob. The rule is that registration is part of the *setup*, not part of the interaction.

**★ Why is `networkidle` discouraged, and what should you use instead?**
It waits for 500 ms with no network connections, which is a proxy for "the page has settled" that stops being true the moment an app polls, streams or pings analytics — the condition may arrive far later than readiness, or never. The documentation is explicit: *"Don't use this method for testing, rely on web assertions to assess readiness instead."* The replacement is not a different wait, it is an assertion about the thing you were really waiting for — a heading, a row count, a disabled state — which both waits and verifies.

**★ How do you assert that a page made a particular network call?**
Create the `waitForResponse` promise *before* the action, perform the action, then await the promise and assert on the returned `Response`. Order matters because the promise is a subscription to an event that will not be replayed. Note also that the assertion about the resolved response (`expect(response.ok()).toBeTruthy()`) is a plain, non-retrying assertion — that is correct here, because by then you are asserting about a value that has already been captured, not about the DOM.

**★ When is HAR replay the right tool, and when is it a liability?**
Right when the dependency is outside your control and hard to drive: a third-party payment or mapping API, a rate-limited service, a scenario that is awkward to provoke on demand. A liability the moment it becomes the default, because the recording is frozen and nothing in the test run will ever notice that the real response gained a required field. The honest position is that HAR replay tests your app against a *past* backend, which is exactly what you want for a third party and exactly what you do not want for your own.

**What does `goto()` wait for, and when would you change it?**
By default it waits for the `load` event. `'domcontentloaded'` returns earlier, before subresources; `'commit'` returns as soon as the response arrives and the document starts loading, which is often the best choice in a suite where the next line is a web-first assertion that does the real waiting. `'networkidle'` exists and is discouraged. The general shape is: return from navigation as early as you reasonably can, and let assertions define readiness.

---

← [Auto-waiting and assertions](../05-auto-waiting-and-assertions/01-web-first-assertions.md) · [Playwright index](../../README.md) · Next → [Authentication and state](../07-authentication-and-state/01-session-reuse.md)
