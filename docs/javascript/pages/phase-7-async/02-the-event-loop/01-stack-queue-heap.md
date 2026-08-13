---
title: "02.1 · Stack, queue, heap"
sidebar_label: "01 · Stack, queue, heap"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model). Documentation-validated.

**The event loop is three data structures and a loop.** MDN describes an *agent* — a
runtime instance — as maintaining exactly three facilities:

| Facility | What it holds | Order |
|---|---|---|
| **Heap** | objects — *"large, mostly unstructured memory region populated as objects are created"* | none |
| **Stack** | execution contexts — *"known as the call stack"* | **LIFO** |
| **Queue** | jobs — *"known in HTML as the event loop"* | **FIFO** |

MDN's note on the queue is the one to hold: it *"enables asynchronous programming while
being single-threaded"*.

## The loop itself

MDN:

> Every time, the agent pulls a job from the queue and executes it. When the job is
> executed, it may create more jobs, which are added to the end of the queue. Jobs can
> also be added via the completion of asynchronous platform mechanisms, such as timers,
> I/O, and events. **A job is considered completed when the stack is empty**; then, the
> next job is pulled from the queue.

Four things in that paragraph, each load-bearing:

1. **One job at a time**, pulled from the queue.
2. **A job can enqueue more jobs**, which go to the **end** — they do not interrupt.
3. **Jobs arrive from outside**, when a timer fires, I/O completes, or an event occurs.
4. 🔴 **A job is complete when the stack is empty.** That is the definition of
   run-to-completion, and it is why nothing else runs until your call stack unwinds
   fully.

The conceptual cycle:

1. Pull a job from the queue.
2. Push an execution context onto the stack and run it.
3. Run until the stack is **empty**.
4. Back to step 1, or wait if the queue is empty.

## Tracing a program through it

```js
console.log("A");

setTimeout(() => console.log("B"), 0);

Promise.resolve().then(() => console.log("C"));

console.log("D");
```

- **`"A"`** — synchronous, runs on the current stack.
- **`setTimeout`** — hands the callback to the platform timer and returns. Nothing is
  queued yet.
- **`.then`** — the promise is already resolved, so the callback is queued as a
  **microtask**.
- **`"D"`** — still the same job, still the same stack.
- The stack empties. **The job is complete.**
- Microtasks drain first → **`"C"`**.
- Then the task queue → **`"B"`**.

Output: `A D C B`. The full ordering rules are
[topic 03](../README.md); what matters here is *why* — `B` and `C` could not run earlier
because **the first job was not finished until the stack was empty**.

## Why a job cannot be interrupted

```js
const start = Date.now();
setTimeout(() => console.log("timer"), 10);
while (Date.now() - start < 1000) {}   // 1 second of synchronous work
console.log("loop done");
```

The timer fires internally at 10 ms — and its callback sits in the queue until the
current job ends. Output is `loop done` then `timer`, about a second later.

🔴 **`setTimeout(fn, 10)` means "not before 10 ms", never "at 10 ms".** The delay is a
*minimum*: the callback also waits for the current job, every job queued ahead of it,
and the entire microtask queue. Timer delay is a floor, not a schedule.

The same reasoning explains the frozen-UI case from
[topic 01](../01-sync-vs-async/01-one-thread.md): rendering is work the platform schedules
*between* jobs, so a job that never ends is a page that never repaints.

## Where jobs come from

- **Platform completions** — a timer elapsing, a network response arriving, a file read
  finishing, an event firing.
- **Your own code** — `.then` callbacks, `queueMicrotask`, `await` continuations.

Both land in the same queueing system; only the **priority** differs, which is what
"microtask" and "task" name. MDN: *"Jobs might not be pulled with uniform priority — for
example, HTML event loops split jobs into two categories: tasks and microtasks.
Microtasks have higher priority and the microtask queue is drained first before the task
queue is pulled."*

## The stack, and what it costs

The stack is where "stack overflow" comes from:

```js
function recurse(n) { return recurse(n + 1); }
recurse(0);   // RangeError: Maximum call stack size exceeded
```

Each call pushes a context; the stack has a finite size. **JavaScript has no tail-call
optimisation in practice** — the specification defines proper tail calls but V8 does not
implement them — so deep recursion is bounded regardless of how you write it. Convert to
iteration, or a trampoline.

Two consequences worth carrying:

- **An async continuation starts a fresh stack.** After `await`, the stack from before is
  gone, which is why async stack traces used to be useless and why runtimes now stitch
  them together artificially.
- **A job's stack must fully unwind** before the next job runs — the same rule as above,
  seen from the other side.

## Node and the browser differ

Both have an event loop; they are not the same event loop. Node's is libuv's, with
distinct **phases** (timers, pending callbacks, poll, check, close) and two extra
queues — `process.nextTick` and the microtask queue — drained between phases. The browser's
is defined by the HTML specification and additionally schedules **rendering**.

The parts covered here — one job at a time, run-to-completion, microtasks before tasks —
hold in both. The differences (`setImmediate` vs `setTimeout(…, 0)` ordering,
`process.nextTick` priority) are runtime specifics, and this page does not assert an
ordering that documentation for *both* runtimes does not agree on.

## Gotchas

**Symptom:** A `setTimeout(fn, 0)` callback runs much later than 0 ms
**Cause:** The delay is a **minimum**. The callback waits for the current job, everything
queued ahead of it, and the whole microtask queue.
**Fix:** Expected. Do not use timers for precise timing.

**Symptom:** The page does not repaint during a long loop
**Cause:** Rendering is scheduled **between jobs**, and *"a job is considered completed
when the stack is empty"*.
**Fix:** Chunk the work and yield between pieces, or use a worker.

**Symptom:** `RangeError: Maximum call stack size exceeded`
**Cause:** The stack is finite and V8 does not implement tail-call optimisation.
**Fix:** Convert to iteration, or a trampoline.

**Symptom:** A stack trace after `await` is missing the calling frames
**Cause:** An async continuation resumes on a **fresh stack**; the original has unwound.
**Fix:** Rely on the runtime's async stack stitching, and keep `async` functions named.

**Symptom:** Ordering differs between Node and the browser
**Cause:** They implement different event loops — libuv phases with `process.nextTick`
versus the HTML specification's loop with rendering.
**Fix:** Do not depend on cross-runtime ordering beyond "microtasks before tasks".

## Interview questions

**★ What is the event loop?**
The mechanism that pulls **jobs** from a FIFO queue and runs each on the **call stack**
until that stack is empty, then pulls the next. MDN describes an agent as having exactly
three facilities — a **heap** of objects, a **stack** of execution contexts, and a
**queue** of jobs.

**★ When is a job considered complete?**
MDN: *"A job is considered completed when the stack is empty."* That is the precise
statement of run-to-completion, and it is why nothing else — no timer, no event, no
rendering — can run until your call stack fully unwinds.

**★ Does `setTimeout(fn, 0)` run after 0 ms?**
No. The delay is a **minimum**. The callback must wait for the current job to finish, for
every job already queued, and for the entire microtask queue to drain. A one-second
synchronous loop delays a 10 ms timer by a second.

**★ Why does a long loop freeze the UI?**
Because rendering is work the platform schedules **between jobs**, and a job is not
complete until the stack is empty. A job that never ends is a page that never repaints.

**Where do jobs come from?**
Platform completions — timers, I/O, events — and your own code: `.then` callbacks,
`queueMicrotask`, and `await` continuations. They differ only in **priority**: microtasks
are drained before the task queue is pulled.

**Why does deep recursion overflow even when written tail-recursively?**
Because V8 does not implement proper tail calls, despite the specification defining them.
The stack is finite and every call pushes a context. Use iteration or a trampoline.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
