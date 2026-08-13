---
title: "01.1 · One thread, and what runs elsewhere"
sidebar_label: "01 · One thread"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model). Documentation-validated.

**Your JavaScript runs on one thread. Almost nothing else does.** Holding those two
facts apart is the whole of this topic — "JavaScript is single-threaded" is true of
*your code* and false of the platform your code runs on.

## Run to completion

MDN:

> Each job is processed completely before any other job is processed. This offers some
> nice properties when reasoning about your program, including the fact that **whenever a
> function runs, it cannot be preempted and will run entirely before any other code
> runs** (and can modify data the function manipulates).

This is a stronger guarantee than most languages give, and it is why JavaScript has no
locks, no mutexes and no `volatile`. Between two statements of your function, **nothing
else can touch your data** — no other callback, no timer, no event handler.

MDN's example of the ordering that follows:

```js
const promise = Promise.resolve();
let i = 0;
promise.then(() => {
  i += 1;
  console.log(i);
});
promise.then(() => {
  i += 1;
  console.log(i);
});
```

Output is `1` then `2` — never the interleaved
`i += 1; i += 1; console.log(i); console.log(i);`. Each callback runs to completion
before the next begins.

**What you lose in exchange:** a long synchronous function freezes everything. There is
no preemption, so a 200 ms loop is 200 ms of no rendering, no clicks, no timers. The
guarantee that nothing interrupts you is the same guarantee that you interrupt nothing.

## Synchronous versus asynchronous

```js
const data = readFileSync(path);   // the thread WAITS here — nothing else runs
console.log("after");

readFile(path, (err, data) => {    // registers a callback and returns immediately
  console.log("in callback");
});
console.log("after");              // ← runs first
```

**Asynchronous does not mean "at the same time".** It means *"not now"* — the work is
started elsewhere, your function returns, and the result arrives as a **job** on the
queue later. Everything on that queue still runs on the one thread, one job at a time.

So there are two distinct ideas people merge:

- **Concurrency** — several operations *in progress*. JavaScript has this, through the
  event loop.
- **Parallelism** — several operations *executing simultaneously*. Your JavaScript does
  not have this, except through workers.

`Promise.all` gives you **concurrency**: three `fetch` calls in flight at once. The
JavaScript that starts them and handles their results still runs one statement at a
time.

## What actually runs elsewhere

The single thread runs your code. Everything else is somewhere else entirely:

| Work | Where it runs |
|---|---|
| `fetch` / XHR — DNS, TCP, TLS, transfer | the browser's or Node's **network stack**, in native code |
| `setTimeout` timing | a platform **timer**, not your thread |
| File and disk I/O (Node) | libuv's **thread pool**, or the OS |
| Crypto, compression, image decoding | native code, often on other threads |
| Rendering, layout, paint | the browser's rendering pipeline |
| Your own CPU work | **your one thread** |

**Your callback runs on your thread; the waiting does not.** That is why a thousand
concurrent `fetch` calls cost almost nothing while one `JSON.parse` of a 50 MB string
blocks everything — the first is other people's threads, the second is yours.

MDN's phrasing of the benefit:

> JavaScript execution is never blocking. Handling I/O is typically performed via events
> and callbacks, so when the application is waiting for an IndexedDB query to return or a
> `fetch()` request to return, it can still process other things like user input.

## `await` does not block the thread

```js
async function load() {
  const res = await fetch(url);   // this FUNCTION suspends
  return res.json();
}
load();
console.log("this runs immediately");
```

`await` suspends **the async function**, not the thread. The function's continuation
becomes a job for later; meanwhile the event loop keeps going — other handlers run,
rendering happens, the page stays responsive.

This is the crucial difference from a blocking read in another language, and it is why
`await` in a loop is *sequential without being blocking*: nothing else in your program is
held up, only the loop.

**But `await` cannot rescue a synchronous hot loop.** `await` on an already-resolved
promise still yields to the microtask queue and comes back; it does not slice a
long computation into pieces. For that you need to break the work up yourself, or move it
off-thread.

## Where the exceptions are

MDN notes the never-blocking guarantee has limits:

> When multiple agents cooperate, the never-blocking guarantee does not always hold. An
> agent can become **blocked**, or paused, while waiting for another agent to perform some
> action. This is different from waiting on a promise in the same agent, because it halts
> the entire agent and does not allow any other code to run in the meantime.

That is `Atomics.wait` over `SharedArrayBuffer`, and MDN notes the restriction that keeps
it safe: only **dedicated and shared workers** may block — *"not windows or service
workers"*, so the UI thread can never be frozen this way.

The deliberately-synchronous APIs are the other exception, and they are the ones that
cause real incidents: `readFileSync`, `execSync`, `alert`, `localStorage`, and a
synchronous XHR. Each stops the world for its duration.

## Genuine parallelism: workers

```js
const worker = new Worker("./heavy.js");
worker.postMessage(data);
worker.onmessage = (e) => { … };
```

A worker is a **separate agent** with its own thread, heap and event loop. It shares no
variables with you — communication is by message passing, and the message is
**structured-cloned** ([Phase 4 · 04](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/02-structuredclone.md)),
so functions and DOM nodes cannot cross and a large payload costs a copy unless you
transfer it.

That isolation is what preserves run-to-completion: because nothing is shared by default,
none of the data-race machinery other languages need is required here.

## Gotchas

**Symptom:** The UI freezes during a computation
**Cause:** Run-to-completion — a long synchronous function cannot be preempted, so
rendering, input and timers all wait.
**Fix:** Break the work into chunks yielded between tasks, or move it to a worker.
`await` alone does not help.

**Symptom:** Code after an async call runs before the callback
**Cause:** Asynchronous means *"not now"*, not *"at the same time"* — the call returns
immediately and the callback is queued.
**Fix:** Expected. Put dependent code inside the callback, or `await` the promise.

**Symptom:** `readFileSync` / `execSync` in a server request handler causes latency
spikes
**Cause:** They block the single thread, so every other in-flight request waits.
**Fix:** The async variants. Sync APIs belong in startup code and scripts only.

**Symptom:** Thousands of concurrent `fetch` calls are fine but one `JSON.parse` is slow
**Cause:** Waiting on I/O happens on other threads; parsing happens on **yours**.
**Fix:** Stream or chunk large parses, or move them to a worker.

**Symptom:** A worker cannot see a variable from the main script
**Cause:** A worker is a separate agent with its own heap; nothing is shared.
**Fix:** `postMessage`, remembering the payload is structured-cloned — so no functions,
no DOM nodes.

## Interview questions

**★ Is JavaScript single-threaded?**
**Your code** is: one thread, run-to-completion, so a function *"cannot be preempted and
will run entirely before any other code runs"*. The **platform** is not — network, timers,
disk I/O, crypto and rendering all happen elsewhere. That combination is why JavaScript
handles thousands of concurrent I/O operations without threads in your code.

**★ What is the difference between concurrency and parallelism here?**
Concurrency is several operations **in progress**; parallelism is several **executing
simultaneously**. The event loop gives you concurrency — `Promise.all` really does have
three requests in flight — while your JavaScript still executes one statement at a time.
Parallelism requires workers.

**★ Does `await` block the thread?**
No. It suspends **the async function** and returns control to the event loop; the
continuation is queued as a job. Other handlers run and the page stays responsive. It
cannot, however, break up a long **synchronous** computation.

**★ What does run-to-completion buy you, and what does it cost?**
It buys freedom from data races: no other code can touch your data between two of your
statements, which is why the language needs no locks. It costs responsiveness — nothing
can preempt a long function, so a 200 ms loop is 200 ms of frozen UI.

**When is the never-blocking guarantee not true?**
With `Atomics.wait` over shared memory, where an agent genuinely halts — MDN notes only
**dedicated and shared workers** may block, never windows or service workers. And with the
deliberately synchronous APIs: `readFileSync`, `execSync`, `alert`, `localStorage`.

**What is a Worker?**
A separate **agent** with its own thread, heap and event loop, communicating only by
message passing with **structured-cloned** payloads. Nothing is shared, which is exactly
what preserves the run-to-completion guarantee on both sides.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
