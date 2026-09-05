---
title: "Next.js emits a different `Cache-Control` for every rendering strategy, and the one number that decides both your bill and your staleness window is `s-maxage` — which nothing in your application can shorten once a response has left"
sidebar_label: "05c · The CDN layer and Cache-Control"
sidebar_position: 57
description: "The exact headers static, ISR and dynamic pages carry, why `stale-while-revalidate` appears by default, the immutable asset rule, and the reason `revalidateTag()` cannot reach a CDN."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js 16.3.4 documentation — [Using a CDN with Next.js](https://nextjs.org/docs/app/guides/cdn-caching), [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms), [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0.

**[05b](05b-the-edge-runtime-is-deprecated.md) established that placement is no longer a runtime you declare. This is where it went instead: a CDN in front of one origin, serving responses it already has so that distant users never reach your server at all. That layer is configured almost entirely through one response header, and Next.js already sets it correctly per rendering strategy — which means the common failure here is not writing a bad header, it is not knowing which header your route emits and therefore being surprised by how long the internet holds it. Once a response carries `s-maxage=31536000` and has been fetched, nothing you deploy, revalidate or delete takes it back.**

## The four headers, by rendering strategy

Next.js publishes exactly what it sets:

> *"**Static pages** (no revalidation): `s-maxage=31536000` (one year)"*
> *"**ISR pages** (time-based revalidation): `s-maxage={revalidate}, stale-while-revalidate={expire - revalidate}`. The default `expire` is one year, so `stale-while-revalidate` is included in the response header by default."*
> *"**Dynamic pages** (no caching): `private, no-cache, no-store, max-age=0, must-revalidate`"*
> *"Static assets (JavaScript, CSS, images, fonts) served from `/_next/static/` include content hashes in their filenames and have a 1 year `max-age` and `immutable` directive: `public, max-age=31536000, immutable`"*
> — [Next.js · Using a CDN with Next.js](https://nextjs.org/docs/app/guides/cdn-caching)

Four rows, and each one encodes a different bet:

| Route kind | Header | The bet |
|---|---|---|
| Static, no revalidation | `s-maxage=31536000` | this will never change without a deploy |
| ISR | `s-maxage={revalidate}, stale-while-revalidate={expire − revalidate}` | serve stale rather than make anyone wait |
| Dynamic | `private, no-cache, no-store, max-age=0, must-revalidate` | this is nobody's but the requester's |
| Hashed asset | `public, max-age=31536000, immutable` | the filename *is* the version |

The asset row is the only one that is unconditionally safe, and it is worth understanding why, because it is the model the other three are approximating. A file under `/_next/static/` has a content hash in its name, so a change to the file changes the URL. Caching it for a year with `immutable` cannot serve stale content, because stale content has a different address. **Every other caching problem in this topic is a consequence of a URL whose content can change underneath it.**

### `s-maxage` versus `max-age`, and why the distinction matters here

`max-age` is what the *browser* keeps; `s-maxage` overrides it for *shared* caches — CDNs and proxies. The page rows above use `s-maxage`, so the CDN holds the response and the browser is comparatively free to re-ask. That is deliberate: a CDN copy can be purged and a browser copy cannot, so the framework puts the long-lived copy in the layer you can still reach.

🔴 **The corollary is the single most expensive mistake available at this layer: setting a long `max-age` on an HTML response by hand.** A response cached in ten thousand browsers for a year is not recoverable by any deployment, purge or rollback. The URL is poisoned for those users until the header expires. If you are going to override the framework's headers — and there are legitimate reasons to — override `s-maxage`, and leave `max-age` alone.

### Why `stale-while-revalidate` is there by default

Read the ISR row again: *"The default `expire` is one year, so `stale-while-revalidate` is included in the response header by default."*

That default is doing real work. `stale-while-revalidate` lets the CDN serve the copy it has *immediately* while fetching a fresh one in the background, so the user who happens to arrive one second after the `revalidate` window closes does not pay for the regeneration. Without it, that unlucky request waits for a full render, and under any concurrency several unlucky requests do.

So an ISR page with a one-year `expire` is, at the CDN, effectively "never make anyone wait" — which is almost always what you want and is worth knowing you have, because it also means **the window in which a user can see stale content is `expire`, not `revalidate`.** People size `revalidate` carefully and then discover content persisting far beyond it. Nothing is broken; `expire` is the number that bounds staleness, and it defaults to a year.

## 🔴 The gap: on-demand revalidation does not reach the CDN

This is the most important paragraph in the topic, and the documentation states it without hedging:

> *"CDN-level caching alone does not support on-demand revalidation (`revalidateTag()` / `revalidatePath()`): those calls invalidate the Next.js server cache, but the CDN will continue serving its cached copy until the `s-maxage` TTL expires. To propagate on-demand revalidation to the CDN, trigger CDN purges alongside your revalidation call."*

Put that next to what [05h](05h-a-shared-cache-across-instances.md) establishes — that `revalidateTag()` also only reaches the instance it ran on — and the shape of the real system becomes clear. A mutation has to invalidate **three** independent caches:

1. **The framework cache on the instance that ran the mutation** — `revalidateTag()` does this, and only this.
2. **The framework cache on every other instance** — a shared cache handler with `updateTags`/`refreshTags`, per [05h](05h-a-shared-cache-across-instances.md).
3. **The CDN** — a purge, issued by you, against your CDN's own API.

Nothing wires those together. Teams reliably build the first, sometimes build the second, and discover the third from a support ticket.

```ts
// app/actions/publish.ts
'use server'

import { revalidateTag } from 'next/cache'

export async function publishBoard(boardId: string) {
  await db.update(boards).set({ published: true }).where(eq(boards.id, boardId))

  revalidateTag(`board:${boardId}`)      // layer 1 (and 2, given a shared handler)
  await purgeCdn(`/boards/${boardId}`)   // layer 3 — nothing does this for you
}

// lib/cdn.ts — the shape; every CDN has its own purge API
async function purgeCdn(path: string) {
  const res = await fetch(`${process.env.CDN_PURGE_ENDPOINT}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.CDN_PURGE_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ paths: [path] }),
  })
  if (!res.ok) {
    // a failed purge is stale content, not a failed mutation — report, do not throw
    console.error('cdn purge failed', path, res.status)
  }
}
```

Note the error handling, which is the same principle [05h](05h-a-shared-cache-across-instances.md) applies to cache handlers: **a purge failure must not fail the mutation.** The write succeeded. Throwing here turns a caching problem into a data-entry problem for the user, and they will retry the write.

⚠️ **And if you cannot purge, the honest response is to lower `s-maxage`** so the TTL itself bounds staleness. That is a real trade — more origin traffic in exchange for a bounded window — and it is a better trade than shipping content nobody can invalidate.

## Where Proxy sits relative to the CDN

> *"`proxy.js` (previously Middleware) should run before the CDN cache so it remains the source of truth for auth, redirects, and rewrites."*

Which follows directly. If the CDN answers first, a request that Proxy would have redirected or rejected is served from cache without Proxy ever seeing it — so an auth check in Proxy protects only the requests that miss. Ordering Proxy in front makes it authoritative, which is the only position an auth check can usefully occupy.

🔴 **The general rule, worth stating once: a cache in front of an authorisation check is an authorisation bypass.** It applies at every layer here. A response that varies by user must never be cacheable by a shared cache — which is exactly what the dynamic row's `private, no-cache, no-store` is for, and why silently making a personalised route "cacheable for performance" is one of the more serious mistakes available in this chapter.

## Gotchas

**★ Symptom: a content fix is deployed and users keep seeing the old page for hours or days.** Cause: the route is static, so the response carries `s-maxage=31536000`, and the CDN is honouring it. A deploy changes what the origin would serve; it does not reach copies the CDN already holds. Fix: purge the CDN as part of the deploy, or move the route to ISR so the TTL bounds the staleness:

```ts
export const revalidate = 300   // s-maxage=300, plus stale-while-revalidate
```

**★ Symptom: `revalidateTag()` runs, the server cache is correct, and the CDN still serves the old copy.** Cause: they are separate caches and the framework says so — those calls *"invalidate the Next.js server cache, but the CDN will continue serving its cached copy until the `s-maxage` TTL expires."* Fix: issue a CDN purge alongside every on-demand revalidation, and treat the purge as the third of three invalidation layers rather than an optimisation.

**★ Symptom: a page keeps serving stale content long past its `revalidate` window.** Cause: `revalidate` is when the CDN starts refreshing, not when it stops serving the old copy. The staleness bound is `expire`, which defaults to one year, and that is what produces the `stale-while-revalidate` directive. Fix: if you need a hard bound rather than a soft one, set `expire` explicitly — and accept that a shorter `expire` means some requests wait for a render.

**★ Symptom: a personalised page is served to the wrong user.** Cause: a route that varies by session was made cacheable by a shared cache — either by a hand-set header or by a CDN rule that ignores what the origin asked for. Fix: personalised routes must stay on the dynamic header set (`private, no-cache, no-store, max-age=0, must-revalidate`), and `private` is the directive doing the load-bearing work: it forbids shared caches specifically. Never override it for performance.

**★ Symptom: a bad HTML response is cached in users' browsers and no purge or rollback fixes it.** Cause: `max-age` was set on an HTML route instead of `s-maxage`. A browser cache is not reachable by anything you control. Fix: this one is not recoverable for affected users within the TTL — the only mitigation is to change the URL. Prevent it by never setting `max-age` on HTML; the framework deliberately uses `s-maxage` so the long-lived copy lives somewhere purgeable.

**★ Symptom: an auth redirect in Proxy protects some requests and not others.** Cause: the CDN is answering before Proxy runs, so cached responses never reach the check. Fix: order Proxy before the CDN cache, which is what the documentation recommends so it *"remains the source of truth for auth, redirects, and rewrites"* — and independently make sure the protected route is not emitting a shared-cacheable header in the first place, so the ordering is a defence in depth rather than the only defence.

**★ Symptom: a hashed asset 404s for users mid-deploy.** Cause: the HTML they hold references `/_next/static/` filenames from the previous build, and the old assets are gone. The `immutable` year-long caching is correct and is not the problem — the HTML lifetime is. Fix: keep the previous build's assets available across a rollout window, and keep HTML lifetimes short relative to how long you retain assets. This is the same mixed-deploy family as the `deploymentId` problem in [05h](05h-a-shared-cache-across-instances.md).

**★ Symptom: origin traffic is far higher than expected on a route you believe is cached.** Cause: the CDN is not caching it, and the most common reasons are that the route is actually dynamic (something in it opted out of static rendering) or that a cookie or header on the response defeated the CDN's own caching rules. Fix: check the header the origin actually emits before blaming the CDN — if it says `private, no-cache, no-store`, the CDN is behaving correctly and the question is why the route is dynamic.

## Interview questions

**★ Why does Next.js use `s-maxage` rather than `max-age` on HTML responses?**
Because a shared cache is reachable and a browser cache is not. `s-maxage` applies to CDNs and proxies, which you can purge, roll back and reconfigure; `max-age` applies to the browser, where a cached response is beyond any control you have until it expires. Putting the long lifetime in the purgeable layer is what keeps a mistake recoverable, and it is why setting `max-age` on HTML by hand is one of the few genuinely unrecoverable errors in this area.

**★ An ISR page has `revalidate: 60`. How long can a user see stale content?**
Up to `expire`, not 60 seconds — and `expire` defaults to one year, which is why `stale-while-revalidate` appears in the header by default. After 60 seconds the CDN begins refreshing in the background, but it keeps serving the copy it has while that happens, so nobody waits. The 60 is when refreshing starts; `expire` is when serving stale stops. Conflating the two is the most common misreading of ISR.

**★ You call `revalidateTag()` in a Server Action and the CDN still serves old content. Is this a bug?**
No, it is documented behaviour. On-demand revalidation invalidates the Next.js server cache, and *"the CDN will continue serving its cached copy until the `s-maxage` TTL expires."* The fix is to purge the CDN alongside the revalidation. It is worth naming all three layers when answering — the local instance cache, the other instances' caches, and the CDN — because the whole difficulty of this area is that they invalidate independently and only the first is automatic.

**★ Why is a CDN in front of an authorisation check dangerous?**
Because a cached response is served without the check running. If Proxy performs an auth redirect and the CDN answers first, only cache misses are ever checked — which means the protection degrades exactly as traffic increases. The documented ordering is Proxy before the CDN cache so it *"remains the source of truth for auth, redirects, and rewrites"*, and independently a response that varies by user must carry `private` so no shared cache is entitled to keep it at all.

**★ Why can hashed static assets safely be cached for a year and HTML cannot?**
Because the asset's filename contains a content hash, so changing the file changes the URL. An `immutable` year-long cache on a hashed asset can never serve stale content — stale content lives at a different address. HTML has a stable URL whose content changes, which is precisely the condition that makes caching hard. Every caching problem on this page is a consequence of that difference.

**★ Your CDN offers no purge API. How do you design around it?**
By making the TTL the invalidation mechanism, which means lowering `s-maxage` to the staleness you can actually tolerate and accepting the extra origin traffic that follows. It is a real cost and a better one than publishing content nobody can retract. The complementary move is to shorten what needs invalidating: keep the cacheable shell long-lived and stable, and push the parts that change into request-time holes that were never cached by the CDN in the first place.

**★ Origin traffic is much higher than expected on a route you believe is static. Where do you look first?**
At the `Cache-Control` header the origin actually emits, before touching any CDN configuration. If it reads `private, no-cache, no-store, max-age=0, must-revalidate`, the route is rendering dynamically and the CDN is doing exactly as instructed — so the real question is what opted the route out of static rendering. Debugging the CDN when the origin is telling it not to cache is the most common wasted afternoon at this layer.

---

← [05b · The Edge Runtime is deprecated](05b-the-edge-runtime-is-deprecated.md) · [Topic index](05-edge-functions-and-custom-cache-structures-for-global-comput.md) · Next → [05d · `Vary`, `_rsc` and CDN forwarding](05d-vary-rsc-and-what-a-cdn-must-forward.md)
