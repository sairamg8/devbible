---
title: "Auto-Waiting & Assertions: Web-First Assertions, Actionability & Soft Assertions"
sidebar_label: "Auto-Waiting & Assertions"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Playwright documentation —
> [Assertions](https://playwright.dev/docs/test-assertions) (auto-retrying vs non-retrying
> matchers, the 5-second assertion timeout, `expect.soft`, `expect.poll`, `expect.toPass`),
> [Timeouts](https://playwright.dev/docs/test-timeouts) (the default table) and
> [Actionability](https://playwright.dev/docs/actionability) (the per-action check table).
> Documentation-validated; **no sandbox run**, **no timings** — `@playwright/test` is not installed
> in this checkout. The track carries **no pinned version** (`policy: latest`).
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🎭 Auto-Waiting & Assertions: Web-First Assertions, Actionability & Soft Assertions

## 1. Under-The-Hood Mechanics

Playwright's defining reliability feature is **automatic, built-in waiting** — both for actions (clicking, filling) and for assertions — eliminating the manual `sleep()`/arbitrary-delay patterns that plague less sophisticated automation tools.

```
expect(locator).toBeVisible()
        │
        ▼
NOT a single, instant check — RETRIES the check repeatedly (polling) until it PASSES,
or a timeout elapses — this is why it's called a "web-first" assertion: designed
SPECIFICALLY for the reality that web UIs update asynchronously

Actionability checks — PER ACTION, not one universal set. For .click() the runner waits for:
    visible → stable (same bounding box for two animation frames) → receives events (it is the
    hit target at the action point) → enabled
  ──► only THEN does the actual click dispatch
  ⚠️ .fill() checks visible/enabled/EDITABLE only, and .press()/.pressSequentially()/
      .setInputFiles() check NOTHING — the full table is in the actions doc
```

Which checks a given method performs is documented per action in
[Actionability](https://playwright.dev/docs/actionability) and reproduced for the four
surprising rows in the [actions doc](../04-actions-and-interactions/01-interaction-primitives.md).
Assuming the `click` set applies to everything is the single most common way a test ends up
"auto-waiting" for something Playwright was never going to wait for.

### Why This Eliminates an Entire Category of Flaky Tests
Without built-in auto-waiting, a test clicking a button the instant after a state change would race against that button's own re-render — sometimes the click lands correctly, sometimes it fires against a stale, about-to-be-replaced DOM node, producing exactly the "flaky, sometimes passes sometimes fails" test behavior that's historically plagued E2E testing. Playwright's actionability checks and web-first assertions build the "wait until it's actually ready" logic into every action/assertion by default, rather than requiring manual `waitFor`-style calls sprinkled through every test (though `waitFor`-equivalent explicit waits still exist for genuinely custom conditions).

### Soft Assertions: Continuing After a Failure
```typescript
await expect.soft(page.getByText('Total: $45.99')).toBeVisible();
await expect.soft(page.getByText('Free shipping')).toBeVisible();
// test CONTINUES even if the first soft assertion failed — both are checked,
// and the test fails at the END if EITHER failed, reporting BOTH results
```
Regular `expect()` throws immediately on failure, stopping the test right there — `expect.soft()` records a failure but lets the test **continue**, useful when checking several independent, unrelated things in one test and wanting visibility into all of them, not just whichever failed first.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Historically Flaky Test Suite Becoming Reliable After Migrating From Manual Delays to Web-First Assertions.
A team's previous Selenium-based suite was riddled with `sleep(2000)`-style manual delays before every assertion, guessing at how long a given UI update might take — too short a delay caused flaky failures under slower CI load; too long a delay made the whole suite unnecessarily slow. Migrating to Playwright's web-first assertions (`expect(locator).toBeVisible()`, which polls until true or a timeout, rather than a single check after a fixed guess-based delay) eliminated both problems simultaneously: assertions resolved the moment the actual condition became true (often much faster than the old fixed delays), and genuinely slow CI runs no longer produced false failures, since the polling window itself absorbed that variability.

---

## 3. Production-Grade Code Example

```typescript
// Web-first assertions — auto-retrying until they pass or time out
test('adds an item to the cart', async ({ page }) => {
  await page.goto('/products/1');
  await page.getByRole('button', { name: 'Add to Cart' }).click();

  // Polls/retries automatically — no manual wait needed for the cart badge to update
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeDisabled(); // a SETTLED state — never assert a state the UI passes THROUGH (see Gotchas)
});
```

```typescript
// Actionability checks happening automatically before an action
test('clicks a button that becomes enabled after validation passes', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('alex@acme.com');

  // Playwright automatically WAITS for this button to become enabled (actionability check)
  // before attempting the click — no manual expect().toBeEnabled() needed first
  await page.getByRole('button', { name: 'Continue' }).click();
});
```

```typescript
// Soft assertions — checking several independent things, seeing ALL results even if one fails
test('order confirmation page shows all expected details', async ({ page }) => {
  await page.goto('/order-confirmation/123');

  await expect.soft(page.getByText('Order #123')).toBeVisible();
  await expect.soft(page.getByText('Total: $45.99')).toBeVisible();
  await expect.soft(page.getByText('Estimated delivery')).toBeVisible();
  // If ONE of these fails, the test STILL checks the others, reporting ALL results at the end —
  // more informative than stopping at the FIRST failure and never learning about the rest
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Adding Manual `waitForTimeout()` Delays "Just in Case"
```typescript
// ❌ ANTI-PATTERN: reintroduces the exact flakiness/slowness tradeoff web-first assertions
// were designed to eliminate — an arbitrary guess-based delay, not a real readiness check
await page.getByRole('button', { name: 'Submit' }).click();
await page.waitForTimeout(2000); // guessing — might be too short (flaky) or too long (slow)
await expect(page.getByText('Success')).toBeVisible();

// ✅ CORRECT: let the web-first assertion itself do the waiting — no arbitrary delay needed
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText('Success')).toBeVisible(); // polls until true or timeout, no guessing
```

### ⚠️ Pitfall 2: Using Regular `expect()` When Checking Several Independent, Unrelated Conditions
```typescript
// ❌ LESS INFORMATIVE: if the FIRST assertion fails, the test stops immediately — you never
// learn whether the SECOND and THIRD conditions were also broken, requiring multiple
// debug-fix-rerun cycles to discover each issue one at a time
await expect(page.getByText('Order #123')).toBeVisible(); // fails here — test STOPS
await expect(page.getByText('Total: $45.99')).toBeVisible(); // never even checked

// ✅ CORRECT: expect.soft() for independent checks where seeing ALL results at once is valuable
await expect.soft(page.getByText('Order #123')).toBeVisible();
await expect.soft(page.getByText('Total: $45.99')).toBeVisible(); // STILL checked, even if the first failed
```

### ⚠️ Pitfall 3: Assuming Actionability Checks Substitute for Explicit Assertions About State
```typescript
// ❌ INCOMPLETE: a successful click only confirms the button WAS clickable at that moment —
// it does NOT verify anything about the RESULT of clicking it
await page.getByRole('button', { name: 'Submit' }).click(); // ✅ this succeeding proves nothing about correctness

// ✅ CORRECT: always follow an action with an explicit assertion about its EXPECTED RESULT —
// actionability checks ensure the action COULD happen correctly, not that the app BEHAVED correctly
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText('Form submitted successfully')).toBeVisible();
```

---

## The defaults, and how they interact

Every number below is quoted from [Timeouts](https://playwright.dev/docs/test-timeouts) and
[Assertions](https://playwright.dev/docs/test-assertions); none of it was measured here.

| Budget | Default | Documented as |
|---|---|---|
| Test | 30 s | *"Playwright Test enforces a timeout for each test, 30 seconds by default."* |
| Auto-retrying assertion | 5 s | *"By default, the timeout for assertions is set to 5 seconds."* |
| Action | none | listed as *"no timeout"* |
| Navigation | none | listed as *"no timeout"* |
| Global | none | *"There is no default global timeout, but you can set a reasonable one in the config."* |
| Fixture | shares the test's | *"By default, fixture shares timeout with the test."* |

The interaction is what bites. An assertion gives up after 5 seconds and names the assertion; an
action never gives up on its own, so it consumes the *test's* 30 seconds and is then reported as a
test timeout naming nothing in particular. Two failures with the same root cause therefore read
completely differently depending on whether you asserted or acted.

## Gotchas

**★ Symptom: an assertion can never fail, no matter what the app does.** Cause: a missing `await`. The reference is blunt — *"Note that retrying assertions are async, so you must `await` them."* — and an un-awaited assertion returns a promise that nobody inspects, so the test proceeds and passes. Fix: `await` every `expect(locator).…`, and turn on a lint rule for floating promises; this is the one defect in this chapter that produces a **green** suite that verifies nothing.

**★ Symptom: an assertion about a spinner, a toast or a briefly-disabled button is flaky.** Cause: an auto-retrying matcher polls until the condition is **true**, so it can only prove a state that is still there when it looks. A state the UI passes *through* may be gone before the first poll, and no amount of retrying brings it back. Fix: assert the settled outcome instead — not "the spinner appeared", but "the table has 20 rows". If the transient state genuinely is the requirement, watch for its *consequence* rather than for the state itself.

**★ Symptom: `expect(await locator.textContent()).toBe('1')` fails intermittently while `await expect(locator).toHaveText('1')` does not.** Cause: they are in different groups. The docs split matchers into the ones where *"The following assertions will retry until the assertion passes"* and the ones that *"allow to test any conditions, but do not auto-retry"*. Moving the `await` inside the `expect(...)` argument reads the DOM exactly once and hands a plain string to a non-retrying matcher. Fix: keep the locator inside `expect()` and let the matcher do the polling — the shape `await expect(locator).toX()` is the whole contract.

**★ Symptom: a correct, slow page fails at 5 seconds while the test still had 25 left.** Cause: the assertion timeout is separate from and much smaller than the test timeout. Fix: widen the *one* assertion that is legitimately slow — `await expect(report).toBeVisible({ timeout: 30_000 })` — rather than raising the global `expect` timeout, which slows every genuine failure in the suite by the same amount.

**★ Symptom: after a soft assertion fails, the rest of the test throws confusing errors.** Cause: soft assertions do exactly what they say — *"failed soft assertions do not terminate test execution, but mark the test as failed."* — so execution continues into code whose precondition has just been shown to be false. Fix: use `expect.soft` for a run of **independent** checks about a page that has already settled, and a hard `expect` for anything the following lines depend on. When you need to branch, `expect(test.info().errors).toHaveLength(0)` reads the failures collected so far.

**★ `expect.toPass` ignores your configured assertion timeout.** The reference notes it *"does not respect custom expect timeout"* and that its own default timeout is 0 — i.e. it will retry the block until something else stops it, which in practice is the 30-second test budget. Fix: always pass `{ timeout: … }` when you use `toPass`, or a mistake in the block becomes a test timeout rather than an assertion failure.

**`expect.poll` is for conditions Playwright cannot see.** Anything that is not a locator — a row in your database, a queue depth, a third-party API returning "processed" — has no web-first matcher, and the temptation is a `waitForTimeout` loop. `expect.poll` wraps the synchronous expectation in *"asynchronous polling"* so the retrying behaviour extends to values you fetch yourself.

**Auto-waiting is not a substitute for asserting the result.** A successful click proves the button was clickable, and nothing else. Every action should be followed by an assertion about what the action was supposed to *cause* — this is the page's third pitfall, and it is the difference between a suite that catches regressions and a suite that catches only crashes.

## Interview questions

**★ What makes an assertion "web-first", and how is it different from `expect(await …)`?**
A web-first matcher receives the locator, not a value, so it can re-read the DOM: it polls until the condition holds or the assertion timeout expires. `expect(await locator.textContent()).toBe('1')` resolves the value first and hands a dead string to a matcher that has no way to look again — one sample, taken at whatever moment the line executed. That is why the same logical check is stable in one form and flaky in the other, and why the documented split between matchers that *"retry until the assertion passes"* and matchers that *"do not auto-retry"* is worth memorising rather than looking up.

**★ What are the default timeouts, and what does a failure look like under each?**
A test gets 30 seconds; an auto-retrying assertion gets 5; actions and navigations get none by default. An assertion that fails therefore fails at 5 seconds with a message naming the matcher, the locator and what it saw instead — a good error. An action that can never satisfy its actionability checks fails at 30 seconds as a test timeout, because nothing smaller ever stopped it — a bad error. Knowing which of the two you are looking at is most of the diagnosis, and setting a project-level `actionTimeout` is how you convert the second kind into the first.

**★ Why does forgetting `await` on an assertion make a test pass rather than fail?**
Because a retrying assertion is asynchronous. Un-awaited, it returns a promise; the failure it will eventually produce arrives after the test function has already returned, so it does not fail the test that wrote it — and the test reports success having verified nothing. This is the strongest practical argument for enabling `no-floating-promises`: the defect is invisible in the report, and a suite can accumulate dozens of them before anyone notices that a feature was broken for a month under green ticks.

**★ When would you use `expect.poll` or `expect.toPass` instead of a normal assertion?**
`expect.poll` when the thing you are waiting on is not in the DOM — a database row, a queue, an email that should have been sent — because it lends the retry behaviour to a value you fetch yourself. `expect.toPass` when the *whole block* has to be retried, typically because the first step of it is what fails intermittently: re-open a menu, re-read a value, assert. The catch worth stating in an interview is that `toPass` does not respect the configured expect timeout and defaults to 0, so an un-timeouted `toPass` retries until the test itself dies.

**★ When are soft assertions the right tool, and when are they a mistake?**
Right when a page has settled and you want a complete report of what is wrong with it — an order confirmation showing five fields, a rendered invoice, a dashboard. You learn about all five defects in one run instead of five. A mistake when a later step depends on an earlier one: after a soft failure the test keeps going, so a missing element produces a cascade of secondary failures that bury the real one. The rule of thumb is that soft assertions are for *reporting*, hard assertions are for *control flow*.

**Does auto-waiting mean explicit waits are never needed?**
No — it means arbitrary sleeps are never needed. The auto-waiting covers actionability before actions and polling inside assertions; anything outside that (a specific network response, a custom readiness condition, a value that lives outside the browser) still needs an explicit construct, which is what `waitForResponse`, `expect.poll` and `expect.toPass` are for. What disappears is `waitForTimeout(2000)`, because a fixed guess is simultaneously too short under CI load and too long everywhere else.

---

← [Actions and interactions](../04-actions-and-interactions/01-interaction-primitives.md) · [Playwright index](../../README.md) · Next → [Navigation and network](../06-navigation-and-network/01-navigation-and-interception.md)
