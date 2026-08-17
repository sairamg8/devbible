---
title: "Skeleton, spinner, or nothing"
sidebar_label: "01 · Skeleton, spinner, or nothing"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — Nielsen Norman Group, *Response Times: The 3 Important
> Limits* (the 0.1 s / 1 s / 10 s thresholds, after Miller 1968), MDN
> *`animation-fill-mode`* and *`animation-delay`*. Composes
> [chapter 4·01](../../phase-4-react-ui/01-useasync-and-the-api-client.md),
> [4·02](../../phase-4-react-ui/02-usedebounce-and-search.md) and
> [4·06](../../phase-4-react-ui/06-cart-state.md), which decide what the app is
> actually waiting for. No sandbox, no measured timings.

Before any shimmer is styled there is a decision, and getting it wrong is why
loading states so often make an app feel *slower*: **a loading indicator is a
cost, not a courtesy.** It occupies space, it draws the eye, and it announces
that the user is waiting — which they may not have noticed otherwise.

## The three thresholds

The durations that matter are perceptual, not technical, and they have been
stable since Miller's 1968 work:

| Duration | What the user perceives | What to show |
|---|---|---|
| **under ~0.1 s** | instantaneous — the app reacted to them | **nothing** |
| **~0.1 s to ~1 s** | a noticeable pause, but their train of thought holds | **nothing**, or the smallest possible in-place hint |
| **over ~1 s** | they have started waiting, and will look for reassurance | a skeleton or a spinner |
| **over ~10 s** | attention is gone; they will switch tasks | progress, and a way out |

**The most common mistake is showing an indicator in the second band.** A
request that resolves in 300 ms with a spinner reads as slower than the same
request with nothing at all, because the spinner appears, is registered, and
disappears — three visual events where there could have been zero.

## Choosing between them

Once something must be shown, the question is what:

| Show | When | Because |
|---|---|---|
| **A skeleton** | you know the **shape** of what is coming | it reserves the real layout, so arrival is a fill rather than a jump |
| **A spinner** | you know **something** is happening but not its shape or duration | it makes no promise about what will appear |
| **Nothing** | the update was optimistic, or it will land inside 1 s | there is nothing to reassure the user about |

**The shape is the deciding factor, not the duration.** A skeleton is a claim:
*this is what is about to be here.* When the claim is true it is the best
possible loading state, because the layout is already correct before the data
lands. When the claim is false — the list is empty, the request fails, the row
count is wildly different — the skeleton was a lie, and the correction is a
visible jolt.

### Where each one lands in this app

| Surface | Choice | Why |
|---|---|---|
| The catalog grid, first load | **skeleton** | the shape is known: a grid of cards ([topic 01 chunk 09](../01-the-product-grid/09-the-loading-state-and-announcements.md)) |
| The catalog grid, appending page 2 | **nothing, then a small spinner near the sentinel** | the existing content already occupies the layout; a full skeleton would imply a replacement |
| The search dropdown | **a small in-field spinner** | already in the [4·02 markup](../../phase-4-react-ui/02-usedebounce-and-search.md); the result count is unknown, so there is no shape to promise |
| The checkout submit | **an in-button spinner + disabled** | one action, unknown duration, and the button must stop accepting a second press |
| Cart quantity change | **nothing** | [chapter 4·06](../../phase-4-react-ui/06-cart-state.md) updates optimistically — the UI already shows the result |

That last row is the one worth internalising: **the best loading state is the one
you deleted by making the update optimistic.** A spinner on a cart increment is
a design admitting it chose to wait.

## Never show a loader before you have to

The second-band problem has a fix that costs no JavaScript at all. Render the
indicator immediately, but keep it invisible until the wait is real:

```css
@layer components {
  .loading-delay {
    animation: loading-appear 1ms 400ms forwards;
    opacity: 0;
  }

  @keyframes loading-appear { to { opacity: 1; } }
}
```

The element exists in the DOM from the moment the request starts, so there is no
mount and no reflow when it appears. `animation-delay: 400ms` holds it at
`opacity: 0`, and `animation-fill-mode: forwards` makes the final state stick.
**A response arriving in 300 ms is never accompanied by a flash**, because the
animation never reached its first frame.

Three reasons this beats a `setTimeout` in the component:

- **No timer to clear**, so no leak and no state update after unmount.
- **No re-render** — the appearance is a compositor concern, not a React one.
- **It is declarative and lives with the styling**, so the threshold is visible
  to whoever is changing how the indicator looks.

⚠️ **`opacity: 0` does not remove the element from the accessibility tree**, so
a screen reader may announce a status the sighted user cannot see yet. Pair this
with the live-region rules from
[topic 01 chunk 09](../01-the-product-grid/09-the-loading-state-and-announcements.md)
— announce from a `role="status"` region whose *text* changes, rather than
relying on the visibility of the indicator.

## The minimum-display problem, and why not to solve it in CSS

The mirror image: a skeleton that appears and vanishes within 50 ms produces a
flicker. The usual fix is a *minimum* display time — once shown, stay for at
least 300 ms.

That one genuinely belongs in the component, not the stylesheet, because it
depends on **when the response arrived**, which CSS cannot observe. Attempting
it with animation timing produces an indicator that either lingers after the
content or hides it, both of which are worse than the flicker.

**The delay above and a minimum display time solve different halves** and only
the first is a CSS concern. If the delay is set well, the second is rarely
needed — an indicator that only appears after 400 ms of waiting is, by
construction, one the user was already waiting for.

## Gotchas

- **Symptom:** the app feels slower after loading states were added.
  **Cause:** indicators are firing for sub-second requests, turning zero visual
  events into three. **Fix:** the delayed-appearance pattern, so nothing shows
  for the fast path.

- **Symptom:** a skeleton flashes and is instantly replaced. **Cause:** it is
  rendered the moment the request starts. **Fix:** as above — and if the request
  is reliably fast, question whether it needs an indicator at all.

- **Symptom:** the skeleton showed four cards and two products arrived; the
  layout visibly corrects itself. **Cause:** the skeleton promised a shape the
  data did not have. **Fix:** a skeleton is only appropriate where the shape is
  known; a grid of unknown length should render a modest fixed count and accept
  that it is a *placeholder*, not a prediction.

- **Symptom:** a spinner appears where the content will be, then the content
  appears somewhere else. **Cause:** the spinner did not occupy the content's
  box, so its removal changed the layout. **Fix:** either reserve the box or use
  a skeleton, which is what reserving the box amounts to.

- **Symptom:** a `setTimeout`-based delay logs a state-update-after-unmount
  warning. **Cause:** the timer outlived the component. **Fix:** the CSS delay
  has no timer to outlive anything.

- **Symptom:** a screen reader announces "loading" for a request that never
  visibly loaded. **Cause:** `opacity: 0` hides the indicator visually while
  leaving it in the accessibility tree. **Fix:** drive announcements from a
  live region's text content, not from the indicator's visibility.

- **Symptom:** the cart shows a spinner on every quantity change. **Cause:** a
  pessimistic update where the app already chose an optimistic one. **Fix:**
  none needed in CSS — the indicator should be deleted, because
  [chapter 4·06](../../phase-4-react-ui/06-cart-state.md) already applied the
  change locally.

- **Symptom:** the delay was implemented with `transition` instead of
  `animation` and nothing happens. **Cause:** a transition needs a property to
  change, and nothing is changing it. **Fix:** an animation with a delay and
  `fill-mode: forwards`, which runs on its own.

- **Symptom:** the indicator appears at the right time but disappears abruptly.
  **Cause:** only the appearance was designed. **Fix:** this is usually correct —
  the content replacing it is the transition. Fading a loader out *delays* the
  content, which is the opposite of the goal.

## Interview questions

1. **★ When should a loading indicator not be shown at all?** When the response
   arrives inside roughly one second, and always when it arrives inside 0.1 s.
   In that band an indicator turns a wait the user would not have registered
   into three visual events they will. The threshold is perceptual and has been
   stable since Miller's 1968 response-time work.

2. **★ Skeleton or spinner — what decides?** Whether you know the *shape* of
   what is coming, not how long it will take. A skeleton is a claim that this is
   what will be here; when the claim is true it is the best loading state
   available, because the layout is already correct. When the shape is unknown —
   search results, an arbitrary-length list — a spinner promises nothing and
   therefore cannot be wrong.

3. **★ How do you delay a loading indicator without a timer?** Render it
   immediately at `opacity: 0` and run a one-millisecond animation with a
   400 ms `animation-delay` and `animation-fill-mode: forwards`. A fast response
   never reaches the animation's first frame, so there is no flash — and there
   is no timer to clear, no re-render, and no state update after unmount.

4. **★ Why is a minimum display time a component concern rather than a CSS
   one?** Because it depends on when the response actually arrived, which CSS
   cannot observe. The stylesheet can delay an appearance because that is a
   function of elapsed time alone; keeping an indicator up *after* data has
   arrived requires knowing that it has.

5. **What makes a skeleton lie, and what does the lie cost?** A skeleton
   promising a shape the data does not have — four cards when two arrive, a
   populated list when the result is empty, content when the request failed. The
   cost is a visible correction at exactly the moment the user's attention
   returns to the screen, which is worse than having shown nothing.

6. **Why is an optimistic update the best loading state?** Because it removes
   the wait from the user's experience entirely: the UI shows the result
   immediately and reconciles in the background. A spinner on an action that
   could have been optimistic is a design choosing to make the user wait, and no
   amount of styling improves on not waiting.

7. **Why `animation` rather than `transition` for the delayed appearance?** A
   transition needs something to change the property, and nothing does — the
   element simply exists. An animation runs on its own from the moment it is
   applied, which is exactly the semantics required.

8. **Should a loading indicator fade out?** Usually not. The content replacing
   it is the transition, and fading the loader out means holding the content
   back for the duration of the fade — spending real time to smooth a moment the
   user was waiting to end.

9. **`opacity: 0` hides the indicator. Is it hidden from a screen reader too?**
   No — it remains in the accessibility tree and can still be announced, which
   is why announcements should come from a live region's changing text rather
   than from the indicator's presence. Visual hiding and semantic hiding are
   different tools and conflating them produces states announced but not shown.

---

Next → [Building the skeleton](02-building-the-skeleton.md)
