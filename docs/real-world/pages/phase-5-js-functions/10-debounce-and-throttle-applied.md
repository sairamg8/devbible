---
title: "Debounce and throttle, applied"
sidebar_label: "10 · Debounce & throttle, applied"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against MDN —
> [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
> and [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
> Concept home: **what each one is and how to choose** is
> [JavaScript 3·10](../../../javascript/pages/phase-3-functions/10-debounce-and-throttle.md);
> the **from-scratch implementations** are
> [JavaScript 17·03](../../../javascript/pages/phase-17-machine-coding/03-debounce-throttle/README.md)
> ([debounce](../../../javascript/pages/phase-17-machine-coding/03-debounce-throttle/01-debounce.md) ·
> [throttle](../../../javascript/pages/phase-17-machine-coding/03-debounce-throttle/02-throttle.md)).
> **This chapter implements neither.** It is the map of which one each
> interaction in the storefront gets, and why.

## The decision rule, in one line each

- **Debounce** — *"do it once the noise stops."* The last call wins; everything
  before it is discarded. Correct when only the final state matters.
- **Throttle** — *"do it at most this often."* Calls are sampled at a rate;
  intermediate values are seen. Correct when the ongoing values matter.

The question that separates them is not "how often does this fire" but
**"would skipping the intermediate values lose anything?"** If yes, throttle.
If no, debounce.

## The storefront's inventory

Every rate-limited interaction in the app, and the reason:

| Interaction | Choice | Why |
|---|---|---|
| **Search box** ([4·02](../phase-4-react-ui/02-usedebounce-and-search.md)) | Debounce ~300 ms | Only the final query matters. Results for `lap` are noise on the way to `laptop` |
| **Email-availability check** ([5·05](05-the-validation-engine.md)) | Debounce ~500 ms | Same shape, longer wait — the check is advisory and the round trip is not free |
| **Cart quantity stepper** | Debounce ~400 ms | Tapping `+` four times is one intent, and the server should see quantity 4, not 1→2→3→4 |
| **Autosaving a review draft** | Debounce ~1 s | Only the latest text matters; saving every keystroke is pure waste |
| **Infinite scroll** ([4·03](../phase-4-react-ui/03-the-infinite-product-list.md)) | Neither — `IntersectionObserver` | The browser already answers "is the sentinel visible" without a scroll handler at all |
| **Sticky header on scroll** | Throttle, via `rAF` | Every frame's position matters; skipping to the last one would freeze the header mid-scroll |
| **Analytics scroll depth** | Throttle ~1 s | Intermediate depths *are* the data; debouncing would record only where the user stopped |
| **Grid reflow on resize** | Throttle, via `rAF` | The layout should track the drag, not snap once it ends |
| **Admin drag-to-reorder** | Throttle, via `rAF` | Visual feedback must be continuous |

🔴 **Two entries in that table are the interesting ones.** Infinite scroll gets
*neither* primitive, because `IntersectionObserver` removes the scroll handler
that would have needed throttling — the best rate limit is the event you never
subscribe to. And analytics is the one place debounce would be actively wrong:
it would discard exactly the intermediate values the measurement exists to
collect.

## Visual work uses `requestAnimationFrame`, not a timer

For anything that moves pixels, a `setTimeout`-based throttle is the wrong
clock. It fires on its own schedule and the browser paints on its own, so the
two drift and the result is visible judder.

`rAF` throttling runs the handler at most once per frame, aligned to the paint:

```js
// src/lib/raf-throttle.js — the shape, not a general-purpose utility
export function rafThrottle(fn) {
  let frame = null;
  const wrapped = (...args) => {
    if (frame !== null) return;                  // already scheduled this frame
    frame = requestAnimationFrame(() => { frame = null; fn(...args); });
  };
  wrapped.cancel = () => {
    if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
  };
  return wrapped;
}
```

⚠️ **`rAF` does not fire in a background tab.** That is the right behaviour for
animation and the wrong behaviour for anything that must keep running — which
is another reason analytics uses a timer-based throttle rather than this.

## Debounce delays are a product decision

The numbers in the table are not universal constants; they trade responsiveness
against load, and the right value depends on what the wait costs the user:

- **Shorter** when the user is watching the result — search feels broken above
  roughly half a second.
- **Longer** when the work is expensive or advisory — the availability check
  can afford to wait, because nothing is blocked on it.
- **Longer still** when the result is invisible — an autosave nobody is
  watching can wait a second.

The delay belongs next to the call site with a comment saying which of those
three it is, not in a shared constants file where it becomes a number nobody
can change safely.

## Cancel on unmount, always

Every one of these holds a pending timer or frame, and a pending callback that
fires after its component is gone either throws or updates state that no longer
exists.

```js
useEffect(() => {
  const handler = rafThrottle(onScroll);
  window.addEventListener('scroll', handler, {passive: true});
  return () => { handler.cancel(); window.removeEventListener('scroll', handler); };
}, [onScroll]);
```

⚠️ **`{passive: true}` is not decoration.** It tells the browser the handler
will not call `preventDefault`, which lets scrolling continue without waiting
for it. Omitting it on a scroll listener costs scroll smoothness on touch
devices even when the handler is throttled.

## Rate limiting is not deduplication

A debounce reduces how many requests are *made*. It does not stop two of them
racing — a slow response to `lap` can still land after a fast response to
`laptop` and overwrite the newer results.

That is a different problem with a different fix, and it lives in the
[fetch wrapper](01-the-fetch-wrapper.md): dedupe in-flight requests by key, and
cancel superseded ones with an `AbortSignal`. **Both are needed.** Debounce
alone leaves the race; cancellation alone sends far more requests than
necessary.

## Gotchas

**Symptom:** Search results flash an older query's results
**Cause:** Debounce without cancellation — responses arrive out of order
**Fix:** Abort the superseded request; debounce is not an ordering mechanism

**Symptom:** A debounced submit button double-fires
**Cause:** Debouncing a submit at all — the trailing call fires after the user
has already navigated
**Fix:** Submits are guarded by disabling and idempotency, never by a timer

**Symptom:** Scroll animation stutters despite a 16 ms throttle
**Cause:** A timer-based throttle drifting against the paint clock
**Fix:** `rAF`, which is aligned to the frame by construction

**Symptom:** Analytics under-reports scroll depth
**Cause:** Debounced instead of throttled — intermediate depths discarded
**Fix:** Throttle; the intermediate values are the measurement

**Symptom:** "Cannot update state on an unmounted component"
**Cause:** A pending timer or frame fired after teardown
**Fix:** `cancel()` in the effect's cleanup, every time

**Symptom:** A background tab stops recording analytics
**Cause:** `rAF`-based throttling, which does not run in background tabs
**Fix:** A timer-based throttle for non-visual work

**Symptom:** Scrolling feels heavy on mobile
**Cause:** A non-passive scroll listener
**Fix:** `{passive: true}` — throttling alone does not fix it

**Symptom:** The cart shows 4 but the server received 1
**Cause:** The debounced update sent the first value rather than the latest
**Fix:** Debounce must call with the *last* arguments, which is what the
trailing edge means — see [17·03 chunk 1](../../../javascript/pages/phase-17-machine-coding/03-debounce-throttle/01-debounce.md)

**Symptom:** Changing a shared `DEBOUNCE_MS` constant breaks an unrelated screen
**Cause:** One number serving three interactions with different requirements
**Fix:** Per-call-site delays with a reason attached

## Interview questions

1. **★ What single question separates debounce from throttle?** Whether
   skipping the intermediate values loses anything. If the intermediate values
   are the data — scroll depth, a drag path — throttle. If only the final state
   matters — a search term, a draft — debounce.
2. **★ Where in this app would debounce be actively wrong, and why?** Analytics
   scroll depth. Debouncing records only where the user came to rest, which
   deletes the very measurement the feature exists to take. Throttling samples
   the journey.
3. **★ Debounce reduced the request count and results still flash stale. Why?**
   Because rate limiting is not ordering. Two requests can still be in flight,
   and a slow earlier response can land after a fast later one. The fix is
   cancellation or dedupe by key, not a longer delay.
4. **Why use `requestAnimationFrame` rather than a 16 ms timer for scroll
   work?** A timer runs on its own schedule and drifts against the browser's
   paint, producing judder. `rAF` is aligned to the frame by construction, and
   it also stops running when the tab is hidden — correct for animation,
   which is work nobody can see.
5. **When is that background-tab behaviour a bug rather than a feature?** For
   anything non-visual that must keep running — analytics, heartbeats,
   polling. Those need a timer-based throttle, precisely because `rAF` stops.
6. **Why does infinite scroll use neither primitive?** Because
   `IntersectionObserver` answers "is the sentinel visible" without a scroll
   handler existing at all. The cheapest rate limit is not subscribing to the
   event.
7. **Why is debouncing a submit button wrong?** The trailing call fires after
   the delay, by which time the user may have navigated or clicked again, and
   the guarantee they need is "exactly once" rather than "not too often".
   Disable the control and make the endpoint idempotent.
8. **Why keep delays at call sites rather than in a shared constants file?**
   Because the correct delay follows from what the wait costs *that*
   interaction — visible result, advisory check, invisible autosave — and a
   shared constant couples three unrelated requirements so that tuning one
   silently changes the others.

---

← Prev: [Optimistic-update helpers](09-optimistic-update-helpers.md) ·
[Phase overview](README.md) — 🏁 **this closes Phase 5**
