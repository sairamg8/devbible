---
name: devbible-javascript-concepts-phase6
description: Load-bearing claims and sources for JavaScript phase 6 — iteration, destructuring, generators
metadata:
  type: reference
---

*Split out of [[devbible-javascript-concepts]] on 2026-08-14, which passed the
300-line memory cap. Open this only when working on the phases named above.*

## Phase 6 — Iteration, destructuring and generators · **Master tier COMPLETE**

Master topics are **01, 02, 03** (unusually, the first three in syllabus order).

| # | Topic | State |
|---|---|---|
| 01 | Destructuring (2 chunks) | ✅ |
| 02 | `for…of` vs `for…in` vs `forEach` (2 chunks) | ✅ |
| 03 | Spread with iterables (2 chunks) | ✅ |

### 01 · Destructuring

- **Array patterns match by position, object patterns by name** — every other rule
  follows from that.
- **Renaming is objects-only** and reads *backwards* from an object literal: the **key**
  is left of the colon, the **new binding** right.
- 🔴 **Defaults apply to `undefined` ONLY, not `null`.** Load-bearing because
  `JSON.stringify` drops `undefined`, so APIs send **`null`** for "no value" — meaning
  real payloads routinely bypass every default. Use `??` after destructuring.
- **Nesting does not bind the intermediate name** (`{ b: { c } }` binds only `c`), and
  **throws** if the intermediate is missing — default each risky level (`{ b: { c } = {} }`)
  or prefer optional chaining when the shape is uncertain.
- **Rest is the idiomatic omit-a-key** (`const { password, ...safe } = user`) — better
  than `delete` on every count; shallow, own-enumerable only.
- Swap: `[a,b] = [b,a]` works because the RHS is fully evaluated first.
- 🔴 **Assigning without declaring needs parentheses** — a statement starting with `{`
  parses as a **block**. `({ a, b } = obj);` — and mind the ASI hazard.
- **Destructuring `null`/`undefined` throws**, and MDN notes it does so *"even with empty
  patterns"* (`const {} = null` fails). Everything else coerces —
  `const { length } = "abc"` is `3`.
- 🔴 **`function f({ a }) {}` throws when called as `f()`** — needs **`= {}`**. MDN's
  `drawChart` example is the canonical shape.
- `for (const [k,v] of map)` needs no adapter — a `Map` yields pairs directly.
- **`Promise.all` is the genuine case for array patterns**; hazard is that names bind by
  **position**, so reordering silently reassigns them.
- 🔴 **Destructuring detaches methods** (`const { start } = timer` loses `this`) — the
  fourth loss mode. APIs designed for destructuring return **closures**.
- **`fn.length`**: a destructured param counts **1**; adding `= {}` drops it to **0**,
  which changes arity dispatch in some libraries.

### 02 · `for…of` vs `for…in` vs `forEach`

- **for...in → keys (incl. inherited); for...of → values (via `Symbol.iterator`);
  forEach → values as a callback.**
- MDN's `ColoredTriangle` example shows prototype properties leaking into `for...in`.
  🔴 **Needing an `Object.hasOwn` guard IS the signal to use `Object.keys` instead.**
- 🔴 **MDN's three reasons never to use `for...in` on an array**: index arrives as a
  **string**, **non-index properties** included, and it uses **property enumeration**
  not the iterator — so it **skips holes** where `for...of` visits them.
- `class` methods are **non-enumerable** so `for...in` misses them, but
  `Ctor.prototype.m = …` methods are enumerable and show up — another inconsistency.
- A plain object is **deliberately not iterable** — which of keys/values/entries you want
  is your decision. `Object.entries` states it.
- `for...of` iterates strings by **code point** (emoji safe).
- 🔴 **Capability table decides the choice**: `break` / `continue` / `return` from the
  enclosing function / `await` all work in `for`/`for...of` and **none** work in
  `forEach`.
- 🔴 **`return` inside a `forEach` callback returns from the CALLBACK** — a `findUser`
  written that way always returns the fallback, compiles cleanly and fails silently.
  Inside `forEach`, `return` behaves like `continue`.
- `forEach(async …)` discards promises → rejections become **unhandled**, outside any
  `try`/`catch`. Sequential = `for...of` + `await`; concurrent = `Promise.all(map(…))`,
  which starts **everything** at once.
- **Labelled `break`** (`outer: for …  break outer;`) for nested loops.
- **`for...of` re-reads `length` via the iterator** (so pushing inside it is an infinite
  loop) while **`forEach` fixes its range up front** (appends never visited).
- Classic indexed `for` still wins when you control the index — stepping, **iterating
  backwards** to remove safely, comparing adjacent elements.

### 03 · Spread with iterables

- 🔴 **Two operations, one syntax** — MDN: array/call spread *"requires iterables"*,
  object spread *"only needs enumerable own properties"*. Hence `[...obj]` **throws**
  while `{...arr}` gives `{0:1,1:2}`; and **`[...map]` gives pairs while `{...map}` gives
  `{}`** (entries are internal slots).
- MDN's `{ ...true, ..."test", ...10 }` → `{'0':'t','1':'e','2':'s','3':'t'}`:
  non-objects contribute **nothing, silently** — which is exactly what makes
  `...(cond && { k })` work.
- Spreading a string yields **code points**; `[...new Set(x)]` is the idiomatic dedupe.
- **Shallow** — MDN's `const b = [...a]; b.shift().shift();` mutates a shared inner array.
- **Spread vs rest**: same dots, opposite directions. Rest collects (left of assignment /
  parameter list, must be **last**, only one); spread expands (right side / call).
- Replaces `apply`, composes with fixed args, and **works with `new`** — which `apply`
  cannot do at all.
- 🔴 **Argument-count `RangeError`** from `Math.max(...huge)` / `arr.push(...huge)` —
  each element becomes an argument. Limit is engine-specific; **unmeasured here**. Use
  `reduce` / a loop / `concat`.
- Merging is **replace, not deep merge**; a **spread placed after an explicit key
  overrides it**.
- 🔴 **Immutable updates: the SHARING of untouched branches is the point**, not a
  compromise — it is what makes `prev.items === next.items` a valid change check.
- 🔴 **Two places spread is wrong**: accumulating in a loop (`out = [...out, x]` is
  quadratic by construction — the array form of the `reduce` anti-pattern), and copying
  anything with **identity** (class instance loses methods; `Date`/`Map`/`Set` give `{}`).
- `Array.from` beats spread for **array-likes without an iterator**, for mapping while
  converting, and for `{length: n}`.

---
