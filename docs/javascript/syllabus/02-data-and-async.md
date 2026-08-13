---
title: "Part 2 — Data, iteration and async"
sidebar_label: "2 · Data & async"
sidebar_position: 2
---

> **Phases 5–8 · 79 topics · 26 Master**
> The standard library you use every day, the protocols that make it iterable,
> and the concurrency model that makes JavaScript what it is.

Phase 7 is the centre of gravity of the whole syllabus. If you only ever finish
one phase to Master depth, finish that one — it is what every interview probes
and what every production incident traces back to.

---

## Phase 5 — The built-in library

*26 topics.* Grouped by object, not by method: array iteration is one page, not
eight. Grouping reduces noise, never coverage — every method still gets its own
example and its own gotcha.

| Topic | Tier |
|---|---|
| **Array creation and shape** — literals, `Array.of`, `Array.from` with a map function, sparse arrays and holes, and `length` as a *writable* property | <span className="db-tier t-master">Master</span> |
| **Adding and removing** — `push`/`pop`/`shift`/`unshift`/`splice`, mutation in place, and why `shift` in a loop is an O(n²) queue | <span className="db-tier t-master">Master</span> |
| **`slice` vs `splice` vs `at`** — copy versus mutate, negative indices, and the name collision that catches everyone | <span className="db-tier t-understand">Understand</span> |
| **Array iteration methods** — `forEach`, `map`, `filter`, `find`, `findIndex`, `findLast`, `some`, `every`, and choosing between them | <span className="db-tier t-master">Master</span> |
| **`reduce`** — the shape that stays readable, the missing-initial-value trap, accumulating into objects and Maps, and when a plain loop is the better answer | <span className="db-tier t-master">Master</span> |
| **`sort`** — the default *string* comparison that ruins numbers, the comparator contract, guaranteed stability, in-place mutation, and multi-key sorting | <span className="db-tier t-master">Master</span> |
| **String methods** — `slice`/`substring`/`at`, `split`, `trim` family, `padStart`/`padEnd`, `repeat`, and `replace` vs `replaceAll` | <span className="db-tier t-master">Master</span> |
| **Template literals** — interpolation, multiline, nesting, and **tagged templates** with the raw strings array | <span className="db-tier t-understand">Understand</span> |
| **`JSON.parse` and `JSON.stringify`** — the replacer and reviver, `toJSON`, what is silently dropped (`undefined`, functions, `Symbol`), and how cycles throw | <span className="db-tier t-master">Master</span> |
| **`Map` vs a plain object** — any key type, insertion order, `size`, direct iteration, and a decision rule for which to reach for | <span className="db-tier t-master">Master</span> |
| **`Number` and `Math`** — the rounding family, `toFixed` returning a string and rounding oddly, random integers in a range, clamping | <span className="db-tier t-understand">Understand</span> |
| **String searching** — `includes`, `indexOf`, `startsWith`, `endsWith`, and `localeCompare` for sorting human text | <span className="db-tier t-understand">Understand</span> |
| **Non-mutating array counterparts** — `toSorted`, `toReversed`, `toSpliced`, `with`, and why they exist | <span className="db-tier t-understand">Understand</span> |
| **`flat`, `flatMap`, `fill`, `copyWithin`**, and `includes` vs `indexOf` on `NaN` | <span className="db-tier t-understand">Understand</span> |
| **Regular expressions — the syntax** — character classes, quantifiers, anchors, groups, named groups, alternation, lookahead and lookbehind | <span className="db-tier t-understand">Understand</span> |
| **Regular expressions — in practice** — `test` vs `match` vs `matchAll`, flags, the `lastIndex` trap with `/g`, replacement callbacks, and catastrophic backtracking | <span className="db-tier t-understand">Understand</span> |
| **`Set`** — deduplication, membership tests, and the set methods (`union`, `intersection`, `difference`, `isSubsetOf`) | <span className="db-tier t-understand">Understand</span> |
| **`Object` statics** — `assign`, `entries`, `create`, `getOwnPropertyNames`, `groupBy`, and `Map.groupBy` | <span className="db-tier t-understand">Understand</span> |
| **`Date`** — the parsing traps, zero-indexed months, UTC vs local, arithmetic, formatting, and why a library is still the default answer | <span className="db-tier t-understand">Understand</span> |
| **`Intl`** — `NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `Collator`, `ListFormat`, `PluralRules`, `Segmenter` | <span className="db-tier t-understand">Understand</span> |
| **`structuredClone`** — what it handles that JSON cannot (cycles, `Map`, `Set`, `Date`, typed arrays) and what it refuses (functions, DOM nodes) | <span className="db-tier t-understand">Understand</span> |
| **Array-likes and iterables** — `arguments`, `NodeList`, strings, and converting each correctly | <span className="db-tier t-understand">Understand</span> |
| **`WeakMap` and `WeakSet`** — attaching data to objects without leaking them, plus `WeakRef` and `FinalizationRegistry` | <span className="db-tier t-know">Know</span> |
| **`Temporal`** — the replacement for `Date`, its shape (`PlainDate`, `Instant`, `ZonedDateTime`), and where it currently ships | <span className="db-tier t-know">Know</span> |
| **Typed arrays, `ArrayBuffer` and `DataView`** — when bytes matter, views over one buffer, and endianness | <span className="db-tier t-know">Know</span> |
| Text encoding — `TextEncoder`/`TextDecoder`, `btoa`/`atob` and its Unicode failure, and base64 in 2026 | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can sort an array of objects by two keys, group it
into a `Map`, and say exactly which of those operations mutated the original.

---

## Phase 6 — Iteration, destructuring and generators

*13 topics.* The protocol layer. Small phase, but it is what lets `for…of`,
spread, destructuring and `Promise.all` all work on the same objects.

| Topic | Tier |
|---|---|
| **Destructuring** — arrays, objects, nested, defaults, renaming, rest, in parameters, and the swap idiom | <span className="db-tier t-master">Master</span> |
| **`for…of` vs `for…in` vs `forEach`** — what each iterates, and which ones `break`, `return` and `await` actually work in | <span className="db-tier t-master">Master</span> |
| **Spread with iterables** — strings, `Set`, `Map`, generators, and how object spread is a *different* operation with the same syntax | <span className="db-tier t-master">Master</span> |
| **The iteration protocols** — `Symbol.iterator`, the `next()` contract, and making your own object work with `for…of` | <span className="db-tier t-understand">Understand</span> |
| **Generators** — `function*`, `yield`, lazy sequences, and infinite streams that cost nothing until consumed | <span className="db-tier t-understand">Understand</span> |
| **Async iterators** — `Symbol.asyncIterator`, `for await…of`, and async generators | <span className="db-tier t-understand">Understand</span> |
| **Paginating an API with an async generator** — the pattern worth stealing, and where it beats collecting an array | <span className="db-tier t-understand">Understand</span> |
| **Early exit inside iteration** — `some`/`every` as a `break`, `find` instead of `filter()[0]`, and the cost of chaining | <span className="db-tier t-understand">Understand</span> |
| **Two-way generators** — `next(value)`, `return()`, `throw()`, and the generator-as-coroutine idea behind async/await | <span className="db-tier t-know">Know</span> |
| **`yield*` delegation** and composing generators | <span className="db-tier t-know">Know</span> |
| **Iterator helpers** — `.map`, `.filter`, `.take`, `.drop`, `.toArray` on iterators, and lazy pipelines | <span className="db-tier t-know">Know</span> |
| Writing a collection class that iterates cleanly, and implementing `Symbol.iterator` on it | <span className="db-tier t-know">Know</span> |
| Driving an iterator by hand — where manual `next()` beats `for…of` | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can write a generator that yields pages from a
paginated endpoint and consume it with `for await…of`.

---

## Phase 7 — Asynchronous JavaScript

*22 topics.* The most consequential phase in this syllabus. Every row here shows
up in interviews, and the ordering row shows up in almost all of them.

| Topic | Tier |
|---|---|
| **Synchronous vs asynchronous** — one thread executing your code, and what is genuinely running elsewhere | <span className="db-tier t-master">Master</span> |
| **The event loop** — call stack, task queue, microtask queue, and where rendering fits between them | <span className="db-tier t-master">Master</span> |
| **Microtasks vs macrotasks** — the exact drain order, and the `setTimeout`/`Promise.then`/sync ordering exercise | <span className="db-tier t-master">Master</span> |
| **Callbacks** — the pattern, the error-first convention, inversion of control, and how callback hell actually forms | <span className="db-tier t-master">Master</span> |
| **Promises** — the three states, `then`/`catch`/`finally`, and what returning a value versus a promise does to the chain | <span className="db-tier t-master">Master</span> |
| **Chaining** — flattening, the `return` you forgot, error propagation down the chain, and where `finally` runs | <span className="db-tier t-master">Master</span> |
| **`async`/`await`** — what it desugars to, exactly where the function suspends, and that an `async` function always returns a promise | <span className="db-tier t-master">Master</span> |
| **Error handling in async code** — `try`/`catch` around `await`, `.catch`, rejections that vanish, and the unhandled-rejection handler | <span className="db-tier t-master">Master</span> |
| **Sequential vs parallel `await`** — the accidental waterfall, starting work before awaiting it, and the fix | <span className="db-tier t-master">Master</span> |
| **`Promise.all` vs `allSettled` vs `race` vs `any`** — fail-fast semantics, what happens to the losers, and picking the right one | <span className="db-tier t-master">Master</span> |
| **Promise anti-patterns** — the explicit-construction anti-pattern, `await` inside `forEach`, floating promises, `return await` | <span className="db-tier t-master">Master</span> |
| **Timers** — `setTimeout`/`setInterval`, the minimum-delay clamp, drift, why `0` is not `0`, and clearing them correctly | <span className="db-tier t-understand">Understand</span> |
| **Creating promises** — `new Promise`, `resolve`/`reject`, and promisifying a callback API correctly | <span className="db-tier t-understand">Understand</span> |
| **Cancellation** — `AbortController`, `AbortSignal.timeout`, `AbortSignal.any`, `throwIfAborted`, and propagating a signal down a call tree | <span className="db-tier t-understand">Understand</span> |
| **Timeouts, retries, backoff and jitter** — the wrapper every real client needs, and which errors are safe to retry | <span className="db-tier t-understand">Understand</span> |
| **Concurrency limiting** — running N tasks at a time over a large list without exhausting the target | <span className="db-tier t-understand">Understand</span> |
| **Race conditions in a UI** — stale responses overwriting fresh ones, keying by request, and last-write-wins | <span className="db-tier t-understand">Understand</span> |
| **`queueMicrotask`** — and when it is the right tool instead of `setTimeout(fn, 0)` | <span className="db-tier t-understand">Understand</span> |
| **Event loop: browser vs Node** — rendering and `requestAnimationFrame` on one side, phases, `setImmediate` and `process.nextTick` on the other | <span className="db-tier t-understand">Understand</span> |
| **`Promise.withResolvers`** and the deferred pattern it replaces | <span className="db-tier t-know">Know</span> |
| **Thenables** — how `await` treats any object with a `then`, and interop with non-native promise libraries | <span className="db-tier t-know">Know</span> |
| Async work and backpressure — why an unbounded `Promise.all` over 50 000 items is a bug | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can predict the console order of a snippet mixing
sync code, `setTimeout(…, 0)`, `Promise.resolve().then` and an `await`, and
explain *why* rather than reciting the answer.

---

## Phase 8 — Modules, errors, memory and the toolchain

*18 topics.* What turns a file of JavaScript into a program someone else can
maintain: how code is split, how failure is represented, and what the garbage
collector will and will not do for you.

| Topic | Tier |
|---|---|
| **ES modules** — `import`/`export`, default vs named, live bindings, and top-level `await` | <span className="db-tier t-master">Master</span> |
| **Modules are singletons, strict, deferred and hoisted** — what each of those means the first time it surprises you | <span className="db-tier t-master">Master</span> |
| **`Error` and its subclasses** — `message`, `name`, `stack`, `cause`, and checking errors without string matching | <span className="db-tier t-master">Master</span> |
| **Leaks you will actually cause** — detached DOM nodes, forgotten listeners and timers, closures holding large objects, module-level caches that never evict | <span className="db-tier t-master">Master</span> |
| **Dynamic `import()`** — code splitting, conditional loading, and its promise semantics | <span className="db-tier t-understand">Understand</span> |
| **Circular imports** — how ESM resolves them, and the `undefined` binding you get instead of an error | <span className="db-tier t-understand">Understand</span> |
| **`throw`, `try`/`catch`/`finally`** — optional catch binding, what `finally` can override, and throwing non-`Error` values | <span className="db-tier t-understand">Understand</span> |
| **Custom error classes** — the prototype fix, error codes, `cause` chains, and typed errors at a module boundary | <span className="db-tier t-understand">Understand</span> |
| **Failing well** — validate at the boundary, never write an empty `catch`, and result objects versus exceptions | <span className="db-tier t-understand">Understand</span> |
| **Global error handling** — `window.onerror`, `unhandledrejection`, `error` events, and shipping errors to a reporter | <span className="db-tier t-understand">Understand</span> |
| **The memory model** — stack versus heap, what a reference costs, and what makes an object reachable | <span className="db-tier t-understand">Understand</span> |
| **Finding a leak** — DevTools heap snapshots, the allocation timeline, retainer paths, and comparing two snapshots | <span className="db-tier t-understand">Understand</span> |
| **Bundlers and the build** — ESM in, tree shaking, `sideEffects`, the `exports` map, and why your bundle is 400 kB | <span className="db-tier t-understand">Understand</span> |
| **Testing JavaScript** — Vitest/Jest shape, mocking time, network and modules, and what is worth testing | <span className="db-tier t-understand">Understand</span> |
| **CommonJS in a modern world** — `require`/`module.exports`, interop through a bundler, and why you still meet it | <span className="db-tier t-know">Know</span> |
| **`AggregateError`** and reporting several failures at once | <span className="db-tier t-know">Know</span> |
| **Mark-and-sweep and generational GC** — enough to reason about allocation patterns, not to tune a flag | <span className="db-tier t-know">Know</span> |
| **Linting and formatting** — ESLint flat config, Prettier, and the handful of rules that catch real bugs | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why a `setInterval` in a component that
was removed keeps a whole subtree alive, and demonstrate it in a heap snapshot.

---

## Where this connects

- **Phase 7 → Node.js Phase 2** — the microtask queue is the language; libuv
  phases, `setImmediate` and `process.nextTick` are the **runtime**, and live in
  the [Node.js syllabus](/docs/nodejs).
- **Phase 7 → Phase 11** — `fetch`, `AbortController` and request races are the
  applied version of everything here.
- **Phase 5 → Phase 13** — `Map` versus object and `shift` versus `pop` are
  re-examined with measured costs in the DSA track.
- **Phase 8 → Phase 17** — a hand-written `EventEmitter` and task queue are
  where error handling and closures meet.
- **Deliberately not here:** module *resolution* in Node, `package.json` fields
  and npm — those are Node.js Phase 1.

---

← [Part 1 — Language core](./01-language-core.md) · Next: [Part 3 — Web APIs](./03-web-apis.md) →
