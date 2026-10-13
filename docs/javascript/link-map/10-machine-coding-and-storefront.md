---
title: "Link map · JavaScript · Part 10 (phases 17–18)"
sidebar_label: "10 · machine coding and storefront"
sidebar_position: 10
---

# Link map · JavaScript · Part 10 (phases 17–18)

Covers every topic row of phase 17 (T17-01 to T17-18, machine coding) from `docs/javascript/syllabus/04-dsa-and-machine-coding.md` and phase 18 (T18-01 to T18-18, the storefront front end) from `docs/javascript/syllabus/05-applied-storefront.md`. That is 36 rows. All 18 phase 17 rows have a written page of ours; in phase 18 rows 01 to 07, 11, 12 and 15 are written (✅) and the other eight are 🔲 not written.
*read* = I read the passage that supports the claim; *headings only* = fetched, headings or size checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where the Beyond line is absent, a search found nothing I could verify as better than the official page.

🔴 **Version note.** Our syllabus targets the current ECMAScript and browser platform in `docs/javascript/README.md`. MDN pages were fetched on 2026-10-13 and are the living reference. Several phase 17 explainers are older than the language they teach: the Corbacho debounce article (2016) predates `AbortSignal.timeout`, and the Zakas Promise series (2020) is written against ES2020. The Lodash docs URL redirects to a 4.18.1 page. `scheduler.yield()` is not in Safari per the web.dev long-tasks page. The AWS Builders' Library page now lives on builder.aws.com and shows a 2026 date. The Kyle Simpson picks (T17-02, T17-13) are the first edition of You Don't Know JS (2014) and the Functional-Light JS manuscript, both older than current ECMAScript.

---

## Phase 17 — Machine coding: implement it yourself

### T17-01 · `map`, `filter`, `reduce`, `forEach` on `Array.prototype` — Master · ✅ written `docs/javascript/pages/phase-17-machine-coding/01-array-methods/01-the-callback-contract.md`
- **Read this:** [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) · MDN · the callback is invoked only for indexes with assigned values, and a sparse array stays sparse after `map()` (*read*) · covers our angle: **partial** — `thisArg` gets one line and mutation of the source array during iteration is not discussed · fetched 2026-10-13
- **Also good:** [Array.prototype.reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) · MDN · an empty array with no `initialValue` throws `TypeError`, and `reduce()` skips holes but not `undefined` (`[1, 2, , 4]` sums to 7, with `undefined` it is `NaN`) (*read*) · fetched 2026-10-13
- **Our delta:** the hole-skipping check, `thisArg` forwarding and the length-snapshot behaviour when the array is mutated mid-loop. Several blog polyfills I found skip holes and `thisArg`, so they were not chosen.

### T17-02 · `call`, `apply` and `bind` — Master · ✅ written `docs/javascript/pages/phase-17-machine-coding/02-call-apply-bind/01-call-and-apply.md`
- **Read this:** [Function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind) · MDN · a bound function used with `new` ignores the bound `this` but keeps the prepended arguments, and `new.target` is the target function (*read*) · covers our angle: **full** for the `new` case · fetched 2026-10-13
- **Also good:** [Function.prototype.call](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call) · MDN · the `this` argument and in a non-strict function `null` and `undefined` become the global object and primitives are wrapped (*read*) · fetched 2026-10-13
- **Beyond the docs:** [You Don't Know JS: this and Object Prototypes, Chapter 2 "this All Makes Sense Now!"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/this%20%26%20object%20prototypes/ch2.md) · Kyle Simpson, first edition on GitHub · includes the MDN-style `bind` polyfill and shows `new` overriding a hard binding, noting that the simple hand-written helper cannot do this while built-in `bind` can (*read*) · fetched 2026-10-13
- **Our delta:** a hand-written `bind` that survives `new`. The popular bind polyfill I opened (DEV Community, ZeeshanAli-0704) admits it has no constructor path, so it is not a model answer.

### T17-03 · `debounce` and `throttle` — Master · ✅ written `docs/javascript/pages/phase-17-machine-coding/03-debounce-throttle/01-debounce.md`
- **Read this:** [Debouncing and Throttling Explained Through Examples](https://css-tricks.com/debouncing-throttling-explained-examples/) · David Corbacho, CSS-Tricks, 2016-04-06 · leading versus trailing edge, with debounce for resize and autocomplete and throttle for infinite scroll (*read*) · covers our angle: **partial** — it shows `cancel()` on a Lodash debounced function but has no `flush`, and nothing on return-value or `this` preservation · fetched 2026-10-13
- **Our delta:** `flush`, `this` and the return value, plus building `cancel` yourself, which no short explainer covers. A search for a from-scratch walkthrough with all of these returned only interview-prep sites and Lodash source, so none is listed.

### T17-04 · `Promise.all`, `race`, `any`, `allSettled` — Master · ✅ written `docs/javascript/pages/phase-17-machine-coding/04-promise-combinators/01-all-and-allsettled.md`
- **Read this:** [Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) · MDN · behaviour of the combinator, including non-promise values are awaited and returned as-is, an empty iterable gives an already-fulfilled promise (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Creating a JavaScript promise from scratch, Part 6: Promise.all() and Promise.allSettled()](https://humanwhocodes.com/blog/2020/12/creating-javascript-promise-from-scratch-promise-all-allsettled/) · Nicholas C. Zakas, 2020-12-16 · builds both over a raw promise; each item goes through a resolve call so non-promise values work, and a countdown reaching zero resolves an empty input, which is the edge case our row names; it does not spell either case out in prose (*read*) · fetched 2026-10-13
- **Our delta:** all four combinators side by side and the `any` empty-input `AggregateError`.

### T17-05 · An `EventEmitter` — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/05-eventemitter/01-the-core.md`
- **Read this:** [Node.js events](https://nodejs.org/api/events.html) · Node.js · listeners run synchronously in registration order, and listeners removed during an emit still run for that emit, because the set is fixed when the emit starts (*read*) · covers our angle: **full** for the mutation-during-emit bug · fetched 2026-10-13
- **Beyond the docs:** [How to code your own event emitter in Node.js: a step-by-step guide](https://www.freecodecamp.org/news/how-to-code-your-own-event-emitter-in-node-js-a-step-by-step-guide-e13b7e7908e1/) · Rajesh Pillai, freeCodeCamp, 2019-02-12 · builds `on`, `off`, `once` and `emit` against Node's API; it does not discuss changing listeners while an emit runs (*read*) · fetched 2026-10-13
- **Our delta:** the listener-array copy before looping, which is the bug the row names.

### T17-06 · Deep clone — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/06-deep-clone/01-writing-it.md`
- **Read this:** [structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) · MDN · throws `DataCloneError` for non-serializable input and preserves circular references (*read*) · covers our angle: **partial** — it does not list what is lost (prototypes, functions) · fetched 2026-10-13
- **Beyond the docs:** [How does JavaScript's structuredClone() differ from other cloning methods?](https://www.30secondsofcode.org/js/s/deep-clone-structured-clone/) · 30 seconds of code, page shows last updated 2025-08-14 · compares shallow copy, custom clone, JSON round trip and `structuredClone()` across Date/Map/Set, cycles, prototypes, getters and private fields, and says to prefer `structuredClone()` unless one of those special cases bites (*read*) · fetched 2026-10-13
- **Our delta:** writing the cycle-safe clone by hand and knowing the cases where it must replace `structuredClone`.

### T17-07 · A concurrency-limited task queue — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/07-task-queue/01-the-pool.md`
- **Beyond the docs:** [JavaScript promise concurrency limit](https://techearl.com/javascript-promise-concurrency-limit) · Ishan Karunaratne, TechEarl, 2026-06-02 · a worker pool over one shared cursor, writing into `results[index]` so order matches input; the basic version rejects on the first error, with options for `allSettled`, catching inside the task, or an `AbortSignal` (*read*) · fetched 2026-10-13
- **Our delta:** errors that do not stall the queue. The page above does not say what happens to other in-flight tasks after the first failure.

### T17-08 · Retry with exponential backoff, jitter and an `AbortSignal` — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/08-retry-backoff/01-backoff-and-jitter.md`
- **Read this:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · Marc Brooker, AWS Architecture Blog, 2015-03-04 · names full, equal and decorrelated jitter and why plain backoff leaves clusters of calls; the formulas are images, so I could not confirm them in text (*read*) · covers our angle: **partial** — no `AbortSignal`, no retryable-versus-not rules; the post carries a May 2023 update note · fetched 2026-10-13
- **Also good:** [AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) · MDN · a signal that aborts after a delay with a `TimeoutError` reason, unlike the `AbortError` of a manual abort (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Using fetch(), AbortSignal, and setTimeout() to apply retry mechanics in JavaScript](https://www.bennadel.com/blog/4200-using-fetch-abortsignal-and-settimeout-to-apply-retry-mechanics-in-javascript.htm) · Ben Nadel, 2022-02-06 · a fixed delay schedule with plus or minus 20 percent jitter, one `AbortSignal` that also cancels the wait between retries, and an `isRetryableError()` that retries network failures, 408, 429 and 5xx but not other 4xx or aborts; the delays are a hard-coded array, not computed exponential backoff (*read*) · fetched 2026-10-13
- **Our delta:** wiring the signal through a computed backoff loop and deciding which failures are retryable.

### T17-09 · An LRU cache in O(1) — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/09-lru-cache/01-the-map-trick.md`
- **Beyond the docs:** [LRU Cache](https://github.com/trekhleb/javascript-algorithms/tree/master/src/data-structures/lru-cache) · trekhleb/javascript-algorithms README · "Version 1" is a hash map plus doubly linked list, "Version 2" uses `Map` insertion order by delete-and-re-add, both O(1) average, so the row's two options appear side by side (*read*) · fetched 2026-10-13
- **Our delta:** the eviction test and why the `Map` version is enough in JavaScript.

### T17-10 · A Promise from scratch — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/10-promise-from-scratch/01-the-state-machine.md`
- **Read this:** [Promises/A+](https://promisesaplus.com/) · promisesaplus.com · `then` must return a promise, and callbacks must not run until the execution context stack holds only platform code (*read*) · covers our angle: **partial** — a spec, not a walk-through · fetched 2026-10-13
- **Beyond the docs:** [Creating a JavaScript promise from scratch, Part 2: Resolving to a promise](https://humanwhocodes.com/blog/2020/09/creating-javascript-promise-from-scratch-resolving-to-a-promise/) · Nicholas C. Zakas, 2020-09-29 · resolving to a thenable queues a job that calls its `then`, so the outer promise cannot settle synchronously; this is the "chaining that flattens" part of our row (*read*) · fetched 2026-10-13
- **Our delta:** the whole state machine in one place, including the microtask scheduling choice.

### T17-11 · `memoize` — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/11-memoize/01-the-key-problem.md`
- **Read this:** [Lodash memoize](https://lodash.com/docs/4.18.1#memoize) · Lodash · the first argument is the cache key unless a `resolver` is given, and the cache class can be replaced, for example by `WeakMap` (*read*) · covers our angle: **partial** — no TTL or size limit · fetched 2026-10-13 (the 4.17.15 URL redirects here)
- **Beyond the docs:** [proposal-function-memo](https://github.com/js-choi/proposal-function-memo) · TC39 proposal by js-choi · lays out the key problem: WeakMaps cannot hold primitive keys, so tuples or composite keys are needed, and what counts as an equal call (SameValue versus SameValueZero, `this`, `new.target`) is unresolved; a proposal, not a tutorial (*read*) · fetched 2026-10-13
- **Our delta:** TTL and cache size limits, which neither page gives.

### T17-12 · Deep equality — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/12-deep-equality/01-writing-it.md`
- **Beyond the docs:** [dequal](https://github.com/lukeed/dequal) · Luke Edwards, GitHub · a small, widely used library; supports Date, RegExp, Set, Map, typed arrays and NaN, with value equality inside Sets and Maps; the README does not say whether `-0` and `+0` differ (*read*) · fetched 2026-10-13
- **Our delta:** an explicit rule for `-0`, prototypes, and where the comparison should stop. Libraries disagree on Map and Set semantics, so state the rule.

### T17-13 · `curry`, `pipe` and `compose` — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/13-curry-pipe-compose/01-curry.md`
- **Read this:** [Currying](https://javascript.info/currying-partials) · javascript.info, 2021-01-10 · a `curry` helper that compares the argument count to `func.length`; it says currying needs a fixed number of arguments and fails for rest-parameter functions (*read*) · covers our angle: **partial** — no `pipe`, `compose`, placeholders or async composition · fetched 2026-10-13
- **Beyond the docs:** [Functional-Light JS, Chapter 4: Composing Functions](https://github.com/getify/Functional-Light-JS/blob/master/manuscript/ch4.md) · Kyle Simpson, free manuscript on GitHub, no date shown · a variadic `compose(..)` with alternative implementations, its left-to-right counterpart `pipe(..)`, and why composed functions should be unary; currying gets only a short note and points back to Chapter 3; nothing on async composition (*read*) · fetched 2026-10-13
- **Our delta:** variadic currying, placeholders and async composition.

### T17-14 · `promisify` and a callback↔promise bridge — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/14-promisify/01-writing-it.md`
- **Read this:** [Node.js util.promisify](https://nodejs.org/api/util.html) · Node.js · a `util.promisify.custom` property overrides the generated wrapper, for example for a function taking separate success and error callbacks; the page says nothing on callbacks with several success values (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Promisification](https://javascript.info/promisify) · javascript.info, 2022-10-18 · the base helper assumes `(err, result)`, then a `manyArgs` flag resolves with the array of all callback results, which is the multi-argument case our row names (*read*) · fetched 2026-10-13
- **Our delta:** the reverse direction (promise to callback) and the pitfalls of a callback called twice.

### T17-15 · A rate limiter — Understand · ✅ written `docs/javascript/pages/phase-17-machine-coding/15-rate-limiter/01-the-token-bucket.md`
- **Beyond the docs:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Paul Tarjan, Stripe, 2017-03-30 · a token bucket per user in Redis, plus concurrent-request and load-shedding limiters, with the reason for allowing bursts such as flash sales; the sliding window is not covered (*read*) · fetched 2026-10-13
- **Our delta:** the sliding window and the client-side code; the Stripe post is the server design.

### T17-16 · `new`, `Object.create` and `instanceof` by hand — Know · ✅ written `docs/javascript/pages/phase-17-machine-coding/16-new-create-instanceof/01-new-and-object-create.md`
- **Beyond the docs:** [Prototypes](https://www.bitovi.com/academy/learn-advanced-javascript/prototypes.html) · Bitovi Academy · "Exercise 1: new Operator" asks you to write `NEW(constructor, args)`: create an object, link its prototype to the constructor's `prototype`, call the constructor with it as `this` (*read*) · fetched 2026-10-13
- **Our delta:** the constructor-returns-an-object rule and an `instanceof` that walks `Object.getPrototypeOf`.

### T17-17 · A tiny pub/sub and a reactive `signal` — Know · ✅ written `docs/javascript/pages/phase-17-machine-coding/17-pubsub-and-signals/01-from-pubsub-to-tracking.md`
- **Beyond the docs:** [Building a Reactive Library from Scratch](https://dev.to/ryansolid/building-a-reactive-library-from-scratch-1i0p) · Ryan Carniato, DEV Community, 2021-02-18 (edited 2022-01-01) · about 50 lines giving signals, effects and memos with a global context that records the running effect; each run clears old subscriptions; he lists the missing pieces, such as batching and glitch-free updates (*read*) · fetched 2026-10-13
- **Our delta:** the pub/sub-to-tracking step and what the 40 lines leave out.

### T17-18 · A virtual-DOM diff in outline — Know · ✅ written `docs/javascript/pages/phase-17-machine-coding/18-virtual-dom-diff/01-the-diff.md`
- **Read this:** [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state) · react.dev · by default React identifies components by position in the parent, and a `key` becomes part of the position, scoped to the parent (*read*) · covers our angle: **partial** — the why of keys, not a diff implementation · fetched 2026-10-13
- **Also good:** [Build your own React](https://pomb.us/build-your-own-react/) · Rodrigo Pombo, 2019-11-13 · reconciliation by comparing old and new elements by type, with update, placement and deletion tags; keys are left out and listed as an exercise (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Adding keys to our DOM diffing algorithm](https://dev.to/joydeep-bhowmik/adding-keys-our-dom-diffing-algorithm-4d7g) · Joydeep Bhowmik, DEV Community, 2023-03-23 (edited 2023-04-19) · adds keyed children to a small diff: the key is stored off the element, missing keys are removed, and a new item at the top is inserted rather than rewriting every node (*read*) · fetched 2026-10-13
- **Our delta:** the keyed-children rule stated as a reconciliation algorithm in outline.

---

## Phase 18 — Building the store front end

### T18-01 · The product grid — Master · ✅ written `docs/javascript/pages/phase-18-storefront/01-product-grid/01-url-as-state.md`
- **Read this:** [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) · MDN · `get`, `getAll`, `set`, `append` and `delete` on a query string, and reading `window.location.search` (*read*) · covers our angle: **partial** — the API, not the design rule · fetched 2026-10-13
- **Beyond the docs:** [Search params](https://docs.scrimba.com/react/search-params) · Scrimba docs, no author or date shown · states that for filtering, sorting and pagination the URL is the single source of truth, and warns that copying a param into state with an effect creates two sources that drift; React Router flavoured (*read*) · fetched 2026-10-13
- **Our delta:** framework-free, plus resetting the page when a filter changes and keeping the back button honest.

### T18-02 · Search with autocomplete — Master · ✅ written `docs/javascript/pages/phase-18-storefront/02-search-autocomplete/01-the-three-bugs.md`
- **Read this:** [Debounce, throttle and race-safe search patterns](https://dev.to/zeeshanali0704/debounce-throttle-race-safe-search-patterns-3fh) · ZeeshanAli-0704, DEV Community, posted Jul 4 (year not shown) · debounce for request count, `AbortController` to cancel the previous request, and a request-ID check to drop any stale response (*read*) · covers our angle: **full** for the three bugs · fetched 2026-10-13
- **Beyond the docs:** [How to Prevent Race Conditions in JavaScript with AbortController](https://johnkavanagh.co.uk/articles/prevent-race-conditions-in-javascript-with-abortcontroller/) · John Kavanagh, 2018-12-03 · a search box where an older query's response arrives last and overwrites newer results; compares the request-ID guard (older requests still run to completion) with aborting the previous controller, says to treat `AbortError` as expected cancellation, and warns that aborting does not undo a server write (*read*) · fetched 2026-10-13
- **Our delta:** the order of the three bugs and a test that makes responses arrive out of order.

### T18-03 · A resilient API client — Master · ✅ written `docs/javascript/pages/phase-18-storefront/03-resilient-api-client/01-composing-the-client.md`
- **Read this:** [AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) · MDN · a per-request timeout whose rejection is a `TimeoutError`, which lets a client tell timeouts from user aborts (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · Marc, AWS Builders' Library, page shows 2026-06-12 · pick timeouts from latency percentiles, retries amplify load (three tries at each of five layers is 243x), retry at one layer, and retries are only safe on idempotent calls (*read*) · fetched 2026-10-13
- **Our delta:** single-flight deduplication and auth header injection, which neither page covers. No single page covered all of timeout, retry, typed errors and deduplication.

### T18-04 · The cart as a state machine — Master · ✅ written `docs/javascript/pages/phase-18-storefront/04-cart-state-machine/01-the-state-machine.md`
- **Read this:** [React reducer patterns](https://www.stanza.dev/courses/react-intermediate/usereducer/react-reducer-patterns) · stanza.dev, no author or date shown · "Never store values that can be computed from existing state", with a cart example that derives total and itemCount (*read*) · covers our angle: **partial** — React `useReducer` framing · fetched 2026-10-13
- **Beyond the docs:** [Don't Sync State. Derive It!](https://kentcdodds.com/blog/dont-sync-state-derive-it) · Kent C. Dodds, 2019-09-30 · only `squares` is stored in a tic-tac-toe board, so a new feature touches one field and the derived values follow; this is the "why the total is computed" argument (*read*) · fetched 2026-10-13
- **Our delta:** the same rule with no framework, and immutable add, increment, remove and clear.

### T18-05 · Money, quantities and rounding — Master · ✅ written `docs/javascript/pages/phase-18-storefront/05-money-and-rounding/01-integer-minor-units.md`
- **Read this:** [Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) · MDN · the `currency` style with a currency code; the examples round EUR to two decimals and JPY to none, since yen has no minor unit (*read*) · covers our angle: **partial** — display only · fetched 2026-10-13
- **Beyond the docs:** [Currency calculations in JavaScript](https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/) · Julio Sampaio, Honeybadger, 2021-09-13 · warns against float money, shows `Intl.NumberFormat` examples for several locales, and names currency.js and Dinero.js as integer-based libraries; rounding gets no dedicated section (*read*) · fetched 2026-10-13
- **Our delta:** integer minor units end to end, tax and discount ordering, and formatting only at the edge.

### T18-06 · Optimistic updates with rollback — Master · ✅ written `docs/javascript/pages/phase-18-storefront/06-optimistic-updates/01-apply-and-reconcile.md`
- **Read this:** [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · TanStack Query docs · cancel in-flight refetches, snapshot the previous value, roll back on error, then refetch in `onSettled` (*read*) · covers our angle: **partial** — library-specific, but the snapshot, rollback and reconcile sequence is the whole pattern · fetched 2026-10-13
- **Our delta:** the same sequence by hand and keeping the UI honest while a request is in flight. The page also describes a simpler variant that renders the pending variables with no cache rollback. Two searches for a vanilla-JavaScript explainer found only React, Next.js and framework docs, so no Beyond line.

### T18-07 · Idempotency from the client — Master · ✅ written `docs/javascript/pages/phase-18-storefront/07-idempotency/01-the-double-submit.md`
- **Read this:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe API docs · for API v1 the client generates the key (V4 UUID suggested, up to 255 characters), a retry returns the saved response, keys may be pruned after 24 hours, and reusing a key with different parameters is an error (*read*) · covers our angle: **partial** — no UI side · fetched 2026-10-13
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach, 2017-10-27 (byline inferred from the site) · atomic phases and recovery points stored on the key record, so a retry resumes where it stopped; this is the server half our page links to (*read*) · fetched 2026-10-13
- **Our delta:** why disabling the button is not a fix, and when the client generates and reuses its key.

### T18-08 · Persisting the cart — Understand · 🔲 not written
- **Read this:** [storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) · MDN · fires in other same-origin tabs for `localStorage` changes and not in the tab that made the change (*read*) · covers our angle: **partial** — nothing on schema versions or quota · fetched 2026-10-13
- **Also good:** [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) · MDN · messages reach every same-origin context except the sender, and it holds no data itself (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Browser tab sync with BroadcastChannel](https://blog.openreplay.com/browser-tab-sync-broadcastchannel/) · OpenReplay Team, 2026-08-04 · compares the two: BroadcastChannel carries structured-clone objects but stores nothing, the `storage` event carries only strings but is backed by durable state; a tab opened later never gets an earlier message, so persist state and read it on mount (*read*) · covers our angle: **partial** — nothing on schema versions or quota · fetched 2026-10-13
- **Our delta:** a versioned key with a migration, handling `QuotaExceededError`, and choosing the event versus the channel. Third-party pages I found for schema migration were short library READMEs and copied rule files, so none is listed.

### T18-09 · Auth in the browser — Understand · 🔲 not written
- **Read this:** [Token Storage](https://auth0.com/docs/secure/security-guidance/data-security/token-storage) · Auth0 docs · in-memory storage is "the most secure option" for browser tokens, script injected into the SPA can read tokens in `localStorage`, and cookies are discussed for traditional web apps, with a 4 KB limit; refresh-token rotation is named only as a requirement for getting a refresh token, not explained (*read*) · covers our angle: **partial** — nothing on refresh-race collapsing or logout across tabs · fetched 2026-10-13
- **Beyond the docs:** [Fix the token refresh race with the Web Locks API](https://blog.openreplay.com/fix-token-refresh-race-web-locks-api/) · OpenReplay Team, 2026-09-09 · with rotating refresh tokens several tabs log each other out; an in-tab `isRefreshing` queue cannot see other tabs, so wrap the refresh in `navigator.locks.request` and re-check the stored token inside the lock; it calls the single-tab queue correct but does not develop it (*read*) · covers our angle: **partial** — the cross-tab half of the row · fetched 2026-10-13
- **Our delta:** one refresh request shared by concurrent callers inside a tab, and logout propagated through `BroadcastChannel`. Vendor guidance differs; Auth0's own forum shows both views.

### T18-10 · Checkout forms — Understand · 🔲 not written
- **Read this:** [Client-side form validation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation) · MDN · `checkValidity()`, `reportValidity()` and `setCustomValidity()`; a non-empty custom error blocks submission (*read*) · covers our angle: **partial** — no multi-step state or server-error mapping · fetched 2026-10-13
- **Also good:** [Error summary](https://design-system.service.gov.uk/components/error-summary/) · GOV.UK Design System · always show a summary on a validation error, move keyboard focus to it, and link each entry to its field (*read*) · fetched 2026-10-13
- **Our delta:** multi-step state and mapping server field errors back onto fields. A search found checklists and library READMEs, no tutorial covering step state and server-error mapping, so no Beyond line.

### T18-11 · Infinite scroll and lazy images — Understand · ✅ written `docs/javascript/pages/phase-18-storefront/11-infinite-scroll-and-lazy-images/01-the-endless-list.md`
- **Read this:** [Browser-level image lazy-loading for the web](https://web.dev/articles/browser-level-image-lazy-loading) · Addy Osmani, Houssein Djirdeh, Mathias Bynens, Barry Pollard, web.dev, last updated 2024-08-13 · set `width` and `height` so the browser reserves space, lazy-load only images outside the first viewport, never the LCP image (*read*) · covers our angle: **partial** — nothing on `srcset` or the sentinel · fetched 2026-10-13
- **Also good:** [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) · MDN · the overview lists lazy loading and infinite scrolling, and the options section covers `rootMargin` for loading just before an item is visible (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Infinite scroll without layout shifts](https://addyosmani.com/blog/infinite-scroll-without-layout-shifts/) · Addy Osmani, 2020-07-30 · reserve space with placeholders sized to match content, prefetch below the fold, keep footer content out of the way, and virtualize long lists; it does not describe the sentinel pattern (*read*) · fetched 2026-10-13
- **Our delta:** the sentinel element and `srcset` in one flow.

### T18-12 · Long lists without freezing — Understand · ✅ written `docs/javascript/pages/phase-18-storefront/12-long-lists-without-freezing/01-why-a-long-list-freezes.md`
- **Read this:** [Virtualize large lists with react-window](https://web.dev/articles/virtualize-long-lists-react-window) · Jason Miller and Houssein Djirdeh, web.dev, last updated 2019-04-29 · measure first, then render only what is visible so DOM size follows the window and not the list (*read*) · covers our angle: **partial** — library-based, an older page · fetched 2026-10-13
- **Beyond the docs:** [150 lines or less: implementing virtual scroll for web from scratch](https://dev.to/anishkumar/150-lines-or-less-implementing-virtual-scroll-for-web-from-scratch-4363) · Anish Kumar, DEV Community, 2025-04-17 · fixed row height with index math and an overscan buffer of half the window on each side; variable heights are left as a future post (*read*) · fetched 2026-10-13
- **Our delta:** when virtualisation starts to beat rendering everything.

### T18-13 · Client-side routing from scratch — Understand · 🔲 not written
- **Read this:** [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) · MDN · `back`, `forward` and `go` are described; `pushState` and `replaceState` appear only in the example code, and `popstate` is linked (*read*) · covers our angle: **partial** — nothing on scroll restoration, which is on [History.scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration) (`auto` or `manual`) · fetched 2026-10-13
- **Beyond the docs:** [Build client-side routing with the History API](https://blog.openreplay.com/build-client-side-routing-history-api/) · OpenReplay Team, 2026-08-23 · about 50 lines: `pushState` does not fire `popstate`, so the router renders itself; link click delegation; `:id` segments; a 404 fallback; server rewrites for Express, Nginx, Netlify and Vercel (*read*) · covers our angle: **partial** — no focus management, scroll restoration or code-splitting · fetched 2026-10-13
- **Our delta:** focus management on navigation and per-route code-splitting. I found only blog advice on focus (move it to a heading with `tabindex="-1"`) and did not open it.

### T18-14 · Real-time order tracking — Understand · 🔲 not written
- **Read this:** [Server Sent Events](https://javascript.info/server-sent-events) · javascript.info, 2020-11-30 · `EventSource` reconnects on its own, an `id:` field becomes a `Last-Event-ID` header on reconnect, `retry:` sets the delay, and WebSocket needs manual reconnect (*read*) · covers our angle: **full** for the SSE half · fetched 2026-10-13
- **Beyond the docs:** [WebSocket vs SSE: Which One Should You Use?](https://websocket.org/comparisons/sse/) · Matthew O'Riordan, websocket.org, 2025-01-07 (updated 2026-03-10) · SSE for one-way feeds and notifications, WebSocket for two-way and binary; the WebSocket example reconnects with exponential backoff and resets on open. The author is the CEO of Ably, a realtime vendor, so treat the leanings as an opinion; the backoff example has no cap and no jitter (*read*) · fetched 2026-10-13
- **Our delta:** reconciling order state after a gap, which neither page covers.

### T18-15 · Review uploads — Understand · ✅ written `docs/javascript/pages/phase-18-storefront/15-review-uploads/01-the-photo-list.md`
- **Read this:** [XMLHttpRequestUpload](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequestUpload) · MDN · `progress` events with `loaded` and `total` on `xhr.upload`, with listeners attached before `send()`, and a `FormData` example (*read*) · covers our angle: **partial** — no Canvas resize and no file validation · fetched 2026-10-13
- **Beyond the docs:** [Build an upload progress bar in JavaScript](https://blog.openreplay.com/build-upload-progress-bar-js/) · OpenReplay Team, 2025-11-20 · `xhr.upload.onprogress` driving a `progress` element with `FormData`; a 10MB client limit and an `accept` filter, and it says server-side type checks are needed but does not show them (*read*) · fetched 2026-10-13
- **Our delta:** Canvas resize and validating a file you cannot trust by its bytes.

### T18-16 · Dates and delivery estimates — Understand · 🔲 not written
- **Read this:** [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) · MDN · with no offset, date-only forms are read as UTC and date-time forms as local time, a historical spec error kept for web compatibility (*read* that passage) · covers our angle: **partial** — this is the cause of the off-by-one-day bug · fetched 2026-10-13
- **Also good:** [Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat) · MDN · `format(-1, "day")` gives "1 day ago" and `numeric: "auto"` gives "yesterday"; the page has no "tomorrow" example (*read*) · fetched 2026-10-13
- **Also good:** [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) · MDN · formats a `Date` for a locale, with `dateStyle`, `timeStyle` and a `timeZone` option (*read*) · fetched 2026-10-13
- **Our delta:** the instant-from-server to local-date flow and a test of the off-by-one case. Two searches found short personal write-ups on the bug (one DEV post is mostly about date-fns) and SEO pages; none is listed.

### T18-17 · Failing in public — Understand · 🔲 not written
- **Read this:** [Window error event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event) · MDN · fires for script errors thrown synchronously; a promise rejection with no handler fires `unhandledrejection` instead (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [unhandledrejection event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) · MDN · listen on `window`, `event.reason` holds the value, `preventDefault()` stops the console log (*read*) · [Component (error boundaries)](https://react.dev/reference/react/Component) · react.dev · boundaries do not catch errors in event handlers, asynchronous code, server rendering or the boundary itself (*read*) · fetched 2026-10-13
- **Our delta:** degrading one broken widget, a retry affordance and what to report. Two searches returned vendor observability docs and mixed blog posts; none covered handlers, widget fallback and reporting together, so none is listed.

### T18-18 · A performance budget — Understand · 🔲 not written
- **Read this:** [The most effective ways to improve Core Web Vitals](https://web.dev/articles/top-cwv) · Chrome team, web.dev, last updated 2024-10-31 · for INP, break up long tasks and cut JavaScript with code splitting; for LCP, make the image discoverable and never lazy-load it; for CLS, set explicit sizes (*read*) · covers our angle: **partial** — no budget numbers or measuring method · fetched 2026-10-13
- **Also good:** [Optimize long tasks](https://web.dev/articles/optimize-long-tasks) · Jeremy Wagner and Brendan Kenny, web.dev, published 2022-09-30 (updated 2024-12-19) · a long task is over 50 ms; yield with `scheduler.yield()` or a `setTimeout` fallback; `isInputPending()` is no longer recommended (*read*) · fetched 2026-10-13
- **Also good:** [Performance budgets 101](https://web.dev/articles/performance-budgets-101) · Milica Mihajlija, web.dev, last updated 2018-11-05 · quantity, milestone and rule-based metrics, with starter numbers such as 170 KB of JavaScript on a mobile product page; it predates INP and uses Time to Interactive, so take the method and not the metrics (*read*) · fetched 2026-10-13
- **Our delta:** setting a budget in current metrics (LCP, INP, long tasks) and measuring before and after. I did not list a third-party budget guide: the ones I saw gave conflicting thresholds.
