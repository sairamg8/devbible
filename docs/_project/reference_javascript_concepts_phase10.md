---
name: devbible-javascript-concepts-phase10
description: Load-bearing claims and sources for JavaScript phase 10 — events and user input
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 10.*

Provenance: **documentation-validated** against MDN. No browser sandbox, no console blocks.
Phase 10 has **4 Master topics** (01–04) — **all complete**; 05–14 deferred.

## Topic 01 · The event model (commit `a889918`)

- Three phases: **capture** (root→target), **target**, **bubble** (target→root). MDN: *"By
  default almost all event handlers are registered in the bubbling phase."* Capture exists
  because Netscape/IE implemented opposite models and W3C standardised both — **vestigial by
  origin, not modern**.
- 🔴 **Not every event bubbles**: `focus`, `blur`, `load`, `error`, most media. That is why
  **`focusin`/`focusout`** exist, and why delegation for focus silently fails.
- 🔴 **`target` vs `currentTarget`** — the distinction the phase rests on. MDN: `target`
  *"remains the same while an event bubbles up"*; `currentTarget` is *"the element to which
  the event handler has been attached"*. **`currentTarget` is valid only during dispatch**
  (null in an async continuation → copy to a local). `this` in a non-arrow handler IS
  `currentTarget`. The mistake survives until you add delegation, because before that they
  are the same element.
- `stopPropagation` framed as **antisocial**: it suppresses handlers in code that doesn't know
  you exist (routers, analytics, outside-click), and the breakage appears elsewhere. Fix:
  the ancestor filters on `e.target`.

## Topic 02 · addEventListener (commit `9110365`)

Options: `capture` (false), `once` (false), `passive` (false*), `signal`.
- 🔴 **The identity asymmetry:** the **same named reference** added twice is *discarded*
  ("Not added again"); two identical **arrow literals** are two separate, unremovable
  listeners. → the "fires four times after four re-renders" bug. `.bind(this)` per call has
  the same problem.
- 🔴 **`signal` is the answer** — one `AbortController` per lifecycle, `abort()` in teardown.
  MDN itself recommends it *"instead of relying on `removeEventListener()`"*.
- `passive: true` = promise never to call `preventDefault()`, letting the browser start
  scrolling without waiting. 🔴 **Breaking the promise fails silently** (no effect + console
  warning).
- 🔴 **Root-node default:** `passive` defaults to **true** for `wheel`, `mousewheel`,
  `touchstart`, `touchmove` on `Window`/`Document`/`body` — MDN adds *"except Safari"*, and
  the page leaves that as a hedge rather than resolving it (rule 8).

## Topic 03 · The event object (commit `ef01a58`)

- Three **independent** decisions: origin (`target`/`currentTarget`), default action
  (`preventDefault`), propagation (`stop*`). MDN on preventDefault: *"The event continues to
  propagate as usual."*
- 🔴 **`return false` does nothing** in an `addEventListener` handler — inline attributes and
  jQuery only, where it meant both.
- `preventDefault` silently no-ops when: the event is **non-cancelable** (incl. `dispatchEvent`
  without `cancelable: true` — check `Event.cancelable`), or the listener is **passive**.
- `stopPropagation` stops ancestors; **`stopImmediatePropagation` also stops other listeners
  on the SAME element** → 🔴 one feature can silently disable another, decided by registration
  order. Never in shared code.
- Cooperative alternatives: parent checks `e.target.closest(...)`; child sets
  `preventDefault()` and parent checks **`defaultPrevented`**.
- `isTrusted` = diagnostic, **not a security control**. `composedPath()[0]` for shadow DOM.

## Topic 04 · Event delegation (commit `ca1951b`) — **PHASE 10 MASTER COMPLETE**

- MDN: *"a single listener to their parent"*. 🔴 **The listener count is the LEAST important
  reason.** Real reasons: survives re-renders (no re-attachment, no per-row leak), handles
  elements that don't exist yet (no insertion site can forget), one place to change behaviour.
  → correct for three rows, not just a thousand.
- 🔴 **Match with `closest`, not `target`** — the click lands on the icon/span. `matches` tests
  only the element itself. `closest` starts at the element and returns `null` (free guard).
- 🔴 **`closest` is not bounded by the listener's element** — walks to the document root; add
  `container.contains(match)`.
- `data-action` + a handler map for routing several actions from one listener.
- **Five failure modes:** non-bubbling events; **upstream `stopPropagation`** (usual cause of
  "delegation stopped working", usually someone else's code); detached targets; **shadow DOM
  retargeting**; hot events on deep trees.
- Attach **as close to the content as is stable**; `document` only for global concerns
  (router, outside-click) — which are exactly what a stray `stopPropagation` breaks.
