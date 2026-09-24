---
name: devbible-javascript-concepts-phase5
description: Load-bearing claims and sources for JavaScript phase 5 — the built-in library
metadata:
  type: reference
---

*Split out of [[devbible-javascript-concepts]] on 2026-08-14, which passed the
300-line memory cap. Open this only when working on the phases named above.*

## Phase 5 — The built-in library · **Master tier COMPLETE**

Master topics are **01, 02, 04, 05, 06, 07, 09, 10** in syllabus order. All
documentation-validated.

| # | Topic | State |
|---|---|---|
| 01 | Array creation and shape (2 chunks) | ✅ |
| 02 | Adding and removing (2 chunks) | ✅ |
| 04 | Array iteration methods (2 chunks) | ✅ |
| 05 | `reduce` (2 chunks) | ✅ |
| 06 | `sort` (2 chunks) | ✅ |
| 07 | String methods (2 chunks) | ✅ |
| 09 | `JSON.parse` / `JSON.stringify` (2 chunks) | ✅ |
| 10 | `Map` vs a plain object (2 chunks) | ✅ |

**Phase 5 Master tier is COMPLETE.**

**Note:** phase-5 topic 21 (`structuredClone`) is already covered in depth by
phase-4 topic 04 — do not write it twice; the phase README says so.

### 01 · Array creation and shape

- **`Array.of` exists because `Array()` changes meaning on argument count** — one
  number is a *length*, anything else is elements. A live hazard whenever the count is
  dynamic (`new Array(...cells)`).
- **`Array.from` accepts BOTH iterables and array-likes**; spread accepts only
  iterables, so `[...{length:2, 0:"a"}]` throws while `Array.from` works.
- `mapFn` allocates **no intermediate array**, and its callback deliberately gets only
  `(element, index)` — MDN: *"because the array is still under construction"*.
- 🔴 **MDN guarantee: `Array.from()` never creates a sparse array.** That is why
  `Array.from({length: n}, fn)` works and `new Array(n).map(fn)` does nothing.
- **`length` is writable** (writable yes, enumerable no, configurable no): smaller
  truncates, larger appends **holes**, ≥2³² or negative throws `RangeError`.
- **`length` is one more than the highest index, not a count** — `a[99]="x"` gives 100.
- **Three states of an index**; four ways holes are created (`new Array(n)`, elisions,
  `delete`, extending `length`).
- 🔴 **The skip-holes table**: `forEach`/`map`/`filter`/`some`/`every`/`reduce` **skip**
  them; `for...of`/spread/`Array.from`/`find`/`includes`/`join`/`sort` treat them as
  `undefined`; `Object.keys` never sees them; `JSON.stringify` emits `null`. Sharpest
  case: **`includes(undefined)` is `true` while `indexOf(undefined)` is `-1`** on the
  same array. Conclusion is not a rule to memorise — **never create holes**.
- `arr.length = 0` empties **in place** (every holder sees it); `arr = []` only rebinds.

### 02 · Adding and removing

- **Return values**: `push`/`unshift` give the **new length**, `pop`/`shift` give the
  **removed element** (`undefined` when empty). So `push` cannot be chained.
- 🔴 **Front vs back asymmetry, argued from the specified algorithm, not a benchmark.**
  MDN says `shift` *"shifts all values to the left by 1"* — every remaining element is
  re-indexed — while `pop` touches one slot. So draining a queue with `shift` in a loop
  is **quadratic**. Fixes: an **index cursor** (`queue[head++]`), or `reverse()` once
  then `pop()`. **The page states explicitly that no multiplier is claimed**, because
  this corpus builds no benchmarks and engines optimise array representations.
- `arr.push(...huge)` can throw `RangeError` — spread makes every element an argument.
- Mutating → non-mutating table (`[...arr, x]`, `slice(1)`, `slice(0,-1)`, `toSpliced`,
  `filter`).
- **`splice(start, deleteCount, ...items)` returns the REMOVED elements**, not the
  array; mutates in place.
- 🔴 **An omitted `deleteCount` deletes to the END; `0` deletes nothing.** The most
  damaging splice mistake — `arr.splice(2)` truncates.
- Negative `start` counts back; below `-length` clamps to 0; at/past `length` makes it
  a pure adder.
- **Never `splice` in a forward loop** — removals shift later elements down, so `i++`
  skips one. `filter` is the default fix; backwards iteration is the in-place one.
- Removing by value needs the `if (i !== -1)` guard, because `splice(-1, 1)` removes the
  **last** element.
- `toSpliced` returns the new array and is **dense**, where `splice` *"preserves
  sparseness"*.

### 04 · Array iteration methods

- The decision tool is **what you want back**: `forEach`→`undefined` (never stops),
  `map`→same-length array, `filter`→≤length array, `find`→element or `undefined`,
  `findIndex`→index or **`-1`**, `some`/`every`→boolean. All but `forEach`/`map`/
  `filter` short-circuit.
- MDN is explicit: **there is no way to break out of `forEach`** other than throwing;
  it names `for`/`for...of` and `every`/`some`/`find`/`findIndex` as the alternatives.
- `map` misused for side effects; `forEach`+`push` as a hand-rolled `map`;
  `filter(...)[0]` where `find` stops at the first match.
- 🔴 **`findIndex` trap**: `-1` (no match) is **truthy** and `0` (match at start) is
  **falsy**, so `if (i)` is inverted both ways. Always `!== -1`.
- 🔴 **`every` on an empty array is `true`** — MDN's vacuous truth. `some` is `false`.
  So `cart.every(inStock)` passes for an empty cart; a gate needs `length > 0 &&`.
- **Callback is always `(element, index, array)`** → `["1","2","3"].map(parseInt)` is
  `[1, NaN, NaN]` because the index arrives as `parseInt`'s **radix**. Check the arity
  of any named function passed to an iteration method.
- 🔴 **Two hole families, both documented with MDN's own counts.** `forEach`/`map`/
  `filter`/`some`/`every`/`reduce` **skip** holes — MDN's example runs the callback
  **3 times over 4 slots**. `find`/`findIndex` are *"invoked for every index"* and
  report holes as `undefined` — MDN's example visits **all 7**. Hence
  `[1,,3].every(x => x !== undefined)` is `true`.
- Mutation during iteration: the range is fixed **before** the first callback, so
  appends are never visited and removals cause skips.
- 🔴 **The async trap.** MDN's own `forEach` example expects `14` and prints **`0`** —
  promises are discarded and nothing is awaited. `filter(async …)` is worse: every
  promise is truthy so nothing is filtered. Patterns: `for...of` + `await` is
  **sequential**; `await Promise.all(arr.map(async …))` is **concurrent**.

### 05 · `reduce`

- Callback takes **four** args `(acc, cur, idx, arr)` — and that is exactly **why
  `reduce` has no `thisArg`**: its own second parameter is `initialValue`.
- MDN gives a **`for...of` equivalence**; use it as the readability test — a `reduce`
  you cannot rewrite as that loop at a glance should have been the loop.
- 🔴 **No `initialValue`**: first element becomes the accumulator, iteration starts at
  **index 1**, and an **empty array throws `TypeError`**. A single-element array returns
  that element with **no callback invocation at all**. Always pass an initial value —
  it also fixes the accumulator's type.
- 🔴 **Holes skipped, `undefined` not** — the corpus's clearest demo that they differ:
  `[1,2,,4]` sums to **7**, `[1,2,undefined,4]` gives **NaN**.
- Idioms: `items.reduce((m,i)=>m.set(i.id,i), new Map())` works because `set` returns
  the map; the plain-object version needs an explicit `return acc` — **the missing
  `return` is the classic reduce bug**, failing on the *second* iteration.
- `reduceRight` matters only for **non-associative** operations (compose, string
  building).
- 🔴 **MDN has a "When to not use reduce()" section.** Its anti-pattern is spreading
  the accumulator — `{...all, [n]: …}` copies every accumulated key each iteration, so
  it is **quadratic by construction**. The page notes this is MDN's analysis of the
  algorithm, **not a benchmark; no multiplier is claimed**.
- The positive framing that makes it click: **inside a `reduce` the accumulator is
  private**, so mutating it is not an immutability violation. Immutability matters at
  the function boundary, not per iteration.
- MDN's replacement table: `flat` for flattening, **`Object.groupBy`/`Map.groupBy`** for
  grouping (prefer the Map version), `Array.from(new Set(x))` for dedupe (the `reduce`
  + `includes` version is quadratic *twice*), `filter`/`find`/`some` for their own jobs.
- Where `reduce` genuinely wins: **scalar folds**, and **folds over functions** —
  `pipe`, and `asyncPipe` (`fns.reduce((acc,fn)=>acc.then(fn), Promise.resolve(v))`),
  which sequences async steps in a way `Promise.all` cannot.

### 06 · `sort`

- 🔴 **The default converts elements to strings** and compares UTF-16 code units —
  MDN's example: `[1, 30, 4, 21, 100000].sort()` → `[1, 100000, 21, 30, 4]`. Always pass
  `(a,b) => a - b` for numbers.
- Contract: **negative / positive / zero**, and **`NaN` counts as EQUAL** — so a
  comparator returning `NaN` (subtracting an `undefined`) silently declares pairs equal
  instead of throwing.
- 🔴 **MDN's five consistency requirements**: pure, stable, reflexive, anti-symmetric,
  transitive. **Violations do not throw** — they give implementation-defined order.
  Hence `sort(() => Math.random() - 0.5)` is a **biased** shuffle (use Fisher–Yates),
  and the `a.type === "x" ? -1 : 1` shape is a common anti-symmetry break.
- `localeCompare` / `Intl.Collator` (built once) for human text — the default puts every
  capital before every lowercase.
- Multi-key via **`||` chaining** (a tie returns `0`, which is falsy); negate one term
  for a descending key. Decorate–sort–undecorate for expensive derived keys.
- 🔴 **`sort` mutates and returns THE SAME REFERENCE** — `const sorted = arr.sort(fn)`
  is not a copy. Mutates a caller's array, and leaves the identity unchanged so change
  detection sees nothing. Fix: `toSorted` (ES2023) or `[...arr].sort()`. Both are
  **shallow** — same element objects. `reverse` has the identical hazard.
- 🔴 **Stability guaranteed since ES2019.** Enables the two-pass trick: sort by the
  **secondary** key first, then the **primary** — the secondary order survives inside
  each group. That is how multi-column table sorting works when columns are picked over
  time. Pre-ES2019 engines varied by array length, which is why old code carries manual
  index tiebreaks.
- **`undefined` and holes always go last** (holes after `undefined`), **regardless of
  the comparator, which is never called for them.** So guard the *property*
  (`(a.name ?? "")`), not the element. Missing values cannot be sorted to the front —
  map them to a sentinel.
- ES2023 non-mutating family: `toSorted`, `toReversed`, `toSpliced`, `with`.

### 07 · String methods

- **Strings are immutable** — every method returns a new string; nothing here mutates.
- 🔴 **`slice` vs `substring`, both documented differences**: `substring` treats
  negatives as `0` while `slice` counts from the end; and `substring` **SWAPS its
  arguments** when `start > end` while `slice` returns `""`. **Use `slice`** — the
  swapping is the dangerous half, returning a plausible substring instead of failing.
  (`substr` is deprecated.)
- `at(-1)` for the last character; bracket notation rejects negatives. `charAt` returns
  `""` out of range where `at` returns `undefined`.
- 🔴 **`split`'s three surprises**: `"".split(",")` is **`[""]`, not `[]`** (off-by-one
  in CSV/query parsing); the `limit` argument **truncates the result** rather than
  keeping the remainder; and `split()` with no separator gives one element.
- 🔴 **`split("")` splits by UTF-16 code unit** and tears emoji into surrogate halves;
  `[...str]` / `Array.from(str)` yield **code points**; `Intl.Segmenter` for real
  graphemes. Same reason `"👍".length` is `2`.
- A **capturing group** in a regex separator puts the delimiter into the result.
- `join` converts `null`/`undefined` to **empty strings**, not `"null"`.
- Trim family removes whitespace only — **no `trim(char)`**. Normalise at the input
  boundary.
- **`padStart(n, pad)`**: `n` is the **target total length**; never truncates; a
  multi-character pad is repeated then **cut** (`"5".padStart(4,"ab")` → `"aba5"`).
- `repeat(-1)` throws `RangeError`.
- 🔴 **`replace` with a STRING pattern replaces only the first occurrence** — the most
  common string bug. `replaceAll` replaces all, and **throws `TypeError` for a
  non-global regex**, which is a feature (it stops a silent single replacement).
- 🔴 **Never build a regex from user input.** MDN's own example: redacting `ha.*er` via
  `new RegExp(name,"g")` swallows most of the sentence, while `replaceAll` with a string
  matches literally. Also a backtracking DoS vector.
- **`$` patterns in the replacement string** (`$&`, `` $` ``, `$'`, `$1`, `$<name>`,
  `$$`) are interpreted — so a **data-derived** replacement is reinterpreted. Use the
  **function form**, whose return value is always literal.
- Case mapping is **locale-dependent** (Turkish `i` → dotted `İ`), so lowercasing both
  sides is a poor case-insensitive comparison; use `localeCompare` with
  `sensitivity: "accent"`.

### 09 · `JSON.parse` and `JSON.stringify`

- 🔴 **Silent losses vs loud ones.** Only **`BigInt`** and **cycles** throw. Everything
  else is silent: `undefined`/functions/symbols **omitted in objects but turned into
  `null` in arrays** (the inconsistency is the danger); `NaN`/`Infinity` → `null`;
  `Date` → ISO string via `toJSON` (**the most common JSON bug in app code**);
  `Map`/`Set` → `{}`; symbol keys and non-enumerables skipped; prototype lost.
- **`stringify` sees exactly the set `Object.keys` sees** — own, enumerable,
  string-keyed. That answers "what will this serialise to?" in one step.
- MDN's rationale for the `BigInt` throw: serialisation must be *"explicitly provided by
  the user"*.
- **`toJSON`** is the clean per-type hook — travels with the class, applies everywhere,
  better than a `replacer` at each call site. Also how to serialise a `Map` subclass.
- **`replacer`**: function form (returning `undefined` omits — the general redactor) or
  **array allowlist**, which is **deny-by-default** and safer at a trust boundary.
  Symbol keys cannot be re-included even via `replacer`.
- `JSON.stringify(a) === JSON.stringify(b)` is **not** a deep-equality check — key order
  follows enumeration order.
- **`SyntaxError`** from **trailing commas** and **single quotes** (legal in JS, illegal
  in JSON), and from an **empty body**. Production classic: an HTML error page served
  with a 200.
- 🔴 **The reviver rule: `return value` for anything you do not handle** — MDN says
  untransformed values *"must be returned as-is or they'll be deleted"*. Returning
  `undefined` for the **root** deletes the entire result.
- **Call order is depth-first, innermost first**, root last with key `""` — MDN's example
  logs `1, 2, 4, 6, 5, 3, ""`.
- Date revival: match on the **key name** (`key.endsWith("At")`) rather than an ISO
  pattern, which turns version strings into dates.
- 🔴 **`context.source`** (third reviver arg, **primitives only**) gives the **original
  text**, because `value` has already been through a double — the only way to recover a
  64-bit ID. Pragmatic alternative: send large IDs as strings.
- **`JSON.parse` is safe from prototype pollution** — in JSON `"__proto__"` is an
  ordinary key. The vulnerability is a later recursive **merge**.

### 10 · `Map` vs a plain object

**The rule: keys are data → `Map`. Keys are code → object.**

- MDN's **six differences**, all favouring `Map`: **accidental keys** (an object inherits
  `Object.prototype`'s — the security-relevant one for user-supplied keys); **key types**
  (any value vs strings/symbols, so any two objects collide on `"[object Object]"`);
  **key order** (insertion vs an order MDN itself calls *"complex"*); **`size`** as a
  property vs `Object.keys().length`; **direct iterability**; and **add/remove
  performance** — direction only, **no multiplier claimed**.
- **SameValueZero** key equality: `NaN` **equals** `NaN` (so `NaN` is a usable key,
  impossible in an object), `0` equals `-0`, objects by identity. Same algorithm as
  `Set` and `Array.prototype.includes` — which is why `includes(NaN)` is `true` and
  `indexOf(NaN)` is `-1`.
- `set()` **returns the map**, which is why `items.reduce((m,i)=>m.set(i.id,i), new Map())`
  works. `delete()` returns a **boolean** (unlike object `delete`, which returns `true`
  for keys that never existed).
- 🔴 **The three costs.** (1) **It does not serialise** — `JSON.stringify(map)` is `{}`,
  which is why objects survive at every network/storage boundary. `Object.fromEntries`
  **stringifies non-string keys**, so use `JSON.stringify([...map])` + `new Map(parsed)`
  to preserve key types. (2) **No literal syntax**, no destructuring, no spread-in; and
  `map.a` is a **silent** `undefined` rather than an error. (3) **No structural typing** —
  a `Map<string,T>` cannot catch a typo'd key the way an object shape can.
- **`Map.groupBy` over `Object.groupBy`** — the grouping key is data; `Object.groupBy`
  stringifies keys and re-sorts integer-like ones.
- **`WeakMap`** holds keys weakly (objects only, not iterable, no `size`) — required when
  attaching data to objects you do not own, where a plain `Map` is a **memory leak**.

---

---

🔴 **Split 2026-08-15.** The Understand and Know tiers' concepts live in
[[devbible-javascript-concepts-phase5b]] — this file kept the Master tier and stays under the
memory-file cap. Nothing was deleted.
