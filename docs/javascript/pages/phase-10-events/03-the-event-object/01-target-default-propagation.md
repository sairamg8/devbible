---
title: "03.1 · Target, default and propagation"
sidebar_label: "01 · Target, default, propagation"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Event.preventDefault()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault), [`Event.stopPropagation()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation), [`Event.stopImmediatePropagation()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation), [`Event.cancelable`](https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable). Documentation-validated.

**Three independent decisions live on the event object, and treating them as one is the
mistake.** *Where did this come from?* *Should the browser still act?* *Should other listeners
still run?*

## The three, kept apart

| Question | Property / method |
|---|---|
| Where did it come from? | `target`, `currentTarget` |
| Should the browser's default action happen? | `preventDefault()` |
| Should other listeners still run? | `stopPropagation()`, `stopImmediatePropagation()` |

MDN puts the independence beyond doubt, in the `preventDefault` page itself:

> "The event **continues to propagate as usual**, unless one of its event listeners calls
> `stopPropagation()` or `stopImmediatePropagation()`, either of which terminates propagation
> at once."

🔴 **`return false` is not a fourth option.** In a modern `addEventListener` handler it does
nothing at all. It only had meaning in inline `onclick="…"` attributes and jQuery, where it
meant *both* `preventDefault` and `stopPropagation`. Code carrying `return false` from those
eras is usually asking for something it is not getting.

## `preventDefault`

MDN:

> "tells the user agent that the event is being explicitly handled, so its **default action**,
> such as page scrolling, link navigation, or pasting text, **should not be taken**."

```js
form.addEventListener("submit", (e) => {
  e.preventDefault();          // stop the navigation
  submitViaFetch(new FormData(form));
});
```

Two conditions under which it silently does nothing, both documented:

**1. The event is not cancelable.**

> "calling `preventDefault()` for a **non-cancelable** event, such as one dispatched via
> `EventTarget.dispatchEvent()`, without specifying `cancelable: true` **has no effect**."

`Event.cancelable` tells you which you have. Custom events are non-cancelable unless you ask:

```js
new CustomEvent("thing", { cancelable: true, bubbles: true });
```

**2. The listener is passive.**

> "If a passive listener calls `preventDefault()`, **nothing will happen** and a console
> warning may be generated."

Which, with the root-node default from [02 · 01](../02-addeventlistener/01-options-and-removal.md),
means a `touchmove` handler on `document` may be passive **without you choosing it**. If you
need to block scrolling, `{ passive: false }` is not optional.

**`defaultPrevented`** reports whether anything called it — useful in a delegated ancestor
that wants to skip work a child already handled:

```js
container.addEventListener("click", (e) => {
  if (e.defaultPrevented) return;    // a child handled it
  …
});
```

That pattern is the cooperative alternative to `stopPropagation`: the child marks the event,
the ancestor chooses to respect the mark, and nothing is suppressed for anyone else.

## `stopPropagation` and `stopImmediatePropagation`

Both stop the journey from [01 · The event model](../01-the-event-model/README.md); they
differ in how much they stop:

| | Other listeners on **this** element | Listeners on **ancestors** |
|---|---|---|
| `stopPropagation()` | still run | **stopped** |
| `stopImmediatePropagation()` | **stopped** | **stopped** |

MDN describes `stopImmediatePropagation` as *"the more restrictive option that prevents other
listeners on the same element from being called."*

🔴 **`stopImmediatePropagation` breaks the same-element case, which is the one nobody expects.**
Two independent features can legitimately listen for `click` on the same element; the one
registered first can now silently disable the second, and which is "first" depends on module
load order. That is a genuinely awful bug to track down.

Reserve it for cases where you own every listener on that element — a widget's internal
handling — and never in shared or library code.

## The cooperative alternatives

Nearly every use of `stopPropagation` has a version that suppresses nothing:

| Instead of | Do |
|---|---|
| child calls `stopPropagation` so the parent ignores the click | parent checks `e.target.closest("button")` and returns |
| child stops propagation after handling | child calls `preventDefault()`; parent checks `e.defaultPrevented` |
| widget stops everything to "own" the click | widget checks `e.target` is inside itself |

**The parent knows what it wants; the child does not know who is listening.** Putting the
decision in the parent keeps it local and visible, and does not break the router, the
analytics wrapper, or the outside-click handler that arrived last month.

## Other properties worth knowing

- **`type`** — the event name, so one handler can serve several types.
- **`eventPhase`** — `1` capture, `2` at target, `3` bubbling. Occasionally the fastest way to
  understand a double-firing handler.
- **`isTrusted`** — `true` for user-generated events, `false` for anything from
  `dispatchEvent`. Useful as a diagnostic; **not a security control**, since it is only about
  provenance within the page.
- **`timeStamp`** — time since the document was created, useful for debounce and
  double-click logic without a separate clock.
- **`composed` / `composedPath()`** — whether the event crosses shadow DOM boundaries, and the
  full path it took. `composedPath()[0]` is the real innermost target when shadow DOM is
  involved, where `target` is retargeted to the host.

## Gotchas

**Symptom:** `return false` in a handler does nothing
**Cause:** It has no meaning in an `addEventListener` handler — only in inline attributes and
jQuery.
**Fix:** Call `preventDefault()` and/or `stopPropagation()` explicitly.

**Symptom:** `preventDefault()` has no effect on a custom event
**Cause:** MDN: it *"has no effect"* for a non-cancelable event, and events from
`dispatchEvent` are non-cancelable by default.
**Fix:** `new CustomEvent(name, { cancelable: true })`, and check `Event.cancelable`.

**Symptom:** `preventDefault()` has no effect in a touch or wheel handler
**Cause:** The listener is **passive** — possibly by the root-node default.
**Fix:** `{ passive: false }`.

**Symptom:** A second feature's click handler on the same element stopped running
**Cause:** Another listener called **`stopImmediatePropagation`**; which one wins depends on
registration order.
**Fix:** Do not use it in shared code. Have handlers check `e.target` instead.

**Symptom:** A link still navigates after `stopPropagation()`
**Cause:** Propagation and default actions are independent — MDN: the event *"continues to
propagate as usual"* is the mirror of this.
**Fix:** `preventDefault()` is the one that cancels navigation.

**Symptom:** In shadow DOM, `e.target` is the component rather than the inner button
**Cause:** Retargeting — `target` becomes the host outside the shadow boundary.
**Fix:** `e.composedPath()[0]`.

## Interview questions

**★ What is the difference between `preventDefault` and `stopPropagation`?**
They are independent. `preventDefault` cancels the **browser's default action** — MDN names
*"page scrolling, link navigation, or pasting text"* — while *"the event continues to
propagate as usual."* `stopPropagation` stops the journey; the default action still happens.

**★ When does `preventDefault()` silently do nothing?**
On a **non-cancelable** event (including custom events dispatched without `cancelable: true`),
and inside a **passive** listener — where MDN says *"nothing will happen and a console warning
may be generated."*

**★ What is the difference between `stopPropagation` and `stopImmediatePropagation`?**
`stopPropagation` stops ancestors; other listeners **on the same element still run**.
`stopImmediatePropagation` also stops those — which makes it able to disable an unrelated
feature's handler depending on registration order, so it does not belong in shared code.

**★ Does `return false` work in an event handler?**
No, not in an `addEventListener` handler. It only meant anything in inline `onclick` attributes
and jQuery, where it did both `preventDefault` and `stopPropagation`.

**★ How do you avoid `stopPropagation` when a child should "own" a click?**
Invert it: let the parent check `e.target.closest(...)` and return, or have the child call
`preventDefault()` and the parent check `e.defaultPrevented`. The parent knows what it wants;
the child cannot know who else is listening.

**What is `isTrusted` for?**
Distinguishing user-generated events from ones created with `dispatchEvent`. A useful
diagnostic — **not** a security control.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
