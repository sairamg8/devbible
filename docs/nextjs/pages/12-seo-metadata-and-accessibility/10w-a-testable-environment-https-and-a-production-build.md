---
title: "Almost every 'my PWA does not work' report is a test environment problem: a development server, an origin that is not a secure context, or a zombie worker from a project you stopped working on last March"
sidebar_label: "10w · A testable environment"
sidebar_position: 54
description: "Why localhost needs no TLS but your phone does, why offline must be tested against next build && next start, and how to guarantee a genuinely clean origin before every run."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against MDN
> [Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), the
> Next.js [CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) (option tables for
> `next dev` and `next start` read directly), the
> [offline support guide](https://nextjs.org/docs/app/guides/offline-support) and the
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9.
> Documentation-verified; **no sandbox run**.

**Before any audit in this group means anything, three preconditions have to hold: the app must be
a production build, the origin must be a secure context, and the origin must be in a known storage
state.** All three are cheap and all three are routinely violated, which is why a large share of
PWA bug reports evaporate the moment someone runs `next build && next start` in a fresh Chrome
profile. The two that surprise people are that **`http://localhost` already is a secure context**,
so you need no TLS at all on your own machine — and that **your phone on the LAN is not**, so you
need real TLS the moment you test on a device.

## Secure context: what actually needs HTTPS

Service workers, the install flow, Web Push and Background Sync are all secure-context features. A
page delivered over plain `http://` from a remote host cannot register a worker at all — MDN
records `register()` throwing a `SecurityError` when the script URL is not on a potentially
trustworthy origin.

But "potentially trustworthy" is broader than HTTPS. MDN's rule for locally delivered resources:

> *"they can be considered to have been delivered securely because they are on the same device as
> the browser"*

That covers `http://127.0.0.1`, `http://localhost` and `http://*.localhost` — including names like
`http://sprintdesk.localhost/`. The practical consequence is the one most teams get wrong in both
directions:

| Origin you are testing from | Secure context? | TLS needed? |
|---|---|---|
| `http://localhost:3000` on your own machine | Yes, potentially trustworthy | **No** |
| `http://sprintdesk.localhost:3000` | Yes | **No** |
| `http://192.168.1.24:3000` from your phone | **No** | **Yes** |
| `http://staging.internal:3000` over the LAN | **No** | **Yes** |
| Anything a colleague loads over a tunnel | Depends on the tunnel's scheme | Use the HTTPS URL |

So the answer to "do I need `--experimental-https` to test my service worker?" is **no, not on your
own machine**. You need it — or something like it — the moment the browser is on a different
device from the server.

## The production build is not optional, and this is the one that wastes a day

🔴 **Prefetching is disabled in development.** The offline support guide states it, and everything
downstream follows: `experimental.useOffline` renders a prefetched **App Shell** when a soft
navigation fails, and in development there is no prefetched App Shell to render. The feature looks
completely broken, the reader concludes the flag does not work, and files an issue.

Three more differences that invalidate a PWA test in `next dev`:

- Modules are served unbundled and unminified, with an HMR channel attached. Going offline kills
  the HMR socket, which produces its own errors on top of whatever you were testing.
- Chunk URLs differ from production chunk URLs, so anything your worker caches under
  `/_next/static/` is caching development artefacts under names production will never request.
- The dev overlay intercepts errors you are trying to observe.

The rule is therefore unconditional — and the cheapest way to enforce it is to make the correct
command the one that is already in `package.json`:

```json
// package.json — make it the obvious thing to run
{
  "scripts": {
    "dev": "next dev",
    "dev:https": "next dev --experimental-https",
    "start": "next start",
    "test:pwa": "next build && next start -p 3100"
  }
}
```

Two Next-specific facts about `next start` worth having straight, both read off the CLI option
tables: `next start` accepts `--port`, `--hostname`, `--keepAliveTimeout` and
`--experimental-cpu-prof`, and **`--experimental-https` is not among them** — the HTTPS flags are
documented under `next dev` only. And `-H`/`--hostname` is described as useful for making the
application available to other devices on the network, which is exactly the case that then needs
TLS.

## Getting HTTPS when you actually need it

`next dev --experimental-https` generates a self-signed certificate; the docs are explicit that it
is only intended for development and creates a locally trusted certificate with `mkcert`, and that
production should use properly issued certificates from trusted authorities. You can supply your
own with `--experimental-https-key`, `--experimental-https-cert` and `--experimental-https-ca`.

That covers `next dev` on HTTPS. It does not cover a **production build** on HTTPS, because the
flag does not exist on `next start`. Two honest options:

1. **Give the device a `localhost` origin instead of a certificate.** Chrome's remote debugging
   feature includes port forwarding from an Android device to the host machine, which is the
   normal way to test a real Android browser against `http://localhost:3000` without any TLS at
   all. I have not verified the current DevTools UI for it here — check Chrome's remote debugging
   documentation before following an old screenshot. There is no equivalent for iOS Safari.
2. **Terminate TLS in front of `next start`.** Any reverse proxy with a locally trusted
   certificate works; the app never learns the difference. This is also closer to production,
   where Next almost always sits behind a proxy.

🔴 **Do not click through a certificate warning and keep testing.** You then have an origin the
browser has flagged, and you are debugging a half-trusted context rather than your app. Install
the local CA so the certificate is genuinely trusted — that is what `mkcert` exists to do, and it
is the tool the Next docs name.

## A clean origin, proved rather than assumed

A PWA is defined by persistent state, so a test that does not control that state is measuring
history. Chrome's Storage pane unregisters service workers and clears every cache and storage
bucket for the origin in one click, and that button is the foundation of every repeatable run. The
discipline around it:

1. Storage pane → clear site data.
2. Confirm the Service Workers pane lists nothing for the origin, using **See all registrations** —
   a worker registered at a narrower scope will not appear in the default view.
3. Confirm Cache Storage is empty.
4. Only then reload.

Steps 2 and 3 exist because the clearing controls are a set of checkboxes and someone always
unticks one. Do not trust them; assert instead, from the page:

```ts
// lib/sw-test-harness.ts — assert a genuinely clean origin before a run
export async function assertCleanOrigin() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const cacheNames = await caches.keys();
  if (registrations.length || cacheNames.length) {
    throw new Error(
      `not clean: ${registrations.length} registration(s), caches [${cacheNames.join(', ')}]`,
    );
  }
}

// the reset itself, when you would rather not reach for the panel
export async function nukeWorkerAndCaches() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}
```

The most reliable reset of all does not involve the panel at all — a throwaway Chrome profile
starts every run from nothing, with no checkbox state to remember and no extensions injecting
requests:

```bash
rm -rf /tmp/pwa-audit-profile
google-chrome --user-data-dir=/tmp/pwa-audit-profile http://localhost:3000
```

## Gotchas

### A zombie service worker on `localhost:3000` from a different project
**Symptom.** A brand-new app on port 3000 serves someone else's cached page, or fails offline in a
way that makes no sense for code you have not written yet.
**Cause.** Service worker registration is scoped to an **origin**, and `http://localhost:3000` is
one origin shared by every project you have ever run on that port. The registration outlives the
project.
**Fix.** Check what is actually registered for the origin before blaming your code, and clear it:

```ts
// paste into the console on http://localhost:3000, or ship it as a dev-only route
const registrations = await navigator.serviceWorker.getRegistrations();
console.table(
  registrations.map((r) => ({ scope: r.scope, script: r.active?.scriptURL ?? null })),
);
await Promise.all(registrations.map((r) => r.unregister()));
```

Better still, give each project its own port in `package.json` so the origins never collide.

### Assuming you need HTTPS on your own machine
**Symptom.** Hours spent on certificates before the first service worker test.
**Cause.** The rule is remembered as "service workers require HTTPS". The rule is that they require
a *secure context*, and MDN classes locally delivered origins as potentially trustworthy.
**Fix.** Run `next start` and open `http://localhost:3000`. If you want a hostname rather than
`localhost`, use a `.localhost` subdomain, which is covered by the same rule:

```bash
next start -p 3000
# then open http://sprintdesk.localhost:3000 — still a secure context, still no TLS
```

### Expecting `next start --experimental-https` to work
**Symptom.** The flag is rejected, or silently ignored, on the production server command.
**Cause.** The HTTPS flags are documented on `next dev` only. `next start`'s option table is
`--port`, `--hostname`, `--keepAliveTimeout`, `--experimental-cpu-prof` and `--help`.
**Fix.** Put a TLS-terminating proxy in front of `next start`, or use port forwarding to give the
device a `localhost` origin. If all you need is HTTPS with *dev-quality* behaviour, use
`next dev --experimental-https` and accept that you are not testing prefetching or production
chunks — which means you are not testing offline.

### Shipping a `--experimental-https` certificate to production
**Symptom.** Certificate warnings for real users.
**Cause.** The generated certificate is locally trusted by design; the docs say the flag is only
intended for development.
**Fix.** Use a properly issued certificate from a trusted authority in production. Nothing in the
Next CLI is part of that path.

### The phone on the LAN registers no service worker
**Symptom.** Everything works on the laptop; on a real device nothing installs, no worker
registers, and push cannot be subscribed.
**Cause.** `http://192.168.x.x` is not a potentially trustworthy origin. It is not local to the
browser's device, and it is not HTTPS.
**Fix.** Either terminate TLS in front of `next start` with a certificate the device trusts, or —
on Android — use Chrome's remote-debugging port forwarding so the device sees a `localhost`
origin. On iOS there is no port forwarding, so TLS is the only route, and everything in
[10p](10p-ios-and-safari-limits.md) is gated behind getting it right.

### Clearing site data and leaving the registration behind
**Symptom.** A "first visit" test that behaves like a returning visit.
**Cause.** The clearing controls are checkboxes and the service-worker one was unticked, or the
worker is registered at a narrower scope than the default panel view lists.
**Fix.** Call `assertCleanOrigin()` from the section above at the top of the run and let it throw.
A test that silently starts dirty is worse than one that fails loudly.

### Unregistering the worker and expecting a clean slate
**Symptom.** You unregister, reload, and stale responses keep appearing.
**Cause.** Unregistering removes the registration. The named caches are origin storage and outlive
it — the mechanism is in [10k](10k-service-worker-cache-budget-and-eviction.md).
**Fix.** `nukeWorkerAndCaches()` above deletes both. Never assume one implies the other.

### Drawing persistence conclusions from an Incognito window
**Symptom.** Everything works in Incognito, then nothing persists for real users.
**Cause.** Incognito gives a clean profile per window — excellent for "does a first visit work" —
but its storage does not survive the window closing, so it says nothing about returning users,
eviction, or WebKit's seven-day fuse ([10q](10q-ios-storage-and-installed-app-containers.md)).
**Fix.** Use Incognito for first-visit runs and a throwaway `--user-data-dir` profile plus a
deliberate reset for anything about persistence.

### Testing against a stale `.next` directory
**Symptom.** A fix is in the source, the build "passed", and the served app is the old one.
**Cause.** `next start` serves whatever `next build` last produced. A build that failed, or was
never re-run, leaves the previous output in place.
**Fix.** Chain them so it cannot happen, and use a distinct port so a forgotten dev server on 3000
cannot be the thing you are testing:

```bash
next build && next start -p 3100
```

### Changing the port midway through a test session
**Symptom.** The worker you were debugging disappears.
**Cause.** `http://localhost:3000` and `http://localhost:3100` are different origins with
different registrations and different storage. Nothing carries over.
**Fix.** Pin the port for the whole session. If you must move, re-run the clean-origin assertion on
the new origin rather than assuming the state you built up followed you.

## Interview questions

**★ Does a service worker require HTTPS on localhost?**
No. It requires a *secure context*, and MDN classes locally delivered resources — `http://localhost`,
`http://127.0.0.1` and `http://*.localhost` — as potentially trustworthy on the grounds that they
are on the same device as the browser. So `next start` on `http://localhost:3000` registers workers,
installs, and subscribes to push without any certificate. TLS becomes mandatory the moment the
browser is on a different machine from the server, which in practice means the moment you pick up
your phone.

**★ Why must offline behaviour be tested against a production build?**
Because prefetching is disabled in development, and the App Shell that `experimental.useOffline`
renders when a navigation fails is the *prefetched* one. In `next dev` it does not exist, so the
feature appears to do nothing and gets written off as broken. Development also serves unbundled
modules under chunk names production never uses, and keeps an HMR socket open that fails noisily
the moment you go offline — so even the errors you see are the wrong errors.

**★ A colleague says their new app is serving pages they never wrote. What do you check first?**
Service worker registrations on the origin. `http://localhost:3000` is one origin shared by every
project that ever ran on that port, and a registration from an old project survives deleting the
old project entirely. `navigator.serviceWorker.getRegistrations()` shows the scopes and script URLs;
unregistering them, and deleting the caches separately because unregistration does not touch them,
resolves it. Giving each project a distinct port prevents the class of bug.

**Can you run a production build over HTTPS with the Next CLI?**
Not directly. The `--experimental-https` family is documented under `next dev`; `next start`'s
options are port, hostname, keep-alive timeout, CPU profiling and help. For a production build over
TLS you terminate TLS in front of it with a proxy, which is what happens in production anyway — or,
if the goal is device testing rather than TLS itself, you give the device a `localhost` origin
through port forwarding.

**Why is a throwaway Chrome profile better than clicking "clear site data"?**
Because clearing site data is a set of checkboxes whose state persists between sessions, and one
unticked box means your "first visit" run starts with a registration or a cache already in place —
silently. A fresh `--user-data-dir` has no checkbox state, no extensions injecting requests, and no
history of any kind, so the run is reproducible by construction. Assert the clean state from the
page as well; the cost is one function call and it converts a silent wrong result into a loud one.

---

← [Auditing with the Application panel](10v-auditing-with-the-application-panel.md) · [Chapter 12 overview](01-explanation.md) · Next → [Reproducing the update bug](10x-reproducing-the-failures-deliberately.md)
