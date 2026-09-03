---
title: "The tool every PWA checklist tells you to run has not had a PWA category since Lighthouse 12, and the reason it was deleted is the same reason most published checklists are now wrong"
sidebar_label: "10u · The Lighthouse PWA category is gone"
sidebar_position: 30
description: "Lighthouse 12.0.0 removed the PWA category because Chrome's installability criteria changed, what that does to a CI gate keyed on it, and the three-layer audit that replaces it."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the
> [Lighthouse v12.0.0 release notes](https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0),
> Chrome's [Update on the installability criteria](https://developer.chrome.com/blog/update-install-criteria),
> and the Next.js [Progressive Web Apps guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9.
> Documentation-verified; **no sandbox run**.

**Seventeen chunks of this topic teach you how to build a PWA. None of them tells you how to
prove you built it, and the instruction almost every article gives — "run the Lighthouse PWA
audit" — points at a category that was deleted in Lighthouse 12.0.0 and shipped removed with
Chrome 126.** It was not deprecated for lack of interest. It was removed because the thing it
measured stopped being true: Chrome no longer requires a service worker with a `fetch()` handler
to offer installation, so an audit that scored you on having one was scoring a requirement that
did not exist. Every consequence in this page follows from that one fact — including why a CI
job that gates on a PWA score cannot be repaired, only replaced.

## What was removed, and what the release notes actually say

Lighthouse 12.0.0 was released on 22 April 2024 and shipped inside Chrome 126. Its release note
is one line:

> *"Lighthouse has removed the PWA category"*

The stated reason is Chrome's updated installability criteria, and the notes send readers to the
updated PWA documentation for future testing rather than naming a replacement audit — because
there is not one.

The same release pruned unrelated audits (`layout-shifts-elements`, `no-unload-listeners`,
`duplicate-id-active`, `plugins`), replaced `tap-targets` with `target-size` in the accessibility
category, and moved `uses-rel-preload` and `preload-fonts` into an experimental config. That
context matters: this was a general clean-out of audits that had stopped measuring anything, not
a verdict on progressive web apps.

## Why the criteria changed

Chrome's installability post states that as a first step it removed the requirement to have a
service worker implementing the `fetch()` method for installation from the menu — from version
**108 on mobile** and **112 on desktop**.

Read what that does to the old audit. The PWA category's spine was a chain of yes/no checks:
is there a manifest, does it have the required fields, is there a registered service worker, and
does that worker have a `fetch` handler. Once the last two stopped gating installation, a green
PWA score meant "you satisfied a 2017 definition of a PWA" and a red one meant nothing about
whether Chrome would offer to install your app. An audit that can be both green and irrelevant is
worse than no audit, because it produces confident false assurance.

The Next.js PWA guide states the current bar in two items — a valid web app manifest, and the
site served over HTTPS — and adds that install prompts can be triggered without offline support.
Chrome's post agrees, and adds that it intends to experiment with removing some manifest field
requirements too, which is why **no page, this one included, should present a fixed list of
manifest fields as "the installability criteria"**. What Chrome still recommends you ship is
`name` or `short_name`, `icons` (preferably maskable), `start_url`, and `display`.

## What the removal does not mean

Three wrong conclusions get drawn from this, and each one ships a worse app.

**It does not mean you no longer need a service worker.** Installability and offline are
different features that used to be welded together by the audit. Chrome will now install an app
that goes completely blank the moment the network drops. If you want a hard reload to work
offline you still need a worker with a `fetch` handler and a cached fallback document — see
[10i](10i-offline-strategy-and-the-useoffline-boundary.md).

**It does not mean Chrome deprecated PWAs.** The post is about lowering the bar to installation,
not raising it. More apps qualify now, not fewer.

**It does not mean "installable" is a quality bar.** It never was. A manifest with a name and one
icon can be installable and terrible. Everything that actually makes an installed app feel like an
app — an update path that does not strand users, a cache that is bounded, a `start_url` that works
when the session is gone — was never in the PWA category and is not in any category now.

## What replaces it: three layers, none of them a score

The audit you run now is not a tool, it is a procedure with three layers, and each layer catches a
class of defect the others cannot see.

| Layer | Catches | Covered in |
|---|---|---|
| **Manual, in Chrome DevTools' Application panel** | A manifest that 404s, icons that do not resolve, a worker stuck in `waiting`, a cache holding the wrong payload for a URL | [10v](10v-auditing-with-the-application-panel.md) |
| **Automated, Playwright against a production build** | Manifest presence and fields, icon URLs resolving, offline soft navigation, cache keys, regressions on every commit | [10y](10y-automating-with-playwright-and-the-manual-checklist.md) |
| **Manual, on real devices before release** | The browser's own install UI, real push delivery, everything on iOS | [10y](10y-automating-with-playwright-and-the-manual-checklist.md) |

All three depend on a prerequisite that is not optional and is the single most common reason a
PWA "does not work": you must be testing a **production build** in a **secure context**. That is
[10w](10w-a-testable-environment-https-and-a-production-build.md), and it comes before any of the
layers above.

Lighthouse itself remains useful to a PWA — it just audits it as a website. An installed app is
still judged on how fast it starts, whether it is keyboard-navigable in a window with no browser
chrome, and whether its content is indexable. Point it at your **`start_url`**, not at `/`, because
`start_url` is the URL an installed app actually opens.


## The CI gate you have to delete

If you have a Lighthouse CI job, it very likely contains an assertion on the category that no
longer exists:

```js
// lighthouserc.js — the shape that stopped meaning anything in Lighthouse 12
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'next start',
      url: ['http://localhost:3000/'],
    },
    assert: {
      assertions: {
        'categories:pwa': ['error', { minScore: 0.9 }],
        'categories:performance': ['error', { minScore: 0.8 }],
      },
    },
  },
};
```

There is no rewrite of `'categories:pwa'` that restores the check, because the data is not
collected. The fix is to drop the assertion, point the collector at `start_url`, and move the
installability question to the layer that can still answer it:

```js
// lighthouserc.js — Lighthouse keeps the categories it still collects
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'next build && next start',
      url: ['http://localhost:3000/dashboard'], // the manifest's start_url
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
  },
};
```

Installability then moves into the Playwright suite in
[10y](10y-automating-with-playwright-and-the-manual-checklist.md), where it is asserted directly
against the manifest instead of inferred from a score.

## Gotchas

### Following a checklist written before Chrome 108
**Symptom.** You add a no-op `fetch` handler purely so an audit will pass.
**Cause.** Nearly every PWA checklist published between 2017 and 2023 lists "a service worker with
a fetch handler" as an install requirement. Chrome removed that requirement in 108 on mobile and
112 on desktop.
**Fix.** Delete the no-op handler. A `fetch` handler that adds nothing is worse than none, because
every request in the app now round-trips through your worker's event loop for no benefit. Write one
only when it does something:

```js
// lib/service-worker.js — a fetch handler earns its place or is removed
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline')),
    );
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit ?? fetch(event.request)),
    );
  }
  // everything else: no respondWith, the browser handles it normally
});
```

### Concluding a PWA no longer needs a service worker
**Symptom.** The app installs, opens in its own window, and shows the browser's error page the
moment the user goes into a lift.
**Cause.** Installability was decoupled from offline. Nothing gave you offline in exchange.
**Fix.** There is no configuration for this; the mechanism is a cached fallback document, taught in
[10i](10i-offline-strategy-and-the-useoffline-boundary.md). Test it by hard-reloading while
offline, per [10x](10x-reproducing-the-failures-deliberately.md) — a soft navigation working
offline proves nothing about a cold start.

### Auditing `/` when `start_url` is `/dashboard`
**Symptom.** Excellent scores; installed users report a slow, broken first screen.
**Cause.** Lighthouse audits the URL you hand it. An installed app opens `start_url`, which is
frequently an authenticated route with a completely different render path.
**Fix.** Audit the `start_url`, and audit it in the state an installed launch is actually in —
which for a fresh install on iOS means logged out
([10q](10q-ios-storage-and-installed-app-containers.md)).

### Running Lighthouse against `next dev`
**Symptom.** Terrible performance numbers that no optimisation improves.
**Cause.** The development server serves unminified, unsplit modules with an HMR channel attached,
and prefetching is disabled. None of it resembles what a user gets.
**Fix.** `next build && next start`, then audit. This is the same rule that governs every other
test in this group — [10w](10w-a-testable-environment-https-and-a-production-build.md).

### Reading a Lighthouse performance number as a returning-visitor number
**Symptom.** Your cache-first static asset strategy shows up nowhere in the score.
**Cause.** A Lighthouse run in the DevTools panel offers a storage-clearing option, and a run that
clears storage starts with no service worker controlling the page and no caches populated — it is
a first-visit measurement by construction. I did not verify the default state of that option in
any specific Chrome version; check it before drawing a conclusion.
**Fix.** Measure the repeat visit the way it happens: load the app, confirm in the Application
panel that a worker is controlling the page and the cache is populated
([10v](10v-auditing-with-the-application-panel.md)), then reload and read the network panel. Do
not infer it from a score.

### Expecting any audit to catch an update-lifecycle bug
**Symptom.** Every check is green and users are on a build from three weeks ago.
**Cause.** No audit — the old PWA category included — ever loaded your site twice with two
different worker bytes. Update bugs are only visible across two builds.
**Fix.** Reproduce it deliberately with two builds, per
[10x](10x-reproducing-the-failures-deliberately.md), and keep the kill switch from
[10h](10h-service-worker-update-detection-and-recovery.md) shipped before you need it.

### Treating "installable" as the release gate
**Symptom.** Sign-off is "Chrome offers to install it".
**Cause.** The bar Chrome enforces is deliberately low and is being lowered further; the post says
Chrome intends to experiment with removing manifest field requirements.
**Fix.** Gate on the checklist in
[10y](10y-automating-with-playwright-and-the-manual-checklist.md), which asserts the things that
break in production — `start_url` when unauthenticated, worker scope, cache versioning, push
subscription expiry — none of which any browser checks for you.

## Interview questions

**★ Why did Lighthouse remove the PWA category, and what should a team do about it?**
Because Chrome's installability criteria changed underneath it. Chrome dropped the requirement for
a service worker implementing `fetch()` for menu installation — version 108 on mobile, 112 on
desktop — which made the category's central checks measure a rule that no longer applied. A green
score no longer predicted that Chrome would offer installation, and a red one no longer predicted
that it would not. The removal shipped in Lighthouse 12.0.0 with Chrome 126. A team's response is
to delete any CI assertion on the category, keep Lighthouse for performance, accessibility and SEO
pointed at `start_url`, and move the PWA-specific questions to a manual DevTools pass, an automated
Playwright suite against a production build, and a short real-device list before release.

**★ What are the current install requirements, and why should a page be careful stating them?**
The Next.js guide states two: a valid web app manifest and the site served over HTTPS — and notes
that install prompts can be triggered without offline support. Chrome's post agrees and adds that
it still recommends `name` or `short_name`, `icons`, `start_url` and `display`, while saying it
intends to experiment with removing some manifest field requirements. So the honest statement is
"a manifest plus HTTPS, with those four fields recommended" — not a fixed enumerated list, because
the source explicitly describes the list as in flux.

**Does the removal mean offline support is no longer worth building?**
No, and the inference is backwards. The removal decoupled two things that used to be bundled: it
made installation easier to earn, not offline less valuable. An installed app is more likely to be
opened in bad network conditions than a tab is, because it sits on the home screen. What changed is
that the browser will no longer refuse to install you for lacking offline support — the user will
just have a worse app.

**Your team's PWA sign-off has been "Lighthouse PWA score above 90" for four years. What replaces
it?**
A checklist with named owners, because there is no single number to replace it with. The automatable
part — manifest resolves, icons resolve, `start_url` renders for an unauthenticated visitor, a soft
navigation works offline, the cache holds what you think it holds — goes into Playwright against a
production build and runs on every commit. The non-automatable part — the browser's install UI,
push arriving on a real phone, anything on iOS — becomes a short manual list run before release.
The value of the old gate was that it was one number; the cost was that the number stopped
correlating with anything, which is exactly why it was deleted.

**Why is auditing `/` instead of `start_url` a real bug and not a nitpick?**
Because they are frequently different routes with different render paths, different auth
requirements and different data. An installed app never opens `/` unless `start_url` says so. On
iOS the divergence is worse: a freshly installed Home Screen app has a storage container separate
from Safari's, so its first launch of `start_url` is unauthenticated even though the user signed in
seconds earlier. Auditing `/` in a warm logged-in browser measures a page no installed user ever
sees in that state.

**A colleague says the PWA category was removed because PWAs are dying. What is wrong with that
reading?**
The release notes attribute the removal to Chrome's updated installability criteria, and the same
release removed four unrelated audits and moved two others to an experimental config — it was a
clean-out of audits that had stopped measuring what they claimed. The criteria change itself made
installation *easier* to qualify for. Reading a lowered bar as an abandonment gets the direction
exactly wrong.

---

← [Chapter 12 overview](01-explanation.md) · Next → [10v · Auditing with the Application panel](10v-auditing-with-the-application-panel.md)
