---
title: "Browser Mode stopped being experimental in Vitest 4 and now needs a separate provider package — but it runs one component in one real browser under Vitest's own runner, which is a different job from a Playwright end-to-end suite"
sidebar_label: "01c · Browser Mode"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vitest documentation — [Browser Mode guide](https://vitest.dev/guide/browser/), [Vitest 4.0 release blog](https://vitest.dev/blog/vitest-4). Stability history for v3 corroborated via third-party coverage of the v4 release (heise.de, InfoQ) rather than a direct vitest.dev quote — flagged inline. Provider version probed against the installed npm registry (`playwright` **1.63.0**). Documentation-validated; **no sandbox run**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Browser Mode tests one component in one real browser — it is not a Playwright replacement

**Browser Mode runs a test file inside an actual browser, driven by Vitest's own runner and reporter, instead of faking the DOM with jsdom or happy-dom.** It graduated from experimental in Vitest 4 and now requires installing a separate provider package rather than a single bundled dependency. The architectural boundary that matters for deciding where to put a given test is this: Browser Mode is Vitest orchestrating one browser tab per test file for component- and DOM-level assertions, while a standalone Playwright suite is a different tool orchestrating multi-page, cross-origin user journeys with its own runner and reporter. They share an underlying automation library on the Playwright provider path, and that is where the similarity ends.

## From experimental to stable, and the provider package split

> *"With this release we are removing the `experimental` tag from Browser Mode."* — [Vitest 4.0 release blog](https://vitest.dev/blog/vitest-4)

Vitest 3 still carried the experimental tag; community coverage of the v3 and v4 releases describes v3 as adding separate Playwright/WebdriverIO guides and improved documentation in preparation for stabilization, with the tag itself removed in v4. I could not find a vitest.dev page stating "Browser Mode was experimental in v3" in as many words — that detail is corroborated through third-party release coverage rather than quoted directly from Vitest's own site.

The stabilization came with a real config change: a single bundled `@vitest/browser` package with a triple-slash reference comment gave way to per-provider packages.

> *"To define a provider, you now need to install a separate package: `@vitest/browser-playwright`, `@vitest/browser-webdriverio`, or `@vitest/browser-preview`."* — [Vitest 4.0 release blog](https://vitest.dev/blog/vitest-4)

Vitest 5.0.0's own `peerDependencies` name each provider individually:

```json
{
  "@vitest/browser-preview": "5.0.0",
  "@vitest/browser-playwright": "5.0.0",
  "@vitest/browser-webdriverio": "^5.0.0-beta.5 || >=5.0.0"
}
```

## The three providers, and which one to default to

> *"If you don't already use one of these tools, we recommend starting with Playwright because it supports parallel execution, which makes your tests run faster."* — [Browser Mode guide](https://vitest.dev/guide/browser/)

Playwright's own registry version at time of writing is **1.63.0**. Playwright covers `firefox`, `webkit`, `chromium`; WebdriverIO covers `firefox`, `chrome`, `edge`, `safari`. `preview` is the lightweight option for local iteration without a full automation stack.

```typescript
// vite.config.ts — Browser Mode with the Playwright provider
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

```typescript
// a component test running against a real browser instance, not jsdom
import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';
import { Button } from './Button';

test('increments the counter on click', async () => {
  const screen = render(<Button label="Click me" />);
  await screen.getByText('Click me').click();
  await expect.element(screen.getByText('Clicked once')).toBeVisible();
});
```

## What Vitest 4 added on top of stabilization

> *"Vitest 4 adds support for Visual Regression testing in Browser Mode"* via a `toMatchScreenshot` assertion, and *"Vitest 4 supports generating Playwright Traces"*, with traces surfaced as reporter annotations and viewable in the Playwright Trace Viewer. Both are meaningful additions specifically because Browser Mode is now a stable target worth building tooling on top of, rather than a feature likely to change shape again soon.

## Where the boundary with end-to-end Playwright actually sits

The Vitest documentation, as fetched, does not carry an explicit "Browser Mode is not a replacement for end-to-end testing" disclaimer — two targeted fetches of the Browser Mode guide found no such sentence, so this section is reasoned from what each tool is architecturally built to do, not quoted from a doc warning.

Browser Mode tests are Vitest tests: one test file, one component or one page, run inside Vitest's own worker/reporter model, asserting on DOM state with `expect.element` and `userEvent`-style interaction helpers. A standalone Playwright end-to-end suite is a different runner entirely — `@playwright/test` — built to drive a full page (or several, across real navigations, real cross-origin redirects, real cookies) through a user journey, with its own parallelization, its own retry semantics, and its own reporter format, unrelated to Vitest's.

The practical line: if the test's subject is "does this component render and respond to interaction correctly," Browser Mode keeps the test in the same runner, same watch mode, same coverage collection as the rest of the unit suite — a real advantage for iteration speed. If the test's subject is "does a user's actual multi-page flow work — login, then checkout, then confirmation, across real navigation" — that is a Playwright end-to-end suite's job, not because Browser Mode is technically incapable of driving multi-page flows, but because Playwright's own test runner is purpose-built for that shape of test, with fixtures and reporting designed around it, while Vitest's is built around fast, isolated unit- and component-level runs.

## Gotchas

**★ Symptom: a Browser Mode config copied from an older tutorial fails to resolve `@vitest/browser`.** Cause: the pre-v4 single-package model (`@vitest/browser` plus a bare `playwright`/`webdriverio` peer, configured via a triple-slash reference comment) was replaced in Vitest 4 by per-provider packages. Fix: install the matching provider package directly and drop the reference comment.
```bash
npm install -D @vitest/browser-playwright playwright
```

**★ Symptom: "which provider do I pick" stalls a team with no existing browser-automation investment.** Cause: all three are documented as valid, with no single one framed as mandatory. Fix: follow the documentation's own default — *"we recommend starting with Playwright because it supports parallel execution"* — unless the team already standardizes on WebdriverIO for other reasons, or just wants zero automation overhead locally via `preview`.

**★ Symptom: a login-through-checkout regression test is written in Vitest Browser Mode and turns out slow and awkward to maintain, with cross-navigation state constantly falling out of scope.** Cause: Browser Mode's test/reporter model is built around one file driving one component or page inside Vitest's worker pool, not around orchestrating a multi-page journey with its own retry and trace tooling. Fix: move that specific test to a standalone Playwright end-to-end suite (`@playwright/test`), and keep Browser Mode for the component- and page-level assertions it is actually built for.

**★ Symptom: `webdriverio`'s peer range on `@vitest/browser-webdriverio` (`^5.0.0-beta.5 || >=5.0.0`) looks unusually loose compared to the other two providers, which pin an exact `5.0.0`.** Cause: this is what the published `vitest` 5.0.0 package declares — probed directly, not inferred. It is worth re-checking at install time rather than assuming parity with the Playwright/preview providers, since a range that wide can resolve a beta release if no stable satisfies it and the lockfile is not pinned explicitly.

## Interview questions

**★ What does "real browser" actually buy Browser Mode over `jsdom`, and what does it cost?**
It buys correctness for anything jsdom/happy-dom only approximate — real layout, real CSS cascade and computed styles, real focus/event timing, real browser-specific quirks a fake DOM implementation cannot fully replicate. It costs startup time and process overhead per test file (a real browser instance versus an in-process fake DOM), which is exactly why `environment: 'jsdom'`/`'happy-dom'` remain the default choice for the bulk of component tests, with Browser Mode reserved for the subset where DOM-faking genuinely produces different results than a real browser would.

**★ Why did Vitest need to stabilize Browser Mode before adding Visual Regression testing and Playwright Trace support?**
Because both features assume the underlying API shape will not shift under them — a screenshot-comparison assertion and a trace-recording integration are exactly the kind of tooling nobody wants to build against something still tagged experimental, where the config surface or provider model could change in the next minor release. Removing the experimental tag in v4 was a signal that the provider-package architecture was settled, which is precisely when it made sense to add features that other tooling (CI screenshot diffing, the Playwright Trace Viewer) would depend on.

**★ A team already has a large Playwright end-to-end suite. Is there still a reason to add Vitest Browser Mode on top of it?**
Yes, for a different layer of the test pyramid: Browser Mode gives fast, real-browser assertions on individual components inside the same watch-mode, same-process workflow as the rest of the unit suite, without paying for a full page navigation or the Playwright test runner's own startup cost per test. The existing Playwright suite keeps doing what it is actually good at — multi-page user journeys — while Browser Mode covers "does this one component render and behave correctly in a real browser" faster and closer to the code than spinning up a full end-to-end scenario for it would.

**★ Why does the Playwright provider get Vitest's own explicit recommendation over WebdriverIO?**
Parallel execution — the documentation's stated reason is exactly that: *"it supports parallel execution, which makes your tests run faster."* For a team with no existing investment in either automation library, the recommendation removes a decision that otherwise has no clearly correct default; teams already using WebdriverIO for other automation have a legitimate reason to diverge from the recommendation and reuse that investment instead.

---

← [01b · Environments](01b-environments.md) · [Vite overview](../../README.md) · Next → [01d · Mocking under a shared pipeline](01d-mocking.md)
