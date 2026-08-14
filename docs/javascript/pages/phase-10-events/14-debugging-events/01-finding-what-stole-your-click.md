---
title: "01 · Finding what stole your click"
sidebar_label: "01 · Finding what stole your click"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`Event.eventPhase`](https://developer.mozilla.org/en-US/docs/Web/API/Event/eventPhase), [`Event.composedPath()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath), [`Event.defaultPrevented`](https://developer.mozilla.org/en-US/docs/Web/API/Event/defaultPrevented), [`Event.isTrusted`](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener). Documentation-validated; ⚠️ the DevTools helpers below are **browser tooling, not web APIs** — they exist only in the console; **no timings**.

"The click does nothing and there is no error" is the hardest event bug, because nothing failed —
something else succeeded first. There are only a handful of possible culprits, and a fixed order to
eliminate them.

## The suspects, in order

1. **Nothing is listening.** The listener was registered on an element that has since been replaced
   — the re-render problem that delegation solves
   ([04 · Event delegation](../04-event-delegation/README.md)).
2. **Something called `stopPropagation()`** before the event reached your listener.
3. **Something called `preventDefault()`**, so the browser's action never happened — check
   `event.defaultPrevented`.
4. **Another element is on top.** The click is landing somewhere else entirely — an invisible
   overlay, a pseudo-element, a `::before` with dimensions.
5. **`pointer-events: none`** somewhere, so the element never receives it.
6. **The listener is passive**, so its `preventDefault()` was ignored
   ([11 · Default actions](../11-default-actions/01-what-preventdefault-costs.md)).
7. **It is a different element than you think** — `event.target` versus `event.currentTarget`, or a
   shadow root retargeting it
   ([Phase 9 · 18 · 03](../../phase-9-dom/18-shadow-dom-and-custom-elements/03-living-with-the-boundary.md)).

## The console helpers

⚠️ **These are DevTools console utilities, not JavaScript.** They do not exist in page code, and
availability differs between browsers — Chrome and Edge have all of them; Firefox has `monitorEvents`
in its console; treat them as debugging aids, never as something to ship.

```js
getEventListeners(document.querySelector('.card'))   // every listener, by type
monitorEvents(el, 'click')                           // log this element's clicks
monitorEvents(el, ['pointerdown', 'pointerup'])
unmonitorEvents(el)
$0                                                    // the element selected in Elements
getEventListeners($0)                                 // the two together — the fastest check
```

🔴 **`getEventListeners($0)` answers suspect 1 in one line.** If the array is empty, nothing is
listening, and the bug is registration, not propagation.

## Event-listener breakpoints

In the Sources panel, **Event Listener Breakpoints** pauses on any listener for a chosen event type
— including listeners inside libraries and third-party scripts you cannot grep for.

That is the tool for suspects 2 and 3: break on `click`, step through each listener in order, and
watch which one calls `stopPropagation()` or `preventDefault()`. The call stack names the file.

## Finding it from page code instead

When you cannot use the console — a mobile browser, a WebView, a customer's machine — a capture
listener at the top of the tree sees everything **before** anyone can stop it:

```js
document.addEventListener('click', (e) => {
  console.log({
    target: e.target,
    path: e.composedPath(),        // includes shadow internals
    phase: e.eventPhase,           // 1 capturing, 2 at target, 3 bubbling
    defaultPrevented: e.defaultPrevented,
    isTrusted: e.isTrusted,        // false ⇒ dispatched by script, not a user
  });
}, true);                          // ← capture: runs before any bubbling listener
```

Then the same listener in the **bubble** phase on `document`. The difference tells you exactly what
happened:

| Capture sees it | Bubble sees it | Conclusion |
|---|---|---|
| ✅ | ✅ | propagation is fine — the bug is in your handler or its condition |
| ✅ | ❌ | 🔴 something called `stopPropagation()` on the way up |
| ❌ | ❌ | the event never reached this tree — wrong element, overlay, or `pointer-events` |

`composedPath()[0]` is the true innermost target even through shadow DOM, and `eventPhase`
distinguishes capture (1), at-target (2) and bubble (3).

📌 **`isTrusted`** tells you whether a real user generated the event. `false` means script
dispatched it — useful when a test or a library is synthesising clicks and behaving differently
from a real one, because untrusted events do not trigger every default action.

## "The click lands somewhere else"

For suspects 4 and 5, stop guessing and ask the browser what is actually at that point:

```js
document.elementFromPoint(x, y);         // the topmost element there
document.elementsFromPoint(x, y);        // the whole stack, front to back
```

Run it with the coordinates you are clicking and the answer is usually an overlay you forgot — a
full-screen `<div>` for a closed modal, a sticky header with more height than it looks, a
decorative pseudo-element.

`pointer-events: none` makes an element transparent to input while remaining visible, which is the
fix for a decorative overlay — and, when applied too broadly, the cause of a button that cannot be
clicked at all.

## Reproducing it in a test

```js
el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
el.click();                                       // simpler, for elements that have it
```

⚠️ **A synthesised event is not identical to a real one.** `isTrusted` is `false`, and some default
actions and permission-gated APIs require genuine user activation. A test that passes with
`dispatchEvent` can still fail for a user — which is a reason to drive real input in end-to-end
tests rather than synthesising.

## Gotchas

**Symptom: the handler never runs, and `getEventListeners` shows nothing.**
Cause — the element was replaced after the listener was attached.
Fix — delegate from a stable ancestor.

**Symptom: the handler runs in capture but not in bubble.**
Cause — a listener in between called `stopPropagation()`.
Fix — event-listener breakpoints to find it; if it is your code, prefer a condition to stopping
propagation.

**Symptom: nothing sees the event at all.**
Cause — another element is on top, or `pointer-events: none` is on the target or an ancestor.
Fix — `document.elementsFromPoint(x, y)` at the click coordinates.

**Symptom: the handler runs but the browser's action does not happen.**
Cause — `preventDefault()` somewhere, or a passive listener whose cancel was ignored.
Fix — log `event.defaultPrevented`; check for `{ passive: false }` where a cancel is genuinely
needed.

**Symptom: the same click fires twice.**
Cause — listeners on both a child and an ancestor, or a listener registered twice on re-render.
Fix — `getEventListeners($0)` to count them; register with `{ signal }` and abort on teardown.

**Symptom: a library's synthetic click behaves differently from a real one.**
Cause — `isTrusted: false`; untrusted events do not carry user activation.
Fix — real input in end-to-end tests for anything gated on activation.

**Symptom: `getEventListeners` is not defined in your code.**
Cause — it is a DevTools console utility, not a web API.
Fix — use it only in the console; instrument with capture listeners in code.

## Interview questions

**★ A click handler does nothing and there is no error. How do you find out why?**
Check in order: is anything listening (`getEventListeners($0)`), did something call
`stopPropagation()` (capture versus bubble listeners on `document`), was the default prevented
(`event.defaultPrevented`), is another element on top (`elementsFromPoint`), and is
`pointer-events: none` in play.

**★ How do you prove `stopPropagation()` is the culprit?**
Register the same logger on `document` in capture and in bubble. If capture sees the event and
bubble does not, propagation was stopped in between — then use event-listener breakpoints to find
which listener did it.

**★ What is `event.isTrusted` for?**
It is `false` for events dispatched by script. It explains why a synthesised click behaves
differently from a real one, since untrusted events do not carry user activation.

**★ What does `composedPath()` give you that `target` does not?**
The full path including nodes inside shadow roots — `target` is retargeted to the host once the
event leaves the boundary, so `composedPath()[0]` is the real innermost element.

**★ Which of these debugging tools can you ship?**
None of the console utilities — `getEventListeners`, `monitorEvents` and `$0` are DevTools only.
Capture-phase logging and `elementsFromPoint` are real APIs, but belong behind a debug flag.

**Why would a click land on the wrong element?**
Something is on top of it — a leftover full-screen overlay, an oversized sticky header, or a
pseudo-element. `document.elementsFromPoint()` names the whole stack at that coordinate.

---

[Topic index](./README.md) · [Phase 10 index](../README.md) →
