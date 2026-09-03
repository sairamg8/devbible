---
title: "A Playwright suite is the only part of a PWA test plan that survives contact with a sprint, and every assertion in it has to be phrased from inside the page because a service worker is not a page"
sidebar_label: "10z · Automating with Playwright"
sidebar_position: 33
description: "A Playwright config that cannot accidentally test a dev server, a suite covering manifest, icons, start_url, offline navigation and cache contents, and the ways such a suite passes while testing nothing."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Playwright [`BrowserContext`](https://playwright.dev/docs/api/class-browsercontext)
> API reference (`setOffline`, `serviceWorkers()`, the `serviceworker` event), the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) and
> [CLI reference](https://nextjs.org/docs/app/api-reference/cli/next), and WebKit's
> [Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Everything in the previous five pages is a manual procedure, and a manual procedure that is not
written down stops happening after the third sprint.** Most of it automates cleanly in Playwright
against a production build: the manifest resolves, the icons resolve, `start_url` renders for a
logged-out visitor, a soft navigation survives going offline, and the cache holds what you think it
holds. What makes this suite unlike the rest of your end-to-end tests is that its subject — the
service worker — is not a page, so one config option set months ago for an unrelated reason can
make every assertion pass while testing nothing at all. The four things that genuinely cannot be
automated, and the release list that covers them, are
[10z2](10z2-what-no-runner-can-reach-and-the-pre-release-checklist.md).

## The runner has to see a production build

Playwright's `webServer` block is where the "test against a production build" rule from
[10w](10w-a-testable-environment-https-and-a-production-build.md) becomes structural rather than
remembered. Note the port: a dev server someone left running on 3000 must not be able to satisfy
the health check.

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3100',
    ...devices['Desktop Chrome'],
    serviceWorkers: 'allow', // the default; stated so nobody "tidies" it to 'block'
  },
  webServer: {
    command: 'next build && next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

Two documented constraints shape everything below. Playwright's own note on service workers:

> *"Service workers are only supported on Chromium-based browsers."*

So a PWA suite is a Chromium project; running it under WebKit tests something else. And
`setOffline()` is documented as a **`BrowserContext`** method that emulates the network being
offline for the whole context, so it applies to every page in it — which is what you want for a
PWA, and is worth knowing before you go looking for a per-page equivalent.

## The suite

```ts
// e2e/pwa.spec.ts
import { test, expect, type Page } from '@playwright/test';

// The worker is active before it controls the page; assert on neither too early.
async function waitForController(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
        once: true,
      });
    });
  });
}

test.describe('installability', () => {
  test('the manifest is linked, resolves, and declares both icon sizes', async ({
    page,
    request,
    baseURL,
  }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href, 'no manifest link in the document head').toBeTruthy();

    const res = await request.get(new URL(href!, baseURL).toString());
    expect(res.ok(), `manifest returned ${res.status()}`).toBe(true);

    const manifest = JSON.parse(await res.text());
    expect(manifest.start_url).toBeTruthy();
    const sizes = (manifest.icons ?? []).map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));

    for (const icon of manifest.icons ?? []) {
      const iconRes = await request.get(new URL(icon.src, baseURL).toString());
      expect(iconRes.ok(), `${icon.src} returned ${iconRes.status()}`).toBe(true);
    }
  });

  test('start_url renders for a visitor with no session', async ({ page, request, baseURL }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestRes = await request.get(new URL(href!, baseURL).toString());
    const manifest = JSON.parse(await manifestRes.text());

    await page.context().clearCookies();
    const response = await page.goto(manifest.start_url);
    expect(response!.status(), 'start_url must not error for a logged-out launch').toBeLessThan(400);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('offline', () => {
  test('a soft navigation to a visited route survives going offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForController(page);
    await page.getByRole('link', { name: 'Reports' }).click();
    await page.goBack();

    await context.setOffline(true);
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await context.setOffline(false);
  });

  test('no RSC payload is cached under a document URL', async ({ page }) => {
    await page.goto('/');
    await waitForController(page);

    const offenders = await page.evaluate(async () => {
      const bad: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).searchParams.has('_rsc')) continue;
          const type = (await cache.match(request))?.headers.get('content-type') ?? '';
          if (type.includes('text/x-component')) bad.push(request.url);
        }
      }
      return bad;
    });

    expect(offenders, 'RSC payloads cached under document URLs').toEqual([]);
  });
});
```

`context.serviceWorkers()` returns the workers that exist in the context and
`context.on('serviceworker')` fires when a new one is created, for the cases where you want the
worker itself rather than the page's view of it. Assertions phrased from inside the page, as above,
survive a refactor of how the worker is registered; assertions on the worker object do not.

## Gotchas

### Auditing the cache while the worker is still installing
**Symptom.** A cache assertion fails intermittently in CI and passes when you run it by hand.
**Cause.** `install` populates the cache inside `event.waitUntil()`, and
`navigator.serviceWorker.ready` resolves on an *active* registration — which is not the same as
that worker controlling your page or having finished filling the cache. A test that reads
`caches.keys()` straight after the first navigation can win the race locally and lose it in CI.
**Fix.** Call `waitForController(page)` from the suite above before any assertion that reads
storage. It waits for `ready` **and** for a controller, which is the point after which the worker
is demonstrably in the request path.

### Every test is a first visit, so nothing ever tests a returning one
**Symptom.** The suite never catches a cache-hit bug, because no test has ever been served from
cache.
**Cause.** Each Playwright test gets a fresh browser context with empty storage. That is exactly
what you want for installability and exactly wrong for anything about persistence — the worker
installs, the cache fills, and the test ends before a single request is answered from it.
**Fix.** Warm the origin inside the test, in the same context, before asserting:

```ts
// e2e/pwa.spec.ts — a returning visit has to be manufactured on purpose
test('static assets are served from cache on the second visit', async ({ page }) => {
  await page.goto('/');
  await waitForController(page);
  await page.reload();                     // now the worker is in the request path

  const servedFromCache = await page.evaluate(async () => {
    const res = await fetch('/dashboard');
    return res.headers.get('x-served-by') === 'sw-cache';
  });
  expect(servedFromCache, 'second visit did not hit the service worker cache').toBe(true);
});
```

The `x-served-by` header is the stamp added by the worker in
[10y](10y-testing-offline-and-what-the-cache-really-holds.md); without it you cannot tell a cache
hit from a fast network response.

### `clearCookies()` used to simulate a logged-out visitor
**Symptom.** The `start_url` test passes while the page is still rendering the previous user's
dashboard.
**Cause.** Clearing cookies removes the session credential. It does not remove the service worker
registration or anything in Cache Storage, so a cached authenticated document can still answer the
navigation.
**Fix.** Clear the storage the worker owns as well, from inside the page:

```ts
// e2e/pwa.spec.ts
async function signOutCompletely(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const name of await caches.keys()) await caches.delete(name);
  });
}
```

### `serviceWorkers: 'block'` inherited from another config
**Symptom.** Every PWA test passes instantly and none of them proves anything; `caches.keys()`
comes back empty in a run that should have populated it.
**Cause.** Playwright can block service worker registration for a context. That is a reasonable
default for a suite that does not want a worker interfering with request mocking — and
catastrophic for the suite whose entire subject is the worker.
**Fix.** State the value explicitly in the config rather than relying on the default, and add a
canary so a blocked worker cannot pass as a green run:

```ts
// e2e/pwa.spec.ts
test('a service worker registers at all', async ({ page }) => {
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 10_000,
      message: 'no worker took control — is serviceWorkers set to block?',
    })
    .toBe(true);
});
```

### `reuseExistingServer` picking up yesterday's dev server
**Symptom.** The suite passes locally and fails in CI, or vice versa, with no code difference.
**Cause.** With `reuseExistingServer: true`, Playwright uses whatever is already listening on the
port — which on a developer machine is very often `next dev`, where prefetching is disabled and
every offline assertion is meaningless.
**Fix.** Keep `reuseExistingServer: false` as in the config above, and keep the port distinct from
the one your dev server uses, so a forgotten `next dev` cannot satisfy the health check.

## Interview questions

**★ Why must a PWA Playwright suite run against `next build && next start` rather than `next dev`?**
Because prefetching is disabled in development, so the App Shell that makes an offline soft
navigation work does not exist, and every offline assertion is then testing a state no user is ever
in. Development also serves unbundled modules under chunk names production never emits, so any
assertion about what the worker cached is about artefacts that will not exist in production. The
structural fix is to put the production command in `webServer` with `reuseExistingServer: false`
and a port no dev server uses, so the wrong server cannot satisfy the health check.

**Why is waiting for `navigator.serviceWorker.ready` not enough before asserting on the cache?**
Because `ready` resolves when there is an active registration, which is not the same as your page
being controlled by it or the `install` handler's `waitUntil` promise having settled. On a first
visit you can have an active worker that has not yet claimed the page, so requests are still going
straight to the network while the cache is still filling. Wait for a controller as well, with a
deadline — otherwise the test is flaky in exactly the way that gets it deleted rather than fixed.

**★ Why phrase PWA assertions from inside the page rather than against the worker object?**
Because the page's view is the user's view. `context.serviceWorkers()` and the `serviceworker`
event tell you a worker exists in the context; they do not tell you that it took control of the
document, that its `install` promise settled, or that the response your user saw came from its
cache. An assertion written as `page.evaluate` over `navigator.serviceWorker.controller` and
`caches` answers the question the user actually cares about, and it survives you changing how and
where the worker is registered. Assertions bound to the worker object break on that refactor while
still passing for the wrong reason.

**Why is Playwright's `request` fixture the right tool for the manifest and the wrong one for the
cache?**
Because `request` is an API client that does not go through the browser at all — no service worker,
no Cache Storage, no document. That makes it exactly right for "does the server serve this manifest
and these icons", which is a question about the origin. It makes it useless for "did the worker
answer this", because the worker was never in the path. Any assertion about caching, offline
behaviour or control has to run inside the page.

---

← [10y · Testing offline and the cache](10y-testing-offline-and-what-the-cache-really-holds.md) · Next → [10z2 · What no runner can reach](10z2-what-no-runner-can-reach-and-the-pre-release-checklist.md)
