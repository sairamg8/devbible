---
title: "01 · The browser loop and the rendering steps"
sidebar_label: "01 · The browser loop"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the [HTML Standard § Event loops — processing model](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model) and [§ Microtask queue](https://html.spec.whatwg.org/multipage/webappapis.html#microtask-queue), and MDN — [The event loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Execution_model), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`requestIdleCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback). Documentation-validated; **no timings, no console blocks**.

⚠️ **The core loop is Master material.** The call stack, the queues and the drain order are
[02 · The event loop](../02-the-event-loop/01-stack-queue-heap.md) and
[03 · The drain order](../03-microtasks-vs-macrotasks/01-the-drain-order.md). **This page adds
the part those did not need: where *rendering* fits**, which is the half of the browser loop that
has no counterpart in Node.

## One turn of the browser's loop

The HTML Standard's processing model, reduced to what a developer acts on:

1. **Pick one task** from a task queue and run it to completion.
2. **Microtask checkpoint** — drain the microtask queue entirely, including microtasks queued
   during the drain.
3. **If this is a rendering opportunity, update the rendering**:
   - run **`requestAnimationFrame`** callbacks
   - deliver **`ResizeObserver`** notifications
   - recalculate style, run layout, paint
4. If there is spare time, run **idle callbacks**. Then repeat.

🔴 **Three consequences, and they explain most "why did that not update" questions:**

**One task per turn.** A long task delays everything — the next task, the timers, the input
events, and the frame. There is no preemption; the loop cannot take the thread back.

**Microtasks run before rendering, always.** Anything you defer with `queueMicrotask` or a
`.then` happens *before* the browser has a chance to paint, which is why a spinner set right
before deferred work never appears ([18 · Choosing a deferral](../18-queuemicrotask/01-choosing-a-deferral.md)).

**Rendering is not once per task.** Step 3 happens only at a *rendering opportunity*, which the
browser decides — tied to the display's refresh and skipped entirely when the page is not
visible. Ten tasks can run between two paints, and a hidden tab may not paint at all.

## `requestAnimationFrame` is a step of the loop, not a queue you poll

Because rAF callbacks run inside the rendering step, they have properties no timer can have:

| | `requestAnimationFrame` | `setTimeout(fn, 16)` |
|---|---|---|
| Runs | inside the rendering step, **before paint** | as a task, whenever the loop reaches it |
| Aligned to the display | ✅ | ❌ |
| In a hidden tab | **stops entirely** | throttled, but keeps firing |
| Gets a timestamp | ✅ the frame's time | ❌ |
| Two writes in one frame | coalesced into that frame | may straddle two frames |

**A style write from inside `rAF` lands in the same frame; a style write from a timer may land in
the next one.** That is the whole reason animation belongs in `rAF`
([12 · Drift and repeating work](../12-timers/03-drift-and-repeating-work.md)).

⚠️ **"Two nested `rAF`s" is the idiom for *after* the paint**, because the first callback still
runs before this frame's paint. Reach for it when you need the rendered result — a transition
that must start from a committed style, a measurement after a class change.

## Where each thing you schedule actually lands

| You called | It runs |
|---|---|
| `queueMicrotask`, `.then`, `await` continuation | step 2 — the microtask checkpoint, before any rendering |
| `MutationObserver` callback | step 2 — it is a microtask |
| `setTimeout` / `setInterval` | step 1 of a later turn — a task |
| a dispatched event's listeners | step 1 — event dispatch is a task |
| `requestAnimationFrame` | step 3, before paint |
| `ResizeObserver` callback | step 3, before paint |
| `requestIdleCallback` | step 4, only if there is time left |

🔴 **There is more than one task queue, and the browser chooses between them.** The
specification lets a browser prioritise, say, user input over timers. So "the task queue" is a
simplification: ordering *within* one queue is guaranteed, ordering *between* queues is the
browser's call. Never write code that depends on a timer beating an input event.

## What this predicts, in practice

**A long task blocks input, not just animation.** A click during a 500 ms task is not lost — it
waits, then fires. The user experiences it as a dead button and clicks again, which is where
[17 · Double submit](../17-race-conditions-ui/02-the-other-races.md) comes from.

**Batching writes is automatic, reading is what breaks it.** Style and layout happen once, in
step 3 — unless you force layout by reading a geometry property mid-task, which is
[Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/02-fixing-it.md).

**Yielding needs a task boundary.** Splitting work so the page stays responsive means letting the
loop reach step 3, and only a task does that — hence `setTimeout(fn, 0)`, `MessageChannel`, or
`scheduler.yield()` where available.

## Gotchas

**Symptom: a DOM change made in a loop is never seen mid-loop.**
Cause — rendering happens at step 3, after the task finishes; there is no repaint inside a task.
Fix — split the work across tasks if intermediate states must be visible.

**Symptom: an animation stutters even though the callback is cheap.**
Cause — it is timer-driven, so it is not aligned to the frame.
Fix — `requestAnimationFrame`, driven by its timestamp.

**Symptom: a transition does not run when a class is added right after an element is inserted.**
Cause — the starting style was never rendered, so there is nothing to transition from.
Fix — nested `requestAnimationFrame`, so the change happens after a paint.

**Symptom: clicks feel dead, then all fire at once.**
Cause — a long task; the events queued behind it.
Fix — break the work into tasks, or move it to a Worker.

**Symptom: `requestIdleCallback` work never happens.**
Cause — step 4 only runs when there is spare time.
Fix — pass a `timeout`, or use a prioritised task.

**Symptom: an ordering that holds in one browser fails in another.**
Cause — you relied on ordering *between* task queues, which is browser-chosen.
Fix — depend only on the microtask-before-task guarantee, and on ordering within one queue.

## Interview questions

**★ Describe one turn of the browser's event loop.**
Run one task to completion, drain the entire microtask queue, then — if this is a rendering
opportunity — run animation-frame callbacks and resize observations, recalculate style, lay out
and paint. Idle callbacks last, if there is time.

**★ Does the browser render between every task?**
No. Rendering happens at rendering opportunities, which the browser picks based on the display
refresh, and not at all when the page is hidden. Several tasks can run between paints.

**★ Where do microtasks run relative to rendering?**
Always before it — the checkpoint is between the task and the rendering step. That is why
deferring with a microtask never lets the browser paint.

**★ Why use `requestAnimationFrame` instead of a 16 ms timer?**
It runs inside the rendering step, before paint, aligned to the display, with a timestamp, and it
stops in a hidden tab. A timer has none of those properties.

**★ Why do people use two nested `requestAnimationFrame` calls?**
Because the first callback still runs before this frame's paint. Nesting gets you to *after* the
paint — needed when a transition must start from a rendered style.

**★ Can you rely on a `setTimeout(fn, 0)` running before a queued click handler?**
No. Ordering within a task queue is guaranteed; ordering between different task queues is the
browser's choice.

**What single fact explains "my UI froze"?**
One task runs to completion with no preemption, so anything long blocks rendering *and* input.

---

[Topic index](./README.md) · [02 · The Node loop](./02-the-node-loop.md) →
