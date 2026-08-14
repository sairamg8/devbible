---
title: "⚠ SuspenseList"
sidebar_label: "18 · ⚠ SuspenseList"
sidebar_position: 18
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-14 against **react 19.2.8**. Status corroborated from the React
> repository and DefinitelyTyped's `types/react/experimental.d.ts`, where it is exported as
> **`unstable_SuspenseList`** — plus this project's own recorded export diff of
> `Object.keys(require('react'))` on `latest` versus `experimental`, which lists
> `unstable_SuspenseList` as **experimental-only**.
> ⚠️ **There is no `SuspenseList` reference page on react.dev to quote**, because the API
> is not part of a stable release. Prop descriptions below come from the experimental type
> definitions and React's own issue tracker, and are labelled as such rather than as
> documentation.
> No sandbox script backs this page; claims are cited, not measured.

**🔴 `SuspenseList` is not in stable React 19.2.8, and has not been for the several years
it has existed.** It is exported as `unstable_SuspenseList` on the experimental channel.
This page is here so you recognise it, know what problem it would solve, and know the
answer to use instead — which is the whole of the "When Needed" tier.

## The problem it would solve

[Topic 02 · 01](02-suspense/01-the-boundary-and-the-fallback.md) established that sibling
boundaries reveal independently, and that reveals are throttled:

> React reveals suspended content **at most once every 300ms** … Boundaries that become
> ready within that window are **revealed together** rather than one at a time.

So three sibling boundaries reveal in whatever order their data arrives, grouped by the
throttle. For a feed, a list of cards or a set of comments, that can look like the page is
assembling itself out of order — the third item appearing before the first.

`SuspenseList` would let you say "reveal these in order, whatever order the data arrives
in", coordinating siblings that otherwise know nothing about each other.

## What it looks like

⚠️ **From the experimental type definitions and React's issue tracker, not from
documentation** — and subject to change, since the API has never stabilised:

```jsx
// ⚠ Experimental. Not available on react@19.2.8.
<SuspenseList revealOrder="forwards" tail="collapsed">
  <Suspense fallback={<CardSkeleton />}><Card id={1} /></Suspense>
  <Suspense fallback={<CardSkeleton />}><Card id={2} /></Suspense>
  <Suspense fallback={<CardSkeleton />}><Card id={3} /></Suspense>
</SuspenseList>
```

| Prop | Values, as the experimental types describe them |
|---|---|
| `revealOrder` | `"forwards"`, `"backwards"`, or `"unstable_legacy-backwards"` — the order children are revealed in |
| `tail` | `"collapsed"` shows only the next fallback in the list · `"hidden"` shows none of the unloaded items · `"visible"` shows all fallbacks |

`tail="collapsed"` is the interesting one: instead of a screen of identical skeletons, you
see the loaded items plus a single "next" placeholder, which reads as a list that is still
arriving rather than a page that has not loaded.

## Why it is still `unstable_`

Two things are worth knowing rather than the API details.

**It has been experimental for years, and was renamed *to* `unstable_`.** That is a
stronger signal than "not shipped yet" — the export name itself now carries the warning.
React's issue tracker records long-standing behaviour problems with it, including
[SuspenseList blocking rendering of later items entirely rather than just their
reveal](https://github.com/facebook/react/issues/17277) and
[the `tail` property not working on re-renders](https://github.com/facebook/react/issues/17779).
Those are behaviour gaps, not polish.

**Ordering interacts badly with everything else in this phase.** Coordinating sibling
reveals means holding back content that is ready, which is in direct tension with
streaming server rendering, selective hydration
([topic 10](10-boundary-placement.md)) and the fallback suppression that transitions
provide ([topic 11](11-suspense-inside-a-transition.md)). That is a plausible reason the
design has been hard to finish, and it is a reason to be cautious about the feature even
when it does land.

## What to do instead

**1. Nest instead of using siblings.** The documented mechanism for sequencing:

> When a component suspends, the **closest parent Suspense component shows the fallback.**
> This lets you nest multiple Suspense components to **create a loading sequence.**

Nesting gives you a *guaranteed* order — the outer content cannot appear after the inner —
because the ordering is structural rather than coordinated. It is less flexible than
`revealOrder` and it actually exists.

**2. Use one boundary for things that should appear together.** If the real requirement is
"these five cards should not appear one at a time", a single boundary around all five gives
exactly that, since the whole tree inside a boundary is one unit. You trade granularity for
coherence, deliberately.

**3. Accept the throttle.** The 300 ms grouping already prevents the worst of the flicker.
Content that arrives close together is revealed together without any coordination from you,
which covers a good share of the cases people reach for `SuspenseList` to fix.

**4. Reconsider whether ordering is the real requirement.** Often the complaint is layout
shift or a screen of identical skeletons, not the order — and those are fixed by fallback
design ([topic 10](10-boundary-placement.md)), which works today.

## The version risk, briefly

The same as [topic 17](17-view-transitions.md), and stronger here: adopting
`unstable_SuspenseList` means running an experimental build of React in production for a
feature whose own export name says not to. Given that its known issues are about *what it
does*, not just its API shape, this is not a close call.

## Gotchas

**Symptom:** `import { SuspenseList } from 'react'` fails.
**Cause:** it is not in stable 19.2.8, and on the experimental channel it is exported as
`unstable_SuspenseList`.
**Fix:** expected. Nest boundaries, or use one boundary for the group.

**Symptom:** an article demonstrates `SuspenseList` and it does not work.
**Cause:** the article predates the rename, or is running an experimental build.
**Fix:** check the React version and the export name before debugging.

**Symptom:** sibling boundaries reveal in a surprising order.
**Cause:** they reveal as their data arrives, grouped by the 300 ms throttle. There is no
ordering guarantee between siblings.
**Fix:** nest for a guaranteed sequence, or group into one boundary.

**Symptom:** a list shows a screen full of identical skeletons.
**Cause:** one boundary per item, each with its own fallback.
**Fix:** what `tail="collapsed"` would address — approximate it by grouping the tail into
one boundary, or by designing a fallback that reads as a list rather than as many
placeholders.

**Symptom:** `SuspenseList` is adopted experimentally and later items do not render at all.
**Cause:** a known issue — it can block rendering of later items rather than only their
reveal.
**Fix:** this is why it is `unstable_`.

## Interview questions

**★ What is `SuspenseList` and can you use it?**
A component that would coordinate how sibling Suspense boundaries reveal — `revealOrder`
for the order and `tail` for how unloaded items are displayed. And no: it is not in stable
React 19.2.8 and has not been for years. On the experimental channel it is exported as
`unstable_SuspenseList`, and the rename *to* `unstable_` is a stronger warning than simply
not having shipped.

**★ What problem would it solve, and what do you do instead?**
Sibling boundaries reveal as their data arrives, so a list can assemble out of order. The
substitutes that exist today: nest boundaries, which gives a *guaranteed* order because the
sequencing is structural rather than coordinated; use one boundary for content that should
appear together, since the whole tree inside a boundary is one unit; and rely on the 300 ms
reveal throttle, which already groups content arriving close together.

**★ Why has it stayed experimental?**
Because it has real behaviour problems on record — it can block rendering of later items
rather than only their reveal, and `tail` has not worked correctly across re-renders — and
because coordinating reveals means holding back content that is ready, which is in tension
with streaming server rendering, selective hydration and the fallback suppression
transitions provide. That is a hard design problem, not an unfinished API.

**Would you ship it today?**
No. It means running an experimental React build in production for a feature whose export
name warns against it, and whose known issues concern what it does rather than how it is
called. The alternatives — nesting, grouping, and fallback design — solve most of the real
requirement and exist on stable.

**Is ordering usually the actual requirement?**
Often not. The complaint is frequently layout shift or a screen of identical skeletons
rather than the sequence, and both are fixed by fallback design and boundary placement,
which work today.

---

← Prev: [⚠ `<ViewTransition>` and friends](17-view-transitions.md) ·
Index: [Phase 8](README.md)
