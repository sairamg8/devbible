---
title: "16 · There is no function overloading"
sidebar_label: "16 · No function overloading"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters), [Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters), [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [`Function.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length), [`Number.isInteger()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger). Documentation-validated; **no timings**.

**Declare a function twice and the second one wins.** There is no overload resolution, no
signature matching, no compile step that could do either:

```js
function area(w) { return w * w; }
function area(w, h) { return w * h; }     // 🔴 this simply replaces the first

area(3);        // NaN — 3 * undefined
```

🔴 **The second declaration is not an overload; it is a reassignment.** Hoisting makes both
bindings the same name in the same scope, and the later initialiser is the one that survives.
Nothing warns you.

**What replaces overloading is dispatch inside one function** — you inspect what you were given
and branch. The topic is really about **which form of dispatch to choose, and how to design a
signature that does not need much of it.**

## Arity dispatch, and why it is the weakest option

Branching on how many arguments arrived:

```js
function slice(a, b) {
  if (arguments.length === 1) return list.slice(0, a);   // ⚠️ fragile
  return list.slice(a, b);
}
```

`arguments.length` counts what the caller actually passed, so `f(1)` and `f(1, undefined)`
differ — which sounds precise and is exactly the problem. **Callers reach that second form
constantly** by forwarding a value that happens to be missing: `slice(start, opts.end)`.

⚠️ `arguments` is also unavailable in arrow functions, and MDN recommends rest parameters
instead — `(...args) => args.length` is the modern equivalent and works everywhere.

🔴 **Prefer a default parameter to an arity check.** Defaults fire on `undefined` specifically,
which is the behaviour you actually wanted:

```js
const slice = (a, b = list.length) => list.slice(a, b);   // ✅ f(1) and f(1, undefined) agree
```

That single change removes a whole class of "works until someone forwards `undefined`" bug.

## Type dispatch, and the checks that are actually correct

Branching on what kind of thing arrived. The pattern is fine; the checks are where it goes
wrong, because `typeof` is a poor instrument for objects:

```js
function normalise(input) {
  if (typeof input === "string") return [input];
  if (Array.isArray(input)) return input;                 // 🔴 not typeof, not instanceof
  if (input && typeof input === "object") return Object.values(input);
  throw new TypeError(`normalise: cannot handle ${typeof input}`);
}
```

Three rules make type dispatch reliable:

**`Array.isArray`, never `typeof`.** `typeof []` is `"object"`, which tells you nothing.
`instanceof Array` is also wrong across realms — an array from an `iframe` or a worker has a
different `Array` constructor and fails the check. MDN specifies `Array.isArray` works across
realms, which is precisely why it exists.

**Guard `null` before `typeof x === "object"`**, because `typeof null` is `"object"` — the
oldest bug in the language, and it turns a "handle the options object" branch into a crash on
`null`.

**Order the branches narrowest first.** A string is iterable, so an `input[Symbol.iterator]`
check placed above the string branch swallows strings and returns characters. Type dispatch is
an ordered chain, not a set of independent tests.

⚠️ **Do not dispatch on `fn.length`.** It counts parameters *before* the first default or rest
parameter, so `(a, b = 1, c) => …` reports `1` and `(...args) => …` reports `0` — the same trap
[11 · Currying](./11-currying-and-partial-application.md) hits.

## The options object is usually the right answer

The moment a function has more than two or three parameters, or any boolean, positional
arguments stop paying:

```js
createUser("Ada", true, false, null, 30);         // ⚠️ unreadable and unextendable
createUser({ name: "Ada", admin: true, age: 30 }); // ✅
```

Four things it buys, and they are worth naming:

- **Named arguments at the call site.** `admin: true` says what `true` means. A bare boolean
  parameter is the classic signature smell — nobody can read `false, null` without opening the
  definition.
- **Order stops mattering**, so adding an option is not a breaking change.
- **Defaults become declarative** through destructuring, in one line:
  `({ name, admin = false, age = null } = {})`.
- **It extends** without ever growing the parameter list.

🔴 **The trailing `= {}` is not optional.** Without it, calling `createUser()` with no arguments
destructures `undefined` and throws `TypeError: Cannot destructure property 'name' of
'undefined'`. It is one of the most common signature bugs in real code.

**Keep the one genuinely required argument positional**, and put the rest in the object —
`fetchUser(id, { includeOrders = false } = {})` reads better than pushing `id` into the bag. The
rule that generalises: **positional for what the function is *about*, options for how it
behaves.**

## Designing a signature that ages

**Required first, optional after.** A required parameter behind an optional one can never be
omitted, so the optional one is not optional.

**Never use a boolean to select behaviour.** `render(true)` is unreadable and stops extending
the moment a third mode appears. A string union — `render({ mode: "compact" })` — reads at the
call site and grows.

⚠️ **`undefined` and `null` are not interchangeable in a signature.** Defaults fire only on
`undefined`, so `f(null)` gets `null`, not the default. Since JSON turns absent fields into
`null`, an API response reaching a defaulted parameter **bypasses the default**. Decide once
whether your function treats `null` as "absent" — and if it does, say so with `?? fallback`
rather than relying on the default.

**Variadic or an array — not both.** `Math.max(...)` is variadic; `Promise.all([...])` takes an
array. Accepting both means a single-array argument is ambiguous forever. Pick one; if the count
can be large, take the array, because spreading a huge array into arguments is what overflows
the stack.

## When dispatch is genuinely the right call

It is not always avoidable, and there are two honest cases:

**A public API that must not break.** `on("click", fn)` and `on({ click: fn, hover: fn })` is
worth supporting because callers already depend on both. Dispatch at the boundary, normalise
immediately, and let the rest of the function see one shape.

**A convenience shorthand over a real signature.** The pattern is a thin wrapper, not a branchy
body:

```js
const parse = (input) =>
  typeof input === "string" ? parseOptions({ source: input }) : parseOptions(input);
```

🔴 **The rule that keeps this maintainable: normalise at the top, then have exactly one body.**
Dispatch that reaches into the middle of a function — two branches doing similar-but-different
work — is where the bugs live, because the branches drift.

## What TypeScript changes, and what it does not

TypeScript has **overload signatures**: several declarations above one implementation, so
callers get accurate types per call shape. It is worth knowing what that is and is not.

🔴 **It is a compile-time fiction.** The overload declarations are erased, exactly one function
exists at runtime, and **you still write the dispatch by hand** in the implementation body — the
implementation signature must be broad enough to accept every overload, and TypeScript does not
check that the body actually handles them correctly.

So TypeScript improves the *call site* and changes nothing about the runtime. Everything above
still applies underneath it.

## Gotchas

**Symptom:** A second definition of a function silently replaced the first
**Cause:** There is no overloading — the later declaration reassigns the name.
**Fix:** One function with dispatch, or two differently named functions.

**Symptom:** `f(1)` and `f(1, undefined)` behave differently
**Cause:** `arguments.length` counts what was passed, not what was meaningful.
**Fix:** A default parameter — defaults fire on `undefined`.

**Symptom:** `arguments` is undefined inside a function
**Cause:** Arrow functions have no `arguments`.
**Fix:** Rest parameters, which MDN recommends anyway.

**Symptom:** An array took the "plain object" branch
**Cause:** `typeof []` is `"object"`.
**Fix:** `Array.isArray()` — and not `instanceof Array`, which fails across realms.

**Symptom:** A `null` argument crashed the object branch
**Cause:** `typeof null` is `"object"`.
**Fix:** Guard `input &&` before the `typeof` check.

**Symptom:** A string was treated as a list of characters
**Cause:** An iterable check ordered above the string check; strings are iterable.
**Fix:** Order branches narrowest first.

**Symptom:** `TypeError: Cannot destructure property … of 'undefined'`
**Cause:** A destructured options parameter with no `= {}` default, called with no argument.
**Fix:** `function f({ a, b } = {})`.

**Symptom:** A default did not apply to a value from an API
**Cause:** JSON sends `null` for absent fields, and defaults fire only on `undefined`.
**Fix:** `?? fallback` where `null` should mean absent.

**Symptom:** A TypeScript overload compiles but misbehaves at runtime
**Cause:** Overloads are erased; the single implementation body still has to dispatch, and TypeScript does not verify that it does.
**Fix:** Write and test the runtime dispatch.

## Interview questions

**★ Does JavaScript support function overloading?**
No. A second declaration with the same name replaces the first — it is a reassignment, not an
overload, and nothing warns you. You emulate it with dispatch inside one function.

**★ How would you emulate it?**
Inspect what arrived and branch: arity via rest parameters, or type via `Array.isArray` /
`typeof` / a discriminant property. Normalise to one shape at the top of the function so the
body is written once.

**★ Why prefer a default parameter to an arity check?**
Because defaults fire on `undefined`, so `f(1)` and `f(1, undefined)` behave the same. An
`arguments.length` check makes them differ, which breaks the moment a caller forwards a value
that happens to be missing.

**★ Which type checks are actually safe?**
`Array.isArray` rather than `typeof` or `instanceof Array` — MDN specifies it works across
realms, and an array from an `iframe` fails `instanceof`. Guard `null` before
`typeof x === "object"`, since `typeof null` is `"object"`. And order branches narrowest first,
because strings are iterable.

**★ When would you use an options object?**
Past two or three parameters, and for *any* boolean. It gives named arguments at the call site,
makes order irrelevant, makes defaults declarative through destructuring, and extends without
growing the signature. Keep the one thing the function is *about* positional.

**★ What is the classic bug with a destructured options parameter?**
Omitting the `= {}` default. Calling with no arguments then destructures `undefined` and throws.

**★ Does TypeScript give you real overloading?**
Only at the call site. Overload signatures are erased at compile time — one function exists at
runtime and you still hand-write the dispatch, which TypeScript does not verify.

**Why is a boolean parameter a smell?**
It is unreadable at the call site — `render(true)` says nothing — and it does not extend when a
third mode appears. A string union in an options object reads and grows.

---

← [15 · Pure functions and side effects](./15-pure-functions.md) · [Phase index](./README.md) · **17 · Closure and default-parameter gotchas** *(not written yet)* →
