---
title: "The caching tree is not about which directive — it asks what invalidates this data and who gets to see the invalidation, and its answer depends on how many cache layers your deployment has rather than on anything in your source code"
sidebar_label: "03b · The caching tree"
sidebar_position: 41
description: "Time-based versus event-based invalidation, the required second argument to revalidateTag, updateTag for read-your-own-writes, and the layer count that turns a correct invalidation into a production bug."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 — every branch of this tree terminates in a page of this book that already argues it, verified there against the Next.js 16.3.4 documentation. This page introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**Two different questions get filed under "caching strategy" and answering the wrong one is how teams end up with a correct invalidation call that fixes nothing. The first question is *where does this data rest* — that is [the cache directive tree](03c-the-cache-directive-tree.md), and it is decided in your source. The second is *what makes this data stop being wrong, and who observes that happening* — that is this tree, and it is decided by your deployment. 🔴 The number of cache layers a single mutation has to reach is a property of how you run the application, not of how you wrote it: one container has two layers, four containers behind a CDN have five, and the source code is byte-for-byte identical. Almost every invalidation bug in this book is someone reasoning carefully about one layer while running three.**

Held against [the four-things rule](03-architecture-decision-trees-rendering-strategy.md): this tree crosses chapters 5, 6, 15 and 17, because no single one of them is allowed to say that the correct `revalidateTag` call is a no-op on three of your four pods. The question that settles a branch here is not *"how fresh does this need to be"* — it is **"how many places is this value currently stored, and which of them will hear about the write?"**

## Count the layers first

Before running the tree, write down the layers that exist in **your** deployment. Every branch below is read against this list.

| Layer | Exists when | Who invalidates it | Argued in |
|---|---|---|---|
| **The client router cache**, per open tab | Always | The action's own response, or time | [`use cache` at runtime](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/02-use-cache-at-runtime.md) — 🔴 a **30-second minimum stale time**, regardless of configuration |
| **The server cache on the instance that ran the write** | Always | `revalidateTag` / `updateTag` | [Revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md) |
| **The server cache on every *other* instance** | More than one instance | Nothing, by default | [A shared cache across instances](../15-databases-apis-and-full-stack-patterns/05h-a-shared-cache-across-instances.md) · [The cache is not one thing](../06-ssg-isr-and-ssr-strategy/03d-the-cache-is-not-one-thing.md) |
| **A shared or remote cache handler** | You configured one | Your handler's `updateTags()` / `refreshTags()` | [Writing a custom cache handler](../15-databases-apis-and-full-stack-patterns/05e-writing-a-custom-cache-handler.md) · [The `cacheHandler` with more than one container](../17-deployment-scaling-and-observability/02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md) |
| **A CDN** | Nearly always in production | A purge through the CDN's own API | [The CDN layer and `Cache-Control`](../15-databases-apis-and-full-stack-patterns/05c-the-cdn-layer-and-cache-control.md) |

## The caching tree

```text
CACHING TREE — "what invalidates this, and WHO SEES the invalidation"

Q1. What tells you the data changed?
    |
    +- Nothing does; it drifts on its own -----> TIME-BASED.
    |                                            A cacheLife profile, stated
    |                                            explicitly at the call site.
    +- A system you control: your Server Action,
       your CMS webhook, your admin tool -------> EVENT-BASED. cacheTag, then Q2.

    (These are not alternatives. The useful configuration is almost always
     both: a long lifetime as a backstop plus a tag for the known moment.)

Q2. Who made the change, and where does the invalidation call run?
    |
    +- The user, inside a Server Action, and they
    |  are about to look at the result ----------> updateTag(tag)
    |                                              Server Actions ONLY. It
    |                                              throws anywhere else. The
    |                                              next request WAITS for fresh
    |                                              data instead of being served
    |                                              stale.
    |
    +- The user, inside a Server Action, but the
    |  thing that changed was NEVER CACHED ------> refresh()
    |                                              Invalidates nothing at all.
    |                                              Re-renders the current route
    |                                              inside the action's own
    |                                              response.
    |
    +- A webhook, a Route Handler, a cron, another
       service ---------------------------------> revalidateTag(tag, profile)
                                                   The profile argument is
                                                   REQUIRED. Go to Q3 to pick it.

Q3. Who is allowed to see stale content, and for how long?
    (This is the second argument, and it is a product answer, not a technical one.)
    |
    +- Anyone, for as long as the refresh takes -> 'max'
    |                                              A one-year window: requests
    |                                              are ALWAYS served stale while
    |                                              revalidation runs. The
    |                                              recommended default.
    +- Anyone, for a bounded window -------------> a cacheLife profile, or
    |                                              { expire: N }. Only its
    |                                              expire field is read.
    +- Nobody; it must be gone immediately, and
       updateTag is not available here ----------> { expire: 0 }
                                                   Stale is never served; the
                                                   next request blocks.
    (Omitting the argument behaves like { expire: 0 } and is deprecated.)

Q4. How many instances serve this application?
    |
    +- Exactly one ----> done. Layers 3 and 4 do not exist for you, and every
    |                    answer above is sufficient.
    +- More than one --> revalidation events are LOCAL by default. The instance
                         that ran the call invalidates itself. The others keep
                         serving stale, and by default they never find out.
                         -> a shared cacheHandler whose updateTags() writes the
                            invalidation to shared storage and whose
                            refreshTags() reads it back before each request.

Q5. Is there a CDN in front of it?
    |
    +- No --> done.
    +- Yes -> the response already carried an s-maxage, and nothing in your
              application can shorten it after the response has left. This
              layer is invalidated by a PURGE through the CDN's own API. It is
              the layer teams forget, because it is the only one that is not
              in the repository.

Q6. Nothing on this list applies and you cannot name a tag.
    |
    +- Then the data is not cached, and there is nothing to invalidate.
       The correct terminal is NOTHING - or refresh(), if the user needs to see
       the new render. Reaching for revalidateTag here is the single most
       common wasted call in a Next.js codebase.
```

## The terminals

| Terminal | Reached when | Where the book argues it |
|---|---|---|
| **A `cacheLife` profile** | Q1, nobody can tell you | [Revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md) |
| **`cacheTag` + `revalidateTag(tag, profile)`** | Q2, the invalidation runs outside a Server Action | [`revalidateTag` vs `updateTag`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md) |
| **`updateTag(tag)`** | Q2, the user who wrote it is about to read it | [`revalidateTag` vs `updateTag`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md) · [The action and what invalidates what](../08-state-management-in-an-rsc-world/07k-milestone-the-action-and-what-invalidates-what.md) |
| **`refresh()`** | Q2 or Q6, the changed thing was never cached | [`refresh()`](../08-state-management-in-an-rsc-world/10-refresh.md) · [`refresh()` against the alternatives](../08-state-management-in-an-rsc-world/10b-refresh-against-the-alternatives.md) |
| **A shared `cacheHandler`** | Q4, more than one instance | [Writing a custom cache handler](../15-databases-apis-and-full-stack-patterns/05e-writing-a-custom-cache-handler.md) · [More than one container](../17-deployment-scaling-and-observability/02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md) |
| **A CDN purge** | Q5 | [The CDN layer and `Cache-Control`](../15-databases-apis-and-full-stack-patterns/05c-the-cdn-layer-and-cache-control.md) |
| **Nothing** | Q6 | [The staleness budget](../06-ssg-isr-and-ssr-strategy/01b-data-velocity-and-the-staleness-budget.md) — deciding that stale is acceptable is a decision, not an omission |

## Why the layer count is the load-bearing fact

Two deployments of the same repository:

- **One container, no CDN.** A `revalidateTag('posts', 'max')` in a webhook handler is completely sufficient. Every user is served by the process that just invalidated itself.
- **Four containers behind a CDN.** The same call invalidates one of four server caches; three keep serving stale, and users are routed between them, so the *same* user sees the new content and then the old one depending on which pod answered. In front of that, the CDN is still serving a response whose `s-maxage` you cannot shorten. Three of the five layers never heard about the write.

Nothing in the source distinguishes these two cases, which is why this belongs on a capstone tree and not in a chapter. The chapter that owns `revalidateTag` cannot tell you how many pods you run; the chapter that owns containers cannot tell you which tags matter. [The cache is not one thing](../06-ssg-isr-and-ssr-strategy/03d-the-cache-is-not-one-thing.md) is the enumeration of the layers, and it also carries the reason the artefacts must not be split: HTML and the RSC payload are regenerated together from one render and stored in the same entry, so caching them separately with different lifetimes produces mismatched content during client navigation.

The other thing the layer count decides is **whether stale-while-revalidate protects you**. Nobody blocks on the stale path, which structurally prevents the classic stampede — but [the paths that *do* block are named and documented](../06-ssg-isr-and-ssr-strategy/03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md), and `{ expire: 0 }` puts you on one of them deliberately. Choosing Q3's third branch is choosing to block; know that you are choosing it.

## What each terminal costs you later

| Terminal | The bill |
|---|---|
| **`cacheLife` alone** | The observed staleness is set by traffic, not by the interval, and a dead upstream is invisible — the site looks healthy while the data ages. |
| **`revalidateTag`** | Every call site now has to answer Q3 forever, and `'max'` chosen by reflex means a user can be served stale for a year if the revalidation keeps failing. |
| **`updateTag`** | It is Server-Action-only, so the day a webhook needs the same invalidation you have to write it a second time with different semantics. |
| **`refresh()`** | It is correct only while the data stays uncached. The day someone adds `use cache` to that read, `refresh()` silently starts re-rendering from the cache it did not clear. |
| **A shared `cacheHandler`** | You now operate a cache: its availability is your availability, and its failure modes have to be handled inside your handler rather than by the framework. |
| **A CDN purge** | The invalidation logic is now split across two systems with two deploy pipelines, and the CDN half is not reviewed in your pull requests. |

## Gotchas

**★ Symptom: `revalidateTag('posts')` produces a TypeScript error, or an old code sample does not compile.** Cause: the function takes two arguments — the tag and a profile saying how long stale may still be served — and the single-argument form is deprecated; omitting it behaves like `{ expire: 0 }`. Fix: state the window explicitly at every call site:

```ts
'use server'
import { revalidateTag } from 'next/cache'

export async function publishPost() {
  await db.post.publish()
  revalidateTag('posts', 'max')   // always served stale while revalidating
}
```

**★ Symptom: a user saves something, is redirected to the list, and their own change is missing.** Cause: `revalidateTag` marks the data stale and the next request is served stale while revalidation runs — technically correct caching, and a bug report. Fix: inside a Server Action, use `updateTag`, which expires immediately so the next request waits for fresh data:

```ts
'use server'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.post.create({ data: { title: String(formData.get('title')) } })
  updateTag('posts')
  updateTag(`post-${post.id}`)
  redirect(`/posts/${post.id}`)
}
```

**★ Symptom: `updateTag` throws inside a Route Handler.** Cause: it is callable only from within a Server Action; `revalidateTag` is the one that works in Server Functions **and** Route Handlers. Fix: where you need immediate expiry from a webhook, pass the zero window explicitly:

```ts
import { revalidateTag } from 'next/cache'

export async function POST(request: Request) {
  const { tag } = await request.json()
  revalidateTag(tag, { expire: 0 })    // stale is never served; next request blocks
  return Response.json({ revalidated: true })
}
```

**★ Symptom: invalidation works perfectly in development and half your users see stale content in production.** Cause: you run one process locally and several in production, and revalidation events are local by default — the instance that received the call invalidates itself while the others continue serving stale. Fix: this is Q4, and the fix is infrastructure rather than a flag. A shared handler writes each invalidation to shared storage in `updateTags()` and reads recent events back in `refreshTags()` before each request; see [05e](../15-databases-apis-and-full-stack-patterns/05e-writing-a-custom-cache-handler.md) for the five methods and [02b](../17-deployment-scaling-and-observability/02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md) for the container-shaped version of the same problem.

**★ Symptom: a transient Redis blip turns into request failures across the fleet.** Cause: a handler that lets `refreshTags()` throw — the exception propagates as a request failure. Fix: catch it and continue with the last known local tag state, accepting staleness instead of an outage:

```ts
async refreshTags() {
  try {
    this.applyEvents(await redis.lrange('next:invalidations', 0, -1))
  } catch {
    // keep the last known local tag state; stale beats 500
  }
}
```

**★ Symptom: an intermittent cache backend produces render errors rather than cache misses.** Cause: a read that throws is not treated as a miss — it propagates as a render error. Fix: return `undefined`, which is the documented miss signal:

```ts
async get(key: string) {
  try {
    return await this.store.get(key)
  } catch {
    return undefined   // the miss signal; a throw is a render error
  }
}
```

**★ Symptom: `revalidateTag` runs, returns cleanly, and nothing anywhere becomes fresh.** Cause: the tag was never assigned, because tags are case-sensitive and a tag longer than 256 characters is never attached to cached data at all — so invalidating it silently does nothing. Fix: build tags from short, stable identifiers rather than from anything user-supplied, and keep the constructor in one module so the write path and the read path cannot disagree about the string.

**★ Symptom: every layer you control has been invalidated and users still get the old page.** Cause: the CDN, whose `s-maxage` your application cannot shorten once the response has been sent. Fix: this layer is purged through the CDN's API, not the framework's — treat it as an explicit step in the invalidation path and put it in the same code path as the tag call, or it will drift out of the release that added it.

**★ Symptom: a client-side navigation shows content that is a mixture of two renders.** Cause: HTML and the RSC payload cached separately with different lifetimes. They are regenerated together from the same component tree and stored in the same entry precisely so that they cannot drift. Fix: do not configure separate TTLs for them at any layer, including the CDN.

**Symptom: the user's own tab keeps showing the old value for a while after a successful invalidation.** Cause: the client router holds its own copy and enforces a minimum 30-second stale time regardless of configuration. Fix: if the tab must update now, the mechanism is the action's own response — `updateTag` or `refresh()` inside the action the user invoked — not a shorter `stale`, which the floor ignores.

**Symptom: a lot of `revalidateTag` calls that never had a matching `cacheTag`.** Cause: Q6 was skipped — the data was never cached, so there is nothing to invalidate. Fix: if the user needs to see the new render, `refresh()` is the correct and only correct call; it invalidates nothing and re-renders the route inside the action's response.

## Interview questions

**★ Why is "which invalidation API do I call?" the wrong first question?**
Because the API is chosen by where the call runs, and the *effect* is decided by how many caches exist. `revalidateTag` in a webhook on a single-instance deployment is complete; the identical line on four pods behind a CDN reaches one of five layers. The first question is how many places this value is currently stored and which of them will hear about the write — and that has no answer in the source code, which is why it is the question a capstone tree has to ask and a chapter cannot.

**★ What does the second argument to `revalidateTag` actually control, and what should it usually be?**
How long stale content may still be served while revalidation runs. `'max'` is a one-year window, which in practice means requests are always served stale and never block — that is the recommended default. A shorter profile, or `{ expire: N }`, bounds the window and makes requests past it block until the refresh completes. `{ expire: 0 }` means stale is never served at all. Framed usefully: the profile is the point past which correctness matters more than speed.

**★ When is `updateTag` the only correct answer?**
When the user who made the change is about to look at the result, and the invalidation runs inside the Server Action that made it. It expires the data immediately so the next request waits for fresh data instead of being handed the stale copy — read-your-own-writes. It is Server-Action-only and throws elsewhere, so a webhook doing the same logical invalidation has to use `revalidateTag` with `{ expire: 0 }` and accept that the next reader blocks.

**★ `refresh()` invalidates nothing. Why would you ever call it?**
Because sometimes there is nothing to invalidate. If the state the user changed was never cached, every invalidation call is a no-op with a cost, and what the user actually needs is a new render of the current route delivered in the action's own response — which is exactly what `refresh()` does. It is also the terminal that ages badly: it stays correct only while the read stays uncached, so adding `use cache` to that read later turns it into a re-render of data nobody cleared.

**★ Your invalidation is correct and users still see stale content. Walk me through diagnosing it.**
Count the layers, then work outward. Did the call run on an instance at all — is the tag actually assigned, spelled identically, and within the 256-character limit? Did it reach the other instances — is there a shared handler, and does its `refreshTags()` run before each request? Is a CDN in front, holding a response with an `s-maxage` I cannot shorten retroactively? And finally, is the user's own tab simply holding its router copy, which has a 30-second floor regardless of what I configured? The order matters, because each layer masks the ones behind it.

**★ Why does a single-container deployment make several of these questions disappear, and why is that dangerous?**
With one process, the server cache and the invalidation live in the same memory, so a plain `revalidateTag` is complete and correct — and every test, every local run and every staging environment agrees. The danger is that the code that is correct at one instance is unchanged at four, and nothing warns you at the moment of scaling. The behaviour change ships with an infrastructure decision, in a pull request that touches no application code.

**★ What is the argument for pairing a long lifetime with a tag rather than choosing one?**
They fail in opposite directions. A tag alone means that if the invalidation is ever missed — a dropped webhook, a failed deploy of the CMS integration — the data is stale forever with nothing to correct it. A lifetime alone means the data is refreshed on a schedule that has nothing to do with when it actually changed. Together, the tag handles the known moment and the lifetime is the backstop for every moment you did not anticipate, which is the class of event that produces incidents.

**A colleague configures the CDN to cache HTML for an hour and the RSC payload for five minutes, reasoning that the payload is smaller and cheaper to refetch. What goes wrong?**
They drift. Both artefacts are produced by the same render and stored together for that reason, so giving them different lifetimes means a client-side navigation can fetch a payload from one render while the document came from another — mismatched or stale content with no error anywhere. The rule is to cache them as one thing, and it is a CDN configuration rule, so it is enforced outside the repository where nobody reviews it.

---

← [03 · The rendering tree](03-architecture-decision-trees-rendering-strategy.md) · Next → [03c · The cache directive tree](03c-the-cache-directive-tree.md)
