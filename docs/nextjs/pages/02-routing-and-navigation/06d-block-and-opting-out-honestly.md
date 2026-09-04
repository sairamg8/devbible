---
title: "instant = false is a validation switch rather than a performance fix — it changes what is reported and not what is rendered, its precedence rule inverts between the two checks that read it, and it does not clear synchronous-IO build errors no matter where you put it"
sidebar_label: "06d · Block, and opting out honestly"
sidebar_position: 37
description: "The third fix card in full: when Block is the right answer, the layout-versus-page choice, the inverted precedence rule for static-shell validation, the use cache: private alternative you should try first, the two things instant = false explicitly does not do, and the whole-app codemod."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Uncached data during prerendering](https://nextjs.org/docs/messages/blocking-prerender-dynamic) (Insight message page, no `lastUpdated` field), [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant) (`lastUpdated: 2026-08-03`), [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) (`lastUpdated: 2026-08-25`), [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (`lastUpdated: 2026-08-25`, via the banked chapter-5 research pass) and [Next.js 16.3: Instant Navigations](https://nextjs.org/blog/next-16-3-instant-navigations).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**`export const instant = false` is the one fix card that does not make anything faster, and it is the one people reach for first because it is the only one that is a single line. Used correctly it is an honest statement that a route needs request-time data high in its tree and has no useful shell to show first. Used incorrectly it is a way to make a red box go away. This page covers when it is right, why it behaves in opposite directions for the two different validations that read it, the `use cache: private` option most people skip past on the way to it, and the two failure classes it explicitly does not cover — one of which will keep your build red while you are convinced the opt-out is broken.**

## Fix 3 — Block

Choose it *"when the route renders per-request and there's no useful static shell."* The blog:

> *"However, sometimes you might want to make a certain navigation server-bound. For example, a blog might choose to never show a loading shell for posts. For those cases, you can tell Next.js that you want this navigation to Block"*

```tsx
// app/dashboard/page.tsx — only this route blocks
export const instant = false

export default async function Page() {
  const data = await getDashboard()
  return <Dashboard data={data} />
}
```

```tsx
// app/dashboard/layout.tsx — the shared layout blocks, descendants stay validated
export const instant = false

export default function DashboardLayout({
  children,
}: LayoutProps<'/dashboard'>) {
  return <DashboardShell>{children}</DashboardShell>
}
```

> *"When the shared layout itself can't ship instantly (it reads runtime data or uncached data of its own), set `instant` to `false` on the layout. This allows that layout segment to block while descendant segments remain independently validated."*

> *"With `false` on `/dashboard/layout.tsx`, validation no longer flags navigations into `/dashboard` from outside; navigations between `/dashboard/a` and `/dashboard/b` are still checked."*

Use it when, verbatim:

> *"The route needs request-time data high in the tree to decide what to render (for example auth, tenant, or other gating in a layout), so there is no meaningful static shell worth showing first."*
> *"You're migrating a route incrementally and want to defer the lifetime decision without changing how the page renders today."*

And the sentence that belongs in every code-review comment on this export:

> *"Don't use this to dismiss the error. Choose Cache the component or data or Wrap in or move into Suspense when either is feasible."*

### The trade-off

> *"Navigations to this route are not instant. The user waits for the full server render before any HTML arrives. Use this only when that latency is necessary for the route to function."*

### 🔴 The inverted precedence rule for static-shell validation

Cache Components runs a second check that `instant` also governs, and it resolves in the **opposite** direction from the navigation checks:

> *"Cache Components also validates that each page in your app produces a non-empty static shell at prerender time. To opt a route out of this validation, ensure the highest `instant` config in the route's tree is `false` — a `false` higher in the tree takes precedence over any deeper `true` for the static-shell check."*
> *"Setting `false` on the root layout disables static shell validation for the entire app. Place the `false` as low as possible — only as high as needed to cover the routes you want to opt out — so the rest of the app keeps validating."*

For navigation validation, meanwhile, a `false` on a layout does **not** silence its descendants — those are still checked against each other. The two checks read the same export with two different precedence rules, and the reference is explicit that you should not reach for `false` reflexively:

> *"You don't need to add `false` to ancestors of an instant page just because they do something blocking — a higher-up `instant = true` doesn't force its descendants to validate, and leaving an ancestor unconfigured is fine. Reach for `false` only when you've configured a deeper page as instant and need to exempt navigations that pass through a blocking ancestor."*

### The alternative the guide offers before you reach for Block

> *"For opted-out segments, the navigation blocks on the server. If the content depends on cookies or headers but has a known cache lifetime, caching it with `use cache: private` lets the App Shell carry it ahead of the click instead of opting out, as long as its `stale` time is at least 5 minutes."*

## What it does *not* do — two hard limits, stated by the migration guide

Two pages appear at first reading to disagree about what `instant = false` does in production. The guide says *"For opted-out segments, the navigation blocks on the server"* and also that the segment *"may still navigate instantly if its structure supports it; the framework just won't surface insights for it."* The message page says *"This export does not disable prerendering. The route still prerenders if it can. It only disables instant-navigation validation for the route."*

The [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) guide (`lastUpdated: 2026-08-25`) settles it, and it settles it in favour of the message page:

> *"`instant = false` marks a segment as **allowed to block**. It does not force the route to be dynamic, so a genuinely prerenderable route still ships a static shell. It also does not clear synchronous IO build errors: calls like `new Date()`, `Math.random()`, and `crypto.randomUUID()` still fail the prerender."*

So the correct mental model is: **`instant = false` changes what is reported, not what is rendered.** A route that could prerender still prerenders. The guide's "blocks on the server" describes the typical route you would put this export on, not a consequence of putting it there.

🔴 **The second limit is the one that ends a debugging session badly**, because it looks like the opt-out simply did not take:

> *"**Fix synchronous IO. It can't be deferred.** Calls like `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` during prerender throw a build error that `instant = false` does not clear, so a route that uses them won't build until you address it, opt-out or not."*

There is no opting out of that class. `Math.random()` and `Date.now()` have their own Insight slugs precisely because they are not the same problem as an uncached `fetch()` — they cannot be moved behind a boundary or cached, they have to be removed from the prerender path.

```tsx
// Fails the prerender regardless of `instant = false`
export default function Page() {
  return <p>Built at {new Date().toISOString()}</p>
}

// Cache it, so the value is computed once and stored rather than derived at prerender
async function buildStamp() {
  'use cache'
  return new Date().toISOString()
}

export default async function Page() {
  return <p>Built at {await buildStamp()}</p>
}
```

## Opting out of a whole app at once

If you are adopting Cache Components on an existing codebase and want every route exempt while you work through them one at a time, there is a codemod rather than a config flag:

```bash
npx @next/codemod@canary cache-components-instant-false ./app
```

> *"Pass `./src/app` in a `src/` project. A wrong path reports `0 ok` instead of failing, so check the file count."*

⚠️ That codemod writes `export const instant = false` into your files. It is a **migration scaffold with a deletion date**, not a configuration choice — every one of those exports is a route that is documented as not-instant until someone removes it. If you want a reversible, single-line version of the same idea, `experimental.instantInsights.validationLevel: 'manual-warning'` gets you there without touching source files; see [06b](06b-instant-insights-and-the-fix-cards.md).

## Gotchas

**Symptom: you set `instant = false` on a page and its children still produce Insights.** Cause: the export is scoped to the segment that declares it. Verbatim: *"Setting `instant` to `false` opts only the segment that exports it out. Descendant segments are still validated by the global default."* Fix: put it on the layout if you mean navigations *into* the subtree — and remember the asymmetry, because for *static-shell* validation a `false` higher in the tree wins over a deeper `true`, which is the opposite direction.

**Symptom: setting `instant = false` on the root layout makes an entire class of errors disappear.** Cause: it does exactly that, for static-shell validation across the whole app. Verbatim: *"Setting `false` on the root layout disables static shell validation for the entire app. Place the `false` as low as possible."* Fix: never put it on the root layout to quiet a single route; push it down to the lowest segment that covers what you actually meant to exempt.

**★ Symptom: a route reads a session cookie in a layout and you conclude it must Block.** Cause: you skipped the middle option. The guide offers `use cache: private` for exactly this shape — *"If the content depends on cookies or headers but has a known cache lifetime, caching it with `use cache: private` lets the App Shell carry it ahead of the click instead of opting out, as long as its `stale` time is at least 5 minutes."* Fix: read the runtime value outside the cached scope, pass it in, and check the `stale` floor before reaching for `false`.

```tsx
// app/dashboard/layout.tsx
import { cookies } from 'next/headers'
import { cacheLife } from 'next/cache'

async function getWorkspace(session: string | undefined) {
  'use cache: private'
  cacheLife('hours') // must leave `stale` at 5 minutes or more to reach the App Shell
  return db.workspaces.forSession(session)
}

export default async function DashboardLayout({
  children,
}: LayoutProps<'/dashboard'>) {
  const session = (await cookies()).get('session')?.value
  const workspace = await getWorkspace(session)
  return <DashboardShell workspace={workspace}>{children}</DashboardShell>
}
```

**★ Symptom: you added `instant = false` and the build still fails with the same error.** Cause: the failure is synchronous IO, which the opt-out explicitly does not cover. Verbatim: *"Fix synchronous IO. It can't be deferred."* Fix: remove `new Date()`, `Date.now()`, `Math.random()` or `crypto.randomUUID()` from the prerender path — cache the value so it is computed once, or move the call into a Client Component that runs after hydration.

```tsx
// The value is now a cached artifact, not something derived during prerender
async function requestId() {
  'use cache'
  return crypto.randomUUID()
}
```

**Symptom: a colleague adds `instant = false` in a pull request and the reviewer cannot tell whether it is legitimate.** Cause: the export looks identical whether it encodes a real architectural constraint or a dismissed warning. Fix: the docs give the review rule — *"Don't use this to dismiss the error. Choose Cache the component or data or Wrap in or move into Suspense when either is feasible."* Make the PR say **which** request-time value high in the tree decides what the route renders. If there is no such value, the export is wrong.

**Symptom: a codemod run reports success but nothing changed.** Cause: the app directory path was wrong. Verbatim: *"Pass `./src/app` in a `src/` project. A wrong path reports `0 ok` instead of failing, so check the file count."* Fix: read the file count in the output, not the exit code.

```bash
npx @next/codemod@canary cache-components-instant-false ./src/app
```
## Interview questions

**★ What does `instant = false` actually do in production?**
Nothing to the render. It changes what the framework *reports*, not what it *produces*. Three pages have to be read together to be sure of this, because the guide's phrasing — *"For opted-out segments, the navigation blocks on the server"* — reads like a behaviour change. The message page contradicts that framing: *"This export does not disable prerendering. The route still prerenders if it can. It only disables instant-navigation validation for the route."* And the migration guide settles it in the same direction and in the strongest terms: *"It does not force the route to be dynamic, so a genuinely prerenderable route still ships a static shell."* So a route that was prerenderable before the export is prerenderable after it. The guide's sentence describes the kind of route you would apply this to, not an effect of applying it.

**★ Your build fails on `new Date()` and someone adds `instant = false`. What happens?**
The build still fails, and now the route is also documented as not-instant for no benefit. Synchronous IO is a separate class of failure that the opt-out explicitly does not cover: *"Calls like `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` during prerender throw a build error that `instant = false` does not clear, so a route that uses them won't build until you address it, opt-out or not."* You can see this in the Insight catalogue too — `blocking-prerender-random`, `blocking-prerender-current-time` and `blocking-prerender-crypto` are their own slugs, with Client Component variants, rather than cases of the uncached-data message. The fix is to get the value out of the prerender path: cache it so it is computed once and stored, move it to a Client Component that runs after hydration, or remove it.

**What is the difference between running the `cache-components-instant-false` codemod and setting `validationLevel: 'manual-warning'`?**
Both silence validation across the app; only one of them leaves a trail. The codemod writes `export const instant = false` into every page and layout, which is durable, greppable and reviewable — you can count what is left to do, and each removal is a visible diff. `validationLevel: 'manual-warning'` is one line in `next.config` that inverts the default from opt-out to opt-in, which is reversible in a second but leaves no per-route record of what was skipped. Use the codemod when the migration is a tracked project with a burn-down; use the config key when you need quiet for an afternoon. The trap with the codemod is its failure mode — a wrong path *"reports `0 ok` instead of failing"*, so check the file count rather than the exit status.

**Why does `instant = false` resolve one way for navigation validation and the other way for static-shell validation?**
Because they are checks on different artifacts. Navigation validation asks "can a client transition into this segment paint immediately," which is a question about each boundary crossing, so a `false` on a layout exempts navigations *through* that layout while sibling-to-sibling navigations below it are still meaningful and still checked. Static-shell validation asks "does this route produce a non-empty prerender," which is a single yes/no about the whole route tree — so the highest `false` wins and everything beneath it is exempt. The practical rule that falls out is the one the docs state: place `false` as low as possible, and never on the root layout unless you mean to switch off static-shell validation for the entire app.

**When would you reach for `use cache: private` instead of Block?**
When the blocking read is `cookies()` or `headers()` — session-shaped rather than URL-shaped — and the data behind it has a known lifetime of at least five minutes. `use cache: private` caches in the browser only and therefore cannot join the static shell, but it *can* be carried by the App Shell ahead of a click, which is what makes the client navigation instant. That is strictly better than `instant = false`, which gives up on the navigation entirely. The five-minute `stale` floor is the constraint that decides it: below that, the value will not be carried and you are back to Stream or Block.
---

← [06c · Stream and Cache in detail](06c-stream-cache-and-block-in-detail.md) · [Chapter 2 overview](01-explanation.md) · Next → [07 · `proxy.ts`: the deployment boundary](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md)
