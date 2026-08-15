---
title: "02 · Frames: requestAnimationFrame and the rendering step"
sidebar_label: "02 · Frames"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Window.requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`Window.cancelAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelAnimationFrame), [`DOMHighResTimeStamp`](https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp), [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API), [`Element.animate()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) — and the [HTML Standard § Event loop: processing model](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model). Documentation-validated; **no timings and no console output**.

A timer schedules against a clock. `requestAnimationFrame` schedules against **the screen** —
it asks the browser to run a callback in the rendering step of the very next frame, just
before style, layout and paint. That single difference is why it is the only correct place
to move something.

## Where the callback runs

Each turn of the event loop can end in an **update-the-rendering** step, and the browser runs
it at roughly the display's refresh rate rather than after every task. Inside that step, in
order:

1. **Animation frame callbacks run** — every `requestAnimationFrame` callback registered
   before this frame, in registration order.
2. Style is recalculated, layout runs, the frame is painted and composited.

🔴 **Two consequences follow from that ordering, and they are the whole topic.** Your write
lands in the *same* frame the browser is about to paint, so nothing is ever displayed one
frame stale — and if the browser is not painting at all (a hidden tab), your callback is
simply not called, which is exactly right for work whose only purpose is to be seen.

```js
const id = requestAnimationFrame(step);
cancelAnimationFrame(id);
```

## `rAF` fires **once**

There is no repeating form. An animation is a callback that re-requests itself, and it stops
by not re-requesting:

```js
let running = true, id;

function step(now) {          // now: a DOMHighResTimeStamp
  draw(now);
  if (running) id = requestAnimationFrame(step);
}
id = requestAnimationFrame(step);

function stop() { running = false; cancelAnimationFrame(id); }
```

**Set the flag *and* cancel.** Cancelling alone leaves a callback that a queued re-request
may have already scheduled; the flag alone leaves one final callback to run.

## The timestamp is the argument — use it

The callback receives a `DOMHighResTimeStamp` on the same clock as `performance.now()`, and
**every callback in the same frame receives the same value**. It is not "now" at the moment
your function runs; it is the moment the frame's callbacks began. That is a feature: two
animations driven in the same frame agree on what time it is.

🔴 **Drive animation from elapsed time, never from a frame count.**

```js
// ❌ assumes 60 Hz — runs half speed on a 120 Hz display, and drifts everywhere
let x = 0;
function bad() { x += 2; move(x); requestAnimationFrame(bad); }

// ✅ position is a function of time, so the speed is the same on every display
const SPEED = 120;                       // pixels per second
let start;
function good(now) {
  start ??= now;
  const seconds = (now - start) / 1000;
  move(Math.min(SPEED * seconds, target));
  if (SPEED * seconds < target) requestAnimationFrame(good);
}
requestAnimationFrame(good);
```

⚠️ **Refresh rates are not 60 Hz any more.** MDN says the callback rate *generally matches the
display refresh rate*; phones and laptops ship 90, 120 and 144 Hz panels, and variable-refresh
displays change it while the page is running. Any code containing `16`, `16.7` or `1000/60`
is asserting a hardware fact it cannot know.

## What happens in a background tab

**`requestAnimationFrame` is paused in most browsers when the page is in a background tab or
a hidden `<iframe>`.** MDN states it plainly, and it is the correct behaviour — nobody is
looking.

Two things follow:

- **A frame-counting animation drifts against wall-clock time**, because it stops accruing
  while hidden. A time-driven one resumes correct: it recomputes from the timestamp.
- 🔴 **A time-driven animation resumed after a long hide jumps.** `now - last` is suddenly
  enormous, and a physics step or a `+= delta` integration teleports. Clamp the delta:

```js
function step(now) {
  const delta = Math.min(now - last, 100);   // never integrate more than ~100 ms at once
  last = now;
  advance(delta);
  requestAnimationFrame(step);
}
```

**Never use `rAF` as a heartbeat for non-visual work** — polling, saving, session timers.
It stops when hidden, which for visual work is the point and for everything else is a bug.
Those belong to a timer ([01](./01-timers.md)) or, better, to something that is not polling
at all.

## `rAF` is not always the right tool — and often is not

| The animation | Use |
|---|---|
| Moving, fading, scaling an element | **CSS transition/animation**, or `Element.animate()` |
| Springs and physics driven by input | `requestAnimationFrame` |
| Canvas or WebGL rendering | `requestAnimationFrame` |
| A value that must change per frame (a counter, a progress readout) | `requestAnimationFrame` |
| Reacting to scroll position | `IntersectionObserver`, or scroll-driven CSS animations |

🔴 **Prefer CSS and the Web Animations API for anything they can express.** A `transform`/
`opacity` animation there can be handled by the compositor, so it keeps running smoothly even
while the main thread is busy — a `rAF` loop is *on* the main thread, so a long task freezes
it by definition. `Element.animate()` gives you the CSS engine with a JavaScript API,
including `.pause()`, `.cancel()`, `.finished` and playback rate:

```js
const anim = box.animate(
  [{ transform: 'translateX(0)' }, { transform: 'translateX(200px)' }],
  { duration: 300, easing: 'ease-out', fill: 'forwards' }
);
await anim.finished;
```

Reach for `rAF` when the value cannot be expressed as a keyframe — because it depends on a
pointer, on a simulation, or on data arriving.

## Reads and writes inside the callback

The frame callback is the right place to **write**. It is a dangerous place to interleave
reads, because reading a layout property after a write forces the browser to lay out
immediately, inside the frame it was about to paint:

```js
// ❌ read → write → read → write: a forced synchronous layout per item
for (const el of items) el.style.height = `${el.getBoundingClientRect().width}px`;

// ✅ read everything, then write everything
const widths = items.map((el) => el.getBoundingClientRect().width);
requestAnimationFrame(() => items.forEach((el, i) => (el.style.height = `${widths[i]}px`)));
```

The full argument, and the list of properties that force layout, is in
[Phase 9 · 12 · The forced reflow](../../phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md)
and [Phase 9 · 11 · Batching DOM work](../../phase-9-dom/11-batching-dom-work/README.md).

## Two patterns worth knowing

**"After the browser has painted."** A frame callback runs *before* paint, so work that must
happen after the pixels are on screen is a timer scheduled from inside the frame:

```js
requestAnimationFrame(() => setTimeout(() => measureAfterPaint(), 0));
```

**Starting a transition on a newly added element.** A transition only runs when the browser
has seen the *old* value; setting both in the same task means it sees only the new one. Two
common fixes: force a style flush by reading a layout property, or set the second value in a
later frame.

```js
el.classList.add('enter');
el.getBoundingClientRect();          // forces the old style to be computed
el.classList.add('enter-active');    // now there is something to transition from
```

⚠️ **The nested double-`rAF` version of this is folklore, not specification.** It works
because the second callback lands in a later frame, and it is fine — but the layout read
above says what it is doing, which the nested version does not.

## Do not use `rAF` to throttle `scroll`

MDN is explicit that `requestAnimationFrame` is **useless as a scroll throttle**: frame
callbacks fire at the same rate as scroll events, so wrapping the handler changes nothing.
The full treatment is in
[Phase 10 · 09 · The high-frequency events](../../phase-10-events/09-scroll-resize-visibility/01-the-high-frequency-events.md).

**`rAF` is also browser-only.** There is no `requestAnimationFrame` in Node — there is no
display to synchronise with. Code shared between the two has to guard it, which is
**12 · Feature detection** *(not written yet)*.

## Gotchas

**Symptom: the animation runs at double speed on a new phone.**
Cause — the step is a fixed pixel increment per callback, and the display is 120 Hz.
Fix — compute the position from the timestamp; a fixed increment per frame is a bug on any
display you have not tested.

**Symptom: the animation teleports when the user comes back to the tab.**
Cause — `rAF` was paused while hidden, so the first resumed delta covers the whole absence.
Fix — clamp the delta, or reset the baseline on `visibilitychange`.

**Symptom: a `rAF`-driven progress bar stops updating in a background tab.**
Cause — that is documented behaviour, not a bug.
Fix — if the value must keep advancing, own the state in a timer or recompute it on return;
`rAF` only ever drives what is visible.

**Symptom: the animation stutters whenever the app does work.**
Cause — the `rAF` loop is on the main thread, and a long task blocks it.
Fix — move the animation to CSS or `Element.animate()` so the compositor can run it, and move
the work off the main thread (**07 · Web Workers** *(not written yet)*).

**Symptom: cancelling the loop does not stop it.**
Cause — a re-request had already scheduled the next callback, or two loops were started.
Fix — keep the id in one place, cancel it, and guard re-requests with a flag.

**Symptom: a class change produces no transition.**
Cause — the old and new values were both set inside one task, so there was nothing to
transition from.
Fix — force a style flush with a layout read between them, or apply the second value in a
later frame.

**Symptom: frames are janky despite all the work being inside `rAF`.**
Cause — reads and writes are interleaved, forcing a synchronous layout per iteration.
Fix — read everything first, then write; see Phase 9 · 12.

## Interview questions

**★ Why animate in `requestAnimationFrame` rather than `setInterval(fn, 16)`?**
Because `rAF` is scheduled by the browser's rendering step, so the write lands in the frame
about to be painted, the rate matches the actual display refresh rather than a guessed 60 Hz,
and it pauses in background tabs instead of burning battery on frames nobody sees. A timer
does none of those and drifts against the frame boundary, which shows up as stutter.

**★ What is the argument to the callback, and why not use `performance.now()` instead?**
A `DOMHighResTimeStamp` marking when the frame's callbacks began, on the same clock as
`performance.now()`. Every callback in the frame receives the same value, so independent
animations stay in agreement; calling `performance.now()` yourself gives each one a slightly
different "now".

**★ Your animation is smooth on your laptop and twice as fast on a 120 Hz phone. What is wrong?**
It advances by a fixed amount per callback. Speed must be derived from elapsed time —
`pixels_per_second × seconds` — so that the number of frames does not change the result.

**★ When would you use CSS or `Element.animate()` instead of `rAF`?**
Whenever the animation can be expressed as keyframes. Those can be run by the compositor, so
they survive a busy main thread; a `rAF` loop cannot, because it *is* main-thread work. Keep
`rAF` for values that depend on input, a simulation, or canvas drawing.

**★ How do you run something after the browser has actually painted?**
Schedule a task from inside a frame callback — `requestAnimationFrame(() => setTimeout(fn, 0))`.
The frame callback itself runs before style, layout and paint, so it is too early.

**Does `requestAnimationFrame` exist in Node?**
No. It is tied to a display, so a shared module has to feature-detect it and fall back to a
timer.

---

← [01 · Timers](./01-timers.md) · [Topic index](./README.md)
