---
title: "05.3 · Borrowing, partial application and cost"
sidebar_label: "03 · Borrowing and cost"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Script: `sandbox/js-p3/ex5-call-apply-bind.mjs`.

**What these methods are actually *for*.** Setting `this` explicitly is the
mechanism; borrowing methods, checking types and pre-filling arguments are the
uses that survive in modern code.

## Borrowing methods from array-likes

```
--- borrowing array methods from array-likes ---
  [].slice.call(arrayLike)                         ["a","b"]
  [].map.call(arrayLike, s => s.toUpperCase())     ["A","B"]
  Array.from(arrayLike)  ← modern                  ["a","b"]
  [].join.call("abc", "-")  ← strings too          a-b-c
  [].push.call({length: 0}) then read length       {"0":"x","length":1}
```

```js
const arrayLike = {0: 'a', 1: 'b', length: 2};
Array.prototype.slice.call(arrayLike);      // ['a', 'b']
```

Array methods are written **generically** — they only require `this` to have a
`length` and integer keys, not to actually be an array. So they work on
`arguments`, on strings, on DOM `NodeList`s, and on any object shaped like one.

The last row is the most striking: `push` on a plain object **writes `0` and
updates `length`**, turning `{length: 0}` into `{"0":"x","length":1}`. Nothing
about it required an array.

`Array.from` replaced most of this — it is clearer and handles iterables as well
as array-likes. Reach for `call` only when you need a method `Array.from` does
not give you directly, or when reading older code where `[].slice.call(arguments)`
was the standard way to get a real array.

## `Object.prototype.toString.call` — still the only correct type check

```
--- the real type check — why toString.call is still used ---
  Object.prototype.toString.call(the value)        [object Array]
  Object.prototype.toString.call([object Obje)     [object Object]
  Object.prototype.toString.call(null)             [object Null]
  Object.prototype.toString.call(undefined)        [object Undefined]
  Object.prototype.toString.call(42)               [object Number]
  Object.prototype.toString.call(x)                [object String]
  Object.prototype.toString.call(Thu Jan 01 1)     [object Date]
  Object.prototype.toString.call(/re/)             [object RegExp]
  Object.prototype.toString.call([object Map])     [object Map]
  Object.prototype.toString.call(() => {})         [object Function]
  typeof [] vs typeof null                         object / object
```

The last row is why this exists: **`typeof` cannot distinguish an array, a
`null`, a `Date` or a `Map`** — all four report `'object'`.

`Object.prototype.toString` reads the internal tag, and calling it via `.call`
is what lets you point it at an arbitrary value instead of the object it lives
on. The idiom:

```js
const typeTag = (v) => Object.prototype.toString.call(v).slice(8, -1);
typeTag([]);        // 'Array'
typeTag(null);      // 'Null'
typeTag(new Map()); // 'Map'
```

**The trade-off:** it is defeated by `Symbol.toStringTag`, which lets any object
claim any tag, and it cannot distinguish two classes that share a tag — every
plain class instance is `[object Object]`. Prefer the purpose-built checks where
they exist:

| Question | Use |
|---|---|
| Is it an array? | `Array.isArray(v)` |
| Is it `null`? | `v === null` |
| Which primitive? | `typeof v` |
| Is it an instance of my class? | `v instanceof MyClass` |
| Which built-in is this? | `toString.call(v)` |

## `apply`'s argument limit

`apply` spreads an array into individual arguments, which was the only way to do
this before spread syntax:

```
--- apply spreads an array-like — the old max() trick ---
  Math.max.apply(null, nums)                       9
  Math.max(...nums)  ← modern                      9
  Math.max.apply(null, 200k-element array)         RangeError: Maximum call stack size exceeded
  Math.max(...200k-element array)                  RangeError: Maximum call stack size exceeded
  reduce has no such limit                         199999
```

**Both `apply` and spread hit the same wall.** Each argument occupies a stack
slot, so a large enough array overflows — measured at 200,000 elements with
`RangeError: Maximum call stack size exceeded`. Spread syntax is *not* a fix for
this; it is the same mechanism with nicer syntax.

The limit is not specified — it depends on the engine and the remaining stack, so
code that works on 100,000 elements today can fail on a deeper call stack
tomorrow. That makes it a genuinely nasty production bug: it scales with input
size *and* with unrelated call depth.

The fix is to stop spreading:

```js
const max = big.reduce((a, b) => (b > a ? b : a), -Infinity);   // 199999, no limit
```

Or chunk the input. **Never spread an array of unbounded length into a call.**

## Partial application with `bind`

Pre-filling leading arguments is `bind`'s second job, and the one that has
nothing to do with `this`:

```js
const log = (level, module, message) => `[${level}] ${module}: ${message}`;

const warn = log.bind(null, 'WARN');
const warnAuth = warn.bind(null, 'auth');

warnAuth('token expired');     // '[WARN] auth: token expired'
```

Bindings accumulate — measured in
[the previous chunk](./02-what-bind-does.md) as `T|1|99|`. Note the ordering
constraint: **`bind` can only fill arguments from the left.** To fix a later
parameter you need a wrapper or a proper curry, covered in
[Currying and partial application](../11-currying.md).

`null` as the `thisArg` here is the conventional "I don't use `this`" marker. In
strict mode it really is `null`, so this is only safe because `log` never touches
`this` — an arrow, which cannot have one, makes that guarantee structural.

## What it costs

Measured over 3,000,000 iterations, with the argument varying per iteration so
that no variant can be constant-folded while others cannot, and identical
checksums confirming they do the same work:

```
--- call vs apply vs spread: which is fastest here ---
  direct sum3(i, 2, 3)                             19.7 ms   (checksum 4500013500000)
  sum3.call(null, i, 2, 3)                         66.3 ms   (checksum 4500013500000)
  sum3.apply(null, [i, 2, 3])                      68.0 ms   (checksum 4500013500000)
  sum3.apply(null, reused array)                   105.8 ms   (checksum 4500013500000)
  sum3(...[i, 2, 3])                               65.9 ms   (checksum 4500013500000)
  preBound(i, 2, 3)  [bind done once]              36.1 ms   (checksum 4500013500000)
  sum3.bind(null)(i, 2, 3)  [bind per call]        65.9 ms   (checksum 4500013500000)
```

Reading it honestly:

- **A direct call is roughly 3× faster than any indirect form.** That is the
  real, reproducible gap.
- **`call`, `apply` and spread are indistinguishable** from each other at
  ~66–68 ms. The folklore that "`call` is faster than `apply`" does not survive
  measurement here.
- **A pre-bound function (36 ms) beats calling `bind` per call (66 ms)**, which
  is the actionable result: hoist the `bind` out of the loop.
- **Reusing one array for `apply` is the *slowest* option** at 106 ms — worse
  than allocating a fresh literal each iteration. That is counterintuitive
  enough that it was re-run to confirm it was stable, and it was. The fresh
  literal is a short-lived object V8 can analyse and keep off the heap; the
  reused array is a real heap object being written to and read back.

**The caveat that matters more than the numbers:** this is 3,000,000 iterations
of a function that adds three numbers. The entire spread between fastest and
slowest is about 86 nanoseconds per call. In any code doing real work, this is
noise — the difference disappears entirely behind one property access on a cold
object, let alone any I/O.

Optimise this only where a profiler has already pointed at it. The reason to
know the numbers is to recognise that **`bind`-in-a-loop is the one worth
avoiding on sight**, because hoisting it is free.

## Gotchas

**Symptom:** `RangeError: Maximum call stack size exceeded` from
`Math.max(...arr)` or `fn.apply(null, arr)`
**Cause:** Every element becomes a stack argument. Measured at 200,000 elements
for both forms.
**Fix:** `reduce`, or chunk the array. Spread is not a workaround — it has the
same limit.

**Symptom:** A spread that works in tests fails in production
**Cause:** The limit depends on remaining stack, so a deeper call stack lowers
it. Array size alone does not predict it.
**Fix:** Never spread unbounded input, regardless of observed limits.

**Symptom:** `typeof` says `'object'` for an array, a `Date` and `null` alike
**Cause:** `typeof` only distinguishes primitives and functions.
**Fix:** `Array.isArray`, `v === null`, `instanceof`, or
`Object.prototype.toString.call(v)` for built-ins.

**Symptom:** A `toString.call` type check returns the wrong tag
**Cause:** The object defines `Symbol.toStringTag`, which overrides it — or it is
a user class, which is always `[object Object]`.
**Fix:** `instanceof` for your own classes; treat `toString.call` as a built-in
check only.

**Symptom:** A hot loop got slower after adding `bind`
**Cause:** `bind` inside the loop allocates a function per iteration. Measured
66 ms versus 36 ms for a pre-bound function.
**Fix:** Hoist the `bind` outside the loop.

## Interview questions

**★ Why does `Object.prototype.toString.call(x)` exist when we have `typeof`?**
`typeof` reports `'object'` for arrays, `null`, `Date`, `Map` and every plain
object — measured `object / object` for `[]` and `null`. `toString.call` reads
the internal tag and distinguishes them. It is defeated by `Symbol.toStringTag`
and useless for user classes, so prefer `Array.isArray` and `instanceof` where
they apply.

**★ Why does `Math.max.apply(null, hugeArray)` throw?**
Each element becomes a separate stack argument, so a large enough array
overflows — measured `RangeError: Maximum call stack size exceeded` at 200,000
elements. Spread syntax has the identical limit. Use `reduce`.

**★ How do array methods work on `arguments` or a NodeList?**
They are specified generically: they need `this` to have `length` and integer
keys, not to be an array. Measured: `[].push.call({length: 0}, 'x')` produced
`{"0":"x","length":1}`. `Array.from` is the modern equivalent.

**Is `call` faster than `apply`?**
Not measurably — 66 ms versus 68 ms over 3,000,000 calls, with spread at 66 ms
too. The only meaningful gaps are direct calls (~3× faster than any indirect
form) and `bind`-per-call versus a pre-bound function. All of it is tens of
nanoseconds per call, so it only matters in a profiled hot path.

**How do you partially apply a function?**
`fn.bind(null, arg1)` fixes leading arguments and returns a new function;
bindings accumulate. It only works left to right — fixing a later parameter needs
a wrapper or a curry.

---

← [What `bind` does](./02-what-bind-does.md) · [Topic index](./README.md) · Next → [Closures](../06-closures/README.md)
