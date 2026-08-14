---
title: "01.1 · Three phases"
sidebar_label: "01 · Three phases"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling), [`Event.eventPhase`](https://developer.mozilla.org/en-US/docs/Web/API/Event/eventPhase), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener). Documentation-validated.

**An event does not fire on one element. It travels a path, twice.** Once down from the root
to the element, once back up — and a listener anywhere along that path can see it.

## The path

MDN's three phases:

1. **Capture phase** — "The event fires first on the least nested element and then on
   successively more nested elements until the target is reached."
2. **Target phase** — "The event reaches the target element."
3. **Bubble phase** — "The event fires on the innermost element targeted, then on
   successively less nested elements (parent elements)."

```
            ┌──────────── html ────────────┐
   capture  │  ┌───────── body ─────────┐  │  bubble
      ↓     │  │  ┌────── div ───────┐  │  │    ↑
      ↓     │  │  │  ┌── button ──┐  │  │  │    ↑
      └─────┴──┴──┴─→│  TARGET   │←─┴──┴──┴────┘
                     └───────────┘
```

Click the button and a listener on `document` can fire **twice** — once going down if
registered for capture, once coming back up if not. Registering the same handler both ways is
a real and confusing bug.

## Bubbling is the default

MDN:

> "**By default almost all event handlers are registered in the bubbling phase**, and this
> makes more sense most of the time."

```js
el.addEventListener("click", fn);                     // bubble (default)
el.addEventListener("click", fn, { capture: true });  // capture
el.addEventListener("click", fn, true);               // capture, legacy shorthand
```

The historical reason MDN gives is worth a line: Netscape implemented only capturing,
Internet Explorer only bubbling, and the W3C standardised both to reach agreement. **Capture
is not a modern addition — it is the other half of a compromise**, which is why it feels
vestigial. In practice you want it for exactly two things: intercepting an event before a
child can stop it, and handling events on elements that do not bubble in some contexts.

🔴 **Not every event bubbles.** `focus`, `blur`, `load`, `error`, and most media events do
not. That is why `focusin`/`focusout` exist — they are the bubbling counterparts of
`focus`/`blur`, and the reason delegation for focus needs the `in`/`out` versions.

## `target` versus `currentTarget`

The distinction the whole phase depends on. MDN:

> **`event.target`**: "the element on which the event was initially fired… **This remains the
> same while an event bubbles up.**"
>
> **`event.currentTarget`**: "the element to which the **event handler has been attached**.
> This differs for handlers attached to different elements in the hierarchy."

MDN's demonstration:

```js
function handleClick(e) {
  const logTarget = `Target: ${e.target.tagName}`;
  const logCurrentTarget = `Current target: ${e.currentTarget.tagName}`;
  output.textContent += `${logTarget}, ${logCurrentTarget}\n`;
}

document.body.addEventListener("click", handleClick);
container.addEventListener("click", handleClick);
button.addEventListener("click", handleClick);
```

Clicking the button runs `handleClick` three times. **`target` is the `BUTTON` every time;
`currentTarget` is `BUTTON`, then the container, then `BODY`.**

| | Means | Changes as it travels? |
|---|---|---|
| `target` | what was actually clicked | **no** |
| `currentTarget` | whose listener is running now | **yes** |

Two practical rules follow:

- **`currentTarget` is only valid during dispatch.** Read it inside the handler; it is `null`
  afterwards, so capturing it in an `async` continuation or a `setTimeout` gives you nothing.
  Copy it to a local first.
- **`this` inside a non-arrow handler is `currentTarget`.** An arrow function's `this` comes
  from the enclosing scope instead — the usual reason a handler written as an arrow "loses"
  the element ([Phase 3 · 04](../../phase-3-functions/04-arrow-functions-and-this/README.md)).

**The single most common event bug is using `currentTarget` where you meant `target`, or the
reverse.** With delegation you almost always want `target` (or `target.closest(...)`); with a
listener on the element itself, they are the same and it does not matter — which is exactly
why the mistake survives until you add delegation.

## `stopPropagation`

MDN:

> "The `stopPropagation()` method prevents an event from bubbling up to parent elements…
> This stops the event from continuing up the DOM tree, preventing parent handlers from
> executing."

```js
video.addEventListener("click", (event) => {
  event.stopPropagation();
  video.play();
});
```

🔴 **`stopPropagation` is antisocial and should be a last resort.** It stops the event
reaching handlers written by code that has no idea you exist:

- Delegation on an ancestor stops working for that subtree — and the ancestor may be a router,
  an analytics wrapper, or a dropdown's "click outside to close".
- The failure is **remote**: something breaks in a different component, with no reference to
  the line that caused it.

The usual legitimate use is preventing a parent's handler from treating a click on a child
control as a click on the parent. The better fix is almost always for the **parent** to check
what it received:

```js
container.addEventListener("click", (e) => {
  if (e.target.closest("button")) return;   // ✅ parent decides, nothing is suppressed
  select(e.currentTarget);
});
```

`stopImmediatePropagation` additionally prevents **other listeners on the same element** from
running, which makes it stronger and correspondingly worse. Details in
[03 · The event object](../README.md).

And the one people conflate: **`preventDefault` is unrelated to propagation.** It cancels the
browser's default action — following a link, submitting a form, scrolling — while the event
continues travelling normally. Cancelling a default action and stopping propagation are
independent decisions, and doing both by reflex is how a click stops working three components
away.

## Gotchas

**Symptom:** A handler on an ancestor runs twice for one click
**Cause:** It is registered for both **capture** and **bubble**.
**Fix:** Pick one. The options object and the boolean shorthand register separately.

**Symptom:** Delegation does not work for `focus`
**Cause:** `focus` and `blur` **do not bubble**.
**Fix:** Use `focusin`/`focusout`, which do.

**Symptom:** `e.currentTarget` is `null` in an async handler
**Cause:** It is only valid during dispatch.
**Fix:** Copy it to a local variable before the first `await`.

**Symptom:** `this` is not the element inside a handler
**Cause:** The handler is an **arrow function**, so `this` comes from the enclosing scope.
**Fix:** Use `e.currentTarget`, or a regular function.

**Symptom:** A click handler on a list gets the inner `<span>` instead of the row
**Cause:** `target` is the innermost element clicked, not the one you attached to.
**Fix:** `e.target.closest(".row")`.

**Symptom:** Something unrelated broke after adding a handler
**Cause:** `stopPropagation` — the event no longer reaches an ancestor's delegated handler,
router, or outside-click logic.
**Fix:** Remove it and have the ancestor filter on `e.target` instead.

**Symptom:** A link still navigates after `stopPropagation`
**Cause:** Propagation and default actions are **independent**. You wanted `preventDefault`.
**Fix:** `e.preventDefault()` — and do not add `stopPropagation` unless you also need it.

## Interview questions

**★ What are the three phases of event propagation?**
**Capture** (root down to the target), **target**, then **bubble** (target back up). MDN:
*"By default almost all event handlers are registered in the bubbling phase."* Capture exists
because Netscape and IE implemented opposite models and the W3C standardised both.

**★ What is the difference between `target` and `currentTarget`?**
`target` is what was actually clicked and *"remains the same while an event bubbles up"*.
`currentTarget` is *"the element to which the event handler has been attached"*, so it changes
for each handler along the path. With delegation you want `target` (usually via `closest`).

**★ Why is `currentTarget` `null` in my `setTimeout`?**
It is only valid during dispatch. Copy it into a local variable inside the handler before any
asynchronous boundary.

**★ Which events do not bubble?**
`focus`, `blur`, `load`, `error` and most media events. `focusin`/`focusout` exist as the
bubbling counterparts, which is what delegation for focus must use.

**★ Why avoid `stopPropagation`?**
It suppresses handlers written by code that does not know you exist — delegated handlers,
routers, analytics, outside-click logic — and the breakage appears somewhere else entirely.
Prefer having the ancestor filter on `e.target`.

**Is `preventDefault` the same as `stopPropagation`?**
No, and they are independent. `preventDefault` cancels the browser's default action; the event
keeps travelling. `stopPropagation` stops the travel; the default action still happens.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
