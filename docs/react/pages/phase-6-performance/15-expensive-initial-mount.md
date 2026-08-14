---
title: "Expensive initial mount"
sidebar_label: "15 · Expensive initial mount"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Activity>`](https://react.dev/reference/react/Activity),
> [`useMemo`](https://react.dev/reference/react/useMemo) and the **React 19.2
> release post** (1 Oct 2025), which ships `<Activity>` with the `hidden` and
> `visible` modes. Hydration itself is Phase 11.
> No sandbox script backs this page.

**The one cost nothing else in this phase touches. Memoization explicitly does not
help the first render, so a slow mount needs different tools — and 19.2 shipped one
built for it.**

> **`useMemo` won't make the *first* render faster.** It only helps you skip
> unnecessary work on updates.

That sentence divides this phase. Topics 02–11 are about updates. Topics 12, 14 and
this one are about the mount.

## What is actually expensive at mount

Four distinct costs, and they have different fixes:

| Cost | Fix |
|---|---|
| Downloading the code | [lazy loading](12-lazy-loading.md), [bundle size](16-bundle-size.md) |
| Constructing the element tree | fewer elements — [virtualization](14-list-virtualization.md), simpler markup |
| Creating and laying out DOM nodes | the same |
| **Hydration** — attaching to server-rendered HTML | Phase 11, plus everything above |

Hydration is the one people underestimate. Server-rendered HTML appears fast, and
then the page is not interactive until the bundle has downloaded, parsed, and React
has walked the whole tree attaching to it. The visible content arriving early makes
the delay *more* jarring, not less, because the page looks ready and does not
respond.

Every fix above helps hydration too, because hydration cost scales with the size of
the tree.

## 🔴 `<Activity>` — new in 19.2

The 19.2 release post:

> **`<Activity />`** — Break your app into "activities" that can be controlled and
> prioritized.

```jsx
<Activity mode={isVisible ? 'visible' : 'hidden'}>
  <Sidebar />
</Activity>
```

The two modes, from the release post:

> **`hidden`**: hides the children, **unmounts effects**, and **defers all updates
> until React has nothing left to work on.**
>
> **`visible`**: shows the children, mounts effects, and allows updates to be
> processed normally.

And from the reference, what hidden actually does:

> React visually hides children using the **`display: none`** CSS property … Children
> **still re-render in response to new props, but at lower priority** than visible
> content. **Internal state and DOM are preserved.**

Two capabilities fall out, and they are opposites of each other.

### Pre-render what the user has not opened

> This allows children to **load code/data at lower priority before becoming
> visible**, resulting in faster rendering when made visible.

The point is *lower priority*. Work for a hidden tab happens in the gaps, after
everything visible is done — so it does not compete with the initial mount, and the
tab is ready when clicked. That is a different trade from `lazy`, which defers the
work until it is needed and therefore until the user is waiting.

### Keep state when navigating away

```jsx
// State is lost on hide
{isShowingSidebar && <Sidebar />}

// State is preserved on hide
<Activity mode={isShowingSidebar ? 'visible' : 'hidden'}>
  <Sidebar />
</Activity>
```

Conditional rendering unmounts and loses everything — form values, scroll position,
a video's timecode. `<Activity mode="hidden">` preserves internal state *and* the
DOM, so back-navigation restores rather than rebuilds. The release post names the
benefit directly: *"allows back navigations to maintain state such as input
fields."*

This is a genuine alternative to
[Phase 3 · 15](../phase-3-state/15-preserving-and-resetting.md)'s conditional
rendering, with the opposite default.

### ⚠️ The caveats that will bite

**Effects are unmounted while hidden, but the DOM is not.**

> The DOM of hidden Activities is preserved (via `display: none`), which means side
> effects from DOM elements like **`<video>`, `<audio>`, and `<iframe>` will
> continue.**

So a hidden video keeps playing. The documented fix is to do the work in the
cleanup:

```jsx
useLayoutEffect(() => {
  return () => {
    videoRef.current.pause();
  };
}, []);
```

> If relying on an Effect to clean up side effects, put the cleanup work **in the
> returned cleanup function rather than the Effect body.**

Which is [Phase 4 · 04](../phase-4-effects/04-cleanup/01-the-cleanup-contract.md)'s
contract earning its keep in a new place.

**A text-only hidden Activity renders nothing**, because there is no DOM element to
apply `display: none` to.

**Pre-rendering does not fetch data from effects.**

> Only data from sources that **activate a Suspense boundary** (like Promises read
> with `use`) are fetched during pre-rendering. **Activity does not detect data
> fetched inside an Effect.**

So a hidden tab that fetches in a `useEffect` will not pre-fetch — the effect is
unmounted. Pre-rendering data requires Suspense-based fetching, which is Phase 8 and
Phase 10.

## Deferring below-the-fold work

Without `<Activity>`, the general shape is: render what is above the fold, and defer
the rest until the browser is idle or the content approaches the viewport. An
`IntersectionObserver` ([Phase 4 · 14](../phase-4-effects/14-timers-listeners-observers.md))
plus `lazy` covers most of it, and CSS `content-visibility: auto` covers some of it
with no JavaScript at all ([topic 14](14-list-virtualization.md)).

`<Activity>` is the React-aware version of the same idea, with the advantage that it
understands priority.

## Gotchas

**Symptom:** memoization was added and the first load is unchanged.
**Cause:** `useMemo` explicitly does not make the first render faster.
**Fix:** mount cost needs less code and fewer elements, not caching.

**Symptom:** server-rendered content appears instantly and does not respond to
clicks.
**Cause:** hydration has not finished.
**Fix:** ship less to hydrate. Everything in topics 12, 14 and 16 helps.

**Symptom:** a hidden `<Activity>` keeps playing audio or video.
**Cause:** the DOM is preserved via `display: none`, so media keeps running even
though effects were unmounted.
**Fix:** pause it in the effect's **cleanup** function, as the docs show.

**Symptom:** a hidden `<Activity>` renders nothing at all.
**Cause:** it contains only text, so there is no element to hide.
**Fix:** expected — wrap it in an element if you need the node to exist.

**Symptom:** a pre-rendered tab still shows a spinner when opened.
**Cause:** it fetches in an effect, and effects are unmounted while hidden.
**Fix:** Suspense-based data fetching, or accept that only code is pre-loaded.

**Symptom:** state is lost when switching tabs.
**Cause:** conditional rendering unmounts.
**Fix:** `<Activity mode="hidden">`, which preserves state and DOM.

## Interview questions

**★ Why does none of the memoization in this phase help a slow first load?**
Because memoization skips repeated work, and there is no repetition on the first
render — `useMemo` says so explicitly. Mount cost is downloading code, constructing
the element tree, creating and laying out DOM nodes, and hydrating. Those need less
code and fewer elements, which is `lazy`, bundle work, and reducing what is rendered.

**★ What is `<Activity>` and what are its two modes?**
A 19.2 component that hides and restores UI along with its internal state. `hidden`
hides children with `display: none`, unmounts their effects, and defers their updates
until React has nothing else to do — they still re-render on new props, at lower
priority. `visible` shows them, re-creates effects, and restores state. It gives you
both pre-rendering a screen the user has not opened and preserving state for one they
navigated away from.

**★ What is the trap with a hidden `<Activity>`?**
Effects are unmounted but the DOM is preserved via `display: none`, so side effects
from DOM elements — `<video>`, `<audio>`, `<iframe>` — keep running. The documented
fix is to put the pausing work in the effect's cleanup function rather than its body.
Also, pre-rendering only fetches data that activates a Suspense boundary; it does not
detect data fetched inside an effect, because that effect is unmounted.

**How does `<Activity mode="hidden">` differ from conditional rendering?**
Conditional rendering with `&&` unmounts the subtree and loses its state; `Activity`
preserves internal state and the DOM. So form values, scroll position and a video's
timecode survive being hidden, which is what makes back-navigation restore rather
than rebuild.

**How does pre-rendering with `<Activity>` differ from `lazy`?**
`lazy` defers work until the component is needed, which means the user waits at the
moment they ask for it. Hidden `<Activity>` does the work *ahead* of time at lower
priority, in the gaps after visible work is done — so it does not compete with the
initial mount and the screen is ready when opened. They compose: `lazy` decides what
ships, `Activity` decides when it renders.

---

← Prev: [List virtualization](14-list-virtualization.md) · Index: [Phase 6](README.md) · Next → [Bundle size](16-bundle-size.md)
