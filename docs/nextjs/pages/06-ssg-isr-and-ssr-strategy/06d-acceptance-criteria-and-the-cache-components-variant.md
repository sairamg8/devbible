---
title: "Accept this milestone on properties you can check rather than pages that look right — then build it a second time with Cache Components on, because `v16.0.0` deletes half the config you just wrote and the durable half is the part that lives in the data layer"
sidebar_label: "06d · Acceptance and the CC variant"
sidebar_position: 39
description: "The chapter 6 milestone's acceptance checklist as verifiable properties and greps rather than impressions, the phase gate, and the same three-strategy deployment rebuilt with cacheComponents enabled — including what the documentation does not settle about replacing the dynamic = 'error' guarantee."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (docs `lastUpdated` 2026-08-25), [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag) and [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params) (`lastUpdated` 2026-06-24).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. 🔴 **No build output, route summaries, timings or bundle sizes appear on this page**, and the checks below are written as procedures you run rather than as results I obtained. One claim is marked explicitly unconfirmed.

**A milestone that is accepted by looking at the pages is not accepted, because every failure this chapter warned about looks fine in a browser. A page that silently went dynamic renders correctly. A cached function with a leaky key returns the right data almost always. So the acceptance criteria below are properties — things a grep, a build, or a deliberately broken commit can decide — rather than impressions. Then the second half: build it again with `cacheComponents: true`, because `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under that flag, and roughly half the configuration in [06](06-project-milestone-static-marketing-pages-isrd-public-team-pa.md) simply stops existing. The half that survives is the half that was in the data layer all along, which is the argument this whole chapter has been making.**

## Acceptance criteria

Each of these is checkable. None of them requires you to trust a screenshot.

### Structural — a grep decides it

```bash
# 1. No request-time reads in files shared across a caching boundary.
grep -n "cookies()\|headers()\|searchParams" app/layout.tsx
grep -n "cookies()\|headers()\|searchParams" "app/teams/[team]/layout.tsx"
# Both must print nothing.

# 2. No segment config on the shared team layout.
grep -n "^export const \(dynamic\|revalidate\|fetchCache\|dynamicParams\)" \
  "app/teams/[team]/layout.tsx"
# Must print nothing.

# 3. Every marketing page asserts its own contract.
grep -L "export const dynamic = 'error'" app/\(marketing\)/**/page.tsx
# Must print nothing — every marketing page file carries the line.

# 4. dynamicParams is not disabled on the user-created team segment.
grep -rn "dynamicParams" "app/teams/[team]"
# Must print nothing.
```

### Behavioural — a deliberately broken commit decides it

**The seam guard actually guards.** On a branch, add `const c = await cookies()` to
`app/(marketing)/pricing/page.tsx` and run `next build`. It must fail. If it succeeds, the
`dynamic = 'error'` line is missing or was changed to `'force-static'`, and your marketing pages
have no protection at all. Revert the branch; the check is the point, not the commit.

**The webhook invalidates something real.** Edit a team profile at the source, call
`/api/revalidate` with the team slug, then request `/teams/<slug>` twice. The second request
must show the new content. Two requests, not one — the `'max'` profile serves stale to the
request that triggers regeneration, which is behaviour, not a bug.

**The tag string is not a typo.** The tag used by `cacheTag` in `lib/teams.ts` and the tag
passed to `revalidateTag` in the webhook must come from one exported constant. Rename it; the
type checker must fail in both places. Nothing in the framework reports an invalidation that
matched no entry, so this is the only cheap way to know they agree.

**The private board is private without the layout.** Request `/teams/<slug>/board` with no
session cookie. It must redirect. Then delete the redirect in the layout on a branch and confirm
the *data layer* still refuses — the redirect is a convenience, and the documented Data Access
Layer requirement is to *"Perform authorization checks"* on the read.

**The public profile cannot leak private members.** A unit test on `getPublicTeamProfile`
asserting that its return value contains no field from the private roster type. This is the one
criterion that should be a test rather than a manual check, because it is the one whose failure
is a disclosure.

### Phase gate

You are done with this milestone when you can point at any route in the application and say,
without running anything: **which of the three strategies it uses, which file would break it,
and what would fail if that file changed.** If the answer requires opening a build summary, the
seams are not yet understood — that is the capability this chapter exists to produce, and the
three-strategies-in-one-deployment shape is only the exercise that forces it.

## The Cache Components variant

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
}

module.exports = nextConfig
```

Turning that on removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` from the
framework — `v16.0.0`, and the 16.3.4 Route Segment Config reference no longer documents them;
they live in a guide titled *Caching and Revalidating (Previous Model)*.

### What changes, file by file

| File | Flag off | Flag on |
|---|---|---|
| `app/(marketing)/*/page.tsx` | `export const dynamic = 'error'` | ⚠️ Gone — see the open question below |
| `app/teams/[team]/page.tsx` | `generateStaticParams` + cached `getTeamProfile` | Unchanged |
| `lib/teams.ts` | `'use cache'`, `cacheLife`, `cacheTag` | **Unchanged** |
| `app/api/revalidate/route.ts` | `revalidateTag(tag, 'max')` | **Unchanged** |
| `app/teams/[team]/layout.tsx` | No reads, no config (by rule) | No reads (by rule); no config to forbid |
| `app/teams/[team]/board/layout.tsx` | `cookies()` read makes it dynamic | Unchanged |

**Look at which rows say "unchanged."** Everything expressed in the *data layer* — the cache
directive, the lifetime, the tag, the invalidation — survives the transition untouched.
Everything expressed as *route configuration* does not. That is not a coincidence and it is the
chapter's argument in one table: the rendering strategy was always a property of the data, and
segment config was a route-level approximation of it.

The three cache directives and how they compose on one page are owned by
[ch5 · choosing a cache directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md)
and [ch5 · composing the three](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01b-composing-the-three.md).
Read those before writing the variant; this page is the milestone's shape, not the directive
reference.

### 🔴 The open question: what replaces `dynamic = 'error'`?

Under the previous model, `dynamic = 'error'` gives a **build-time guarantee** that a segment
stays prerenderable: a Request-time API anywhere in its render path fails the build. That is the
single enforcement mechanism [06c](06c-data-layer-seams-and-choosing-a-fix.md) relies on.

**I could not confirm from the 16.3.4 documentation what the Cache Components equivalent of that
guarantee is, or whether one exists.** The mechanics that clearly do carry over are different in
kind rather than equivalent:

- A cached function *cannot* read `cookies()`, `headers()` or `searchParams` — the restriction
  follows the call stack and produces `next-request-in-use-cache`. That protects the cached
  function, not the segment, and the documentation states it can surface at runtime rather than
  at build on a dynamically rendered route.
- `use cache: private` is documented as executing on every server render and being **excluded
  from static shell generation**, which tells you a request-dependent component does not enter
  the shell — but that is a description of behaviour, not a build-time assertion that a given
  route has no such component.

So: do not assume the guard survives the flag flip. Verify against your own build before
removing `dynamic = 'error'` from a segment whose prerendering you depend on, and if you cannot
establish an equivalent, say so in the migration ticket rather than assuming. Writing "the
protection is unverified" is a legitimate outcome; assuming it transferred is how the marketing
pages quietly go dynamic a second time.

⚠️ One adjacent fact that *is* documented, and is easy to conflate with the above: with Cache
Components, `generateStaticParams` becomes **required for root parameters** — *"A
`generateStaticParams` function is only required with Cache Components, where each root
parameter must have at least one value or the build fails."* That is specifically about
`next/root-params`, not about ordinary dynamic segments, and SprintDesk's `[team]` only becomes
a root parameter when it moves to subdomain tenancy in chapter 15.

## Gotchas

**★ Symptom: the milestone is signed off, and two weeks later the marketing pages are dynamic.** Cause: acceptance was done by looking at the pages, which look identical either way. Fix: accept on properties — the greps above, plus the deliberately-broken-commit check that proves `dynamic = 'error'` actually fails a build. A criterion you cannot fail on purpose is not a criterion.

**★ Symptom: the webhook check "fails" because the first request after revalidation still shows old content.** Cause: `revalidateTag` with the `'max'` profile serves stale to the request that triggers regeneration. Fix: make the acceptance criterion two requests, explicitly. Writing the criterion as one request bakes a misunderstanding into the definition of done, and the team will then "fix" it by dropping to a profile that blocks — turning every publish into a cache miss.

**★ Symptom: `revalidateTag` runs, returns cleanly, and nothing is invalidated.** Cause: the tag string in the webhook and the tag string in `cacheTag` drifted apart, usually via a rename on one side. Nothing reports an invalidation that matched no entry. Fix: one exported constant imported by both, so a rename is a type error. This is the cheapest defect in the milestone to prevent and among the most annoying to diagnose.

**★ Symptom: after enabling `cacheComponents`, the build fails on `export const dynamic` lines.** Cause: `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under the flag. Fix: remove them — and 🔴 do not remove them *silently*. Each `dynamic = 'error'` you delete was enforcing a prerendering guarantee, so each deletion needs a note in the migration recording that the guarantee is now unverified, until you have established what replaces it.

**★ Symptom: a team migrates to Cache Components and rewrites the whole data layer.** Cause: assuming the flag changes everything. Fix: it does not. `use cache`, `cacheLife`, `cacheTag`, `revalidateTag` and the tagging scheme are unchanged; what goes away is route-level configuration. Scoping the migration to the config files first makes it a small change, and makes it obvious how little of the design was ever route-level.

**★ Symptom: `generateStaticParams` is added everywhere after reading that Cache Components requires it.** Cause: conflating root parameters with ordinary dynamic segments. The documented requirement is that with Cache Components, each **root parameter** must have at least one value or the build fails. Fix: apply it to root parameters only. SprintDesk's `[team]` is an ordinary segment today and becomes a root parameter only under subdomain tenancy.

**Symptom: the phase gate is treated as a quiz rather than a capability.** Cause: reading "you are done when you can say which strategy each route uses" as trivia. Fix: it is a test of whether the seams are internalised — the second and third clauses are the real content. Naming the strategy is easy; naming the file that would break it, and what would fail, is the thing that stops the next seam bug from being written.

## Interview questions

**★ How do you accept a milestone whose failure modes are invisible in a browser?**
By writing criteria you can fail on purpose. A page that silently went dynamic renders correctly; a cached function with a leaky key returns the right data almost always. So the criteria become greps over the shared files, a deliberately broken commit that must fail the build, a two-request check for revalidation, and a unit test for the one criterion whose failure is a disclosure. If a criterion cannot be violated deliberately to prove it works, it is not testing anything.

**★ What survives turning on Cache Components, and what does not?**
Everything in the data layer survives: `use cache`, `cacheLife`, `cacheTag`, `revalidateTag` and the tagging scheme are untouched. Everything expressed as route configuration goes away, because `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under the flag. That split is the chapter's argument made concrete — the rendering strategy was always a property of the data, and segment config was a route-level approximation that the framework has now retired.

**★ You are migrating to Cache Components and have to delete `dynamic = 'error'` from the marketing pages. What is your concern?**
That it was the only enforcement mechanism protecting those pages from a shared component that starts reading the request. The documentation for 16.3.4 does not settle what the Cache Components equivalent is, and the mechanisms that clearly carry over — the ban on Request-time APIs inside cached functions, the exclusion of request-dependent components from the static shell — protect different things and can surface at runtime rather than at build. So the honest migration note is that the guarantee is unverified pending a check against your own build, rather than an assumption that it transferred.

**★ Why is "two requests, not one" the correct wording for the revalidation acceptance criterion?**
Because `revalidateTag` with the stale-while-revalidate profile serves stale content to the request that triggers regeneration; the fresh version is what subsequent requests get. Writing the criterion as a single request encodes a misunderstanding into the definition of done, which then gets "fixed" by moving to a profile that blocks the next read — converting every publish into a cache miss and a burst of origin load, in exchange for a behaviour nobody actually required.

**★ What does the phase gate for this milestone actually test?**
Whether you can point at any route and name three things without running anything: which strategy it uses, which file would break it, and what would fail if that file changed. The first is trivia. The second and third are the chapter — they require holding the layout hierarchy and the import graph in your head at the same time, which is exactly the model that stops you from putting a `cookies()` read in a shared header. Needing a build summary to answer means the seams are still invisible to you.

**★ Why does the acceptance list include a check on a file that nobody was asked to change?**
Because the shared `[team]` layout is where the milestone's most expensive failure originates, and it fails by *addition* rather than by modification of anything you wrote. Nobody breaks it deliberately; somebody adds a reasonable feature to a reasonable file. A grep asserting that the file contains no request reads and no segment config is a permanent statement of a constraint that is otherwise recorded only in a comment — and comments are not run in CI.

---

← [06c · Data-layer seams, and choosing a fix](06c-data-layer-seams-and-choosing-a-fix.md) · [Chapter 6 overview](01-explanation.md) · Next chapter → [07 · Error handling, loading states and resilience](../07-error-handling-loading-states-and-resilience/01-explanation.md)
