---
title: "Four things about a PWA cannot be automated by anyone, and the only honest way to cover them is a short numbered list with a person's name against each row"
sidebar_label: "10z2 · The pre-release checklist"
sidebar_position: 34
description: "The install UI, real push delivery, iOS and the seven-day storage fuse — why each resists automation, how to run the manual rows properly, and the sixteen-row list to run against a deploy candidate."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), MDN
> [`beforeinstallprompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event),
> WebKit's [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
> and [Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/),
> and the Playwright [`BrowserContext`](https://playwright.dev/docs/api/class-browsercontext) reference.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A test plan that only contains what is automatable is not a test plan, it is a list of what was
convenient.** The four things below are the ones that decide whether a PWA works for a real person
on a real device, and none of them can be reached by a runner: the browser's own install UI, push
actually arriving, anything at all on iOS, and a storage rule measured in days. The answer is not
cleverer tooling — it is sixteen numbered rows, each with a person against it, run against the
deploy candidate. The automated half is [10z](10z-automating-with-playwright-and-the-pre-release-checklist.md).

## The four things no runner can reach

Four things resist automation completely, and each one is in the checklist below as a manual row.
**The browser's install UI** is browser chrome driven by `beforeinstallprompt`, which has limited
availability and no guaranteed timing. **Real push delivery** crosses your server, a third-party
push service and a device, so a green test proves your code path and nothing about arrival.
**Anything on iOS** is out of reach twice over — Home Screen web apps are not drivable by a runner,
and Playwright's service worker support is Chromium-only. And **WebKit's seven-day storage fuse**
is a wall-clock rule you design around rather than test
([10q](10q-ios-storage-and-installed-app-containers.md)).

Run the list below against the deploy candidate, not against `main`. Each row names how to check it and the
page that explains why it matters.

| # | Check | How | Why |
|---|---|---|---|
| 1 | Manifest resolves at the URL the document links | Automated, above | [10v](10v-auditing-with-the-application-panel.md) |
| 2 | Icons at 192 and 512 resolve and are maskable | Automated, above | [10b](10b-manifest-fields-that-change-behaviour.md) |
| 3 | `start_url` renders with no session | Automated, above | [10q](10q-ios-storage-and-installed-app-containers.md) |
| 4 | Worker scope covers every route it must control | Service Workers pane, Clients line | [10f](10f-service-workers-in-the-app-router.md) |
| 5 | Worker script served `no-store`, registered `updateViaCache: 'none'` | Response headers | [10x](10x-reproducing-the-failures-deliberately.md) |
| 6 | A new build produces a byte-different worker | Two builds, one open tab | [10x](10x-reproducing-the-failures-deliberately.md) |
| 7 | Update prompt appears and reload lands on the new build | Manual, in the installed window | [10h](10h-service-worker-update-detection-and-recovery.md) |
| 8 | Cache names carry the build id and old ones are deleted on `activate` | Cache Storage pane | [10k](10k-service-worker-cache-budget-and-eviction.md) |
| 9 | No cache is unbounded; images and documents have a cap | Code review plus `estimate()` | [10k](10k-service-worker-cache-budget-and-eviction.md) |
| 10 | Nothing of type `text/x-component` under a document URL | Automated, above | [10y](10y-testing-offline-and-what-the-cache-really-holds.md) |
| 11 | Hard reload while offline reaches the fallback document | Manual, airplane mode | [10i](10i-offline-strategy-and-the-useoffline-boundary.md) |
| 12 | Server Actions are excluded from every retry path | Code review plus one offline submit | [10y](10y-testing-offline-and-what-the-cache-really-holds.md) |
| 13 | Push subscription stored per user, deleted on a 404 | Server log for one expired subscription | [10m](10m-storing-push-subscriptions.md) |
| 14 | One real push delivered to one real device | Manual | [10n](10n-sending-push-from-the-server.md) |
| 15 | iOS: install, then sign in, in that order, in the standalone window | Manual on a real device | [10p](10p-ios-and-safari-limits.md) |
| 16 | Install by hand on Android and desktop Chrome | Manual | [10d](10d-installability-and-the-install-prompt.md) |

Row 13 is the one teams skip, and then cannot explain why push volume falls week over week. The
signal and the code that acts on it are [10n](10n-sending-push-from-the-server.md); what belongs
here is only that somebody confirms, per release, that a 404 from a send actually deletes a row.

## How to run the manual rows so they mean something

A manual row that says "check push works" gets ticked without being done. Each of these is a
sequence with an observable result.

**Row 7 — the update prompt (installed window).** Install the app. Open it. With the app still
open, deploy a build whose worker script differs. Wait for, or trigger, an update check. The
prompt must appear *in the installed window*, and accepting it must land you on the new build —
verified by asking the controller which build it is, not by looking at the page
([10x](10x-reproducing-the-failures-deliberately.md)). The installed window is the client users
leave open for days, so it is the one that holds a worker in `waiting`.

**Row 11 — the offline cold start.** Airplane mode on the device, then launch the installed app
from the home screen. Not a reload of an already-open window: a cold launch. This is the only way
to exercise the document request, the worker's `fetch` handler and the cached fallback in the order
a real user meets them.

**Row 14 — one real push.** Send one push from the production sender to one real subscription on a
real device with the screen locked. Delivery is the claim; a synthetic push from the DevTools
Service Workers pane proves your handler and nothing about arrival.

**Row 15 — iOS ordering.** On a real iPhone at 16.4 or later: install to the Home Screen *first*,
then sign in *inside the standalone window*, then subscribe to push from a direct tap on a
button. WebKit requires the permission request to come from direct user interaction, push is only
available to Home Screen web apps, and the installed app has a storage container separate from
Safari's — so a session established in Safari does not travel
([10p](10p-ios-and-safari-limits.md), [10q](10q-ios-storage-and-installed-app-containers.md)).

**Row 16 — install by hand.** Install from the browser's own UI on Android Chrome and on desktop
Chrome. You are checking that the option is offered at all, which depends on Chrome's installability
criteria plus engagement heuristics that no API exposes — `beforeinstallprompt` has limited
availability and, per MDN, no guaranteed timing.

## Gotchas

### Reproducing the update in a tab and never in the installed window
**Symptom.** The update path works in testing and installed users still report stale builds.
**Cause.** An installed app window is a separate client with its own lifetime. Users leave it open
for days, so it is the client most likely to be holding a worker in `waiting` — and it is the one
nobody tests.
**Fix.** Install the app, run the same two-build procedure with the standalone window as the open
client, and read the state from inside that window. Detect where you are running so the harness can
say so:

```ts
// lib/sw-test-harness.ts
export function displayMode() {
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
  return 'browser';
}
```

### `start_url` is invalid or cross-origin
**Symptom.** The installed app opens the marketing home page rather than the dashboard you
configured.
**Cause.** Per MDN, if `start_url` is unspecified or invalid — not a string, not a valid URL, or
not same-origin with the page that links the manifest — the URL of the linking page is used
instead. There is no error; the pane shows the fallback.
**Fix.** Use a root-relative path so resolution against the manifest URL cannot surprise you, set
`scope` explicitly rather than letting it be inferred from `start_url`, and let the suite's
`start_url` test above prove the route renders logged out. The full manifest these two fields sit
in is [10b](10b-manifest-fields-that-change-behaviour.md):

```ts
// app/manifest.ts — the two members this gotcha is about
start_url: '/dashboard',
scope: '/',
```

### A manual row with no name against it
**Symptom.** The checklist is green and row 15 has not been run since March.
**Cause.** A row that belongs to "the team" belongs to nobody, and the manual rows are exactly the
ones that need a device somebody has to physically pick up.
**Fix.** Put the list in the release template with an owner column, so an unfilled cell blocks the
release rather than being invisible:

```markdown
{/* .github/PULL_REQUEST_TEMPLATE/release.md */}
| # | Check | Owner | Result |
|---|---|---|---|
| 14 | One real push to one real device |  |  |
| 15 | iOS: install → sign in → subscribe, in the standalone window |  |  |
| 16 | Install by hand on Android and desktop Chrome |  |  |
```

### Running the checklist against `main` instead of the deploy candidate
**Symptom.** Everything passed and the released build has a broken manifest.
**Cause.** The rows that matter are about *served artefacts* — the manifest URL, icon responses,
the worker script's headers, chunk filenames. All of them are properties of a specific build behind
a specific proxy, not of the source tree.
**Fix.** Run the list against the deploy candidate's real URL, and make the build identify itself
so the result is attributable:

```ts
// app/api/build/route.ts — one route so a checklist result can name what it tested
export const dynamic = 'force-static';

export function GET() {
  return Response.json({
    buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? 'unknown',
    builtAt: process.env.BUILD_TIMESTAMP ?? 'unknown',
  });
}
```

### Treating a synthetic push as row 14
**Symptom.** Push is signed off every release and users report never receiving anything.
**Cause.** The DevTools **Push** button dispatches a `push` event straight at the worker. It never
touches VAPID signing, your subscription store, the push service or the device.
**Fix.** Row 14 is a real send from the production sender to a real subscription, with the device
screen locked. The send path and its error handling are
[10n](10n-sending-push-from-the-server.md); what this row adds is that somebody watched a phone
light up.

### Trying to defeat the seven-day storage fuse instead of designing for it
**Symptom.** A background ping, a hidden iframe or a scheduled fetch added "to keep the cache
alive" on iOS.
**Cause.** WebKit's rule deletes script-writable storage — including service worker registrations
and their caches — after seven days of Safari use without **user interaction on the site**. Nothing
your code does on its own counts as user interaction, so none of these work.
**Fix.** There is no code fix, and the row exists to stop someone writing one. The documented way
off the fuse is installation: a Home Screen web app has its own counter of days of use and, per
WebKit, is not expected to have its first-party data deleted. Promote installation to the users
whose offline experience you care about, and treat the tab as online-only
([10q](10q-ios-storage-and-installed-app-containers.md)).

### Row 14 run with the app in the foreground
**Symptom.** Push "works" every release and users say notifications never arrive.
**Cause.** With the app focused, a notification that your own page displays and a notification
delivered by the push service to a sleeping device look identical to the tester. The interesting
path — the worker being woken to handle a `push` event with no client running — was never
exercised.
**Fix.** Lock the screen, or fully close the app, before sending. The observable result is the
device waking up; anything less is testing your own UI.

### Assuming the checklist covers what the automated suite covers
**Symptom.** Sixteen manual rows, run by hand, every release.
**Cause.** Rows 1, 2, 3, 10 are marked "automated" for a reason — they run on every commit and
their value is that nobody has to remember them.
**Fix.** Keep the automated rows in the list as *evidence*, not as work: the release owner records
the CI run that proved them. If CI did not run, they become manual, which is the incentive you
want.

## Interview questions

**★ What in a PWA can be automated, and what genuinely cannot?**
Automatable: that the document links a manifest, that the manifest resolves and declares the icon
sizes you expect, that every icon URL resolves, that `start_url` renders for a visitor with no
session, that a soft navigation to a visited route survives `context.setOffline(true)`, and that
nothing of type `text/x-component` is cached under a document URL. Not automatable: the browser's
own install UI, which is chrome driven by a limited-availability event with no guaranteed timing;
real push delivery, which crosses a third-party push service and a device; anything on iOS, since
Home Screen web apps are not drivable by a runner and Playwright's service worker support is
Chromium-only; and WebKit's seven-day storage fuse, which is a wall-clock rule. Those four become
named manual rows owned by a person, not "we should check that".

**★ Why must an iOS pre-release pass be run in the order install → sign in → subscribe?**
Because each step depends on the previous one in a way that has no workaround. Push on iOS is only
available to Home Screen web apps from 16.4, so subscribing in a Safari tab cannot work. The
installed app has a storage container separate from Safari's, so a session created before
installation does not travel into it — a user who signs in first and installs second arrives logged
out. And WebKit requires the permission request to come from direct user interaction, so the
subscribe call has to sit behind a real tap inside the standalone window. Run the steps in any
other order and you will observe three "bugs" that are all the same documented behaviour.

**★ Why is the browser's install UI not automatable, and what do you check instead?**
Because it is browser chrome, not page content, and whether it appears at all depends on Chrome's
installability criteria plus engagement heuristics no API exposes. `beforeinstallprompt` is the
only programmatic signal, and MDN records it as limited-availability with no guaranteed time of
firing — so its absence in a test run proves nothing. What you check automatically is the two
things the documentation does state as requirements: a manifest that resolves, and HTTPS. What you
check manually is that a human on Android Chrome and desktop Chrome is actually offered the option.

**Why does the checklist have to be run against the deploy candidate rather than the source
branch?**
Because almost every row is a claim about a served artefact rather than about code. Whether the
manifest resolves depends on the route the framework emitted and the proxy in front of it; whether
the worker updates depends on the `Cache-Control` header that proxy adds; whether the cache holds
the right things depends on chunk filenames that only exist after a build. A checklist run against
a branch is a checklist run against a different application that happens to share a git history.

**Why is WebKit's seven-day storage rule a design constraint rather than a test case?**
Because it is measured in wall-clock days of Safari use without user interaction on the site, so
there is nothing to run inside a release window and nothing to assert. What you can do is decide
what happens when it fires: an uninstalled iOS visitor's offline experience has a one-week fuse, so
either the app degrades to online-only in a tab and says so, or you promote installation, which
moves the app into a container with its own usage counter that WebKit does not expect to clear.
Writing it into the checklist as "confirm the tab experience degrades honestly" turns an untestable
rule into a reviewable decision.

---

← [10z · Automating with Playwright](10z-automating-with-playwright-and-the-pre-release-checklist.md) · [Chapter 12 overview](01-explanation.md)
