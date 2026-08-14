---
title: "<Activity>"
sidebar_label: "14 · <Activity>"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Activity>`](https://react.dev/reference/react/Activity) (definition, props, the
> hidden/visible behaviour, pre-rendering, and the Caveats) and the
> [React v18.0 release post](https://react.dev/blog/2022/03/29/react-v18) (*reusable
> state*), and
> [React Labs: View Transitions, Activity, and more](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more)
> — *"`<Activity />` has shipped in `react@19.2`."*
> It is **stable**, unlike `ViewTransition`, which remains canary-only.
> No sandbox script backs this page; claims are cited, not measured.

**`<Activity>` hides a subtree without unmounting it: the DOM stays, the state survives,
the effects are cleaned up, and the children keep rendering at low priority so they are
ready when you show them again. It replaces a pile of hand-rolled patterns that each got
one of those four things wrong.**

## The component

> `<Activity>` lets you **hide and restore the UI and internal state of its children.**

```jsx
<Activity mode={visibility}>
  <Sidebar />
</Activity>
```

> `children`: The UI you intend to show and hide.
>
> `mode`: A string value of either **`'visible'` or `'hidden'`.** If omitted, defaults to
> `'visible'`.

Two modes, one prop. The behaviour is where the substance is.

## What hiding actually does

> When an Activity boundary is **hidden**, React will **visually hide its children using
> the `display: "none"` CSS property.** It will also **destroy their Effects, cleaning up
> any active subscriptions.**

> When the boundary becomes **visible** again, React will **reveal the children with their
> previous state restored, and re-create their Effects.**

Four distinct behaviours, and it is worth separating them because every hand-rolled
alternative gets a different subset right:

| | `<Activity mode="hidden">` |
|---|---|
| **DOM** | Kept, hidden with `display: none` |
| **State** | **Preserved** |
| **Effects** | **Cleaned up** — subscriptions released |
| **Rendering** | Continues, at lower priority |

The third row is the one people do not expect and is the whole point. A hidden tab should
not keep a WebSocket open, keep polling, or keep an `IntersectionObserver` attached — and
because effects are torn down and set up again, **your cleanup functions are what make
`<Activity>` correct**. The ordinary contract from
[Phase 4 · 04](../phase-4-effects/04-cleanup/README.md), with a new trigger that is
neither mount nor unmount.

## Pre-rendering, which is the other half

> Hidden Activity boundaries will **still render their children**, albeit at a **lower
> priority than the visible content**, and **without mounting their Effects.** This allows
> children to **load code or data ahead of time** for faster rendering when the Activity
> becomes visible.

> Children still re-render in response to new props at a **lower priority** than the rest
> of the content.

So a hidden subtree is not frozen — it is *warming up*. Combined with
[topic 03](03-what-can-suspend.md), that means a hidden `<Activity>` containing a `lazy()`
component or a `use(promise)` can be **loading its code and data while the user is looking
at something else**, and be ready instantly when revealed.

That is the practical case: pre-render the next screen at low priority instead of showing
a spinner when the user gets there. And it composes with the priorities from
[topic 07](07-urgent-vs-transition.md) — low-priority work is exactly what concurrent
rendering is for.

## What it replaces

This is the capability React named in the 18 release post:

> **Concurrent React can remove sections of the UI from the screen, then add them back
> later while reusing the previous state.** For example, when a user tabs away from a
> screen and back, React should be able to restore the previous screen in the same state
> it was in before.

Before `<Activity>`, that meant choosing which problem to have:

| Hand-rolled approach | What it gets wrong |
|---|---|
| Conditional render (`{tab === 'a' && <A />}`) | State is destroyed — a different type at the same position resets the subtree ([Phase 3 · 15](../phase-3-state/15-preserving-and-resetting.md)) |
| `display: none` via CSS | State and DOM survive, but **effects keep running** — sockets, timers and observers stay live |
| Lifting all the state above the toggle | Preserves state at the cost of hoisting every piece of it, and still remounts the tree |
| Keeping it mounted and hiding it | The subtree competes for rendering priority with what the user is actually looking at |

`<Activity>` is the first option that keeps state, releases effects, and renders at low
priority at the same time.

## The two caveats

**Text-only children render nothing when hidden.**

> A *hidden* Activity that just renders text **will not render anything** rather than
> rendering hidden text, because **there's no corresponding DOM element** to apply
> visibility changes to. For example,
> `<Activity mode="hidden"><ComponentThatJustReturnsText /></Activity>` will not produce
> any output in the DOM for `const ComponentThatJustReturnsText = () => "Hello, World!"`.

Mechanically obvious once stated — `display: none` needs an element — and easy to trip over
in a test that asserts on hidden content.

**It integrates with View Transitions.**

> If an Activity is rendered inside of a ViewTransition and it becomes visible as a result
> of an update caused by `startTransition`, it will activate the ViewTransition's **`enter`
> animation.** If it becomes hidden, it will activate its **`exit` animation.**

⚠️ Worth reading with [topic 17](17-view-transitions.md) in hand: **`ViewTransition` is not
in stable React 19.2.8.** The integration is documented; the other half of it is on the
experimental channel. `<Activity>` itself is usable without it.

## When not to use it

- **When the state should not survive.** A form that ought to be blank next time the user
  opens it wants unmounting, or a `key` change
  ([Phase 3 · 07](../phase-3-state/07-resetting-state-with-key.md)).
- **For a large subtree you will probably never show.** Hidden children still render, so
  the cost is real even at low priority. Pre-rendering pays when the reveal is likely.
- **As a substitute for `lazy`.** Keeping a heavy screen hidden still ships and executes
  its code. Code-splitting is a different problem
  ([Phase 6 · 12](../phase-6-performance/12-lazy-loading.md)) — though the two compose
  well, since a hidden Activity can load a lazy chunk in advance.

## Gotchas

**Symptom:** a hidden tab keeps polling, or a socket stays open.
**Cause:** it is hidden with CSS rather than `<Activity>`, so its effects never stopped.
**Fix:** `<Activity mode="hidden">`, which destroys effects and cleans up subscriptions.

**Symptom:** switching tabs loses scroll position and form input.
**Cause:** conditional rendering unmounts the subtree and destroys its state.
**Fix:** `<Activity>` preserves state while hidden.

**Symptom:** effects run again when a tab is re-shown, and something double-counts.
**Cause:** effects are re-created on becoming visible — by design.
**Fix:** the cleanup must undo exactly what the setup did. This is the standard contract
with a new trigger.

**Symptom:** a test asserts on hidden text and finds nothing in the DOM.
**Cause:** a hidden Activity whose children are only text renders nothing — there is no
element to hide.
**Fix:** expected. Assert on an element, or on the visible state.

**Symptom:** the app is slower with several hidden Activities.
**Cause:** hidden children still render, at lower priority but not for free.
**Fix:** only pre-render what is likely to be revealed.

**Symptom:** an enter/exit animation was expected and nothing animates.
**Cause:** that behaviour comes from `ViewTransition`, which is not in stable 19.2.8.
**Fix:** `<Activity>` works without it; the animation half needs the experimental channel.

## Interview questions

**★ What does `<Activity mode="hidden">` do to its children?**
Four things. It hides them with `display: none`, keeping the DOM. It **preserves their
state**. It **destroys their effects**, cleaning up active subscriptions. And it keeps
rendering them at lower priority than the visible content, without mounting effects, so
they can load code or data ahead of time. Making it visible again restores the previous
state and re-creates the effects.

**★ Why is destroying effects the important part?**
Because it is what the CSS approach cannot do. Hiding a tab with `display: none` leaves its
sockets, timers, polls and observers running against a screen nobody is looking at.
`<Activity>` releases them and re-creates them on reveal — which also means your cleanup
functions are what make it correct, with a trigger that is neither mount nor unmount.

**★ What did people do before it, and what did each approach get wrong?**
Conditional rendering destroys state, because a different type at the same position resets
the subtree. CSS hiding keeps state and DOM but leaves effects running. Lifting all the
state above the toggle preserves it at the cost of hoisting everything and still remounts.
Keeping it mounted and visible-but-hidden makes it compete for priority with what the user
is actually looking at. `<Activity>` is the first that does all four correctly.

**★ What is the pre-rendering behaviour for?**
Getting the next screen ready before the user asks for it. Hidden children still render at
low priority without mounting effects, so a hidden subtree containing a `lazy` component or
a `use(promise)` can load its code and data while the user looks at something else, and be
instant on reveal. The cost is real though — only pre-render what you are likely to show.

**When would you not use it?**
When the state should *not* survive — a form that ought to be blank next time wants an
unmount or a `key` change. For a large subtree you will probably never reveal, since hidden
children still render. And it is not a substitute for `lazy`: a hidden heavy screen still
ships and executes its code, though the two compose well together.

**Why does a hidden Activity containing only text render nothing?**
Because `display: none` needs an element to apply to, and text has no corresponding DOM
element — so React renders nothing rather than hidden text. It matters mostly in tests that
assert on hidden content.

---

← Prev: [`cache` and `cacheSignal`](13-cache-and-cachesignal.md) ·
Index: [Phase 8](README.md) ·
Next → [Tearing](15-tearing.md)
