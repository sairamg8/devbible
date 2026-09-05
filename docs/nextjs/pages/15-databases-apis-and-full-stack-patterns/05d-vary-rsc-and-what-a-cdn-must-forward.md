---
title: "A CDN that strips the `rsc` header does not break your site — it breaks client-side navigation only, by returning HTML where the router expected a Flight payload, which presents as \"links do a full page load now\" and points at nothing"
sidebar_label: "05d · Vary, `_rsc` and CDN forwarding"
sidebar_position: 58
description: "The five Vary headers Next.js sets, why the `_rsc` search parameter exists at all, the 307 hash redirect and the flag that disables it, and the navigation bug a mis-set CDN produces."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js 16.3.4 documentation — [Using a CDN with Next.js](https://nextjs.org/docs/app/guides/cdn-caching).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0.

**One URL in the App Router has two representations. A browser navigating to `/boards/42` for the first time wants HTML; the client router navigating there from `/boards` wants an RSC Flight payload. Same path, same method, different response — which is exactly the situation HTTP invented `Vary` for, and exactly the situation most CDNs handle badly. [05c](05c-the-cdn-layer-and-cache-control.md) covered how long a CDN keeps a response; this page is about it keeping the *right* one, and about the specific, confusing bug that results when it does not: navigation still works, but every link becomes a full page load.**

## The headers that make the response different

Next.js declares what varies:

> Vary headers Next.js sets: `rsc`, `next-router-state-tree`, `next-router-prefetch`, `next-router-segment-prefetch`, `next-url`.
> — [Next.js · Using a CDN with Next.js](https://nextjs.org/docs/app/guides/cdn-caching)

Five request headers, all of which change what the server sends back for one path. The most important is the first: `rsc` marks a request as coming from the client router rather than from the browser's address bar.

The problem is that the mechanism does not survive contact with real CDNs:

> *"Many CDNs don't support `Vary` without additional configuration. Next.js addresses this with the `_rsc` search parameter: a hash of the relevant request header values that acts as a cache-key"*

That is the whole reason `_rsc` exists, and it is worth stating plainly because the parameter looks like framework noise in a network tab. **It is a `Vary` you can put in a URL** — a hash of the varying headers, promoted into the cache key, because a query string is the one part of a request every CDN reliably keys on.

## The two rules a CDN has to follow

The documentation gives them as a pair, and each has its own failure mode.

> *"**The `rsc` header** must be forwarded from the client to the server… If a CDN strips it, the server returns HTML when the client-side router expects RSC data, which breaks client-side navigation, causing browser navigations instead."*

> *"**The `_rsc` search parameter** must be included in the cache key… By default, when an RSC request arrives without the correct `_rsc` value, the server responds with a **307 redirect** to the URL with the correct hash. This behavior can be disabled by setting `experimental.validateRSCRequestHeaders` to `false`."*

🔴 **Read the first failure carefully, because it is the one that wastes days.** Stripping `rsc` does not produce an error. The server does exactly what it was asked — an ordinary request gets an ordinary HTML response — and the router, receiving HTML where it expected Flight, falls back to a full browser navigation. The site works. Every link is just slower, the loading states never appear, and client state is lost on every navigation. There is no console error, no failed request, and no obvious place to look. The symptom is "the app feels like it stopped being a SPA", and the cause is a header dropped by a proxy nobody changed recently.

The second failure is louder and easier: a CDN that ignores `_rsc` in its cache key can serve an RSC payload for one state tree in response to a request for another. The 307 redirect exists to detect that and correct it — the server sees a mismatched hash and bounces the client to the right URL. That is a safety net, not a design goal: every redirect is a wasted round trip, so a CDN that keys on `_rsc` properly should never see one.

⚠️ **`experimental.validateRSCRequestHeaders: false` turns the net off.** There are legitimate reasons — a CDN you cannot configure, or a measurable redirect volume you have traced to something benign — but disabling validation does not fix the mismatch it was detecting. It stops reporting it. Treat a nonzero rate of these 307s as a CDN configuration finding first.

## What to actually configure

Three settings, in the order they matter:

1. **Forward the five request headers to the origin** — `rsc`, `next-router-state-tree`, `next-router-prefetch`, `next-router-segment-prefetch`, `next-url`. On a CDN with an allowlist model, these have to be added explicitly; the default allowlist will not contain them.
2. **Include `_rsc` in the cache key.** Many CDNs strip unknown query parameters from the key by default, precisely to improve hit rates, and that default is wrong here.
3. **Keep Proxy in front of the cache**, per [05c](05c-the-cdn-layer-and-cache-control.md), so auth and rewrites stay authoritative.

⚠️ **A note on longevity, quoted so you can date it:** the framework describes this as transitional —

> *"The Next.js team is working on moving all cache-affecting inputs into the URL pathname, eliminating the need for `Vary` on custom headers and removing the `_rsc` search parameter."*

with its status given as *"It is in active design."* So `_rsc` is a mechanism to configure around today and not one to build tooling on. **Nothing announces a version for that change**, and this page does not guess at one.

## Gotchas

**★ Symptom: every link triggers a full page load; loading UI never appears and client state resets on navigation.** Cause: a CDN or proxy is stripping the `rsc` request header, so *"the server returns HTML when the client-side router expects RSC data, which breaks client-side navigation, causing browser navigations instead."* Fix: add the five headers to the forwarding allowlist. Confirm it from the client rather than the dashboard — a navigation request should come back as a Flight payload, not a document:

```js
// in the browser console, on a page with a <Link> to /boards/42
await fetch('/boards/42', { headers: { rsc: '1' } }).then(r => r.text())
// starts with Flight data if the header survived; starts with <!DOCTYPE html> if it was stripped
```

**★ Symptom: a steady rate of 307 redirects on RSC requests, and everything works but is slow.** Cause: the CDN is not including `_rsc` in its cache key, so requests arrive with a hash that does not match what the server expects and the server bounces them to the correct URL. Fix: add `_rsc` to the cache key. Do not disable the validation — the redirect is the symptom, and switching it off with `experimental.validateRSCRequestHeaders: false` removes the report rather than the mismatch.

**★ Symptom: navigation returns content from the wrong route segment, or a stale part of the tree.** Cause: the cache key ignores the headers that distinguish one router state from another, so two genuinely different responses collide on one key. Fix: `_rsc` is the hash that separates them and it must be in the key. This is the failure the parameter exists to prevent, and it is why "strip unknown query parameters to improve hit rate" is the wrong CDN default for a Next.js origin.

**★ Symptom: prefetching appears to do nothing, or prefetches return full pages.** Cause: `next-router-prefetch` and `next-router-segment-prefetch` are among the five headers that change the response, so a prefetch stripped of them is indistinguishable from an ordinary request. Fix: the same allowlist — all five, not just `rsc`. Forwarding one and not the others produces partial, confusing behaviour that is harder to diagnose than forwarding none.

**★ Symptom: it works in production behind one CDN and breaks behind a corporate proxy, for some users only.** Cause: header stripping can happen anywhere on the path, not only at your CDN. An intermediary that drops unknown request headers produces the identical symptom for the users behind it. Fix: diagnose by comparing an affected client's request with an unaffected one rather than by auditing your own configuration, which is probably fine.

**★ Symptom: someone adds `Vary: rsc` handling by hand and hit rate collapses.** Cause: `Vary` on a header with many distinct values fragments the cache into one entry per value, which is why the framework promoted the hash into `_rsc` instead. Fix: use the mechanism that exists rather than re-deriving it — key on `_rsc`, forward the headers, and do not add custom `Vary` handling on top.

## Interview questions

**★ Why does one URL in the App Router have two representations?**
Because a first visit and a client-side navigation want different things from the same path: the browser wants HTML it can render immediately, and the router wants an RSC Flight payload it can merge into the tree it already has. The `rsc` request header is what distinguishes them, along with four others describing router state and prefetch intent. That is a textbook use of `Vary`, and the complication is entirely that CDNs handle `Vary` poorly.

**★ What is the `_rsc` search parameter for?**
It is a `Vary` that fits in a URL. Since *"Many CDNs don't support `Vary` without additional configuration"*, Next.js hashes the relevant request header values into a query parameter that acts as a cache key, because a query string is the one thing every CDN reliably keys on. It is explicitly described as transitional — the team is working toward moving cache-affecting inputs into the pathname and removing the parameter — so it is something to configure around rather than build on.

**★ A CDN strips the `rsc` header. What does the user see?**
A site that works and has stopped feeling like an app. The server returns HTML because that is what an unmarked request asks for, the router cannot use it, and it falls back to a full browser navigation on every link — so loading states never show, client state is lost each time, and everything is slower. Crucially there is no error anywhere: no failed request, no console message. It is one of the highest-confusion-per-byte misconfigurations available, because the evidence is an absence.

**★ You see a steady rate of 307 redirects on RSC requests. What is happening and what do you do?**
The CDN is not including `_rsc` in its cache key, so requests reach the server with a hash that does not match, and the server redirects them to the correct URL — a safety net working as designed and costing a round trip every time. The fix is the cache key. The thing not to do is set `experimental.validateRSCRequestHeaders` to `false`, which stops the detection without addressing the mismatch it was detecting.

**★ Why not just add `Vary: rsc` at the CDN and be done?**
Because `Vary` on a high-cardinality header fragments the cache into one entry per distinct value, which destroys hit rate — and because many CDNs need extra configuration to honour `Vary` at all, which is the problem being solved rather than the solution. Hashing the varying inputs into a single query parameter collapses that cardinality into one key the CDN already understands. Re-deriving the mechanism by hand gives you the fragmentation the framework's design avoids.

**★ How would you verify the configuration is right, rather than trusting the dashboard?**
Exercise both representations from a real client. Request a route normally and confirm you get a document; request it with the `rsc` header and confirm you get a Flight payload rather than HTML. Then navigate in the browser and watch whether the request is an RSC fetch or a document load, and whether any 307s appear. Dashboards report what the CDN was told; the responses report what it actually does, and on a path that may include intermediaries you do not own, only the second one settles it.

---

← [05c · The CDN layer and `Cache-Control`](05c-the-cdn-layer-and-cache-control.md) · [Topic index](05-edge-functions-and-custom-cache-structures-for-global-comput.md) · Next → [05e · Writing a custom cache handler](05e-writing-a-custom-cache-handler.md)
