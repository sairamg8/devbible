---
title: "Suspense boundary placement"
sidebar_label: "10 · Boundary placement"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (*Revealing content together
> at once*, *Revealing nested content as it loads*, the closest-parent rule, the 300 ms
> reveal throttle, and the Streaming SSR / Selective Hydration note).
> The placement guidance is **applied judgement** built on those documented behaviours,
> and is labelled where it is.
> No sandbox script backs this page; claims are cited, not measured.

**Where you put a boundary decides three separate things at once: what disappears
together, what the server can stream first, and what React can hydrate first. Most
codebases decide only the first, by accident.**

## The three behaviours you are choosing between

All three are documented, and all three follow from placement alone.

**1. A boundary is one unit.**

> By default, **the whole tree inside Suspense is treated as a single unit** … even if
> *only one* of these components suspends waiting for some data, *all* of them together
> will be replaced by the loading indicator … Then, after all of them are ready to be
> displayed, **they will all appear together at once.**

**2. The closest parent wins, so nesting is a sequence.**

> When a component suspends, **the closest parent Suspense component shows the fallback.**
> This lets you nest multiple Suspense components to create a **loading sequence.**

**3. Reveals are throttled and grouped.**

> React reveals suspended content **at most once every 300ms** … Boundaries that become
> ready within that window are **revealed together** rather than one at a time.

So placement is not "where do I want a spinner". It is: **which parts of this screen
belong to the same moment?**

## The two failure modes

**One boundary at the root.** The whole page is one unit, so the slowest thing on it gates
everything. The user gets a full-page spinner and then everything at once. It also gives
up the streaming and hydration benefits below.

**A boundary around every component.** Each piece appears independently, which sounds
ideal and produces a page that assembles itself in front of the user in a dozen visible
steps — the 300 ms throttle groups some of them, but the effect is still a page that
twitches. Worse, each fallback is a different size from its content, so every reveal moves
everything beneath it.

Neither is a matter of taste; both are the direct consequence of rule 1 applied at the
wrong granularity.

## The rule that works

⚠️ **Judgement, not documentation** — but it follows from "a boundary is one unit":

**Put a boundary around a region that is meaningful on its own, and never around pieces
that only make sense together.**

- A chart and its legend belong to one boundary. A legend that arrives before its chart is
  noise.
- A price and its currency belong to one boundary. Half a price is worse than no price.
- A sidebar and the main article do **not** belong to one boundary. Either is readable
  without the other.
- A comment list and the post above it do not. The post is the point; comments are
  supplementary.

The test: **would a user find this piece useful while the other piece is still missing?**
Yes → separate boundaries. No → one.

## Nesting for a shell-first sequence

The documented nesting example is the shape to copy — the outer boundary covers the
shell, inner boundaries cover the parts that take longer:

```jsx
<Suspense fallback={<PageSkeleton />}>
  <ArticleHeader />                    {/* fast — the shell */}
  <ArticleBody />
  <Suspense fallback={<CommentsSkeleton />}>
    <Comments />                       {/* slow — its own boundary */}
  </Suspense>
</Suspense>
```

The user gets something readable as soon as the article is ready, and the comments fill in
after. Without the inner boundary, the article would wait for the comments — rule 1.

**The ordering is a consequence, not a setting.** There is no API for "reveal the header
first"; you get that by putting the header outside the boundary that the slow thing is
inside. If you genuinely need to control the order in which *sibling* boundaries reveal,
that is `SuspenseList` — still `unstable_` ([topic 18](18-suspenselist.md)) — so today the
answer is nesting.

## Layout shift is a fallback-design problem

The reveal replaces the fallback with the content, so **any size difference between them
is a visible jump**. Three practical consequences:

- **A skeleton should occupy the content's space**, not a spinner's. A centred spinner in
  a region that becomes a 600 px list guarantees a shift.
- **Reserve the dimensions you know.** A fixed-height row, a known image aspect ratio, a
  known column count — all of these can be in the fallback.
- **Where the size is genuinely unknown**, prefer a boundary lower in the tree so less
  moves, or accept the shift somewhere it does not push content the user is reading.

And a specific trap from the reference:

> **If `fallback` suspends while rendering, it will activate the closest parent Suspense
> boundary.**

So an elaborate skeleton that lazy-loads a component or reads a promise escalates to the
parent — you lose the fallback you designed *and* the granularity you placed it for.
**Fallbacks must be dumb.**

## Boundaries are also a server concern

> React includes under-the-hood optimizations like **Streaming Server Rendering** and
> **Selective Hydration** that are integrated with Suspense.

This is the argument that changes placement decisions, and it is easy to miss because it
pays off in a metric nobody is looking at while writing components:

- **Streaming**: the server can send the HTML outside a boundary immediately and stream
  each boundary's content as it becomes ready. One boundary at the root means the server
  has nothing to send early.
- **Selective hydration**: React can hydrate boundaries independently, and prioritise the
  one the user just interacted with. One boundary at the root means one hydration unit,
  and the whole page must hydrate before anything responds.

So **a boundary is a unit of streaming and interactivity, not just a loading state.** A
page with sensible regional boundaries gets faster first paint and faster
time-to-interactive without any other change. Phase 11 covers the mechanics.

## A workable default

⚠️ **Judgement.** For a typical content page:

| Level | Boundary? |
|---|---|
| The app shell — nav, header, layout chrome | **No** — render it, don't suspend it |
| Each major region (article, sidebar, comments, recommendations) | **Yes**, one each |
| Components inside a region | **No**, unless one is dramatically slower than the rest |
| A single slow widget inside a fast region | **Yes** — its own boundary |

Then adjust with the one-unit test rather than by adding boundaries wherever a spinner
would be convenient.

## Gotchas

**Symptom:** the whole page shows one spinner and then everything at once.
**Cause:** a single boundary at the root; the slowest thing gates every other thing.
**Fix:** a boundary per meaningful region.

**Symptom:** the page assembles itself in many visible steps and twitches.
**Cause:** a boundary around every component.
**Fix:** group pieces that belong to the same moment into one boundary.

**Symptom:** content jumps when a boundary reveals.
**Cause:** the fallback and the content are different sizes.
**Fix:** size the skeleton like the content and reserve known dimensions.

**Symptom:** a designed fallback never appears; the parent's shows instead.
**Cause:** the fallback itself suspended, which activates the closest parent boundary.
**Fix:** keep fallbacks free of lazy components, `use`, and precedence stylesheets.

**Symptom:** two boundaries reveal simultaneously although their data arrived apart.
**Cause:** reveals are throttled to once per 300 ms and grouped within that window.
**Fix:** documented behaviour; do not design around exact reveal timing.

**Symptom:** SSR streams nothing early and the page is unresponsive until fully hydrated.
**Cause:** one boundary at the root, so one streaming unit and one hydration unit.
**Fix:** regional boundaries. They buy streaming and selective hydration for free.

**Symptom:** sibling boundaries reveal in an order that looks wrong.
**Cause:** there is no ordering API in stable React.
**Fix:** nest instead of siblings, so the sequence is structural. `SuspenseList` is still
`unstable_`.

## Interview questions

**★ What are you actually deciding when you place a boundary?**
Three things at once. What disappears and reappears together, because the whole tree
inside a boundary is one unit. What the server can stream first, since boundaries are the
streaming unit. And what React can hydrate first, since selective hydration works per
boundary. Most codebases decide only the first, and by accident.

**★ What is wrong with one boundary at the root, and with one per component?**
The root boundary makes the slowest thing on the page gate everything, gives a full-page
spinner, and leaves the server nothing to stream early. A boundary per component makes the
page assemble in many visible steps and multiplies layout shift, since each fallback is a
different size from its content. Both are the one-unit rule applied at the wrong
granularity.

**★ What is the test for grouping?**
Whether a user would find one piece useful while the other is still missing. A chart and
its legend, or a price and its currency, belong in one boundary — half of either is worse
than none. An article and its comments do not; the article is readable alone.

**★ How do you control which part of the page appears first?**
Structurally, by nesting: put the fast shell outside the boundary that contains the slow
part, and it renders as soon as it is ready while the slow part fills in. There is no
ordering API for sibling boundaries in stable React — `SuspenseList` is still `unstable_`
— so nesting is the answer today.

**Why does boundary placement affect performance metrics that have nothing to do with
loading states?**
Because Suspense is integrated with streaming server rendering and selective hydration.
The server can send everything outside a boundary immediately and stream each boundary as
it becomes ready, and React can hydrate boundaries independently and prioritise the one
the user touched. A single root boundary collapses both into one unit, so nothing streams
early and nothing responds until the whole page hydrates.

**How do you avoid layout shift on reveal?**
Design the fallback to occupy the content's space rather than showing a centred spinner,
and reserve every dimension you actually know — row heights, image aspect ratios, column
counts. Where the size is genuinely unknown, push the boundary lower so less moves. And
keep the fallback simple: one that suspends escalates to the parent boundary, costing you
both the design and the granularity.

---

← Prev: [Async transitions](09-async-transitions.md) ·
Index: [Phase 8](README.md) ·
Next → [Suspense inside a transition](11-suspense-inside-a-transition.md)
