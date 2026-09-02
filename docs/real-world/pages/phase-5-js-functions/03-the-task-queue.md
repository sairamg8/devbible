---
title: "The concurrency-limited task queue"
sidebar_label: "03 · The task queue"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against MDN. Concept home:
> [JS — a concurrency-limited task queue](../../../javascript/pages/phase-17-machine-coding/07-task-queue/README.md)
> builds the primitive from scratch; this chapter is where the storefront
> actually uses it — and what the *application* adds that the primitive
> doesn't have.

## The problem

Three places in the app fan work out and must not fan it out all at once:
**image prefetch** (hovering the grid warms next pages' covers — dozens
of candidate fetches, the browser's per-origin connection budget is
6-ish), **the upload batch** ([4·08](../phase-4-react-ui/08-upload-with-progress.md)
picked three files; on a review with retakes it can queue more than
bandwidth wants in flight), and **cart line revalidation** after a
long-idle tab returns. Phase 17 built `taskQueue(limit)`; the storefront
needs three application-grade features on top: **priorities**,
**cancellation of queued work**, and **queue-jumping for user intent**.

## The implementation

```js
// src/lib/priority-queue.js — the phase-17 queue, application edition
export function createTaskQueue({concurrency = 4} = {}) {
  const waiting = [];                    // [{fn, priority, seq, resolve, reject, signal}]
  let running = 0;
  let seq = 0;

  function next() {
    if (running >= concurrency || waiting.length === 0) return;
    // highest priority first; FIFO within a priority (seq breaks ties)
    waiting.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    const task = waiting.shift();
    if (task.signal?.aborted) {          // cancelled while queued: skip, free slot
      task.reject(Object.assign(new Error('cancelled'), {name: 'AbortError'}));
      return next();
    }
    running++;
    Promise.resolve()
      .then(() => task.fn({signal: task.signal}))
      .then(task.resolve, task.reject)
      .finally(() => { running--; next(); });
  }

  return {
    /** Enqueue. priority: higher runs sooner. signal: cancels queued AND
     *  running work (the fn receives it and must pass it to fetch). */
    add(fn, {priority = 0, signal} = {}) {
      return new Promise((resolve, reject) => {
        waiting.push({fn, priority, seq: seq++, resolve, reject, signal});
        queueMicrotask(next);
      });
    },
    stats() { return {running, waiting: waiting.length}; },
  };
}
```

```js
// src/lib/prefetch.js — the main consumer
import {createTaskQueue} from './priority-queue.js';

const imageQueue = createTaskQueue({concurrency: 4});
const seen = new Set();

export function prefetchImage(url, {priority = 0} = {}) {
  if (seen.has(url)) return;
  seen.add(url);
  imageQueue.add(({signal}) =>
    fetch(url, {signal, priority: 'low'})        // fetchpriority hint too
      .then((r) => r.blob())                      // pull it into HTTP cache
      .catch(() => seen.delete(url)),             // failed: allow a future retry
  {priority});
}

// grid hover → warm the product page's gallery at priority 1;
// visible-viewport covers of the NEXT page → priority 0 (4·03's rootMargin
// already fetched this page's).
```

The upload batch reuses the same queue class with `concurrency: 2` — two
parallel uploads saturate most uplinks without starving the API calls
sharing the connection pool — and passes each file's
[per-file controller](../phase-4-react-ui/08-upload-with-progress.md)
as the task's signal, which is what makes cancel-while-queued work: an
✕ on a file that never started simply never starts.

## The decisions

- **Priorities are for *intent*, not importance.** Hover says "the user
  may go here next" (priority 1); the next page's covers are ambient
  (0). When the user actually clicks, the page's own render fetches at
  the network's normal priority *outside* the queue — the queue governs
  speculation only. Putting user-blocking work behind a speculation
  queue is the classic self-inflicted jank.
- **Cancellation is checked at dequeue, not just delivered to the
  task.** A queued-then-cancelled task costs zero — no slot, no fetch.
  The phase-17 primitive delivers the signal to running work; the
  application version adds the cheap early exit, because speculative
  queues churn (hover in, hover out) far more than they run.
- **The `seen` set makes prefetch idempotent** — hover events fire in
  bursts, and re-queuing the same URL wastes slots on requests the HTTP
  cache would satisfy anyway. Failure removes from `seen`: a flaky
  image gets another chance on the next intent signal.
- **`fetchpriority: 'low'`** (the `priority` fetch option) tells the
  *browser* what the queue already knows — the two throttles compose:
  the queue bounds our concurrency; the hint keeps what we do send from
  competing with the page's own critical requests.
- **What the queue deliberately is not:** a scheduler with retries,
  timeouts or persistence — the fetch wrapper (5·01) owns
  per-request policy, and anything worth persisting is the
  [outbox's](../phase-2-node-services/04-outbox-relay-and-email.md) job
  server-side. One concern per layer, as always.

## Gotchas

- **Symptom:** prefetch makes *the product page itself* slower to open.
  **Cause:** the click's real fetches queued behind speculation — the
  intent/importance inversion above, usually from routing the page's
  data fetch through the shared queue "for consistency". **Fix:**
  the rule as stated: real navigation never enters the speculation
  queue. Consistency between different things is not a virtue.
- **Symptom:** `stats()` shows `waiting` growing without bound during a
  long grid-scroll session. **Cause:** every scrolled-past cover was
  queued and nothing expires ambient speculation. **Fix:** cap the
  waiting list for priority-0 work (drop oldest — stale speculation is
  worthless by definition); the ten-line change lives in `add` and the
  interview question below is why it is safe.
- **Symptom:** uploads and prefetch fight — a review upload crawls while
  the grid warms images. **Cause:** two queues, one uplink; each queue
  keeps its own promise. **Fix:** the upload queue's tasks pass
  `fetchpriority: 'high'` and prefetch pauses while `busy`
  ([4·08's flag](../phase-4-react-ui/08-upload-with-progress.md)) — a
  three-line coordination, and the honest note that browsers arbitrate
  the rest.

## Interview questions

1. **★ Why is dropping queued priority-0 work safe when dropping
   priority-1 work isn't?** Because ambient speculation's value decays
   to zero on its own — a cover the user scrolled past five screens ago
   will not be needed; if it ever is, the miss costs one normal fetch.
   Hover intent is a *prediction about the next click* — dropping it
   forfeits real perceived-latency wins. Queue policy should mirror the
   value curve of what is queued, and the two curves differ.
2. **★ The phase-17 queue was correct — why did the application need to
   change it?** The primitive optimizes for the general contract
   (bounded concurrency, FIFO fairness). Applications add *policy*:
   priorities encode intent, dequeue-time cancellation exploits churn,
   idempotence exploits domain knowledge (URLs re-request safely). The
   division — mechanism in the library, policy at the edge — is the
   same one the whole track keeps drawing, and knowing which side a
   feature belongs on is the senior skill.
3. **Why bound prefetch concurrency at all when the browser already
   limits connections per origin?** The browser's limit is a shared
   pool — speculation unbounded at the app level fills it and *queues
   the user's real requests behind it* inside the network stack, where
   you can't reprioritize. App-level bounding keeps the contention
   visible and governable in your own code; `fetchpriority` then
   handles what does reach the wire.

---

← Prev: [The TTL cache with stale-while-revalidate](02-the-ttl-cache.md) ·
Next → [The event bus](04-the-event-bus.md)
