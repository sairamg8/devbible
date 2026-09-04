---
title: "There is no longer a runtime to choose per route — `'edge'` is deprecated, the migration is to delete the line rather than change it, and the documentation offers no rationale you are entitled to repeat"
sidebar_label: "04 · The withdrawn runtime choice"
sidebar_position: 4
description: "What is actually deprecated (the value, not the option), why the migration is removal and not substitution, the warning it emits, the Cache Components forcing function, and the claims about isolates, cold starts and API allow-lists that no current documentation supports."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js documentation — [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) and its [`runtime` sub-page](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime) (both `version: 16.3.4`, `lastUpdated: 2026-04-30`), and the [Edge Runtime Deprecated](https://nextjs.org/docs/messages/edge-runtime-deprecated) message page (fetched 2026-09-04; the page carries no `lastUpdated`). Cross-checked against the corpus's Cache Components and `preferredRegion` verifications.
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run**, **no timings**, **no cold-start figures** — see [What the documentation refuses to tell you](#what-the-documentation-refuses-to-tell-you).

**This page used to be a decision framework and is now a demolition notice. "Node.js runtime versus Edge runtime, choosing per route" described a real architectural fork for about four years, and in Next.js 16 the fork was closed: `runtime = 'edge'` is deprecated, and the documented migration is not "switch it to `'nodejs'`" but *delete the export*, because `'nodejs'` was always the default. The subtlety that trips people reading the release notes quickly is that the `runtime` option itself is not deprecated — only the `'edge'` value is — so a lint rule or codemod written against "remove all `runtime` exports" is doing the right thing for the wrong reason. The second half of this page is harder and more important: almost everything you have read about *why* — V8 isolates, cold-start milliseconds, memory ceilings, an Edge API allow-list — is not in the current documentation, and this page does not repeat it.**

## What is deprecated, precisely

The Route Segment Config reference lists the options with their types. Two entries carry a deprecation *inside the type itself*:

| Option | Type | Default |
|---|---|---|
| `runtime` | `'nodejs' \| 'edge' (deprecated)` | `'nodejs'` |
| `preferredRegion` | `'auto' \| 'global' \| 'home' \| string \| string[] (deprecated)` | `'auto'` |
| `dynamicParams` | `boolean` | `true` |
| `maxDuration` | `number` | Set by deployment platform |

🔴 **Read the `runtime` row as a union with one member marked, not as a deprecated option.** `runtime` is still a supported route segment config export. It still defaults to `'nodejs'`. What has been withdrawn is the *other value*. The distinction is not academic: a migration note that says "the `runtime` export is deprecated" will send someone hunting for a replacement export that does not exist and never will, because the replacement for `runtime = 'edge'` is *nothing*.

The dedicated sub-page is four sentences and a two-item list, and every one of them is load-bearing:

> *"The `runtime` option allows you to select the JavaScript runtime used for rendering your route."*
> *"**`'nodejs'`** (default)"*
> *"**`'edge'`** (deprecated)"*
> *"The Edge Runtime is deprecated. Remove the `runtime` export from your route files. See Edge Runtime Deprecated."*
> *"This option cannot be used in Proxy."*

That last sentence is the one people skip; it has its own page, [04b](04b-what-survives-the-withdrawal-proxy-and-region-placement.md).

## The migration is a deletion

The message page the reference links to says the same thing in the imperative, and the shape of the fix is a one-line diff:

> *"One or more routes in your application use `export const runtime = 'edge'`, which is deprecated."*
> *"Remove the `runtime` export from your route files:"*
> *"The Node.js runtime is the default, so no replacement is needed."*
> *"This applies to all route files that support the `runtime` segment config: `page.ts`, `layout.ts`, `route.ts`, and API routes."*

The documented diff, verbatim from that page:

```diff
- export const runtime = 'edge'
```

So the correct migration on a real route handler is not a substitution:

```ts
// app/api/health/route.ts — BEFORE
export const runtime = 'edge'

export async function GET() {
  return Response.json({ ok: true })
}
```

```ts
// app/api/health/route.ts — AFTER. The line is gone, not changed.
// 'nodejs' is the default; re-declaring it adds a config export that
// says nothing and that a future reader will assume was deliberate.

export async function GET() {
  return Response.json({ ok: true })
}
```

**Writing `export const runtime = 'nodejs'` instead is not wrong, but it is noise.** It pins a default. Six months from now someone will read it as evidence that this route once needed something special and will be reluctant to touch it. Delete the line.

### It is a warning, not an error

The message page's own heading is *"Why This Warning Occurred"*. That word decides your rollout: a deprecated `runtime = 'edge'` does not stop a build, so **nothing in your pipeline will force this migration for you**. If you want it enforced, enforce it yourself — the routes that still declare it are findable with a plain search, since the config export must be a statically analysable top-level `const`:

```bash
# Every route file still declaring the deprecated value.
grep -rn "runtime *= *['\"]edge['\"]" app/ src/ --include=*.ts --include=*.tsx

# The same search widened to catch the older experimental spelling,
# deprecated separately in v15.0.0-RC and codemod-able.
grep -rn "runtime *= *['\"]\(edge\|experimental-edge\)['\"]" app/ src/
```

The version history records that older spelling as a distinct event:

> *"`v15.0.0-RC` — `export const runtime = \"experimental-edge\"` deprecated. A codemod is available."*

⚠️ **A codemod is documented for `experimental-edge`, not for `'edge'`.** The `edge-runtime-deprecated` page shows a hand diff and names no codemod. If you find one, verify it against the docs before running it across a repository; this page will not assert one exists.

## The forcing function you will actually hit first

Most teams will not migrate because of a warning. They will migrate because a feature refuses to work. The Cache Components documentation makes the dependency explicit:

> *"Cache Components requires the Node.js runtime. Migrate any routes that set the deprecated `runtime = 'edge'` export, and note that other server-side JavaScript runtimes are not guaranteed to work."*

Two things are worth separating in that sentence:

1. **The hard requirement** — Cache Components needs Node.js. A route still declaring `'edge'` is a blocker for adopting the caching model that [chapter 5](../05-caching-ppr-and-cache-components/01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md) is built around.
2. **The softer warning** — *"other server-side JavaScript runtimes are not guaranteed to work."* That is the documentation declining to promise anything about Bun, Deno or a bespoke host. It is not a statement that they fail; it is a statement that they are not covered.

**So the practical ordering is: delete the `runtime` exports first, adopt Cache Components second.** Doing it the other way round produces a build failure whose message points at caching and whose cause is a runtime declaration three directories away.

## What the documentation refuses to tell you

This is the part that separates an honest page from a confident one.

**The current documentation does not state why the Edge Runtime was deprecated.** The message page has a *"Why This Warning Occurred"* section, and it explains only that your code uses a deprecated value — not why the value was deprecated. There is no rationale paragraph, no linked RFC, no blog reference on either page. I fetched it specifically to find one. **It is not there, and this page does not speculate.**

Three families of claim were removed from this page's earlier draft, and each of them should be treated as unsourced until someone produces a current primary source:

- **"An Edge function is a V8 isolate; a Node function is a full process."** No current Next.js reference page says this. It may well have been true of a particular platform's implementation; it is not a documented property of Next.js, and platform implementations change without touching your code.
- **"Edge has faster cold starts and lower memory ceilings."** No figure of any kind appears on the `runtime` pages. A cold start is a property of the *host*, not of the framework, and any number you quote is a number about one vendor on one day. If you need one, get it from that vendor's documentation and cite it as theirs.
- **"The Edge runtime supports only an allow-listed subset of APIs."** There was an Edge Runtime API reference historically. It is not what the current `runtime` page documents, and reconstructing an allow-list from memory is exactly the failure mode this corpus exists to avoid. Do not carry a list forward.

🔴 **The general rule this page is an instance of:** when a capability is withdrawn, the documentation describing it is withdrawn with it — and the descriptions that remain in circulation are all *older than the removal*. Every article explaining Edge-versus-Node trade-offs is, by construction, written against a version where the choice still existed. That does not make them lies; it makes them evidence about a version you are not running.

## Gotchas

**★ Symptom: you told the team "the `runtime` export is deprecated" and someone removed `export const runtime = 'nodejs'` from a file where it was doing nothing, then went looking for its replacement.** Cause: the deprecation lives in the *type union*, on the `'edge'` member — the option itself is current and defaults to `'nodejs'`. Fix: state it precisely, and note that removing an explicit `'nodejs'` is harmless because it restates the default. The one-line rule to circulate:

```ts
// ✅ current — and identical to writing nothing at all
export const runtime = 'nodejs'

// ⚠ deprecated value — remove the line entirely
export const runtime = 'edge'
```

**★ Symptom: `next build` succeeds, so the team concludes there is nothing to migrate.** Cause: the deprecation surfaces as a **warning** (*"Why This Warning Occurred"*), not a build error, so a green pipeline says nothing about it. Fix: make the check explicit rather than trusting the build, and fail CI on a match:

```bash
# ci/no-edge-runtime.sh — exits non-zero when any route still declares it
if grep -rn "runtime *= *['\"]\(edge\|experimental-edge\)['\"]" app/ src/ \
     --include=*.ts --include=*.tsx --include=*.js --include=*.jsx; then
  echo "Deprecated runtime = 'edge' found. Delete the export; 'nodejs' is the default."
  exit 1
fi
```

**Symptom: you migrated by changing `'edge'` to `'nodejs'` and a reviewer asks what the export is for.** Cause: pinning a default reads as intent. Fix: delete the export. The documented instruction is *"Remove the `runtime` export from your route files"*, and the reason given is *"The Node.js runtime is the default, so no replacement is needed."*

**Symptom: enabling Cache Components fails on a route you have not touched in a year.** Cause: that route still carries `runtime = 'edge'`, and *"Cache Components requires the Node.js runtime."* The failure surfaces during the caching migration, so it gets diagnosed as a caching problem. Fix: run the grep above **before** flipping the Cache Components flag, and clear every hit first.

**Symptom: a `runtime` export in a shared file appears to have no effect.** Cause: `runtime` is a *route segment* config. It is read from the files the deprecation page enumerates — *"`page.ts`, `layout.ts`, `route.ts`, and API routes"* — not from an arbitrary module you import. Fix: put segment config in a segment file; if you want it applied to a subtree, put it on that subtree's `layout.ts`, not in a helper module.

**Symptom: a search-and-replace across the repo also rewrote `proxy.ts`.** Cause: the same string appears there, but the semantics are different and worse — see [04b](04b-what-survives-the-withdrawal-proxy-and-region-placement.md): *"This option cannot be used in Proxy."* Fix: exclude `proxy.ts` from the sweep and handle it deliberately; setting the option there throws rather than warns.

**Symptom: a third-party guide insists you must pick Edge for a low-latency route, and the reviewer cannot find the option.** Cause: the guide predates 16. Fix: check the date of anything that presents this as a live choice, and take latency questions to region placement instead — which is now a platform concern with no framework API at all, covered in [chapter 16 · 03](../16-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md).

## Interview questions

**★ `runtime = 'edge'` is deprecated in Next.js 16. What is the migration, and why is it not "set it to `'nodejs'`"?**
The migration is to delete the export. The documentation's instruction is *"Remove the `runtime` export from your route files"*, and it gives the reason directly: *"The Node.js runtime is the default, so no replacement is needed."* Setting it explicitly to `'nodejs'` is functionally identical to deleting it, but it leaves a config export in the file that asserts a default as though it were a decision — which costs the next reader time and discourages them from touching the route. The migration applies to every file that supports the segment config: `page`, `layout`, `route` and API routes.

**★ Is the `runtime` route segment config deprecated?**
No, and this is the distinction the question is testing. The options table types it as `'nodejs' | 'edge' (deprecated)` with a default of `'nodejs'` — the deprecation marker sits on one member of the union, not on the option. `runtime` remains a supported segment config export; the `'edge'` value is what has been withdrawn. Anyone who says "the runtime export is deprecated" will go looking for a successor API, and there isn't one, because the successor to choosing Edge is not choosing.

**Why was the Edge Runtime deprecated?**
The current documentation does not say. The reference page states the deprecation and the migration; the `edge-runtime-deprecated` message page has a *"Why This Warning Occurred"* section that explains only that your code uses the deprecated value. Neither page gives a rationale, links an RFC, or names a replacement architecture. The honest answer in an interview is that the docs instruct removal without explaining the decision, and that anything else you have read on the subject is older than the deprecation — plus one adjacent fact that *is* documented and points in a direction: Cache Components requires the Node.js runtime.

**★ Someone hands you a Next.js 16 codebase and asks you to audit its runtime configuration. What do you actually do?**
Grep for `runtime` declarations across `app/` and `src/`, covering both `'edge'` and the older `'experimental-edge'` spelling, and delete every hit — the build will not do this for you because the deprecation is a warning. Separately grep for `preferredRegion`, which is deprecated with no framework successor. Then check `proxy.ts` on its own terms, because the `runtime` option is not merely deprecated there but unavailable, and setting it throws. Finally, look at whether `instrumentation.ts` branches on `process.env.NEXT_RUNTIME`; the branch is still in the documentation's own examples and is not itself a defect, but it is worth knowing which side of it is now live.

**What would you say to a teammate who wants to quote cold-start numbers for Edge versus Node in a design document?**
Ask where the numbers come from. The Next.js `runtime` reference is four sentences long and contains no figures — no cold-start times, no memory limits, no API allow-list. Cold starts are a property of the hosting platform, so the only citable source is that platform's own documentation, and the number should be attributed to them and dated. Putting an unattributed millisecond figure into a design document is how a vendor-specific measurement from three years ago becomes a team's permanent belief.

**A route needs to run physically close to users in Asia. What is the Next.js answer in 16?**
There isn't one at the framework level any more. The route-segment API for this was `preferredRegion`, and it is deprecated in the same table as `runtime = 'edge'` — the documentation notes that *"regions were previously only supported with `export const runtime = 'edge'`, which is now deprecated"*, and names no successor export. Region placement is now configured on the platform, not in the route file. That also changes the shape of the conversation: before you move compute closer to users, work out where the data is, because moving compute away from its database usually makes the request slower, not faster. That arithmetic is [chapter 16 · 03](../16-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md).

---

← [03 · Bundle analysis and lazy loading](03-bundle-analysis-dynamic-imports-lazy-loading.md) · [Chapter index](01-explanation.md) · Next → [04b · What survives the withdrawal](04b-what-survives-the-withdrawal-proxy-and-region-placement.md)
