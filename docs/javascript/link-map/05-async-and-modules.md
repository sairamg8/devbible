---
title: "Link map · JavaScript · Part 5 (phases 7–8)"
sidebar_label: "05 · async and modules"
sidebar_position: 5
---

# Link map · JavaScript · Part 5 (phases 7–8)

Covers every topic row of `docs/javascript/syllabus/02-data-and-async.md` in phase 7 (T07-01 to T07-22, asynchronous JavaScript) and phase 8 (T08-01 to T08-18, modules, errors, memory and the toolchain). That is 40 rows, and all 40 have a written page of ours. A header gives the path of the single page file, or of the first chunk file when the topic is a directory of chunks.
*read* = I read the passage that supports the claim; *headings only* = fetched, headings or size checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no Beyond line. Every linked URL returned 200 on 2026-10-13 at the canonical address shown (MDN's old `Event_loop` page and the `nodejs.org/en/learn/` paths redirect, so the final addresses are used; the Mozilla Hacks cartoon returns 403 to command-line requests but opens through the fetch tool, where it was read). The verification pass opened the remaining *not opened* targets, so every link now carries a *read* mark except where a line says otherwise. The verification pass could not run the fresh spot-check searches it planned because the web-search budget ran out; the blocks with no Beyond line (T07-03, T07-15, T07-22, T08-16, T08-17, T08-18) therefore rest on the researcher's searches alone.

🔴 **Version note.** Our syllabus verifies output in **Node 24 LTS** (`docs/javascript/README.md`). MDN and nodejs.org track the current language and runtime. Older third-party picks are flagged by date: Archibald's microtask post (2015) reports browser bugs that were since fixed, the Addy Osmani heap-profiling post (2013) describes an old DevTools UI (the "Profiles" panel), and the web.dev tree-shaking article was last updated in 2018 and covers webpack 4-era configuration. The Chrome heap snapshot page was last updated 2024-02-09 (the page shows that date) and mentions Chrome 123. The Lin Clark module cartoon (2018) predates top-level `await`. `Error.isError` is new enough that browser support should be checked before relying on it.

---

## Phase 7 — Asynchronous JavaScript

### T07-01 · Synchronous vs asynchronous — Master · ✅ written `docs/javascript/pages/phase-7-async/01-sync-vs-async/01-one-thread.md`
- **Read this:** [Introducing asynchronous JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Introducing) · MDN · a long synchronous function blocks the main thread; async APIs start work and report back later; wrapping CPU-heavy code in a promise does not stop the blocking (*read*) · covers our angle: **partial** — does not name what is genuinely running elsewhere · fetched 2026-10-13
- **Also good:** [Don't Block the Event Loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · callbacks run on one Event Loop thread while expensive I/O and CPU work goes to a Worker Pool; the page adds that the Worker Pool runs C++ tasks, and the JavaScript callbacks themselves stay on the Event Loop (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How Is Javascript Asynchronous And Single Threaded?](https://sohamkamani.com/javascript/single-thread-and-async/) · Soham Kamani, 2016-03-14 · states that only your own code is on the one thread, the waiting happens elsewhere, and the response callback still queues behind your code; uses a server request as the example, not browser APIs · fetched 2026-10-13 (*read*)
- **Our delta:** the explicit list of what runs on another thread (network, timers, file I/O) versus what never does (your callbacks).

### T07-02 · The event loop — Master · ✅ written `docs/javascript/pages/phase-7-async/02-the-event-loop/01-stack-queue-heap.md`
- **Read this:** [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model) · MDN (the old Event loop page, now retitled) · heap, job queue and stack of execution contexts; each job runs to completion; the queue is first-in first-out (*read*) · covers our angle: **partial** — no rendering step at all and only a short note on microtasks; those are on the Microtask guide · fetched 2026-10-13
- **Also good:** [Using microtasks in JavaScript with queueMicrotask()](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) · MDN · tasks versus microtasks and when each runs (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Event loop: microtasks and macrotasks](https://javascript.info/event-loop) · javascript.info, last updated May 17, 2024 · the loop as one cycle (oldest macrotask, all microtasks, render if needed), with the point that the DOM is painted only after the task completes and a zero-delay `setTimeout` split lets progress render while `queueMicrotask` does not · fetched 2026-10-13 (*read*)
- **Our delta:** rendering placed between tasks as an opportunity, not a guaranteed step.

### T07-03 · Microtasks vs macrotasks — Master · ✅ written `docs/javascript/pages/phase-7-async/03-microtasks-vs-macrotasks/01-the-drain-order.md`
- **Read this:** [Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/) · Jake Archibald, 2015-08-17 · the canonical ordering exercise: `script start`, `script end`, `promise1`, `promise2`, then the `setTimeout` callback; notes that some browsers of the time got it wrong (*read*) · covers our angle: **full** for the exercise; the browser bugs it reports are fixed in current engines · fetched 2026-10-13
- **Also good:** [Using microtasks in JavaScript with queueMicrotask()](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) · MDN · microtasks drain completely, including ones added while draining, before the loop moves on (*read*) · fetched 2026-10-13
- **Our delta:** none material; the page adds `await` to the ordering exercise.

### T07-04 · Callbacks — Master · ✅ written `docs/javascript/pages/phase-7-async/04-callbacks/01-the-pattern.md`
- **Read this:** [JavaScript Asynchronous Programming and Callbacks](https://nodejs.org/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks) · nodejs.org · callbacks, the error-first convention (first argument is `null` when there is no error), and the problem with nesting (*read*) · covers our angle: **partial** — no inversion of control · fetched 2026-10-13
- **Also good:** [Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function) · MDN glossary · a callback is a function passed into another function and invoked inside it; synchronous (`map`) or asynchronous (`setTimeout`) (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Introduction: callbacks](https://javascript.info/callbacks) · javascript.info, last updated June 18, 2022 · error-first callbacks, the pyramid of doom that grows to the right, and the named-step-functions fix and why it only half works · fetched 2026-10-13 (*read*)
- **Our delta:** inversion of control (the callee may call back twice, late, or never) and how a pyramid forms.

### T07-05 · Promises — Master · ✅ written `docs/javascript/pages/phase-7-async/05-promises/01-the-three-states.md`
- **Read this:** [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) · MDN · pending, fulfilled, rejected; "resolved" means locked in to another promise's eventual state, which is different from fulfilled (*read*) · covers our angle: **full** on states; the value-versus-promise return behaviour is on Using promises · fetched 2026-10-13
- **Also good:** [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) · MDN guide · every `then()` returns a new promise; callbacks never run synchronously, even on an already-resolved promise (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Promise](https://javascript.info/promise-basics) · javascript.info, last updated December 11, 2024 · the executor, internal state and result, "settled once only", and that `finally` takes no argument and passes the previous result through · fetched 2026-10-13 (*read*)
- **Our delta:** the resolved-versus-fulfilled distinction stated up front.

### T07-06 · Chaining — Master · ✅ written `docs/javascript/pages/phase-7-async/06-chaining/01-flattening.md`
- **Read this:** [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) · MDN guide · "chaining" and the mistake of not returning the inner promise, so the next `then` receives `undefined`; one `catch` at the end covers every step; nesting narrows a `catch` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Promises chaining](https://javascript.info/promise-chaining) · javascript.info, last updated April 6, 2023 · returning a value hands it to the next handler, returning a promise makes later handlers wait, and a thenable is treated the same way · fetched 2026-10-13 (*read*)
- **Our delta:** where `finally` runs in the chain (see T07-05).

### T07-07 · `async`/`await` — Master · ✅ written `docs/javascript/pages/phase-7-async/07-async-await/01-always-a-promise.md`
- **Read this:** [async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) · MDN · always returns a new promise, non-promise returns are wrapped, so `p === asyncReturn()` is `false` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) · MDN · `await` suspends only the surrounding async function; even a non-promise value resumes in a later microtask (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Difference Between Async/Await and Generators](https://thecodebarbarian.com/the-difference-between-async-await-and-generators) · Valeri Karpov, 2018-05-03 · shows the rough conversion (`co.wrap(function*)` and `yield` for `async` and `await`); written for the `co` era, so the "desugars to" idea is clear but the details are dated · fetched 2026-10-13 (*read*)
- **Our delta:** the exact suspension point and the microtask count of `await` on a native promise.

### T07-08 · Error handling in async code — Master · ✅ written `docs/javascript/pages/phase-7-async/08-error-handling/01-try-catch-around-await.md`
- **Read this:** [unhandledrejection event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) · MDN · fires when a promise is rejected with no handler; `preventDefault()` stops the console log; cross-origin script rejections do not fire it (*read*) · covers our angle: **partial** — browser only; Node's handling is in the Node docs · fetched 2026-10-13
- **Beyond the docs:** [Error handling with promises](https://javascript.info/promise-error-handling) · javascript.info, last updated June 18, 2022 · the "invisible try..catch" around executors and handlers, rethrowing, and the unhandled-rejection event with advice to report to the server · fetched 2026-10-13 (*read*)
- **Our delta:** rejections that vanish with floating promises, and `try`/`catch` around `await`.

### T07-09 · Sequential vs parallel `await` — Master · ✅ written `docs/javascript/pages/phase-7-async/09-sequential-vs-parallel/01-the-accidental-waterfall.md`
- **Read this:** [async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) · MDN · "await and concurrency": awaiting in turn is sequential, starting both before awaiting (or `Promise.all`) overlaps them (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Sequential vs Parallel JavaScript](https://savvy.co.il/en/blog/complete-javascript-guide/sequential-vs-parallel-javascript/) · Roee Yossef, page shows "Updated on Jun 21, 2026" · asks whether each line needs the previous result before choosing; a roughly 3 s waterfall versus roughly 1 s parallel demo; notes parallel awaiting overlaps waiting, not JavaScript execution · fetched 2026-10-13 (*read*)
- **Our delta:** none material.

### T07-10 · `Promise.all` vs `allSettled` vs `race` vs `any` — Master · ✅ written `docs/javascript/pages/phase-7-async/10-combinators/01-all-and-allsettled.md`
- **Read this:** [Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled) · MDN · `allSettled` for independent tasks, `all` when one failure should reject at once (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Promise.any()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any) · MDN · unlike `race`, ignores rejections; rejects with `AggregateError` only if all reject or the input is empty (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Promise.all vs allSettled vs race vs any](https://flaviocopes.com/promise-all-allsettled-race-any/) · Flavio Copes, last updated Jul 29, 2026 · one rule of thumb: `all` when failure should abort, `allSettled` for partial success, `race` for timeouts, `any` for mirrors and fallbacks · fetched 2026-10-13 (*read*)
- **Our delta:** what happens to the losers (they keep running; the combinators cannot cancel them).

### T07-11 · Promise anti-patterns — Master · ✅ written `docs/javascript/pages/phase-7-async/11-anti-patterns/01-explicit-construction.md`
- **Read this:** [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) · MDN guide · common mistakes section: not returning the inner promise, nesting (*read*) · covers our angle: **partial** — not `forEach`, floating promises or `return await` · fetched 2026-10-13
- **Beyond the docs:** [We have a problem with promises](https://pouchdb.com/2015/05/18/we-have-a-problem-with-promises.html) · Nolan Lawson, 2015-05-18 · five rookie mistakes: promise pyramid, `forEach` with promises, forgetting `catch`, "deferred", and side effects instead of returning; 2015, so it predates `async`/`await` · fetched 2026-10-13 (*read*)
- **Our delta:** floating promises and `return await`, which the 2015 post does not cover.

### T07-12 · Timers — Understand · ✅ written `docs/javascript/pages/phase-7-async/12-timers/01-the-api.md`
- **Read this:** [Window: setTimeout()](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout) · MDN · 4 ms minimum after five nested calls, longer minimums in background tabs, "reasons for longer delays", `clearTimeout` (*read*) · covers our angle: **partial** — drift and repeating work are on `setInterval` · fetched 2026-10-13
- **Beyond the docs:** [Scheduling: setTimeout and setInterval](https://javascript.info/settimeout-setinterval) · javascript.info, last updated February 25, 2026 · zero delay runs after the current script; the nested-timer limit is a browser rule and Node has none; nested `setTimeout` guarantees a gap between calls where `setInterval` may not · fetched 2026-10-13 (*read*)
- **Our delta:** drift measured, and clearing timers correctly.

### T07-13 · Creating promises — Understand · ✅ written `docs/javascript/pages/phase-7-async/13-creating-promises/01-the-executor.md`
- **Read this:** [Promise() constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) · MDN · the executor runs synchronously, a throw rejects, resolving with a thenable adopts its state, and the "callback-based API into promise-based" example (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Promisification](https://javascript.info/promisify) · javascript.info, last updated October 18, 2022 · a generic `promisify(f)` helper, the multiple-results variant, and the warning that it only suits callbacks called once · fetched 2026-10-13 (*read*)
- **Our delta:** `util.promisify` and its limits are in our page, not this one.

### T07-14 · Cancellation — Understand · ✅ written `docs/javascript/pages/phase-7-async/14-cancellation/01-the-model.md`
- **Read this:** [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) · MDN · `AbortSignal.timeout()` rejects with `TimeoutError`, `AbortSignal.any()` combines signals, `throwIfAborted()`, `reason`, and an "implementing an abortable API" example (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Aborting a signal: how to cancel an asynchronous task in JavaScript](https://ckeditor.com/blog/Aborting-a-signal-how-to-cancel-an-asynchronous-task-in-JavaScript/) · Tomasz Jakut, CKEditor blog, 2020-03-10 · a function that accepts a signal, checks `aborted` first because no event fires for an already-aborted signal, and clears its timer in the abort listener; predates `AbortSignal.timeout` and `any` · fetched 2026-10-13 (*read*)
- **Our delta:** composing signals with `any` and propagating one signal down a call tree.

### T07-15 · Timeouts, retries, backoff and jitter — Understand · ✅ written `docs/javascript/pages/phase-7-async/15-timeouts-retries-backoff/01-what-is-safe-to-retry.md`
- **Read this:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · Marc Brooker, AWS Architecture Blog, 2015-03-04 (May 2023 update note) · plain capped backoff still leaves clusters; full jitter spreads calls to a roughly constant rate and cuts the call count by more than half with 100 clients (*read*) · covers our angle: **partial** — no JavaScript, no idempotency · fetched 2026-10-13
- **Also good:** [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) · MDN · `AbortSignal.timeout()` for the timeout half (*read*) · fetched 2026-10-13
- **Our delta:** which errors and which HTTP methods are safe to retry.

### T07-16 · Concurrency limiting — Understand · ✅ written `docs/javascript/pages/phase-7-async/16-concurrency-limiting/01-why-unbounded-breaks.md`
- **Read this:** [Promise concurrency limit](https://techearl.com/javascript-promise-concurrency-limit) · Ishan Karunaratne, TechEarl, 2026-06-02 · a fixed number of workers share one cursor and pull the next index, results stored by index, so output keeps input order (*read*) · covers our angle: **full** on the pool; a third-party page chosen because MDN has no equivalent; the core code and its reasoning (a shared `cursor++` is safe on one thread, `Promise.all` is not throttling) are sound, but the FAQ and related-link blocks are padding and a few version claims are unsourced, so lean on the code, not the claims · fetched 2026-10-13
- **Our delta:** none material. The `p-limit` README (github.com) returned 403 through the fetch proxy and the npm page too, so neither is linked.

### T07-17 · Race conditions in a UI — Understand · ✅ written `docs/javascript/pages/phase-7-async/17-race-conditions-ui/01-the-stale-response.md`
- **Read this:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · react.dev · has a "Fetching data" section that explains out-of-order responses and fixes them with an `ignore` flag set in the effect cleanup (*read*) · covers our angle: **partial** — React-specific · fetched 2026-10-13
- **Beyond the docs:** [Handling race conditions when fetching data in React with useEffect](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect) · Max Rozen, no date shown · why responses arrive out of order, a cleanup flag that ignores stale results, and `AbortController` as the second fix · fetched 2026-10-13 (*read*)
- **Our delta:** the framework-free version of both fixes, plus keying by request.

### T07-18 · `queueMicrotask` — Understand · ✅ written `docs/javascript/pages/phase-7-async/18-queuemicrotask/01-choosing-a-deferral.md`
- **Read this:** [Using microtasks in JavaScript with queueMicrotask()](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) · MDN · "When to use microtasks"; recursive scheduling can block the event loop because the queue drains completely (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Picking the Right Tool for Maneuvering JavaScript's Event Loop](https://dev.to/alexmacarthur/picking-the-right-tool-for-maneuvering-javascripts-event-loop-5e6j) · Alex MacArthur, DEV post 2023-06-02 (blog 2023-04-21) · compares `setTimeout`, `queueMicrotask`, `requestAnimationFrame` and `requestIdleCallback` side by side; notes Safari lacked `requestIdleCallback` at the time · fetched 2026-10-13 (*read*)
- **Our delta:** the hazards page (starvation) is ours.

### T07-19 · Event loop: browser vs Node — Understand · ✅ written `docs/javascript/pages/phase-7-async/19-event-loop-browser-vs-node/01-the-browser-loop.md`
- **Read this:** [The Node.js Event Loop](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick) · nodejs.org · phases (timers, pending callbacks, poll, check, close), `setImmediate` before `setTimeout` inside an I/O callback, and `process.nextTick` running before the loop continues (*read*) · covers our angle: **partial** — Node half only; the browser half is the MDN event loop page · fetched 2026-10-13
- **Also good:** [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model) · MDN · the browser/engine side, but it covers no rendering and only briefly names microtasks (*read*) · fetched 2026-10-13
- **Beyond the docs:** [A complete guide to the Node.js event loop](https://blog.logrocket.com/complete-guide-node-js-event-loop) · Joseph Mawa, LogRocket, 2023-07-11 · six phases, and the `nextTick` queue drained before the promise microtask queue between callbacks; says only that browser and Node timers have "slight implementation differences"; dated 2023, republished with a 2024-06-04 modified date · fetched 2026-10-13 (*read*)
- **Our delta:** the side-by-side table and writing code that behaves the same in both.

### T07-20 · `Promise.withResolvers` — Know · ✅ written `docs/javascript/pages/phase-7-async/20-promise-withresolvers.md`
- **Read this:** [Promise.withResolvers()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers) · MDN · returns `promise`, `resolve`, `reject`; Baseline widely available since March 2024; stream-to-async-iterable example (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Promise.withResolvers(): the deferred pattern built in](https://certificates.dev/blog/promisewithresolvers-the-deferred-pattern-built-in) · Martin Ferret, certificates.dev, 2026-06-23 · the old `let resolve, reject` capture next to the one-line form; calls it "sugar, not new semantics" · fetched 2026-10-13 (*read*)
- **Our delta:** none material.

### T07-21 · Thenables — Know · ✅ written `docs/javascript/pages/phase-7-async/21-thenables.md`
- **Read this:** [await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) · MDN · the "Thenable objects" example: native promises used directly, other thenables get their `then()` called (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) · MDN · the Thenables subsection (*read*) · fetched 2026-10-13
- **Beyond the docs:** [JavaScript Thenables and Creating Your Own Promises](https://futurestud.io/tutorials/javascript-thenables-and-creating-your-own-promises) · Marcus Pöhls, Future Studio, 2023-11-02 · a class with a `then()` method works with `await`, nested thenables are unwrapped, and `Promise.resolve()` returns a real `Promise` · fetched 2026-10-13 (*read*)
- **Our delta:** interop with non-native promise libraries.

### T07-22 · Async work and backpressure — Know · ✅ written `docs/javascript/pages/phase-7-async/22-backpressure.md`
- **Read this:** [Backpressuring in Streams](https://nodejs.org/learn/modules/backpressuring-in-streams) · nodejs.org · defines backpressure, and shows memory about 87.81 MB with it versus about 1.52 GB without in the page's experiment (*read*) · covers our angle: **partial** — streams, not an array of promises · fetched 2026-10-13
- **Our delta:** tying the unbounded `Promise.all` bug to the stream definition of backpressure. The one DEV post on 50 000-item `Promise.all` that the first pass linked was removed: its own benchmark table shows unlimited `Promise.all` fastest, gives no hardware or method, and reads as a templated listicle. The Node page calls its 87.81 MB and 1.52 GB figures "virtual memory" while its raw output is labelled maximum resident set size, so quote them as the page's figures.

---

## Phase 8 — Modules, errors, memory and the toolchain

### T08-01 · ES modules — Master · ✅ written `docs/javascript/pages/phase-8-modules-errors/01-es-modules/01-import-and-export.md`
- **Read this:** [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) · MDN guide · named versus default exports, import maps, top-level `await`, hoisted imports, cyclic imports (*read*, including the cyclic-imports and top-level `await` sections) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) · MDN reference · named, default, namespace and side-effect forms, plus `with` import attributes; also covers hoisting and live bindings (*read*) · fetched 2026-10-13
- **Beyond the docs:** [ES modules: A cartoon deep-dive](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/) · Lin Clark, Mozilla Hacks, 2018-03-28 · CommonJS copies values while ES modules share one memory location (live bindings), and loading splits into construction, instantiation and evaluation; predates top-level `await` · fetched 2026-10-13 (*read*)
- **Our delta:** top-level `await` and its effect on dependents.

### T08-02 · Modules are singletons, strict, deferred and hoisted — Master · ✅ written `docs/javascript/pages/phase-8-modules-errors/02-module-semantics/01-singletons-and-strict.md`
- **Read this:** [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) · MDN guide · module scripts are deferred, strict, run once even if referenced by several script tags; "Import declarations are hoisted" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [ECMAScript modules in browsers](https://jakearchibald.com/2017/es-modules-in-browsers/) · Jake Archibald, 2017-05-02 · module scripts behave like `defer`, run once per URL, and share the queue with `defer` scripts; it does not discuss strict mode, and the browser-support parts are dated · fetched 2026-10-13 (*read*)
- **Our delta:** the strict-mode consequences and the singleton gotchas with two module graphs.

### T08-03 · `Error` and its subclasses — Master · ✅ written `docs/javascript/pages/phase-8-modules-errors/03-error-and-subclasses/01-the-error-object.md`
- **Read this:** [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) · MDN · `message`, `name`, non-standard `stack`, `cause` set from the constructor options, subclasses, and checking with `instanceof` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) · MDN · holds the original error passed as `options.cause`, can be any type, writable but not enumerable; Baseline widely available since September 2021 (*read*) · fetched 2026-10-13
- **Beyond the docs:** [From instanceof to Error.isError](https://allthingssmitty.com/2026/02/23/from-instanceof-to-error-iserror-safer-error-checking-in-javascript/) · Matt Smith, no date shown (sits between posts of 2026-02-02 and 2026-03-16) · `instanceof` fails across realms (iframe, `vm`); `Error.isError()` is realm-safe and also true for `DOMException` in browsers; check support before relying on it (the post lists Chrome 134+, Firefox 138+, Edge 134+, Node 24.3+, Safari 18.4 partial) · fetched 2026-10-13 (*read*)
- **Our delta:** checking error type without string matching, ranked by when each check is safe.

### T08-04 · Leaks you will actually cause — Master · ✅ written `docs/javascript/pages/phase-8-modules-errors/04-leaks/01-reachability.md`
- **Read this:** [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management) · MDN guide · leaks are objects that stay reachable unintentionally; `WeakMap` and `WeakSet` hold keys weakly (*read*) · covers our angle: **partial** — no catalogue of causes · fetched 2026-10-13
- **Beyond the docs:** [Fixing memory leaks in web applications](https://nolanlawson.com/2020/02/19/fixing-memory-leaks-in-web-applications/) · Nolan Lawson, 2020-02-19 · event listeners as the most common cause, then timers, observers, never-settling promises, global stores and unbounded DOM growth; does not use the term "detached DOM" · fetched 2026-10-13 (*read*)
- **Our delta:** closures holding large objects and module-level caches that never evict.

### T08-05 · Dynamic `import()` — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/05-dynamic-import/01-the-expression.md`
- **Read this:** [import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import) · MDN · returns a promise for the module namespace object; rejects if loading, linking or evaluation fails (*read*) · covers our angle: **partial** — no code splitting · fetched 2026-10-13
- **Beyond the docs:** [Dynamic imports](https://javascript.info/modules-dynamic-imports) · javascript.info, last updated February 8, 2020 · `await import(path)` with destructured named exports and the `default` property for default exports · fetched 2026-10-13 (*read*)
- **Our delta:** bundler chunking and conditional-loading patterns.

### T08-06 · Circular imports — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/06-circular-imports/01-what-happens.md`
- **Read this:** [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) · MDN guide · "Cyclic imports": works only if a binding is not read before initialization, otherwise a `ReferenceError` (*read*) · covers our angle: **partial** — does not describe the `undefined` case for other module systems · fetched 2026-10-13
- **Beyond the docs:** [Breaking down circular dependencies in JavaScript](https://www.bryanbraun.com/2025/03/29/breaking-down-circular-dependencies-javascript/) · Bryan Braun, 2025-03-29 · steps through an `a.js` and `b.js` loop ending in "Cannot access 'a' before initialization"; ESM bindings are live and can start uninitialized; advises removing cycles and lists madge and eslint-plugin-import · fetched 2026-10-13 (*read*)
- **Our delta:** the syllabus says an `undefined` binding, while the sources I read describe a `ReferenceError` for `let`, `const` and `class`; our page should separate the two (CommonJS gives a partial `exports`, see T08-15).

### T08-07 · `throw`, `try`/`catch`/`finally` — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/07-throw-try-catch/01-the-statements.md`
- **Read this:** [try...catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch) · MDN · optional catch binding, a `return` or `throw` in `finally` overrides earlier control flow, conditional catch with `instanceof` and re-throw (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [throw](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw) · MDN · any expression can follow `throw`, but the page says to throw an `Error` or subclass (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Error handling, "try...catch"](https://javascript.info/try-catch) · javascript.info, last updated April 8, 2025 · `finally` runs on any exit including `return`; "technically, we can use anything as an error object", though objects with `name` and `message` are preferred · fetched 2026-10-13 (*read*)
- **Our delta:** none material.

### T08-08 · Custom error classes — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/08-custom-error-classes/01-designing-the-taxonomy.md`
- **Read this:** [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) · MDN · "Custom error types" example; subclasses must forward `options` to `super(message, options)` for `cause` to work (*read*) · covers our angle: **partial** — no error-code convention · fetched 2026-10-13
- **Beyond the docs:** [Custom errors, extending Error](https://javascript.info/custom-errors) · javascript.info, last updated August 7, 2023 · extending `Error`, resetting `name`, wrapping low-level errors in one `ReadError` type; stores the original in `this.cause` by hand, which predates the built-in `cause` option · fetched 2026-10-13 (*read*)
- **Our delta:** error codes and typed errors at a module boundary.

### T08-09 · Failing well — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/09-failing-well/01-validate-at-the-boundary.md`
- **Beyond the docs (partial match):** [Node.js Error Handling Made Easy](https://sematext.com/blog/node-js-error-handling/) · Sematext, page shows "Updated on: March 19, 2025", no author named · separates operational errors (expected, handle them) from programmer errors (bugs, restart); lists invalid user input as operational; has no section on validation or on empty catch blocks · fetched 2026-10-13 (*read*)
- **Also good:** [no-empty](https://eslint.org/docs/latest/rules/no-empty) · ESLint · flags empty block statements including empty `catch` unless it holds a comment; `allowEmptyCatch` opts out (*read*) · fetched 2026-10-13
- **Our delta:** no primary doc covers this topic as stated (validate at the boundary, result objects versus exceptions). The neverthrow README and an exceptions-versus-results DEV post were not fetchable (403 and 404), so neither is linked. The Sematext pick is partial for this row: it covers operational versus programmer errors, but not boundary validation, empty `catch` or result objects.

### T08-10 · Global error handling — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/10-global-error-handling/01-the-handlers.md`
- **Read this:** [Window: error event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event) · MDN · `onerror` receives five arguments and must return `true` to cancel console output; the `error` event gets an `ErrorEvent` (*read*) · covers our angle: **partial** — rejections are a separate event · fetched 2026-10-13
- **Also good:** [Window: unhandledrejection event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) · MDN · promise rejections with no handler (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Client JavaScript reporting: window.onerror](https://blog.sentry.io/client-javascript-reporting-window-onerror/) · Ben Vinegar, Sentry blog, updated 2025-09-24 · the five arguments, a generic `Script error.` message for some cross-origin cases (the full `Error` object is the useful argument), and a hand-written `fetch` reporter; calls manual reporting "mostly obsolete" in favour of Sentry's SDK, so read it as vendor-leaning · fetched 2026-10-13 (*read*)
- **Our delta:** a reporter that does not itself throw or loop.

### T08-11 · The memory model — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/11-the-memory-model/01-stack-and-heap.md`
- **Read this:** [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management) · MDN guide · memory life cycle, references, mark-and-sweep (*read*) · covers our angle: **partial** — the spec does not mandate a stack and heap layout, which MDN does not say outright · fetched 2026-10-13
- **Beyond the docs:** [Garbage collection](https://javascript.info/garbage-collection) · javascript.info, last updated October 14, 2022 · reachability from roots, the interlinked `John` and `Ann` example where mutual references do not keep objects alive, and mark-and-sweep as spreading paint from the roots · fetched 2026-10-13 (*read*)
- **Our delta:** the cost of a reference in retained memory.

### T08-12 · Finding a leak — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/12-finding-a-leak/01-proving-there-is-one.md`
- **Read this:** [Record heap snapshots](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots) · Chrome for Developers, last updated 2024-02-09 · taking a snapshot, the Comparison view, the Retainers section, and "Uncover DOM leaks" for detached subtrees; names a Chrome 123 setting, so menus may have moved (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Fixing memory leaks in web applications](https://nolanlawson.com/2020/02/19/fixing-memory-leaks-in-web-applications/) · Nolan Lawson, 2020-02-19 · repeat the scenario a set number of times, sort by object count, follow retainer chains (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Taming The Unicorn: Easing JavaScript Memory Profiling In Chrome DevTools](https://addyosmani.com/blog/taming-the-unicorn-easing-javascript-memory-profiling-in-devtools/) · Addy Osmani, 2013-04-11 · the three-snapshot technique credited to the Gmail team, retaining trees, detached DOM in red; the panel names are from 2013, so verify against current DevTools · fetched 2026-10-13 (*read*)
- **Our delta:** the exact current menu path (verify against the DevTools you run).

### T08-13 · Bundlers and the build — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/13-bundlers-and-the-build/01-what-a-bundler-does.md`
- **Read this:** [Tree Shaking](https://webpack.js.org/guides/tree-shaking/) · webpack.js.org · static ES2015 structure is required, the `sideEffects` field in `package.json`, `usedExports`, production mode, and the pitfall of dropping CSS imports (*read*) · covers our angle: **partial** — webpack only; no `exports` map, no Vite or Rollup · fetched 2026-10-13
- **Beyond the docs:** [Reduce JavaScript payloads with tree shaking](https://web.dev/articles/reduce-javascript-payloads-with-tree-shaking) · Jeremy Wagner, web.dev, last updated 2018-06-14 · a 1,300-line `utils` module of which one function is used; `modules: false` in Babel to keep ES modules intact; old, so treat the config as webpack 4 era · fetched 2026-10-13 (*read*)
- **Our delta:** the `exports` map and diagnosing a 400 kB bundle with an analyzer.

### T08-14 · Testing JavaScript — Understand · ✅ written `docs/javascript/pages/phase-8-modules-errors/14-testing-javascript/01-the-shape-of-a-test.md`
- **Read this:** [Mocking](https://vitest.dev/guide/mocking) · Vitest · cheat sheet for mocking exported functions and classes, `vi.mock`, `vi.spyOn`, the current date and globals; timers and network requests are on separate pages, linked below (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) · Kent C. Dodds, 2020-08-17 · false negatives on refactor and false positives when wiring is broken (*read*) · fetched 2026-10-13
- **Also good:** [Timers](https://vitest.dev/guide/mocking/timers) and [Mocking Requests](https://vitest.dev/guide/mocking/requests) · Vitest · fake timers with `vi.useFakeTimers` and `advanceTimersByTime`; network mocking through Mock Service Worker rather than patching `fetch` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests) · Kent C. Dodds, 2019-07-13 · diminishing returns past roughly 70% coverage (his own admittedly made-up figure), mock less, avoid implementation details · fetched 2026-10-13 (*read*)
- **Our delta:** fake timers, network faking and what is worth testing, shown framework-neutral. Both Dodds posts are React-flavoured opinion.

### T08-15 · CommonJS in a modern world — Know · ✅ written `docs/javascript/pages/phase-8-modules-errors/15-commonjs-today/01-the-commonjs-model.md`
- **Read this:** [Modules: CommonJS modules](https://nodejs.org/api/modules.html) · nodejs.org · `exports` is a shortcut to `module.exports`; cache by resolved filename; a circular `require()` returns an unfinished `exports`; `require()` of ESM throws `ERR_REQUIRE_ASYNC_MODULE` with top-level `await` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Introduction to CommonJS](https://flaviocopes.com/commonjs/) · Flavio Copes, page shows "Updated Jul 18, 2026" · why `exports = x` exports nothing, `.cjs` or `"type": "commonjs"`, and a recommendation to set the module type explicitly · fetched 2026-10-13 (*read*)
- **Our delta:** interop through a bundler.

### T08-16 · `AggregateError` — Know · ✅ written `docs/javascript/pages/phase-8-modules-errors/16-aggregate-error.md`
- **Read this:** [AggregateError](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError) · MDN · wraps several errors in one, `errors` property, Baseline since September 2020 (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Promise.any()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any) · MDN · the built-in producer, errors in input order (*read*) · fetched 2026-10-13
- **Our delta:** none material. The one candidate third-party article (Medium) returned 403, so it is not linked.

### T08-17 · Mark-and-sweep and generational GC — Know · ✅ written `docs/javascript/pages/phase-8-modules-errors/17-gc-mark-sweep-generational.md`
- **Read this:** [Trash talk: the Orinoco garbage collector](https://v8.dev/blog/trash-talk) · Peter Marshall, V8 blog, 2019-01-03 · generational hypothesis, semi-space Scavenger, and Mark-Compact in marking, sweeping and compaction (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Garbage collection](https://javascript.info/garbage-collection) · javascript.info, last updated October 14, 2022 · gentler: roots, marking, and the new/old split in a few lines (*read*) · fetched 2026-10-13
- **Our delta:** which allocation patterns hurt, without tuning flags.

### T08-18 · Linting and formatting — Know · ✅ written `docs/javascript/pages/phase-8-modules-errors/18-linting-and-formatting.md`
- **Read this:** [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) · ESLint · flat config lives in `eslint.config.*` and exports an array of config objects, later matching objects override earlier ones (*read*) · covers our angle: **partial** — no list of bug-catching rules · fetched 2026-10-13
- **Also good:** [Rationale](https://prettier.io/docs/rationale) · Prettier · "Prettier is an opinionated code formatter" and "only prints code, does not transform it" (*read* those lines) · fetched 2026-10-13
- **Also good:** [Rules reference](https://eslint.org/docs/latest/rules/) · ESLint · rules marked as part of the `recommended` config; the Possible Problems section lists `no-undef`, `no-unused-vars`, `require-atomic-updates` and `no-unsafe-finally` (*read*) · fetched 2026-10-13
- **Our delta:** the handful of rules that catch real bugs; the rules index above is the closest authoritative list. A search found no good third-party piece, so no Beyond line.
