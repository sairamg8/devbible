---
name: devbible-javascript-concepts-phase17
description: Load-bearing claims and sources for JavaScript phase 17 — machine coding, implement it yourself
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 17 or any "implement it
yourself" question.*

Provenance: **documentation-validated** against MDN. 🔴 **No timings and no console blocks** —
nothing was run. Phase 17 has **4 Master topics**; ✅ **all done** (commit `98ce80b`). 05–18
deferred.

⚠️ **The syllabus gate names four things — `bind`, `debounce`, `Promise.all`, `EventEmitter` — and
`EventEmitter` is topic 05, deferred.** Stated on the phase README rather than papered over.

## Topic 01 · `map`/`filter`/`reduce`/`forEach`
- MDN quotes: callback args (element, index, array); `thisArg` *"A value to use as `this`"*;
  *"`callbackFn` is invoked only for array indexes which have assigned values. It is not invoked
  for empty slots in sparse arrays."*; *"`map()` method is generic. It only expects the `this`
  value to have a `length` property and integer-keyed properties."*
- 🔴 **`if (i in o)` is the hole check — NOT `o[i] !== undefined`.** A hole and a stored
  `undefined` are different; the callback skips one and visits the other.
- `Object(this)` + `length >>> 0` (ToUint32) for genericity.
- **`map` preserves length and holes; `filter` compacts.** Opposite behaviours, not a style choice.
- `forEach` returns `undefined` and cannot be broken out of (`break` is a syntax error; `throw` to
  escape is an anti-pattern).
- 🔴 **`reduce` detects its initial value by ARGUMENT COUNT, not by `!== undefined`** —
  `reduce(f, undefined)` did pass one. **The single most-probed detail in the topic.** Empty +
  no seed → `TypeError: Reduce of empty array with no initial value`. `reduce` takes **no**
  `thisArg`.
- ⚠️ `thisArg` does nothing for an arrow callback — arrows have no own `this`; it is a pre-arrow
  affordance.
- **Mutation during iteration**: length captured at start (appends never visited); changes to
  not-yet-visited elements ARE seen; deletions ahead become holes.
- 🔴 **`[].every(f)` is `true`** (vacuous truth), `[].some(f)` is `false`. Short-circuiting must be
  a real early return — a flag is observably different.
- `indexOf` (`===`, skips holes) vs `includes` (SameValueZero, treats holes as `undefined`) →
  differ on **both NaN and holes**.
- 🔴 **`flat` removes empty slots at ANY depth, including `depth = 0`.** `Array.isArray` not
  `instanceof` (realms). ⚠️ `push(...spread)` can `RangeError` on a huge flatten.
- ⚠️ **Do not ship a prototype polyfill** — the `flatten`→`flat` (SmooshGate) rename is the reason;
  also `for…in` pollution unless non-enumerable.

## Topic 02 · `call`, `apply`, `bind`
- `call`: put the fn on the target under a **fresh `Symbol`**, call as a method, remove in a
  **`finally`**, define **non-enumerable**. Four details, each a follow-up.
- ⚠️ Sloppy-mode coercion (`null` → `globalThis`, primitives boxed) vs **strict mode, where `this`
  is used as-is** — ES modules are always strict. Say which you implement.
- `apply`: **`Array.from`, not spread** — `apply` accepts array-likes that are not iterable.
- `this` precedence table; 🔴 **arrows are the exception** — `call`/`apply`/`bind` cannot set their
  `this`.
- Still-current `call` idioms: `Object.prototype.toString.call(x)` (the reliable type tag) and
  `hasOwnProperty.call(obj, k)` (→ now `Object.hasOwn`).
- **`bind` MDN quotes**: *"The value is ignored if the bound function is constructed using the
  `new` operator."*; *"because a bound function does not have the `prototype` property, it cannot
  be used as a base class for `extends`"*; re-binding — *"The newly bound `thisArg` value is
  ignored"* while **arguments accumulate** (first bind's, second's, then the call's).
- 🔴 **Two lines make `bind` work under `new`**: `new.target` (or `this instanceof boundFn`)
  detection, and `boundFn.prototype = Object.create(target.prototype ?? Object.prototype)`.
  ⚠️ Assigning `target.prototype` directly **shares** the object; the `??` is needed because
  arrows/methods have no `prototype`.
- 🔴 Three things a hand-rolled `bind` cannot do: have **no `prototype` at all** (the engine uses
  an internal bound-target slot), set `name`/`length`, and be used with `extends`.
- ⚠️ `bind` in a render path allocates per render → defeats memoized children. Class-field arrow is
  the modern answer, at the cost of **one function per instance instead of one on the prototype**.

## Topic 03 · `debounce` and `throttle`
- 🔴 **Wrapper must be a `function` (to capture `this`), callback an arrow (to inherit it)** —
  `fn.apply(this, args)`.
- `clearTimeout` before `setTimeout` is what makes it a debounce rather than a delayed call.
- `leading`/`trailing`; ⚠️ **both-edges fires twice for a burst of ≥2** — real libraries track the
  call count.
- 🔴 **`cancel` exists because a pending timer retains `lastThis`/`lastArgs`** → an unmounted
  component stays alive. Not a testing convenience.
- 🔴 **The return-value problem**: a debounced fn cannot return the result. Options are the
  *previous* result (Lodash) or a promise — and with a promise you must decide whether superseded
  callers **resolve with the eventual value** (safer) or **reject** (risks unhandled rejections).
- 🔴 **The render-scope trap**: a debounce rebuilt each render has a fresh timer per call and
  debounces nothing. Same for throttle. Capture `e.target.value` at call time, not in the callback.
- **Throttle: timestamp (leading, drops the tail) and timer (trailing, delayed start) are
  DIFFERENT behaviours**, not two spellings. Most uses want both edges.
- ⚠️ **`remaining > interval` is the clock-jump guard** — `Date.now()` can move backwards (NTP,
  manual change, resume from sleep). `performance.now()` is monotonic and better.
- 🔴 **For anything that paints, `requestAnimationFrame` beats both** — frame-aligned, cannot fire
  twice per frame, does not run in a hidden tab. A 16 ms `setTimeout` gives none of that.
- Neither is a rate limiter for a shared resource — per-closure and per-tab.

## Topic 04 · Promise combinators
- **MDN quotes**: `all` — *"fulfills when all of the input's promises fulfill (including when an
  empty iterable is passed)"*, *"Already fulfilled, if the `iterable` passed is empty"*,
  *"`Promise.all` resolves synchronously if and only if the `iterable` passed is empty"*,
  *"will reject immediately upon any of the input promises rejecting"*, and non-promise values
  *"will be ignored, but still counted"*.
- `any` — *"fulfills when any of the input's promises fulfills"*; *"rejects when all … reject
  (including when an empty iterable is passed), with an `AggregateError`"*; *"Already rejected, if
  the `iterable` passed is empty"*; and vs `race`: *"returns the first settled value … this method
  returns the first fulfilled value."*
- 🔴 **Five `all` details**: the empty case (an implementation without it **hangs silently**);
  **`results[index] = value` not `push`** (completion order vs input order — the bug that passes
  most tests); `Promise.resolve(item)` for non-promises **and thenables**; a `remaining` counter
  not `results.length`; and passing `reject` straight through (a promise settles once).
- `Array.from(iterable)` — all four take **iterables**, not arrays.
- 🔴 **None of them cancel anything.** A rejected `all` leaves siblings running; a `race` timeout
  leaves the fetch in flight → `AbortSignal` is the real mechanism, and the loser `setTimeout`
  leaks unless cleared in a `finally`.
- ⚠️ `Promise.all(urls.map(u => () => fetch(u)))` resolves **instantly** with functions.
- `allSettled` built **in terms of `all`** (convert every rejection to a fulfilment). Exact shape:
  `{status:"fulfilled", value}` / `{status:"rejected", reason}` — **`reason`, not `error`**.
- `race` is three lines because a promise settles once. 🔴 **`race([])` is pending FOREVER** — the
  exact opposite of `all([])`.
- 🔴 **`any` is the mirror of `all`**: collect errors by index, resolve on first success, reject
  with `AggregateError` (`.errors` in input order).
- 🔴 **The empty-input column is the comparison question** — all four differ, two surprisingly.
- 🔴 **"First response wins" almost always means `any`, not `race`** — `race` lets the first
  *failure* sink a fallback.
