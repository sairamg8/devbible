---
name: devbible-javascript-concepts-phase3-4
description: Load-bearing claims and sources for JavaScript phases 3 (functions, scope, closures) and 4 (objects, prototypes, classes)
metadata:
  type: reference
---

*Split out of [[devbible-javascript-concepts]] on 2026-08-14, which passed the
300-line memory cap. Open this only when working on the phases named above.*

## Phase 3 — Functions, scope and closures · **Master tier COMPLETE**

Topics 01–07 measured; **topic 08 documentation-validated**. 09–20 deferred
(Understand/Know) under Master-first.

| # | Topic | Concepts covered |
|---|---|---|
| 01 | Declarations, expressions, arrows | declaration vs expression vs arrow; hoisting differences; naming for stack traces; **corrected**: arrows *inherit* `super`/`new.target`, they do not lack them |
| 02 | Parameters | defaults evaluated left to right; `undefined` vs `null` triggering a default; **the parameter list's own TDZ** (measured); parameter scope is the body's *parent*; rest; `arguments` aliasing only in non-strict + simple parameter lists; `fn.length` counting rules |
| 03 | `this` | the four binding rules as one decision tree; call-time not definition-time; sloppy vs strict receiver |
| 04 | Arrows and `this` | lexical `this`; no own `arguments`/`super`/`new.target` (all **inherited**); no `prototype`; not constructable; no generator-arrow syntax; the method-definition mistake |
| 05 | `call`/`apply`/`bind` | borrowing; partial application; `bind` returns `"bound X"`, reduced `length`, no own `prototype`, **cannot be re-bound**; `new` ignores bound `this` but keeps bound args; arrows ignore all three |
| 06 | Closures | the *variable* is captured, not the value; the `var`-in-a-loop bug; per-iteration `let` bindings; memory held alive |
| 07 | Lexical scope | lexical vs dynamic scope; what creates a scope; shadowing; `var` function-scope vs `let`/`const` block-scope; redeclaration rules; `const` is not immutable; module vs CommonJS vs script top level |
| **08** | **Hoisting and the TDZ** — 6 chunks | **see below** |

### Topic 08 chunk map (documentation-validated, MDN)

| Chunk | Concepts |
|---|---|
| 01 two-step scope entry | nothing *moves*; binding created then code runs; MDN's **four hoisting kinds** (value / declaration / behavioural / side-effect); `let` **is** hoisted; "hoisting" is **not** in the spec (only *HoistableDeclaration*); the three error types and what each means |
| 02 `var` and function declarations | `var x = 1` is **two operations** hoisting separately; redeclaration is a no-op without an initialiser; value hoisting makes helpers-below-callers legitimate; function *expressions* fail as `TypeError`; **`var`+function precedence regardless of source order**; script top-level `var` is a **non-configurable** global, modules are not |
| 03 the temporal dead zone | MDN's definition; **time not position** — a closure may be *defined* in the zone, just not *called*; the zone closes at the **declaration**, not the first assignment; `let x = x` throws; per-iteration bindings in `for...of` |
| 04 `typeof` and why it's a feature | `typeof` **throws** in the TDZ and is only safe for never-declared names; the **three engines' error strings** (V8 / SpiderMonkey / **Safari names no variable**); three arguments that the TDZ is a feature — fail at the mistake, make `const` mean one value, make shadowing unambiguous (hence the zone starts at the block top) |
| 05 block functions and parameters | block-level function declarations: **strict = block-scoped and fine**, **sloppy = Annex B, MDN warns behaviour differs across Chrome/Firefox/Safari**, and takes effect *even if the block never runs*; parameter list initialises **left to right** with its own TDZ; body is a **child** scope so a default cannot see body `var`s or functions (error is `X is not defined`, not a TDZ error); a default's closure captures the *parameter*, not the body's `var` |
| 06 classes and circular imports | classes are **lexical** — TDZ, block-scoped, no `globalThis` property; the class name is a **const-like binding inside the body**; `extends` is evaluated **at the declaration**, so mutual `extends` is impossible; imports are hoisted **with side effects**, are live read-only views; **circular ESM gives the same `Cannot access 'X'` error across a file boundary**, fixed by reading inside an exported function; CommonJS instead gives a silently half-populated `module.exports` |

---

## Phase 4 — Objects, prototypes and classes · **Master in progress**

Master topics are **01, 03, 04, 05, 06, 07, 08** in syllabus order — 02 is an
Understand topic and is deliberately skipped. All documentation-validated.

| # | Topic | State |
|---|---|---|
| 01 | Object literals (4 chunks) | ✅ |
| 03 | Existence checks and `delete` (3 chunks) | ✅ |
| 04 | Shallow vs deep copy (3 chunks) | ✅ |
| 05 | The prototype chain (3 chunks) | ✅ |
| 06 | `class` (3 chunks) | ✅ |
| 07 | `this` in methods, and losing it (2 chunks) | ✅ |
| 08 | `Object.keys`/`values`/`entries`/`fromEntries` (2 chunks) | ✅ |

**Phase 4 Master tier is COMPLETE.**

### 01 · Object literals

- **Shorthand** `{ a }`; cannot rename, which is why API boundaries stay verbose.
- **Computed keys**; evaluated in source order; the only literal form for a **symbol
  key**; the `...(cond && { k })` conditional-key idiom, preferred over `delete`.
- **Method shorthand is NOT `prop: function () {}`** — methods are **not
  constructable** (`TypeError`) and **only methods get `super`** (otherwise a
  parse-time `SyntaxError`), because a method has a **home object**.
- Getters/setters; a getter makes reading arbitrary work; copying converts accessors
  into frozen data snapshots.
- **Spread copies own + enumerable, shallowly, excluding the prototype** → spreading a
  class instance loses every method.
- **`Object.assign` triggers setters, spread does not** (MDN warning); `Object.assign`
  mutates and keeps the target's prototype.
- **Duplicate keys are legal even in strict mode since ES2015** (last wins); the ES5
  `SyntaxError` was removed because computed keys make it undetectable. Only private
  class elements must be unique.
- **Keys are strings or symbols only** — objects collide on `"[object Object]"`, which
  is why `Map` exists.
- **Enumeration order is three tiers**: integer-index keys **ascending**, then strings
  by insertion, then symbols by insertion. **`"-1"`, `"01"`, `"1.5"` are NOT integer
  indices** (MDN's `Reflect.ownKeys` example proves `"-1"` sorts with the strings). So
  an object keyed by numeric ID **reorders itself**.
- Comparison table: `Object.keys` / `getOwnPropertyNames` / `getOwnPropertySymbols` /
  `Reflect.ownKeys` / `for...in` / `JSON.stringify`.
- **`{ __proto__: x }` sets the prototype and creates no property** — and does
  **nothing at all** if `x` is not an object or `null`. Shorthand `{ __proto__ }` and
  computed `{ ["__proto__"]: v }` are ordinary properties. Duplicate colon-form
  `__proto__` is a **`SyntaxError`**, unlike every other duplicate key.
- **`JSON.parse` is safe** — `"__proto__"` is a normal key in JSON. **Prototype
  pollution** comes from a recursive *merge* assigning through it; three defences.
- `Object.create(null)`: no inherited keys, no `__proto__` accessor, **no `toString`**
  so string conversion throws, and `hasOwnProperty` is unavailable.

### 03 · Existence checks and `delete`

- **Two axes**: does the prototype chain count, and does a property holding
  `undefined` count.
- `in` finds **inherited** properties → wrong for user-supplied keys
  (`"hasOwnProperty" in ages` is `true`); **right** for feature/capability detection.
  **Throws on primitives** (no auto-boxing, unlike property access).
- **`Object.hasOwn` is the modern default** — MDN's two documented reasons: it works
  on **null-prototype objects** (where `hasOwnProperty` is a `TypeError`) and on
  objects that **override** `hasOwnProperty` (which parsed JSON can arm).
- `!== undefined` **conflates missing with explicitly-`undefined`** → breaks PATCH
  semantics; `JSON.stringify` **omits** `undefined`, so on the wire the distinction
  must be present-vs-absent or `null`.
- `?.` / `??` are **value** checks, not existence checks; `??` vs `||` and the
  deliberate `0` / `""` / `false` case; mixing `??` with `||` is a `SyntaxError`.
- **Three states of an array index**: value, stored `undefined`, **hole** — only
  `in`/`hasOwn` distinguish them; array methods disagree about holes.
- **`#field in obj` brand check** — trustworthy where `instanceof` is not
  (`Symbol.hasInstance`, reassigned `prototype`, cross-realm).
- **`delete`**: own properties only (so it can **unshadow** an inherited one);
  `true` is uninformative, `false` only means non-configurable, **strict mode throws**;
  cannot remove variables; **does not free memory**; on an array leaves a **hole** with
  `length` unchanged.
- **Cost stated precisely from V8's blog**: frequent add/delete costs descriptor-array
  and HiddenClass maintenance, and dictionary/"slow" mode is slower because inline
  caches do not apply. 🔴 **Explicitly noted: the blog does NOT say one `delete`
  demotes an object, and gives no multiplier.** Alternatives: rest destructuring,
  `= null`, a `Map`.

### 04 · Shallow vs deep copy

- A copy duplicates **references**, not what they point to. Every convenient
  operation — spread, `Object.assign`, `slice`, `Array.from`, `concat`, `toSorted` —
  is **shallow**.
- The four spread-vs-`Object.assign` differences (mutation, setters, prototype,
  return).
- The prototype is never copied → instances lose methods; `Map`/`Set`/`Date` need
  their own constructors.
- 🔴 **Shallow is usually CORRECT**: immutable updates copy only the changed path and
  **deliberately share** untouched branches, because that identity sharing is what
  makes `prev === next` a valid change check. **Deep-cloning state defeats
  memoisation.**
- **`structuredClone`**: handles **cycles**, rebuilding them to point at the clone;
  clones `Map`/`Set`/`Date`/`RegExp`/typed arrays/`Error`. **Loses** the prototype
  chain, **property descriptors (so a frozen object comes back writable)**, private
  elements, and `RegExp.lastIndex`. **Throws `DataCloneError`** on functions and DOM
  nodes — better than JSON's silent drop. `transfer` **detaches** the original
  (`byteLength` → 0).
- **The seven documented JSON losses**: `undefined`/functions/symbols **omitted in
  objects but nulled in arrays**; `NaN`/`Infinity` → `null`; `Date` → string;
  `Map`/`Set` → `{}`; symbol keys and non-enumerables ignored; prototype lost; and it
  **throws** on `BigInt` and on cycles.
- Hand-written deep clone: a **`WeakMap` populated BEFORE recursing** (that ordering
  is the whole trick), which also preserves **identity** for shared sub-objects; plus
  an honest list of what it still gets wrong.

### 05 · The prototype chain

- `[[Prototype]]` is an **internal slot**; the four-step lookup; `null` terminates.
- 🔴 **A MISS is the most expensive lookup** — it traverses the entire chain.
- Property **shadowing** on read; why every object has `toString`.
- **`this` is the receiver**, not where the method was found — two lookups in one
  expression.
- 🔴 **`Fn.prototype` ≠ `obj.[[Prototype]]`**: `Object.getPrototypeOf(Fn)` is
  `Function.prototype`, **not** `Fn.prototype`. The biggest source of confusion here.
- What `new` does; **`class` is the same machinery** (methods on `Ctor.prototype`,
  differing only by being non-enumerable); the `constructor` back-reference and how
  replacing `prototype` breaks it; `Object.create` and its descriptor defaults
  (everything `false`).
- **A write never travels up** — assignment creates an own property that shadows.
  🔴 **But mutation does not**: `Fn.prototype.items = []` is shared by every instance
  because `push` is a read plus a mutation. Primitives are effectively safe.
- **Inherited setters are the exception** — they intercept the write.
- **`Object.setPrototypeOf` de-optimises** (MDN: engines *"recompile code for
  de-optimization"*; **no multiplier claimed**). Set at creation:
  `{ __proto__: proto }` is MDN's *best*, `Object.create` second.
- Keep chains short; why extending built-in prototypes is bad.

### 06 · `class`

- The wiring **is** sugar. **Five things that are not**: always-strict body;
  `TypeError` without `new`; **non-enumerable** methods; TDZ + block scoping + no
  `globalThis`; **private elements have no desugaring at all**.
- **Instance field vs prototype method** table; mutable defaults **must** be fields.
- The **arrow-function field** idiom, and its cost (one function per instance, not
  overridable, no `super`).
- **Field initialisation order**: base = start of constructor; **derived =
  immediately before `super()` returns** → an overridden method called from the
  parent's constructor sees fields still `undefined` (the virtual-method hazard).
- **Three destinations** — instance / prototype / class object. `instance.staticThing`
  is `undefined` because the chain never passes through the constructor.
- `this` in a static method **is the class** → `new this()` is a subclass-aware
  factory (statics inherit via the second chain `extends` builds).
- **Static initialization blocks**: statements + access to the private scope,
  evaluated **at class evaluation** in declaration order; assigning to the class's own
  name inside is a `TypeError`.
- Accessors on the prototype; the **self-recursion trap**
  (`get name() { return this.name; }`); write-only setters.
- **Private elements**: **`SyntaxError`** outside the class (parse-time, so nothing
  runs); **`TypeError`** on the wrong object; cannot be deleted or created by
  assignment; **unique names in a namespace shared between static and instance**
  (the one place duplicates error rather than last-wins); 🔴 **NOT inherited — there
  is no `protected`**, and parent/child may reuse a name safely; the brand check;
  and what privacy does **not** buy (not security, not serialisable, class-only).

---

### 07 · `this` inside methods, and losing it

- A method is **not attached to its object** — the binding is created by the call
  expression. One function object, different `this` per receiver; **method borrowing**
  is the same rule used deliberately.
- **Strict vs sloppy decides the symptom**: strict gives `undefined` → `TypeError` at
  the right line; sloppy substitutes `globalThis` → reads give `undefined` and
  **writes silently create globals**, failing far away.
- Four ways it happens: assigning to a variable, **passing as a callback** (the most
  common), destructuring, and re-attaching to another object (MDN's Car/Bird example).
- `thisArg` exists on `forEach`/`map`/`filter`/`some`/`every`/`find`/`findIndex`/
  `flatMap` but **not** on `reduce`/`reduceRight`/`sort`.
- `this` in a **class field initialiser** is already the instance — which is *why* the
  arrow-field fix works.
- **Four fixes with a trade-off table** over where the binding lives, per-instance
  cost, whether the method stays overridable and `super`-reachable, and listener
  removability:
  🔴 **`removeEventListener` matches by identity**, so an inline arrow can *never* be
  removed — a real leak. And **both own-property fixes take the method off the
  prototype**, so subclasses cannot override it and `super` cannot reach it.
- Default: **wrap at the call site**. Arrow field for always-a-callback handlers.
  `bind` in the constructor when a **stable function identity** is required.

### 08 · `Object.keys` / `values` / `entries` / `fromEntries`

- One definition for the first three: **own, enumerable, string-keyed** (MDN). Each
  word is what they drop — inherited (unlike `for...in`), non-enumerable (descriptor
  flags default to `false`; `class` methods are non-enumerable), and every symbol.
- `Object.keys` and `JSON.stringify` see **exactly the same set**.
- Order is the object's order, not insertion — MDN's example turns
  `{100:"a", 2:"b", 7:"c"}` into `2, 7, 100`. Keys always come back as **strings**.
- **Non-object arguments are coerced; `null`/`undefined` THROW** — hence the
  `Object.entries(x ?? {})` habit for anything from an API.
- `Object.fromEntries` reverses `entries` and accepts **any iterable of pairs**, so
  `Map` ↔ object is one expression each way.
- The `entries → map → fromEntries` round trip is how objects get `map`/`filter`;
  variants for keys, values, filter, pick/omit.
- 🔴 **Repeated-key data loss**: `Object.fromEntries(new URLSearchParams("tag=a&tag=b"))`
  is `{ tag: "b" }` — the first value is gone. Use `getAll` for parameters that repeat.
- The round trip drops **seven things**: symbol keys, non-enumerables, inherited
  members, the prototype, accessors (getters are *invoked*), descriptors, and numeric
  key order. It is a shallow plain-object normalisation.

---
## Phase 3 · 12 — Composition (`pipe` and `compose`)

Written 2026-08-14. Sources: MDN `Array.prototype.reduce`, `reduceRight`,
`Promise.prototype.then`, `Function: name`, `Function.prototype.length`.
Documentation-validated, no timings.

- 🔴 **`compose` and `pipe` are the SAME function with the argument list reversed.**
  `compose(f,g,h)(x)` = `f(g(h(x)))` (right to left, the maths convention);
  `pipe(f,g,h)(x)` = `h(g(f(x)))` (left to right). Saying that immediately is most of
  the interview answer. Redux's `compose` is the well-known right-to-left survivor.
- Seeded implementation: `(...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x)`;
  `compose` is the same with `reduceRight`.
- 🔴 **The function-reducing form** — `fns.reduce((f,g) => (...args) => g(f(...args)))` —
  lets the **first** function be variadic, but has **no initial value**, and MDN
  specifies `reduce` on an empty array with no initial value **throws `TypeError`**.
  So `pipe()` throws *at build time, not call time*. Seed it with an identity to get both.
- 🔴 **Every function after the first must be unary** — it receives only the previous
  step's return. That constraint is why **currying and composition are one subject**:
  currying is what produces the data-last unary functions a pipeline needs. Return an
  object to pass several values.
- **Async**: `fns.reduce((p, fn) => p.then(fn), Promise.resolve(x))`. Works because
  `then` **adopts a returned thenable**, so steps may be sync or async interchangeably.
  Strictly sequential — independent work wants a combinator, not a pipeline.
- **Point-free** = defining a function without naming its argument. Good for a straight
  chain of unary transforms; stops paying at the first branch, reused value, or
  out-of-position argument, where it forces combinators (`converge`, `juxt`, `useWith`)
  that mean nothing to most readers. "I would stop being point-free here" is the
  stronger answer.
- 🔴 **The real cost is the stack trace, not performance.** Every stage is the *same*
  anonymous arrow, so a throw cannot be attributed to a step — the pipeline is data, not
  code. Three fixes: **name every step** (MDN: a function takes its `name` from the
  variable it is assigned to), **keep a `tap`** that logs *and returns `x`*, and **unroll
  to named consts while debugging**. ⚠️ A `tap` that forgets to return feeds `undefined`
  onward — the most common bug in composed code.
- Smaller costs: the composed function reports **`length` `0` and an empty `name`**
  (it is a rest-parameter arrow), so anything introspecting arity sees nothing; and one
  closure allocation per stage.
- **Trade-off vs method chaining**: `arr.filter().map()` reads the same and keeps a
  useful stack trace, but is limited to methods the type provides. Composition works on
  any free function and gives up the trace to do it.

---
## Phase 3 · 13 — Memoization

Written 2026-08-14. Sources: MDN `Map`, `WeakMap`, `JSON.stringify`, Map key equality,
`Object.groupBy`. The wrapper is trivial; the topic is keys and eviction.

- 🔴 **`cache.has(key)`, never `if (cache.get(key))`.** A cached `0`, `""`, `null`,
  `false`, `NaN` or `undefined` is falsy, so a truthy check recomputes forever —
  silent, no crash, just no cache. The single most common memoization bug.
- `Map` over a plain object: any key type, insertion order, `size`, and no
  `Object.prototype` collision (`memoize(f)("toString")` finds an inherited function).
- 🔴 **No general key function exists.** `JSON.stringify` is **property-order sensitive**
  (`{a,b}` ≠ `{b,a}`), **omits `undefined`, functions and symbols** in objects and nulls
  them in arrays (so `f(1, undefined)` collides with `f(1)`), and throws on circular
  structures and `BigInt`. `args.join(",")` collapses every object to `[object Object]`
  and confuses `1` with `"1"`. **Take a key function per call site** — a better API than
  one that guesses. Nested maps (a cache tree) are exact but make eviction hard.
- ⚠️ **Unbounded by default = a leak** the moment the key space is user-controlled.
  Three bounds: **size cap** — `cache.delete(cache.keys().next().value)` is **FIFO, not
  LRU** (LRU needs delete+re-set on every *read*); **TTL**; and 🔴 **`WeakMap` when the
  key is an object** — the object's lifetime *is* the policy, the one strategy with no
  policy to get wrong. Keys must be objects or non-registered symbols.
- **Preconditions**: purity. Memoizing an impure function freezes the first answer; a
  memoized side effect happens once and then silently stops; memoizing a cheap function
  is slower *and* leaks.
- 🔴 **Memoizing a recursive function from the outside caches ONE entry** — the internal
  calls still reference the unmemoized binding, so the exponential work happens in full.
  The function must call the memoized binding.
- **A memoized method needs a per-instance cache or `this` in the key** — a
  prototype-level one shares a cache across every instance. A `WeakMap` keyed on `this`
  gives both.

## Phase 3 · 14 — Recursion

Written 2026-08-14. Sources: MDN "Too much recursion", Functions, `structuredClone`;
tail-call status from TC39 `proposal-ptc-syntax` and V8's published position.
🔴 **Stack-depth numbers are LINKED to phase 0 topic 03, not restated** — that page owns
the run (rule 8).

- **Base case first.** It must cover every way the input bottoms out — `null`, empty, and
  missing fields. `Math.max()` of an empty spread is `-Infinity`, so a leaf returns
  `-Infinity + 1`. Base cases are where recursive functions are actually wrong.
- **"Smaller" must be guaranteed, not likely.** Cycles need a `visited` set — a better
  base case cannot fix a cyclic graph walked as a tree.
- 🔴 **The stack limit is BYTES, not calls** — frame size decides depth, so there is no
  "about 10,000 calls" budget. 🔴 **`await` consumes no stack**, so async recursion goes
  far deeper than the synchronous twin. Both measured on phase 0 topic 03.
- 🔴 **No tail-call optimisation in practice.** PTC is in ES2015 and implemented in
  **JavaScriptCore**; **V8 and SpiderMonkey do not implement it**, and the syntactic
  opt-in (`proposal-ptc-syntax`) never shipped. So on Node and Chrome a tail-recursive
  rewrite still overflows — the folk advice is wrong on the target platform. **This is
  the most useful fact in the topic.**
- **Conversions**: explicit stack (an array on the heap — ⚠️ `pop` reverses child order,
  `shift` is O(n)); a **trampoline** (return a thunk, loop while `typeof result ===
  "function"`) which is manual PTC and only works in tail position.
- **Mutual recursion** overflows just as fast (depth is the total), and with `const`
  arrows has a **TDZ window** that function declarations do not.
- Right shape for: recursive data, divide and conquer (log depth), backtracking (the
  stack *is* the undo). Wrong for: depth ∝ input size, and overlapping subproblems.
- `structuredClone()` handles cycles and many built-ins but **throws on functions, DOM
  nodes and property descriptors** — not a universal deep clone.

---
## Phase 3 · 15 — Pure functions and side effects · 16 — No function overloading

Written 2026-08-14. Sources: MDN `Object.freeze`, `toSorted`, `sort`, `with`,
`structuredClone`, `Math.random`; Functions, Default/Rest parameters, `arguments`,
`Array.isArray`, `Number.isInteger`.

**15 · Purity**
- Two properties, both required: same arguments → same result, **and** no observable effect.
- 🔴 **Reading ambient state disqualifies as much as writing it** — `Date.now()`,
  `Math.random()`, `process.env`, a module-level `let`. This is the half people miss and it
  is exactly what forces mocks in tests. Inject `now` as a parameter.
- **The four things purity buys, named**: testability without mocks; correct memoization
  (purity is the *precondition*); reorderability and repeat-safety (React StrictMode
  double-invokes in dev precisely to surface impure renders); local reasoning.
- **Mutating array methods**: `sort reverse splice push pop shift unshift fill`. 🔴 ES2023
  **`toSorted` / `toReversed` / `toSpliced` / `with`** are the non-mutating counterparts.
  `items.sort()` returning the *same* array is the bug people actually ship.
- Spread and `Object.freeze` are **both shallow**; freeze fails **silently in sloppy mode**
  and **throws in strict** — and module code is always strict, so the throw is what you see.
- 🔴 **Push effects to the edges**: pure core (decisions/calculations), thin impure shell
  (I/O, DOM, clock, storage). **The tell that the split is right: the hard-to-test part is
  boring.**
- **Pure ≠ deterministic ≠ idempotent.** Deterministic is half of pure; idempotent is about
  *effects*, which is why `DELETE /cart/1` is idempotent and not pure.

**16 · No overloading**
- 🔴 A second declaration is a **reassignment**, not an overload — later initialiser wins,
  no warning.
- 🔴 **Prefer a default parameter to an `arguments.length` check.** Defaults fire on
  `undefined`, so `f(1)` and `f(1, undefined)` agree; an arity check makes them differ, which
  breaks the moment a caller forwards a missing value. `arguments` is also absent in arrows —
  MDN recommends rest parameters.
- **Three type-dispatch rules**: `Array.isArray` (not `typeof`, and **not `instanceof Array`
  — it fails across realms**, an `iframe` array has a different constructor); guard `null`
  before `typeof x === "object"`; **order branches narrowest first** because strings are
  iterable. ⚠️ Never dispatch on `fn.length`.
- **Options object** past 2–3 params or *any* boolean: named arguments, order-independence,
  declarative defaults, extensibility. 🔴 **The trailing `= {}` is mandatory** or a no-arg
  call throws `Cannot destructure property … of 'undefined'`. Keep what the function is
  *about* positional; options for how it behaves.
- ⚠️ **`null` is not `undefined` in a signature** — JSON sends `null` for absent fields, so an
  API response **bypasses the default**. Use `?? fallback` where `null` means absent.
- **Variadic or array, never both** — a single-array argument becomes permanently ambiguous.
- 🔴 **TypeScript overloads are a compile-time fiction**: erased, one runtime function, you
  still hand-write the dispatch, and TS does **not** verify the body handles every overload.

---
