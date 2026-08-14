---
title: "The caveats that shape the design"
sidebar_label: "03 · The caveats"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`resume`](https://react.dev/reference/react-dom/server/resume),
> [`resumeToPipeableStream`](https://react.dev/reference/react-dom/server/resumeToPipeableStream)
> and [`resumeAndPrerender`](https://react.dev/reference/react-dom/static/resumeAndPrerender)
> (Caveats sections, verbatim), with
> [`prerender`](https://react.dev/reference/react-dom/static/prerender) for the build-side
> half of each pairing.
> No sandbox script backs this page; claims are cited, not measured.

The resume references each end in a short **Caveats** list, and it is the most useful part of
the documentation. Four sentences, three of which look like small API restrictions and one of
which is the whole performance model. Read together they say something the marketing word
"resume" hides: **resuming is a second render of the same tree with permission to skip parts
of it**, and every restriction follows from that.

## 🔴 The caveat that decides whether any of this is worth doing

> `resume` **re-renders from the root** until it finds a component that was not fully
> pre-rendered. **Only fully prerendered Components (the Component and its children finished
> prerendering) are skipped entirely.**

Both `resume` and `resumeToPipeableStream` carry that sentence identically.

Read the second half carefully, because it is stricter than the first half suggests. The unit
of skipping is **a component together with everything under it**. A component whose own output
finished but which contains one unresolved descendant is *not* fully prerendered, so it is not
skipped — React renders it again.

That makes the saving **a property of where your boundaries sit**, not of how much of the page
the build managed to produce:

| Shape | What resume re-renders |
|---|---|
| One `<Suspense>` low in the tree, wrapping the personalised widget | the path from the root down to that boundary, then the widget |
| The dynamic part rendered inline near the root, no boundary around it | effectively the whole tree beneath it — most of the page again |
| A layout component that awaits per-request data | everything, because nothing under it ever finished at build time |

So the design rule is the same one Suspense has always implied, with a sharper consequence:
**push the per-request part as deep as it will go, and put a boundary around it.** A page that
postpones near the root gets a prelude that looks impressive and a resume that does nearly all
the work over again.

⚠️ **"Re-renders from the root" also means the render still costs something even in the good
case.** The spine of the tree — the components between the root and the postponed boundary —
runs on every request. Partial pre-rendering removes the *expensive* work, the data-dependent
subtrees that finished at build time; it does not turn the request into a file read. If your
mental model is "serve the prelude bytes, then render only the hole", the first half is right
and the second is optimistic.

## The three restrictions, and the single reason behind them

The other three caveats look unrelated. They are the same idea from three angles: **anything
that has to be identical across the two renders belongs to the `prerender` call, not the
`resume` call.**

### Bootstrap options belong to the build

> `resume` does not accept options for `bootstrapScripts`, `bootstrapScriptContent`, or
> `bootstrapModules`. Instead, you need to pass these options to the `prerender` call that
> generates the `postponedState`. You can also inject bootstrap content into the writable
> stream manually.

The bootstrap scripts are emitted into the HTML that the *build* produced — they are already in
the prelude. Accepting them again at resume time could only produce a second, conflicting set.

🔴 **This has a real consequence for the decision made back in
[topic 08 · 02](../08-prerendering/02-calling-them.md):** `bootstrapScripts` is the switch that
decides whether the page ships React to the client at all. With partial pre-rendering that
switch is thrown **at build time, for every request that page will ever serve**. You cannot
decide per request that this visitor gets a hydrating page and that one gets inert HTML.

The escape hatch is named in the same sentence — *"you can also inject bootstrap content into
the writable stream manually"* — which is exactly what it sounds like: you are writing script
tags into the stream yourself, and React is not managing them.

### `identifierPrefix` belongs to the build

> `resume` does not accept `identifierPrefix` since the prefix needs to be the same in both
> `prerender` and `resume`.

This is [topic 02 · Hydration mismatches](../02-hydration-mismatches.md) enforced by the API
shape rather than by a warning. `useId` values generated at build time are already sitting in
the prelude; the resumed render has to generate the same ones. Rather than trust you to pass
the same string twice, React removes the option.

### `nonce` is the one you have to think about

> Since `nonce` cannot be provided to prerender, you should only provide `nonce` to `resume`
> **if you're not providing scripts to prerender**.

Unpack the two halves, because the conditional is doing real work.

[Chunk 01](01-the-idea-and-the-four-apis.md) covered why `nonce` is absent from the static
side: a nonce is a **per-request** CSP value, and baking one into shared static output is,
in the words of the `prerender` reference, *"inappropriate and insecure"* — the whole point of
a nonce is that it is unguessable and used once.

Now put the two calls together. If `prerender` emitted bootstrap scripts, those `<script>` tags
are in the prelude **without** a nonce. Giving `resume` a nonce does not retrofit them: it
applies to what the resumed render emits. You end up serving one page with nonce-less scripts
from the build and nonce-bearing scripts from the request, under a CSP that will reject
whichever set it was not told about.

So the documented rule collapses to a choice made once per page:

| Your CSP strategy | Prerender with scripts? | Pass `nonce` to `resume`? |
|---|---|---|
| Nonce-based CSP | **no** — inject bootstrap manually, or don't ship them from the build | yes |
| Hash-based or script-src allowlist CSP | yes | no |

⚠️ **This is the caveat most likely to be discovered in production**, because it fails only
under a CSP, only in the browser, and only for the half of the scripts that were emitted by the
other renderer.

## `resumeAndPrerender`'s own two

The static resume carries a shorter list, and neither entry is new:

- **`nonce`** *"is not available when prerendering"* — the same wording and the same reason as
  `prerender` itself. It is producing shared output, so there is no request to key a nonce to.
- **The Web-Streams dependency.** `resumeAndPrerender` is the Web-stream API; Node uses
  **`resumeAndPrerenderToNodeStream`**, which is the fourth corner of the grid in
  [chunk 01](01-the-idea-and-the-four-apis.md).

Everything else it inherits from `prerender`: it waits for all data, it rejects on a real
render failure, and an abort is a partial success that hands you another `postponed`.

## ⚠️ Three places the documentation contradicts itself

These are real defects on react.dev as of 2026-08-14, not misreadings. They are recorded here
because each one will cost you time if you hit it while debugging, and because **this page does
not resolve any of them** — the primary source says both things, and no run is available to
settle it (no sandbox, so no output block).

1. **`resumeToNodeStream` does not appear to exist.** `resume`'s page says *"For Node.js, use
   `resumeToNodeStream`"* — a name that appears nowhere else in the reference — and links it to
   `renderToPipeableStream`. The Node API documented with its own page is
   **`resumeToPipeableStream`**. Treat `resumeToNodeStream` as a typo for it; do not write code
   against the name.
2. **Both cross-links between the two resume pages point at the wrong function.** `resume`
   links its Node advice to `renderToPipeableStream`; `resumeToPipeableStream` says Web-Stream
   runtimes *"should use `resume`"* and links that to `renderToReadableStream`. The advice is
   right, the link targets are the streaming renderers rather than the resume pair.
3. **`resumeAndPrerender` names its second return value twice, differently.** The signature
   line writes `{ prelude, postpone }`; the Returns section documents **`postponed`**. Flagged
   in [chunk 01](01-the-idea-and-the-four-apis.md) and still unresolved — `prerender`'s own
   reference uses `postponed`, which is the safer bet, but check the types you have installed
   rather than trusting either page.

And one more from [chunk 02](02-calling-them.md), for completeness: the
`resumeToPipeableStream` example imports `resume`, and calls the function without `await`
though the signature line has one.

**None of these is a reason to avoid the API** — they are documentation slips around a small,
new surface. They are a reason to check your installed types before writing the call.

## What the caveats add up to

Partial pre-rendering is not a caching layer bolted onto SSR. Every restriction points the same
way: **the build and the request are two halves of one render**, and the things that must agree
between them — identifier prefixes, bootstrap scripts, the component tree itself — are decided
by the build. The request gets to supply data, a nonce (conditionally), an abort signal and an
error handler. That is all.

Which gives the three questions worth asking before adopting it:

1. **Where does the per-request data enter the tree?** As deep as possible, behind a boundary,
   or the re-render rule eats the benefit.
2. **How is the postponed state stored, keyed and invalidated?** Per page and **per build** —
   it encodes a tree that must match the components you are about to render again. A deploy
   invalidates every stored state.
3. **What is your CSP?** It decides the `nonce`-versus-bootstrap-scripts fork, and it decides
   it once, at build time.

## Gotchas

**Symptom:** the prelude covers most of the page, but resuming is barely faster than plain SSR.
**Cause:** the postponed boundary sits high in the tree. Only a component *and its children*
that finished prerendering are skipped, so a high boundary leaves nearly everything to
re-render.
**Fix:** move the per-request part deeper and wrap it in its own `<Suspense>`.

**Symptom:** `resume` rejects `bootstrapScripts` as an unknown option.
**Cause:** it does not accept it. Bootstrap options belong to the `prerender` call that
generated the postponed state.
**Fix:** pass them at build time, or inject the bootstrap content into the writable stream
yourself.

**Symptom:** hydration mismatch warnings about `useId` values on resumed pages only.
**Cause:** the identifier prefix differed between the two renders — which is precisely why
`resume` refuses the option.
**Fix:** set `identifierPrefix` once, on `prerender`, and let resume inherit it.

**Symptom:** the CSP blocks half the scripts on the page.
**Cause:** the build emitted bootstrap scripts without a nonce (it cannot have one) while the
resumed render emitted nonce-bearing tags.
**Fix:** pick one — prerender without scripts and use a nonce at resume, or keep the build's
scripts and use a hash-based CSP.

**Symptom:** code written against `resumeToNodeStream` does not resolve.
**Cause:** the name appears once on react.dev and nowhere else; the documented Node API is
`resumeToPipeableStream`.
**Fix:** use `resumeToPipeableStream`.

**Symptom:** resumed pages break immediately after a deploy.
**Cause:** stored postponed state from the previous build was reused against new component
code. Resuming re-renders the tree, so the tree has to match.
**Fix:** key the stored state by build and invalidate on deploy.

## Interview questions

**★ What exactly does `resume` skip?**
Only components that were **fully** prerendered — the component *and* all its children finished
at build time. It re-renders from the root until it reaches something that was not, so the
saving depends on where the unfinished work sits, not on how much HTML the prelude contains.

**★ Why can't you pass `bootstrapScripts` to `resume`?**
Because those scripts were emitted into the prelude by the `prerender` call; accepting them
again would produce a second, conflicting set. The documentation directs you to pass them to
`prerender`, or to inject bootstrap content into the writable stream manually.

**★ Why does `resume` refuse `identifierPrefix` when the streaming renderers accept it?**
The prefix has to be identical across the two renders — the build already put `useId` values in
the prelude. Removing the option makes a mismatch impossible instead of merely warned about.

**★ When should you pass a `nonce` to `resume`?**
Only when you are not emitting scripts from `prerender`. A nonce is per request, so the static
half cannot have one; mixing nonce-less build scripts with nonce-bearing resumed ones breaks
under a nonce-based CSP. It is a per-page decision made at build time.

**★ Your prerendered page has a personalised header rendered inline at the top of the layout.
What does that cost you?**
Almost everything. Nothing containing it finished prerendering, so React re-renders the tree
under it on every request — the prelude still exists, but the resume is close to a full server
render. Moving the header behind its own boundary is what makes the rest skippable.

**★ How long does a stored `postponedState` stay valid?**
Until the build changes. It is opaque and JSON-serializeable, per page and per build, and
resuming re-renders the same component tree — so a deploy invalidates it. Storage and
invalidation are your responsibility; React documents only that you load it *"from wherever you
stored it"*.

---

← Prev: [Calling the resume APIs](02-calling-them.md) ·
Index: [09 · Partial pre-rendering](README.md) ·
Next → [Document metadata](../10-document-metadata.md)
</content>
