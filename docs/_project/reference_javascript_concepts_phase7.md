---
name: devbible-javascript-concepts-phase7
description: Load-bearing claims and sources for JavaScript phase 7 — asynchronous JavaScript, the syllabus's centre of gravity
metadata:
  type: reference
---

*Split out of [[devbible-javascript-concepts]] on 2026-08-14, which passed the
300-line memory cap. Open this only when working on the phases named above.*

## Phase 7 — Asynchronous JavaScript · **Master in progress**

🔴 **The syllabus's stated centre of gravity**, and the phase with the **most Master
topics: eleven (01–11)**.

| # | Topic | State |
|---|---|---|
| 01 | Synchronous vs asynchronous (1 chunk) | ✅ |
| 02 | The event loop (1 chunk) | ✅ |
| 03 | Microtasks vs macrotasks (2 chunks) | ✅ |
| 04 | Callbacks | **next** |
| 05–11 | Promises · Chaining · async/await · Error handling · Sequential vs parallel · all/allSettled/race/any · Anti-patterns | to do |

🔴 **Standing rule for this phase, written into its README:** ordering claims are held to
the documentation. Node and the browser implement **different event loops**, so pages
assert only what both agree on — *"microtasks drain before tasks"* — and **name the
runtime** for anything narrower. No run means no console block, so no page prints an
interleaving nobody produced.

### 01 · Synchronous vs asynchronous

- **"Single-threaded" is true of YOUR CODE, false of the platform** — which is why a
  thousand concurrent `fetch`es are free while one big `JSON.parse` freezes the page.
- 🔴 **Run-to-completion is one fact with two faces**: MDN's *"a function cannot be
  preempted and will run entirely before any other code runs"* is **why the language
  needs no locks** AND **why a 200 ms loop freezes everything**.
- **Concurrency ≠ parallelism.** The event loop gives concurrency (three fetches in
  flight); parallelism needs workers.
- Table of what runs off-thread (network stack, platform timers, libuv pool, crypto,
  rendering) versus on yours (your CPU work).
- **`await` suspends the FUNCTION, not the thread** — and therefore **cannot rescue a
  synchronous hot loop**.
- MDN's carve-out: `Atomics.wait` genuinely blocks, but only **dedicated and shared
  workers** may — *"not windows or service workers"*.
- Workers are **separate agents**; payloads are **structured-cloned**.

### 02 · The event loop

- MDN's three facilities: **heap** (objects), **stack** (execution contexts, LIFO),
  **queue** (jobs, FIFO).
- 🔴 **The load-bearing sentence: *"A job is considered completed when the stack is
  empty."*** That is run-to-completion stated precisely, and it explains almost every
  async surprise.
- Jobs created by a job go to the **end** of the queue; jobs also arrive from platform
  completions (timers, I/O, events).
- Traces `A D C B` through `console.log` / `setTimeout` / `.then`.
- 🔴 **`setTimeout(fn, 0)` is a MINIMUM, never a schedule** — a 1-second synchronous loop
  delays a 10 ms timer by a second, because the callback waits for the current job, every
  job ahead of it, and the whole microtask queue.
- Rendering is scheduled **between jobs** — hence the frozen UI.
- Stack is finite and **V8 does not implement proper tail calls**, so tail recursion still
  overflows. An async continuation resumes on a **fresh stack** (why async traces need
  stitching).
- **Node ≠ browser**: libuv phases plus `process.nextTick` versus the HTML spec's loop
  plus rendering.

### 03 · Microtasks vs macrotasks

- 🔴 **The asymmetry**: a **task** runs **one** job per turn; a **microtask drain** runs
  **every** microtask, *including ones queued during the drain*, until the queue is empty.
  MDN's two rules carry the words "all" and "until the queue is empty".
- Tasks: `setTimeout`/`setInterval`, event dispatch, the initial script. Microtasks:
  `.then`/`.catch`/`.finally`, **`await` continuations**, `queueMicrotask`,
  `MutationObserver`.
- **The exercise** `1, 4, 3, 2` read as three phases: all synchronous → **entire**
  microtask queue → **one** task. Nested case: a `.then` inside the first `setTimeout`
  beats the second `setTimeout`, because the queue drains after **each** task.
- 🔴 **A microtask chain freezes the page more completely than `while(true)`** — it never
  returns to the task queue, so no timers, events **or rendering**. A recursive
  `setTimeout` breathes; a recursive `.then` does not. Realistic form: `poll().then(poll)`
  where the promise resolves synchronously.
- **Everything before the first `await` runs synchronously**; `await` then queues the rest
  as a microtask. **`await null` still yields.** So an `await` loop never yields to the
  task queue and still starves rendering.
- **Rendering happens between tasks**, after the microtask queue empties. To let the
  browser paint you must yield a **task** (`await new Promise(r => setTimeout(r,0))` or
  `scheduler.yield()`). **`requestAnimationFrame` is neither queue** — it is part of the
  rendering step.
- MDN's two documented uses of `queueMicrotask`:
  1. 🔴 **The "sometimes async" bug** — a cache hit fires an event synchronously before
     the caller can attach a listener, a miss fires it later. Fix: wrap the fast path.
     **A function should be always-async or never-async, never sometimes.** (An `async`
     function gets this for free.)
  2. **Batching within one turn** via the **`length === 1`** trick — the first call
     schedules the flush, later calls join the array. The mechanism behind framework
     batching, and a microtask is right because it runs after all sync code but **before
     rendering**.
- **Prefer `queueMicrotask` to `Promise.resolve().then(fn)`** for pure scheduling: no
  promise allocated, and **exceptions surface as uncaught errors** rather than becoming an
  unobserved rejection.
- **`try`/`catch` cannot catch a microtask's error** — the block exits before the callback
  runs. Same for `setTimeout`.
- Node adds `process.nextTick` (before promise microtasks) and `setImmediate`.
  🔴 **No cross-runtime ordering asserted beyond "microtasks before tasks".**

---

## Topic 04 · Callbacks — **4 chunks, 921 lines** (commit `a4eac0f`)

Sources: MDN [Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function),
[Introducing asynchronous JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Introducing),
[Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises);
Node.js [Errors](https://nodejs.org/api/errors.html) — *Error propagation and interception*.

**01 the pattern**
- 🔴 **A callback is not an async feature.** MDN splits **synchronous** callbacks
  (`map`, `forEach` — *"called immediately after the invocation of the outer function"*)
  from **asynchronous** ones (`setTimeout`, `then`). **The call site is identical**, so
  timing is answerable only from the callee's documentation.
- MDN's `let value = 1; doSomething(() => value = 2); console.log(value)` → *"1 or 2?"*.
  The two implementations differ by one line (`callback()` vs `setTimeout(callback, 0)`).
- Callbacks exist **because of run-to-completion** — wait either blocks the thread or
  leaves instructions for later. Promises and `await` are wrappers over the same mechanism.
- **Callbacks are not legacy; callback *sequencing* is.** Still correct for many-shot
  events, synchronous array methods, and scheduling (`queueMicrotask`, `rAF`).

**02 error-first**
- An async callback **cannot `throw`** — the stack that set it up has unwound, so the
  error must travel as data. Node: *"an `Error` object passed as the first argument…
  if that first argument is not `null` … an error occurred"*.
- 🔴 **The missing `return` is the signature bug.** Falling through gives `undefined` to
  the success path, and **the stack trace then points at the wrong function**. Unlike
  `catch`, an `if` does not end the block.
- On success the first argument is **`null`, explicitly** — `cb(result)` makes the
  consumer read the result as an error.
- `try`/`catch` around the *call* never fires; the block exits before the callback runs.
  `async`/`await` is what restores `try`/`catch` over async work.
- Two producer rules: **always async** (defer the fast path with `queueMicrotask`) and
  **called exactly once on every path**, including early guard clauses.

**03 inversion of control**
- 🔴 **This is the real problem, not the nesting.** Six failure modes — too early, too
  late, never, twice, wrong arguments, swallowed error — and **every one is silent**.
- Called-twice is the missing `return` seen from the producer side; the consumer-side
  `once(fn)` wrapper **is what a promise gives free**, since a promise settles once.
- Never-called leaves **no object behind** — no error, no log. A promise does not prevent
  it but makes it inspectable as a pending promise.
- MDN's three `then()` guarantees map onto the failures: never before the current
  event-loop run completes (kills "Zalgo"); invoked **even if attached after settling**
  (a raw callback has no slot to attach to late); multiple handlers in insertion order.
- 🔴 **Promises fixed the contract, not the indentation.** Flat chaining is a consequence
  of `then()` returning a new promise. "Promises fix callback hell" is the shallow half.

**04 callback hell**
- MDN's `doStep1/2/3` pyramid, quoted, plus *"'callback hell' or the 'pyramid of doom'"*.
- 🔴 **Why nesting is FORCED:** a callback API has **no return value to sequence on**.
  Step 2 needs step 1's result, which exists only inside step 1's callback. One
  dependency = one level. Not a discipline failure.
- MDN names the real cost: *"you have to handle errors at each level of the 'pyramid',
  instead of having error handling only once at the top level."* One `.catch` replaces
  MDN's callback version passing `failureCallback` three separate times.
- **Named functions flatten and fix nothing** — sequence becomes invisible, the closure
  over earlier results is destroyed (values must be threaded manually), the per-level
  `if (err)` remains, and every trust problem survives.
- Decision rule: **promise for "one result, later"; callback for "a function to run" or
  "many results over time"**. Promises are one-shot, so wrong for event sources.

## Topic 05 · Promises — **3 chunks, 801 lines** (commit `a292f0f`)

Sources: MDN [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise),
[`then`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then),
[`catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch),
[`finally`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally),
[Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises).

**01 the three states**
- pending / fulfilled / rejected; **settled** = "either fulfilled or rejected, but not
  pending". The transition is **once and irreversible** — that is what replaces the
  `once()` guard a callback API needs.
- 🔴 **"Resolved" ≠ "fulfilled".** MDN: resolved means *"settled or 'locked-in' to match
  the eventual state of another promise"*, and *"a resolved promise can be pending or
  rejected as well"*. `resolve(innerPromise)` resolves immediately, fulfils 1s later.
  This is why the executor parameter is named **`resolve`, not `fulfill`**.
- **No `promise.state` / `promise.value`** — internal slots, no synchronous reader. This
  is deliberate; a sync `isSettled()` would reintroduce Zalgo.
- **Thenables:** *"the language allows using thenables in place of promises"*. `await`
  accepts any object with a callable `then`. Failure mode: a data object with an unrelated
  `then` field gets assimilated.

**02 then / catch / finally**
- MDN: the returned promise is *"always pending when returned"*, and the handler call
  *"always happens asynchronously, even when the current promise is already settled"*.
- 🔴 **The whole of error propagation is two defaults.** A non-function `onFulfilled`
  becomes **identity `(x) => x`**; a non-function `onRejected` becomes **thrower
  `(x) => { throw x; }`**. So "a rejection skips `.then`s to reach `.catch`" is not a
  rule — each `then` re-throws in turn.
- `catch` is *"a shortcut for `then(undefined, onRejected)`"*; MDN demonstrates it calling
  `then` internally. **Handling RESTORES the chain** — a `catch` returning normally
  fulfils, so a log-only catch swallows the error and feeds `undefined` onward.
- Two things `catch` cannot catch, both MDN examples: a throw **asynchronously inside the
  executor**, and a throw **after `resolve()`** (already settled → no effect). Only a
  synchronous executor throw becomes a rejection.
- `finally`: **no argument** ("by design"), and *"transparent — reflects the eventual
  state of the original promise"*. `Promise.resolve(2).finally(() => 77)` → **2**.
  🔴 But **throwing** or returning a rejected promise **replaces the outcome**
  (`Promise.reject(3).finally(() => { throw 99 })` rejects with 99 — the original error is
  lost), and returning a **pending** promise delays the chain.

**03 returning a value vs a promise**
- MDN's six outcomes. 🔴 **Plain value → wrapped; promise → *adopted*, never nested.**
  `then(() => 2)` and `then(() => Promise.resolve(2))` both fulfil with 2. Adoption is the
  "resolved" state from chunk 01. Payoff: a handler moves between sync and async with no
  caller change.
- 🔴 **The forgotten `return`** — handler returns nothing → *"fulfilled with `undefined`"*
  **immediately**, so the chain does not wait AND the inner promise **floats** free of the
  outer `.catch`, becoming an unhandled rejection. **A `.then` nested inside a `.then` is
  the tell.** Concise arrow bodies cannot forget.
- Returning from `catch`: deliberate = fallback recovery; accidental =
  `.catch(e => log(e))` feeding `undefined` on.
- `throw err` ≡ `return Promise.reject(err)` inside a handler; they differ only in
  reachability (a throw inside a `setTimeout` callback rejects nothing).
- Same rule governs `async` functions: `return Promise.resolve(1)` fulfils with **1**.

## Topic 06 · Chaining — **3 chunks, 767 lines** (commit `2f036ca`)

Source: MDN [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
(chaining, nesting, chaining-after-a-catch, composition, timing), plus `then` and `finally`.

**01 flattening**
- `then` *"returns a new promise, different from the original"*, representing the previous
  step **and** the handler — which is why a throw rejects the **next** promise.
- 🔴 MDN's **"always return promises"**: without the `return`, *"there's no way to track
  its settlement anymore"* — the promise is **floating**. **Two damages, and people notice
  only the first:** sequencing breaks (next handler gets `undefined` immediately) and
  **error handling breaks** (rejection can no longer reach the chain's `catch`).
  MDN also warns floating promises *"could be worse if you have race conditions"*.
- **A chain is strictly sequential.** Chaining independent work = accidental waterfall;
  combinators are for independent work.
- Sequential composition over a list: `[f1,f2,f3].reduce((p,f) => p.then(f), Promise.resolve())`.

**02 error propagation**
- MDN: *"modeled after how synchronous code works"*, and promises catch *"all errors, even
  thrown exceptions and programming errors"* — a `TypeError` in a handler reaches the same
  `.catch` as a network failure. In the callback version it escapes to `uncaughtException`.
- 🔴 **There is no propagation mechanism** — the default `(x) => { throw x; }` fires once
  per link. A rejection *walks* the chain.
- 🔴 **`.then(f, g)` ≠ `.then(f).catch(g)`.** `g` handles only **upstream** rejections; a
  throw inside `f` rejects the *next* promise, so only a trailing `catch` sees it.
- A `catch` sees **only upstream**. Mid-chain catch = recovery, not coverage.
- Chaining after a catch: MDN's example outputs `Do that` / `Do this, no matter what
  happened before` — handling **restores** the chain.
- 🔴 **Nesting is a deliberate scoping tool**: *"a nested `catch` only catches failures in
  its scope and below"* — lets optional steps fail while a critical failure still reaches
  the outer catch. MDN's caveat: *"if you don't have sophisticated error handling, you very
  likely don't need nested `then` handlers."* Nesting-by-forgotten-return looks identical
  in a diff, which is why the inner catch deserves a comment.

**03 finally and timing**
- 🔴 **`finally` is a link, not a clause** — it runs at its **position**. Before a `catch`
  it runs first and passes the rejection through; after a `catch` it sees a fulfilled
  chain. The `try`/`finally` intuition (always last) is what misleads.
- 🔴 **A chain ending in `.finally()` still produces an unhandled rejection** — finally is
  transparent and marks nothing handled. Only `catch` / two-arg `then` does.
- **Every link costs one microtask tick**, even over an already-settled promise.
- MDN's ordering example yields three facts; the load-bearing one is 🔴 **the executor runs
  synchronously** (`"Promise callback"` prints first), so **wrapping slow synchronous work
  in `new Promise` does not offload it**. Also: chain still pending when sync code ends;
  `.then` beats `setTimeout` (microtask before task).
- A long chain of sync handlers **freezes the frame** — the whole microtask queue drains
  before a rendering opportunity.

## Topic 07 · `async`/`await` — **3 chunks, 727 lines** (commit `721e9c5`)

Sources: MDN [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function),
[`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await).

**01 always a promise**
- *"Async functions always return a promise. If the return value … is not explicitly a
  promise, it will be implicitly wrapped."* Three exits: return → fulfil, return-a-promise
  → **adopted**, throw → **reject**.
- 🔴 **An `async` function NEVER throws synchronously.** `try { asyncFn() } catch {}` around
  the bare call catches nothing. Synchronous argument validation must live in a **non-async
  wrapper**. *(This corrected a wrong claim on topic 03 chunk 01, made twice.)*
- 🔴 **`return p` ≠ `return Promise.resolve(p)` by identity.** MDN: `p === basicReturn()` is
  **true**, `p === asyncReturn()` is **false** — `Promise.resolve` passes a native promise
  through, an async function must create its own. Marking a pure pass-through `async` costs
  the reference and buys nothing (breaks identity comparisons / WeakMap keys).
- MDN desugaring: `async function foo(){ await 1 }` ≡
  `function foo(){ return Promise.resolve(1).then(() => undefined) }` — non-promise is
  **wrapped**, code after `await` is a continuation, the return value is the chain's promise.
- MDN: behaviour *"similar to combining generators and promises"*.

**02 where it suspends**
- *"The body … can be thought of as being split by zero or more await expressions. Top-level
  code, up to and including the first await expression … is run synchronously."*
- `await` does three things in order: 🔴 **evaluates the expression immediately**, suspends,
  returns control to the caller. **Point 1 is what makes concurrency possible** — start the
  calls, then await them.
- 🔴 **One tick minimum, no fast path**: *"even when the used promise is already fulfilled,
  the async function's execution still pauses until the next tick."*
- Non-promise: *"resolved in the same way as `Promise.resolve()`"*; `(await obj) === obj`.
  So `await` is safe on a value that may or may not be a promise. Thenables likewise.
- Allowed only in an **async function** or at the **top level of a module** — not CommonJS.
  Top-level `await` **delays evaluation of every importing module**.

**03 reading the ordering**
- Three-pass method: sync walk → microtask drain → one task, repeat.
- 🔴 **A two-`await` function re-queues at the BACK of the queue at each `await`**, so it
  interleaves with other microtasks. Worked example `0,1,4,2,then,3,timer` — **derived from
  the rules, marked on the page as not from a run**.
- `await` suspends the **function**, not the thread; a sync hot loop in a continuation still
  freezes everything.
- `await` in `for...of` = sequential round trips (correct only when steps depend on each
  other). 🔴 **`await` inside `forEach` does nothing** — forEach discards the returned
  promise, so nothing is awaited and rejections float.

## Topics 08–10 (commits `e4edbff`, `34fb25a`, `3fb7864`)

### 08 · Error handling in async code — 3 chunks, 728 lines
Sources: MDN Using promises, `await`, `unhandledrejection`; Node `process` docs.
- `await` reconnects failures to the exception channel because the continuation is back in
  the same function. A `try` does **not** cover: an un-`await`ed call, a `return p` inside
  the `try`, or callbacks handed elsewhere.
- 🔴 **The one place `return await` is not redundant: inside a `try`.** `return p` exits the
  block before settling, so the local `catch`/`finally` never sees it — and a
  `try`/`finally` releases the lock **before** the work finishes.
- A `try`/`catch` per `await` is the `if (err)`-without-`return` bug in new syntax.
- 🔴 **Nine ways a rejection vanishes**; the worst is the **missing `await`**, because the
  function **returns the wrong answer** (checkout reports success mid-charge). Ownership
  rule: every promise is `await`ed, `return`ed, or given a `.catch` **in the same turn**.
- Node docs give the timing: `'unhandledRejection'` fires when no handler is attached
  *"within a turn of the event loop"*; `'rejectionHandled'` covers later attachment.
- 🔴 **Node default: an unhandled rejection *"will be raised as an uncaught exception"***.
  The browser only logs. Same bug, far worse on a server.
- 🔴 MDN: an **empty** `process.on('unhandledRejection')` listener leaves rejections
  *"dropped on the floor and silently ignored"* — worse than no listener.

### 09 · Sequential vs parallel await — 2 chunks, 494 lines
- 🔴 **`await` is a BARRIER, not a wait.** Everything textually after it is fenced, whether
  or not it depends on the value. Reading it as "block until ready" is what hides the bug.
- Mechanical dependency test: does this call's argument list contain anything derived from
  an earlier `await`? If not, it did not need to wait.
- Pagination is the canonical **legitimate** `await`-in-a-loop.
- Costs **latency, not CPU** — which is why it survives review and local testing.
- Fix: hoist then await, or `Promise.all`. 🔴 **`Promise.all` is safer than hoisting** —
  MDN: it *"immediately marks all promises as handled"*, while a hoisted promise has a
  handler-less window whose rejection is reported unhandled.
- `ids.map(getUser)` bug — `map` passes `(el, index, array)`.
- Mixed dependency: start independent work first → total is `max`, not sum.

### 10 · The Promise combinators — 3 chunks, 693 lines
Organised as a 2×2: all-results vs one-result × failure-fails vs failure-tolerable.
- `all`: **input order** regardless of completion; fail-fast reason is the first to reject
  **in time**, others discarded; bare values pass through; `all([])` fulfils **synchronously**.
- `allSettled`: **never rejects**; `{status, value|reason}` with 🔴 **`value`/`reason`
  ABSENT, not undefined** — branch on `status`. Trap: total failure looks like empty success.
- `race`: first to **settle**, so 🔴 **a fast rejection wins** — deadlines yes, redundancy no.
  🔴 **`race([])` is forever pending.** With pre-settled inputs, **array position** decides.
- `any`: first to **fulfil**, ignoring rejections; rejects with **`AggregateError`** carrying
  every reason (the only one that does); `any([])` already rejected.
- 🔴 **None of them cancels anything** — MDN: losers *"are not explicitly cancelled — they
  continue their internal execution"*. Requests still hit the server, side effects still run.
- Combinators **suppress losers' unhandled-rejection reports** (they mark all inputs handled)
  — an advantage over hoisting, and why a failing mirror is silent. A logging `.catch` on an
  input **must re-throw**, or the failed source counts as a winner.
- **Joins, not schedulers** — every task starts at once.

## Topic 11 · Promise anti-patterns — 3 chunks, 684 lines (commit `fd192b1`) — **PHASE 7 MASTER TIER COMPLETE**

- 🔴 **Explicit construction**: `new Promise` around an existing promise. Harm, not verbosity:
  a **missing `reject` path leaves the caller pending forever**; a throw in a callback
  registered inside the executor converts to nothing; the reference is lost; intent hidden.
  Correct use is MDN's *"wrap the callback-accepting functions at the lowest possible level,
  and then never call them directly again"*. Deferred variant → `Promise.withResolvers`.
- **Floating promises, four disguises**: MDN's worked example where the list is
  🔴 **"always" `[]`, deterministically not racily**; the missing `await` (wrong result);
  `forEach(async …)`; and 🔴 **`filter(async …)` keeps EVERY element** because promises are
  truthy. Deliberate fire-and-forget still needs a `.catch`.
- 🔴 **`return await`: redundant outside a `try`, REQUIRED inside one.** `return p` exits the
  block before settling → local `catch` blind, and in `try`/`finally` the **lock is released
  before the work finishes**. ESLint's `no-return-await` was deprecated for missing this;
  `@typescript-eslint/return-await` handles it.
- `.then(fn())` calls immediately and passes the return value; `undefined` is then replaced
  by the identity function, so the chain silently passes through.
- Marking a pure pass-through `async` costs the promise reference.
