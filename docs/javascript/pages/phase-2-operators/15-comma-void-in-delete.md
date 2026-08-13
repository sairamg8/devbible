---
title: "15 · Comma, `void`, `in` and `delete`"
sidebar_label: "15 · Comma, void, in, delete"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p2/ex11-misc-operators.mjs`,
> `ex9-precedence.mjs`.

**Four operators nobody thinks of as operators.** You will write `delete` and
`in` occasionally, meet the comma operator in minified code, and almost never
need `void` — but each has one behaviour worth knowing before it surprises you.

## Measured

```
--- delete ---
  delete o.a returns: true | o = {"b":2}
  delete missing key : true
  delete arr[1] ->  [1,null,3] | length still 3 | 1 in arr = false
  arr.map over hole: [1,null,3] <- hole preserved
  delete frozen prop -> TypeError
  delete on a var    -> SyntaxError

--- in ---
  "a" in {a:1}       = true
  "toString" in {}   = true <- walks prototype chain
  Object.hasOwn({},"toString") = false
  0 in [1,2]         = true | 5 in [1,2] = false
  "length" in []     = true

--- void ---
  void 0             = undefined | void 0 === undefined = true

--- comma ---
  (1, 2, 3)          = 3
  all evaluated: [1,2,3] | result = 3
```

## `delete` — and why not to use it on arrays

`delete` removes an **own property** and returns a boolean. It returns `true`
even when the key never existed, so the return value tells you almost nothing.

The array case is the trap:

```
  delete arr[1] ->  [1,null,3] | length still 3 | 1 in arr = false
```

`delete arr[1]` does **not** shorten the array. It leaves a **hole** — index 1 is
now absent, `length` is still `3`, and `1 in arr` is `false`. The `null` in that
output is `JSON.stringify` rendering the hole; the slot is genuinely empty, not
`null`.

Holes are contagious: `map` preserves them rather than calling the callback, so a
sparse array silently survives transformations.

```js
arr.splice(1, 1);      // ✅ removes the element and reindexes
arr.filter(Boolean);   // ✅ removes falsy entries and holes
```

**Use `splice` (mutating) or `filter`/`toSpliced` (non-mutating). Never `delete`
on an array.** Sparse arrays also drop out of V8's fast element paths
([Phase 0 · 11](../phase-0-how-javascript-runs/the-jit)).

Two more measured facts:

- **`delete` on a frozen property throws** in strict mode — `TypeError`.
- **`delete` on a variable is a `SyntaxError`** in strict mode. It only ever
  worked on properties.

For objects, `delete` is fine but often unnecessary — object rest is cleaner and
non-mutating:

```js
const { password, ...safeUser } = user;   // page 06
```

## `in` — and why `hasOwn` is usually what you want

```
  "toString" in {}   = true
  Object.hasOwn({},"toString") = false
```

`in` walks the **prototype chain**. Every object inherits `toString`, so
`'toString' in {}` is `true`. That is rarely the question you are asking.

| Question | Use |
|---|---|
| Does this object, or anything it inherits from, have the key? | `'k' in obj` |
| Does this object have the key **itself**? | `Object.hasOwn(obj, 'k')` |
| Is the value not undefined? | `obj.k !== undefined` |

`Object.hasOwn` (ES2022) replaces `Object.prototype.hasOwnProperty.call(obj, k)`
and is the modern default. Note it distinguishes a **missing** key from a key
holding `undefined`, which `obj.k !== undefined` cannot
([page 04](./04-optional-chaining.md)).

On arrays, `in` tests **indices**, not values — `0 in [1,2]` is `true` because
index 0 exists; `5 in [1,2]` is `false`. To search for a value use `includes`.
And `'length' in []` is `true`, because `length` is a real property.

`in` has a second, unrelated job as part of `for…in` ([page 05](./05-loops.md)),
which is why `for (const k in obj)` reads the way it does.

## `void` — evaluate and discard

```
  void 0 = undefined | void 0 === undefined = true
```

`void expr` evaluates its operand and always returns `undefined`. Two historic
uses, both obsolete:

1. **`void 0` as a safe `undefined`.** Before ES5, `undefined` was a writable
   global that could be shadowed. It is now read-only, so plain `undefined` is
   fine. Minifiers still emit `void 0` because it is shorter.
2. **`<a href="javascript:void(0)">`** — stops navigation. Use a `<button>` with
   a click handler instead; a link that goes nowhere is an accessibility problem.

The one modern use is deliberately discarding a promise to satisfy a linter:

```js
void logAnalytics(event);   // "yes, I know this is floating"
```

Even there, `.catch(() => {})` is usually better — it also handles the rejection.

## The comma operator

```
  (1, 2, 3)          = 3
  all evaluated: [1,2,3] | result = 3
```

Evaluates every operand left to right and returns the **last**. Measured: all
three calls ran, and the result was the third.

It has the **lowest precedence of any operator** ([page 10](./10-precedence.md)),
so `x = 1, 2, 3` assigns `1` — the parentheses are what made the measured result
`3`.

Its one readable use is a `for` header:

```js
for (let i = 0, j = arr.length - 1; i < j; i++, j--) { /* two-pointer swap */ }
```

That is idiomatic and clear. Everywhere else it hides side effects inside an
expression, which is why you mostly meet it in minified output.

Do not confuse it with the commas in argument lists, array literals, object
literals or destructuring — those are **syntax**, not the comma operator.

## Gotchas

**Symptom:** `delete arr[i]` left a `null`/empty slot and `length` unchanged.
**Cause:** it creates a hole rather than removing the element — measured, `1 in
arr` became `false` with `length` still `3`.
**Fix:** `splice`, `filter`, or `toSpliced`.

**Symptom:** `map` skipped an element without calling the callback.
**Cause:** a hole from `delete`; array methods preserve holes.
**Fix:** avoid creating sparse arrays at all.

**Symptom:** `'toString' in obj` is `true` for an empty object.
**Cause:** `in` walks the prototype chain.
**Fix:** `Object.hasOwn(obj, key)`.

**Symptom:** `key in obj` is `false` even though the object "has" the key.
**Cause:** on an array, `in` tests indices; and a deleted key is genuinely gone.
**Fix:** check what you actually mean — `includes` for values, `hasOwn` for own
keys.

**Symptom:** `delete` returned `true` but nothing changed.
**Cause:** it returns `true` for a key that never existed.
**Fix:** do not use the return value as evidence.

**Symptom:** `SyntaxError: Delete of an unqualified identifier in strict mode`.
**Cause:** `delete someVariable`.
**Fix:** `delete` works on properties only.

**Symptom:** `x = 1, 2, 3` assigned `1`.
**Cause:** the comma operator is looser than `=`.
**Fix:** parenthesise — or do not use it outside a `for` header.

## Interview questions

**★ What does `delete` do to an array?**
It creates a **hole**, not a removal. Measured: `delete arr[1]` on `[1,2,3]` left
`length` at 3 and made `1 in arr` false, and array methods preserve the hole
rather than calling the callback. Use `splice` to mutate or `filter`/`toSpliced`
for a new array.

**★ What is the difference between `in` and `Object.hasOwn`?**
`in` walks the prototype chain — `'toString' in {}` is `true`. `Object.hasOwn`
checks own properties only, and returned `false` for the same test. `hasOwn` is
almost always what you want, and unlike `obj.k !== undefined` it distinguishes a
missing key from one holding `undefined`.

**What is `void 0` and why does it exist?**
`void expr` evaluates its operand and returns `undefined`. Historically
`undefined` was a writable global that could be shadowed, so `void 0` was a safe
way to obtain it. It is read-only now, so plain `undefined` is fine — minifiers
still emit `void 0` because it is two characters shorter.

**What does the comma operator do?**
Evaluates every operand left to right and returns the last — measured, all three
calls ran and the result was the third. It has the lowest precedence of any
operator, so `x = 1, 2, 3` assigns `1`. Its only readable use is a `for` header
with two counters.

**Why does `delete` return `true` for a key that does not exist?**
Because it reports "the property is not there afterwards", not "I removed
something". The return value is only `false` when the property exists and is
non-configurable, so it is not a useful success signal.

---

← [14 · Bitwise](./14-bitwise.md) · [Phase index](./) · **Phase 2 complete** → [Phase 3 — Functions, scope and closures](../../syllabus/01-language-core.md)
