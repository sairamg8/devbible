---
title: "The moment a host and a remote deploy on separate schedules, the browser assembles a page out of artefacts that were never built or tested together, and the single mutable file deciding which artefacts those are is remoteEntry.js"
sidebar_label: "05c · Version skew and the manifest"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html) and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[05](05-module-federation-on-vite.md) established that `remoteEntry.js` is a manifest
fetched fresh at load time, not pinned at the host's build time — that is the entire value
proposition of federation. This page is about the caching and deploy-ordering consequence
of that design: the manifest and the chunks it names are two different kinds of file with
opposite caching requirements, and a deploy pipeline that treats them the same either
serves stale code for an hour or 404s a live user mid-navigation. Neither failure looks
like a bug in the code that shipped; both look like a caching or deploy-ordering mistake,
because that is exactly what they are. [05d](05d-exposes-sri-and-build-observability.md)
continues with the parts of version skew that aren't about caching at all — the type
contract across `exposes`, why SRI actively fights this pattern, and how to know which
build is actually running.**

## `remoteEntry.js` is the federation equivalent of `index.html`, and the caching split it needs is the same one

**[01f](../15-deployment-considerations/01f-caching-strategy-and-library-mode-deployment.md)**
already argues the general case for a normal Vite build: content-hashed chunks under
`assets/` can be cached `immutable` forever because a content change always produces a new
filename, and `index.html` — the one unhashed, fixed-name file every request must find —
needs the opposite treatment, `no-cache`, so a stale copy doesn't keep pointing at chunks a
new deploy has removed. That page also carries the Vite documentation's own description of
what happens when the split is inverted: a returning user's browser holds a cached
`index.html` referencing hashed chunks the new deploy's `emptyOutDir` has since deleted, and
the resulting dynamic `import()` 404s.

A federated remote reproduces that exact shape with `remoteEntry.js` standing in for
`index.html`:

- **The remote's hashed chunks** — the actual JS implementing whatever `exposes` names —
  are content-hashed the same way any Vite build's chunks are. `Cache-Control: public,
  max-age=31536000, immutable` is correct on them for the same reason it's correct on any
  hashed asset: a byte changing anywhere in the file changes the filename, so a cached copy
  under the old name is never requested again.
- **`remoteEntry.js` itself is unhashed, at a fixed, predictable name** — the host's
  `remotes` config points at a literal URL (`checkout@http://localhost:3001/remoteEntry.js`
  in [05b](05b-worked-example-and-the-version-spine.md)'s example), and that URL cannot
  change on every deploy the way a hashed chunk's can, because the host's own build has that
  URL baked into it and isn't rebuilding every time the remote redeploys. It needs the same
  short-lived treatment `index.html` needs, for the same reason: a stale cached copy of it
  is not merely outdated, it's actively wrong, pointing at chunks that may no longer exist.

```nginx
# nginx.conf — checkout's remote deploy

location /assets/ {
    # Hashed chunk filenames — a content change always produces a new filename,
    # so a cached copy under the OLD filename is simply never requested again.
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location = /remoteEntry.js {
    # UNHASHED, fixed name — every host's `remotes` config points at this exact
    # URL forever. A stale cached copy here doesn't just serve an old page,
    # it names chunks that a later deploy may have already deleted.
    add_header Cache-Control "no-cache, must-revalidate";
}
```

`max-age=0, must-revalidate` is an equivalent way to write the same intent — force a
conditional request on every fetch rather than trusting any locally stored copy without
asking first. Either is correct; what's not correct is letting `remoteEntry.js` inherit the
same `immutable` rule as everything under `assets/`, which is the single most common way
this gets broken, because it's usually one glob rule (`*.js`) rather than two deliberate
ones.

## What actually breaks when the split is inverted, and why it's worse than the `index.html` case

Invert the split — `remoteEntry.js` picks up a long `max-age` from a CDN edge, either
through a blanket rule or because the CDN's own default TTL applies to anything without an
explicit override — and the failure has a specific, disproportionately bad shape.

`checkout` deploys a new build. The new hashed chunks land on the origin; the previous
build's chunks are removed (the next section argues why they shouldn't be, but assume for a
moment a deploy pipeline that does remove them, because most naive ones do). A CDN edge
somewhere is still serving the *old* `remoteEntry.js` out of cache — it hasn't expired yet,
and nothing told it to revalidate. Every host that fetches `checkout`'s manifest during that
window gets the old manifest, naming the old, now-deleted chunk filenames. The
`React.lazy(() => import('checkout/CheckoutFlow'))` call in
[05b](05b-worked-example-and-the-version-spine.md)'s `CheckoutBoundary` resolves against
that stale manifest, the federation runtime fetches a chunk URL that no longer exists on the
origin, and the request 404s.

The reason this is worse than the equivalent `index.html` failure: an `index.html` cache
failure is caught at *page load* — the user's very first request for the page returns a
stale entry point, and the failure (or a `vite:preloadError` handler's recovery) happens
before the user has invested anything in the session. A stale `remoteEntry.js` is fetched
lazily, at the exact moment the host's code first tries to resolve
`checkout/CheckoutFlow` — which for a route that isn't the landing page is often deep into
a session, after a real interaction, not at initial load. The user has already loaded
`shell` successfully, done something, and only then hits a blank panel or an uncaught
promise rejection where checkout should be. It is not correlated with the user's own initial
page load, which is exactly what makes it read as "works for me" — the engineer testing it
loaded the page fresh, past any stale edge cache window, and never reaches the failure the
next user hits on the same route thirty seconds into a stale CDN's TTL.

The CDN TTL is the whole blast radius. A one-hour `max-age` on `remoteEntry.js` means every
host across every origin consuming `checkout` can serve broken navigations to some fraction
of users for up to an hour after every single `checkout` deploy, with no code change on
either side to point at.

## The atomicity problem: a remote deploy is not one atomic operation across the manifest and its chunks

Even with the caching split correct, a remote deploy still isn't atomic. Uploading a new
`remoteEntry.js` and uploading its corresponding hashed chunks are two (or more) separate
writes to two (or more) separate files, with no transaction wrapping them. Between the
moment the new `remoteEntry.js` is live and the moment every one of its referenced chunks
has finished propagating to every edge that might serve them, a request landing in that
window can fetch the *new* manifest and get a *chunk* URL that hasn't finished propagating
yet — the same 404, from the opposite direction.

🔴 **The fix this argues for is specifically: never delete a previous build's chunks on
deploy.** `build.emptyOutDir` clearing `outDir` before every build, as
[01f](../15-deployment-considerations/01f-caching-strategy-and-library-mode-deployment.md)
describes for a normal app, is correct for a self-contained application where the host
serving `index.html` and the host serving its chunks are the same deploy, updated together.
A federated remote does not have that guarantee — some other party's cached copy of an
*older* `remoteEntry.js`, or a request caught in the propagation window above, can still
reference chunks from a build that is no longer the current one. Deleting those chunks
converts a merely-stale reference into a guaranteed 404; keeping them converts it into a
harmless cache hit for an old-but-still-valid file.

```
checkout-deploys/
├── build-2026-09-06-a1b2c3/   ← kept: some cached remoteEntry.js may still reference it
├── build-2026-09-07-d4e5f6/   ← kept
└── build-2026-09-08-g7h8i9/   ← current, live remoteEntry.js points here
```

Keep N previous builds' hashed chunks reachable at their original URLs, and let the CDN's or
object store's own lifecycle policy age the oldest ones out on a much longer horizon than
any `remoteEntry.js` cache TTL — long enough that no live cached manifest could plausibly
still be pointing at them. The exact value of N and the retention window is a deploy-topology
decision this page does not attempt to pin a number to; the property that matters is that a
chunk referenced by *any* manifest a client could currently be holding must still resolve.

## Rollback is not symmetric: rolling the host back does not roll the remote back

A host and a remote are separately deployed artefacts, and a rollback of one is a rollback
of exactly that one artefact — not of the pairing. Rolling `shell` (the host) back to a
previous build restores `shell`'s own code and its own `remotes` config, pointing at the
same `checkout@http://localhost:3001/remoteEntry.js` URL it always did. It does **not**
restore `checkout` to whatever version was live when that host build was originally shipped
— `checkout`'s deploy pipeline is entirely independent, and the currently-live
`remoteEntry.js` at that URL is whatever `checkout`'s most recent deploy left there,
regardless of what `shell` version is asking for it.

This means an incident traced to `checkout` cannot be fixed by rolling `shell` back, and an
incident that looks like it started with a `shell` deploy can actually be `checkout` having
redeployed at roughly the same time — the host's own deploy history and the remote's are two
independent timelines that happen to be rendered together in the same browser tab, and
nothing in either side's own deploy tooling correlates them. Rolling back the side that
didn't change fixes nothing; the fix has to target whichever side's deploy actually
introduced the regression, which requires knowing which one that was — the observability
section on [05d](05d-exposes-sri-and-build-observability.md) is the mechanism for finding
out.

## Gotchas

**★ Symptom: a `checkout` deploy goes out clean, and for roughly an hour afterward some
fraction of navigations into checkout throw a chunk-load error, then it stops on its own.**
Cause: `remoteEntry.js` was served with the same long `max-age`/`immutable` rule as the
hashed chunks under `assets/`, so a CDN edge kept serving the previous manifest — naming
chunk filenames the new deploy had already removed — until that edge's own TTL expired.
Fix: give `remoteEntry.js` its own explicit `no-cache`/`must-revalidate` rule, scoped
separately from the hashed-assets rule, exactly as [01f](../15-deployment-considerations/01f-caching-strategy-and-library-mode-deployment.md)
argues for `index.html`.

**★ Symptom: the chunk-load failure above happens deep into a user's session, not on their
first page load, which makes it hard to reproduce by just reloading the page.** Cause: the
stale manifest is fetched lazily, at the exact moment the host's code first resolves a
federated `import()` — for anything that isn't the landing route, that's often well after
the initial page load, once the user has already interacted with the app. Reproducing it
requires hitting the specific stale-cache window on the specific route, not just loading the
page. Fix: this is the failure the caching-split gotcha above already fixes at the source —
treat "reproduces only intermittently, mid-session" as a strong signal to check
`remoteEntry.js`'s cache headers before assuming a code regression.

**★ Symptom: a `checkout` deploy's `remoteEntry.js` is fixed, but chunk 404s continue for a
short window right after every subsequent deploy.** Cause: the deploy pipeline treats
`checkout`'s previous build as disposable and deletes its chunks as part of publishing the
new one — reproducing `build.emptyOutDir`'s behaviour, which is correct for a self-contained
app but wrong for a remote, because some client somewhere may still be holding a cached
`remoteEntry.js` (even a short-lived one, mid-propagation) that references the just-deleted
build. Fix: never delete a previous build's chunks on deploy; retain the last N builds'
hashed output at their original URLs and let a lifecycle policy age them out on a horizon
much longer than any `remoteEntry.js` cache TTL.

**Symptom: rolling `shell` back to yesterday's build doesn't fix a checkout-related
production issue, or appears to fix an unrelated one.** Cause: `shell`'s rollback restores
`shell`'s own code and its `remotes` config, but the URL that config points at
(`checkout@http://localhost:3001/remoteEntry.js`) still resolves to whatever `checkout`'s
own, independent deploy pipeline currently has live — rolling back one side of a federation
pairing does not roll back the other. Fix: identify which side actually introduced the
regression (see the build-SHA observability section on
[05d](05d-exposes-sri-and-build-observability.md)) before rolling either one back; a `shell`
rollback only helps if `shell` was the side that regressed.

## Interview questions

**★ Why does `remoteEntry.js` need the same short-lived caching treatment as `index.html`,
when it's serving a completely different purpose?**
Because the property that determines the correct caching policy isn't what the file is for,
it's whether its own URL changes when its content does. `index.html` and `remoteEntry.js`
are both unhashed, fixed-name files — every host's `remotes` config, like every browser's
initial page request, addresses them by a URL that never changes across deploys. A stale
cached copy of either one doesn't just serve outdated content, it actively points at chunk
filenames a later deploy may have already removed. The hashed chunks both files reference
can be cached forever precisely because *their* filenames do change on every content change
— the split tracks that property, not the file's role.

**★ Why is a stale `remoteEntry.js` a worse operational problem than a stale `index.html`,
even though both come from the same root cause?**
Timing. A stale `index.html` is caught at the very first request for the page — before the
user has invested anything in the session, and Vite's own `vite:preloadError` handling
exists to recover from exactly that case at load time. A stale `remoteEntry.js` is fetched
lazily, at the moment the host's code first resolves a federated import — which for most
routes is well into a session, after real interaction. The failure isn't correlated with the
user's initial page load at all, so it reproduces intermittently and looks like a flaky bug
rather than a caching misconfiguration, which is exactly what makes it hard to diagnose from
a bug report alone.

**Why is "never delete a previous build's chunks" a stronger requirement for a federated
remote than for a normal Vite app, given that both use content-hashed filenames?**
A normal app's `index.html` and its chunks are the same deploy, updated atomically from the
consuming browser's point of view — a fresh page load always gets the current `index.html`
naming the current chunks. A federated remote's `remoteEntry.js` is consumed by a different
party (the host) on a schedule the remote doesn't control, through caches the remote doesn't
control, and the manifest and its chunks aren't published as a single atomic unit even on
the remote's own side. Any client — a host, or a CDN edge mid-propagation — can be holding a
manifest that references a build the remote's own pipeline no longer considers current. Only
keeping old builds' chunks reachable closes that window; deleting them on every deploy
guarantees any such reference 404s.

**Why can't rolling the host back to a previous build fix an incident actually caused by the
remote?**
Because a rollback restores exactly the artefact that was rolled back and nothing else. The
host's `remotes` config names a URL, not a pinned build — rolling `shell` back changes what
code `shell` itself runs but leaves that URL resolving to whatever `checkout`'s own,
completely independent deploy pipeline currently has live. The two sides' deploy histories
were never coupled in the first place, which is the entire point of federation; a rollback
only helps the side whose own history you're rolling back.

---

← [Worked example and version spine](05b-worked-example-and-the-version-spine.md) · [Vite overview](../../README.md) · Next → [exposes, SRI and observability](05d-exposes-sri-and-build-observability.md)
