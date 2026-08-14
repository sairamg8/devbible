---
title: "Calling them: the rule that decides whether the call counts"
sidebar_label: "02 · Calling them"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — the Caveats and Usage
> sections of react.dev
> [`preload`](https://react.dev/reference/react-dom/preload),
> [`preinit`](https://react.dev/reference/react-dom/preinit),
> [`preconnect`](https://react.dev/reference/react-dom/preconnect),
> [`prefetchDNS`](https://react.dev/reference/react-dom/prefetchDNS),
> [`preloadModule`](https://react.dev/reference/react-dom/preloadModule) and
> [`preinitModule`](https://react.dev/reference/react-dom/preinitModule).
> No sandbox script backs this page; claims are cited, not measured.

[Chunk 01](01-the-six-apis.md) covered what the six functions ask for. This is where and when
you are allowed to ask — and it is the part that makes them a **server-rendering** topic rather
than a performance footnote.

## 🔴 The rule, repeated six times

Every one of the six references carries this pair of caveats, word for word:

> In the browser, you can call `preload` in any situation: while rendering a component, in an
> Effect, in an event handler, and so on.

> In server-side rendering or when rendering Server Components, `preload` only has an effect if
> you call it while rendering a component or in an async context originating from rendering a
> component. **Any other calls will be ignored.**

Substitute any of the six names; the sentences are identical.

**On the client, anywhere. On the server, only during a render — or in an async context that
came from one.** Everything else is silently dropped.

### Why the server is stricter

Because on the server there is no persistent document to hint at. A hint has to be **emitted
into the HTML** — as a `<link rel="preload">` in the head, alongside the metadata of
[topic 10](../10-document-metadata/README.md) — and the only moment React can do that is while
it is producing that HTML for this request. A call made outside a render has no stream to write
into and nowhere to put the hint. So it is discarded.

That also explains the *"or in an async context originating from rendering a component"*
clause. A Server Component that awaits before it returns is still, causally, inside its own
render; React can still attribute the hint to the right request. A call from a module top level,
a background job, or a stray timer cannot be attributed to anything.

⚠️ **The failure mode is silence.** No warning, no throw, no return value to inspect (they all
return nothing). The hint simply is not in the HTML, and you find out by reading the response
or by never seeing the improvement you expected. Two shapes to watch for:

```js
// ❌ module top level — not a render, ignored on the server
preconnect('https://cdn.example.com');

export function ProductPage() { /* … */ }
```

```js
// ✅ during render — attributed to this request
export function ProductPage() {
  preconnect('https://cdn.example.com');
  return /* … */;
}
```

The first form *works in the browser* — the caveat says any situation — which is exactly what
makes it a trap. It works locally in a client-only dev setup and quietly stops working in the
server-rendered build.

## Where to call them, by intent

Every reference names the same two Usage cases, and they answer different questions.

### While rendering — "this page needs it"

> Call `preload` when rendering a component if you know that it or its children will use a
> specific resource.

`preinit`'s version adds the condition that matters for rung 4:

> Call `preinit` when rendering a component if you know that it or its children will use a
> specific resource, **and you're OK with the resource being evaluated and thereby taking effect
> immediately upon being downloaded.**

`preconnect` and `prefetchDNS` phrase it one step out: *"if you know that its children will load
external resources from that host."*

This is the case that works on the server, and the one that composes: a leaf component can
declare the font it needs, and the hint lands in the head of the response.

### In an event handler — "the *next* page needs it"

> Call `preload` in an event handler before transitioning to a page or state where external
> resources will be needed. This gets the process started earlier than if you call it during the
> rendering of the new page or state.

All six say this, identically. **This is a client-side move**, and it is the higher-value one:
on hover or on `mousedown`, you know where the user is going a few hundred milliseconds before
the router does, and you can spend those milliseconds fetching.

Note what it is *not*: it is not a substitute for rendering the resource. It starts the download
early; the actual `<img>`, `<script>` or import still has to happen.

## De-duplication, and the one exception

Five of the six references say the same thing:

> Multiple calls to `preinit` with the same `href` have the same effect as a single call.

**`preload` is the exception**, because images are not identified by URL alone:

> Multiple equivalent calls to `preload` have the same effect as a single call. Calls to
> `preload` are considered equivalent according to the following rules: Two calls are equivalent
> if they have the same `href`, except: If `as` is set to `image`, two calls are equivalent if
> they have the same `href`, `imageSrcSet`, and `imageSizes`.

🔴 **For a responsive image, the identity is the triple.** Which is correct — `href`,
`imageSrcSet` and `imageSizes` together determine which candidate the browser will actually
fetch, so two calls that differ in the source set are two different requests, not a duplicate.

**Why de-duplication matters more than it sounds.** It is what makes these functions safe to
call from a shared component. A `<Avatar>` rendered forty times can call `preconnect` on every
one of them; the browser is asked once. You do not need a memo, a ref guard, or a module-level
`Set` — React and the browser already collapse it. Writing that guard yourself is a common piece
of dead code.

## How this relates to the tags in topic 10

There are two ways to express the same hint, and they are not competitors:

| | Hoisted `<link>` ([topic 10](../10-document-metadata/README.md)) | These functions |
|---|---|---|
| Form | JSX you render | a call you make |
| Deduplicated by | the `href` prop | the `href` argument (plus image fields for `preload`) |
| Available in an event handler | no — it is markup | **yes** |
| Reads naturally when | the resource is tied to what you are rendering | the resource is tied to something you are *about to* do |

**The imperative form exists for the case markup cannot express**: reacting to a hover, an
intent, a decision made outside render. Inside render, either works, and rendering a `<link>` is
often clearer because it sits next to the thing it describes.

⬜ **What the references do not settle:** whether a hint expressed both ways — a rendered
`<link rel="preload">` and a matching `preload()` call — is de-duplicated against *each other*.
The de-duplication rules quoted above are stated in terms of calls to the function. **This page
does not assert an answer**; if you care, pick one form per resource, which is better style
regardless.

## Gotchas

**Symptom:** a `preconnect` at module top level does nothing in the server-rendered build but
works in the client-only dev server.
**Cause:** the documented server rule — outside a render, *"Any other calls will be ignored."*
**Fix:** move the call into the component's render (or into an async context originating from
it).

**Symptom:** a preload called from `setTimeout` inside a Server Component never appears in the
HTML.
**Cause:** a timer is not an async context originating from rendering; the response was likely
already streamed.
**Fix:** call it during render.

**Symptom:** the same font is preloaded from twenty components and you are about to add a guard.
**Cause:** none — multiple calls with the same `href` have the effect of a single call.
**Fix:** delete the guard.

**Symptom:** two responsive-image preloads that look identical are both emitted.
**Cause:** for `as: 'image'`, equivalence needs the same `href`, `imageSrcSet` **and**
`imageSizes`. One of the three differs.
**Fix:** pass the same values you pass the `<img>`.

**Symptom:** a hover-time preload fires but the navigation is no faster.
**Cause:** the hint only starts the download; if the resource was going to be fetched at the same
priority moments later anyway, there was little to win.
**Fix:** measure. These are hints, and *"If the browser chooses to do so"* is doing real work in
that sentence.

## Interview questions

**★ Where can you call `preload` on the server, and what happens elsewhere?**
Only while rendering a component, or in an async context originating from a render. Any other
call is ignored — silently, since the function returns nothing. In the browser there is no such
restriction.

**★ Why is the server restriction there at all?**
Because on the server the hint has to be written into the HTML being produced for this request.
Outside a render there is no stream to write into and no request to attribute it to, so there is
nothing React can do with the call.

**★ What is the highest-value place to call these functions?**
An event handler before a transition — on hover or on intent, you know the destination before
the router does. Every reference names it: it *"gets the process started earlier than if you
call it during the rendering of the new page or state."*

**★ When are two `preload` calls considered the same?**
When they have the same `href` — except for `as: 'image'`, where equivalence requires the same
`href`, `imageSrcSet` and `imageSizes`, because those three together decide which candidate is
actually fetched. The other five functions de-duplicate on `href` alone.

**★ Do you need to guard against calling `preconnect` from a component rendered many times?**
No. Multiple calls with the same server have the effect of a single call. A memo or a
module-level `Set` around it is dead code.

**★ When would you render `<link rel="preload">` instead of calling `preload()`?**
When the resource belongs to what you are rendering — the markup sits next to the thing it
describes and gets hoisted into the head anyway. The function is for the case markup cannot
express: an event handler, or anywhere outside the render of the component that needs it.

---

← Prev: [The six APIs, and the ladder they form](01-the-six-apis.md) ·
Index: [11 · Resource preloading](README.md) ·
Next → [`flushSync`](../12-flushsync.md)
