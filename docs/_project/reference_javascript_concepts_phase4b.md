---
name: devbible-javascript-concepts-phase4b
description: Load-bearing claims from JavaScript phase 4's Understand tier (topics 12 onward) — freeze/seal, instanceof, object creation — with the sources they were validated against
metadata:
  type: reference
---

**Phase 4, Understand tier, topics 12 onward.** Written by lane A in the `js-lane-a` worktree,
2026-08-14. Topics 01–11 are in [[devbible-javascript-concepts-phase3-4]]; the live cursor is
[[devbible-javascript-build-progress]].

**All documentation-validated against MDN** (each page names its sources in a `> Verified:` line).
**No sandbox, no timings, no console blocks** — rule 8.


**Phase 4 topic 12 · `Object.freeze` and `seal`** (Understand) — **3 chunks + index, 734 lines**,
commit `d3761a8f`. 228 / 235 / 226 + 45. The split is genuine: level semantics → what freeze cannot
reach → deep freeze and the alternatives.

Facts worth not re-deriving:

- **The three levels are one mechanism**: `preventExtensions` sets `[[Extensible]]` false; `seal`
  adds `configurable: false` on every own property; `freeze` adds `writable: false` on every own
  **data** property. So **freeze cannot make an accessor read-only** — a setter stays installed and
  callable, and the freeze is only as strong as that setter's body.
- 🔴 **The failure mode is silence in sloppy mode and `TypeError` in strict.** Same object, opposite
  developer experience. ES modules and class bodies are always strict, so modern code throws.
- 🔴 **`push` throws on a frozen array even in sloppy mode**, while `arr[0] = x` on the same array
  stays silent there — the mutating array methods write with the throw-on-failure form internally,
  so they ignore the *caller's* strictness. One frozen array, two different behaviours.
- 🔴 **`Map`, `Set`, `Date` and `#private` fields are internal slots, not properties.**
  `Object.freeze(new Map())` reports `isFrozen === true` and protects nothing; `map.set()` still
  works. Same for a frozen `Date` and for `this.#count++` on a frozen instance. **There is no
  built-in immutable `Map`.**
- **`Object.isFrozen(Object.preventExtensions({}))` is `true`** — vacuously, since an object with no
  properties has no forbidden operation left. The predicate is about state, not about which call
  was made.
- **The naive `deepFreeze` has three bugs**: infinite recursion on cycles, **invoking getters**
  (`obj[key]` runs the accessor — forcing lazy values, firing side effects, and freezing a
  throwaway object instead of the real state), and missing symbol keys. The fix is a `WeakSet`
  threaded through the recursion, `Reflect.ownKeys`, and recursing into `descriptor.value` only.
- **`readonly` and `Object.freeze` are complements** — compile-time-and-erased vs runtime-only. The
  production shape is `as const` plus a shallow freeze on the export.

**Phase 4 topic 13 · `instanceof` and `Symbol.hasInstance`** (Understand) — **2 chunks + index,
521 lines**, commit `6a211485`, **the first topic written in the worktree**. 237 / 242 + 42. Split
at the seam between mechanism and failure.

The framing that made it work: **`instanceof` asks whether `C.prototype` is in `x`'s chain — not
whether `C` built it.** Everything else follows from that substitution.

- **It is not a provenance check, and can be made to lie in both directions.** Reassign
  `C.prototype` and existing instances stop matching; `Object.setPrototypeOf(plain, C.prototype)`
  and a never-constructed object starts matching.
- 🔴 **`Symbol.hasInstance` is consulted BEFORE the callable check**, so the right-hand side does
  not have to be a function at all — a plain object with the hook works. And
  `Function.prototype[Symbol.hasInstance]` is **non-writable and non-configurable**, so the default
  cannot be overridden globally, only per class.
- **Two different `TypeError`s:** "not callable" (RHS is a primitive/plain object with no hook) and
  "Function has non-object prototype" (**arrow functions and shorthand methods have no
  `prototype`**). A *failed* check and an *invalid* check are different outcomes.
- 🔴 **The second failure mode is the one nobody expects: two copies of the same package.** A
  duplicated transitive dependency or a bundler resolving ESM and CJS separately produces two
  distinct class objects from identical source — `instanceof` is identity-based, so `false`. This
  is *why* libraries ship `Foo.is()` rather than telling you to use `instanceof`.
- **`await` does not use `instanceof Promise`** — it checks for a callable `then`. That duck typing
  is the entire reason promise libraries interoperate, and it is the strongest available argument
  for shape checks at boundaries.
- **`Object.prototype.toString` is cross-realm but spoofable** — `Symbol.toStringTag` overrides the
  tag for anything, arrays included. `Array.isArray` and `util.types.*` read internal slots and
  cannot be faked (edge: `Array.isArray` follows a `Proxy` to its array target and returns `true`).
- **The portable brand is `Symbol.for("scope.Type")`** — registered symbols are shared across realms
  *and* across duplicate copies, which is exactly the property `instanceof` lacks.
- ⚠️ **`Error.isError()` was named as recent with an explicit "check support" caveat** rather than
  asserted — rule 8's "state it as uncertain" applied deliberately.

**Phase 4 topic 14 · Object creation patterns** (Understand) — **2 chunks + index, 520 lines**,
commit `2dc2a98f`. 254 / 223 + 43.

The framing: **constructor functions and classes are one mechanism**, so the only real choice is
**factory vs class**, and it reduces to *where the methods live*. `a.greet === b.greet` is `false`
for a factory and `true` for a class — every other difference (instanceof, this, inheritance vs
composition, whether forgetting `new` is even possible) follows from that one line.

- 🔴 **"I need privacy" is no longer a reason to pick a factory.** `#private` fields are genuinely
  inaccessible and are missed by `Object.keys`, `JSON.stringify` and `Object.freeze` exactly as
  closure variables are. The surviving reasons are shape and ergonomics.
- **Static factory methods are the shape that ends most of the argument** — they name their input
  (JS has no overloading), they can fail by returning `null` where a constructor must throw, and
  they can return a cached instance where `new` must allocate. Prototype sharing is kept.
- ⚠️ **`{ __proto__: null }` is a special literal form.** `{ ["__proto__"]: null }` or assigning
  afterwards does **not** set the prototype — it creates an ordinary property.
- **The bug null-prototype dictionaries exist to prevent**, stated concretely: a word count over
  real text where the word is `"toString"` — `counts[word]` is a *function*, so the truthiness
  branch increments it and the count becomes `NaN`.
- **`Map` is usually the better answer**, and the deciding row is iteration order: a plain object
  puts **integer-like keys first, ascending**, whatever the insertion order; `Map` is pure insertion
  order. The only common reason to prefer a null-prototype object is direct `JSON.stringify`.
- **`Object.create` over `Object.setPrototypeOf`** — cited as MDN documents it (a very slow
  operation in every engine, because it invalidates shape-based optimisation), **not measured here**.

## Topic 15 · Normalising untrusted shapes (Understand)

- **`?.` short-circuits the whole chain to its right**, but only from the link it is attached to.
  `a?.b.c` with `a` present and `b` undefined **throws**, and the message names `c` — which sends
  people to the wrong property. `(a?.b).c` throws even when `a` is nullish: parentheses end the
  chain.
- 🔴 **`??` vs `||` is the `0`/`""`/`false` bug.** `settings.darkMode || true` **can never be
  `false`**, so an explicit "off" is silently ignored. Mixing `??` with `||`/`&&` without
  parentheses is a **`SyntaxError`**, not a precedence surprise — the language refuses to guess.
- **Destructuring defaults fire on `undefined` only**, and JSON has no `undefined`, so an absent
  API field arrives as `null` and skips every default. Nested destructuring through a missing
  parent **throws**; needing two levels of defaulted nested destructuring is the signal to
  normalise instead.
- **"Missing" is three states** — absent / explicitly `null` / present. `??` collapses the first
  two, which is right for rendering and wrong for PATCH. Test presence with **`Object.hasOwn`**,
  never `in` (walks the chain) and never `!== undefined`.
- **The normaliser's four properties:** total (never throws, never `undefined`), every field a type
  that cannot be absent, renames once, and **drops unknown keys** — that last one is a *security*
  property, not tidiness.
- 🔴 **`Number("")` and `Number(null)` are both `0`**, so the fallback belongs outside the coercion;
  `Number(x) || fallback` is wrong twice (empty becomes 0, and a real 0 gets replaced).
  `parseInt("12px")` is `12` — a prefix reader, wrong when the whole string must be numeric.
  **`new Date("garbage")` does not throw** — `Number.isNaN(d.getTime())` is the only test.
- **The rule that settles throw-vs-default:** never default a value you write back or charge for. A
  missing display name can become `""`; a missing price must not become `0`.
- **`as Product` on `res.json()` checks nothing** — assertions are erased at build. `json()` returns
  `any`/`unknown` precisely because the value came from outside the program.

## Topic 16 · Prototype patterns to avoid (Understand)

- **`flatten` → `flat` and `contains` → `includes` are scar tissue**: MooTools had shipped its own
  on the built-in prototype, the native version broke sites, and the web cannot break — so the
  *committee* renamed. The lesson is that a plausible name on a built-in is the name the committee
  will eventually want.
- **A legitimate polyfill has three marks:** feature detection (never overwrite a native
  implementation), the exact specified name and semantics, and `enumerable: false, writable: true,
  configurable: true` to match a real built-in. A **ponyfill** (export it, do not install it) is
  safer still.
- **Patching survivably:** keep the original and always call through it with `apply(this, args)`;
  patch once at startup in one named place; **name** the replacement so stack traces are useful;
  return exactly what the original returns. 🔴 **The lasting cost is debuggability** — nothing at
  the call site reveals the patch, which is why an imported wrapper module beats a global patch.
- 🔴🔴 **The prototype-pollution correction worth keeping: `JSON.parse` is NOT the vulnerability.**
  It creates `__proto__` as an **ordinary own data property** and never invokes the inherited
  setter — `Object.getPrototypeOf(parsed)` is still `Object.prototype`. The pollution happens when
  *your* code copies that key with **assignment**, because `target["__proto__"] = v` reaches the
  accessor on `Object.prototype`.
- **Three routes, not one:** `__proto__`, `constructor` → `prototype`, and `prototype`. A blocklist
  covering only the first is not a defence.
- ⚠️ **`for...in` is part of the bug** — it walks inherited keys, so an already-polluted prototype
  feeds the next merge. `Object.keys`/`Object.entries` see own enumerable only.
- **Impact:** authorisation bypass (`if (obj.isAdmin)` on an object that does not define it), DoS
  (**a polluted `then` makes every plain object look thenable**, so `await` breaks), and RCE on Node
  when a library reads the polluted property as an option. It persists for the life of the process,
  so one poisoned request affects every later one.
- **Defences, ordered:** field-by-field normalising (**immune by construction** — `__proto__` is not
  in your field list); `Object.create(null)` targets; block all three keys; `Map` for data keys; a
  `JSON.parse` reviver; then hardening — `Object.freeze(Object.prototype)` and Node's
  `--disable-proto=delete`, both defence in depth, never a fix.
- **Test it in an isolated process.** The effect is global, so a pollution test leaks into every
  later test in the same run and produces failures that look unrelated.

## Topic 17 · `toString`, `valueOf`, `Symbol.toPrimitive` (Know)

- **One algorithm, three steps:** `Symbol.toPrimitive` if present (its return must be primitive, or
  `TypeError`); else `toString`/`valueOf` in an order the **hint** picks; else
  `TypeError: Cannot convert object to primitive value`.
- **The hint table:** `"string"` → `toString` first (`String()`, template literals, property keys,
  `join`); `"number"` → `valueOf` first (`-`, `*`, `/`, unary `+`, relational operators, `Number()`);
  `"default"` → same order as number, and **only binary `+` and loose `==` produce it** — because
  `+` means two things and declines to say which.
- 🔴 **`obj + ""` does not call `toString`.** `+` asks for `"default"`, `valueOf` answers first, and
  the *number* is what gets concatenated. `String(obj)` or a template literal forces the string path.
- **The `Object.prototype` defaults are useless on purpose:** `valueOf` returns the object (never a
  primitive, so it never wins) and `toString` returns `"[object Object]"`. An `Object.create(null)`
  object has neither, which is the `TypeError`.
- **`[1,2] + [3]` is `"1,23"`** — arrays inherit `Object.prototype.valueOf`, so the algorithm falls
  through to `Array.prototype.toString`, which joins with commas. No array special-casing involved.
- 🔴 **`Date` is the one built-in whose `Symbol.toPrimitive` maps `"default"` → `"string"`.** That is
  why **`date1 - date2` is a duration in ms and `date1 + date2` is nonsense** — the most useful
  consequence in the whole topic.
- **`==` coerces only against a primitive.** Two objects compare by reference, always.
- **`{} + []` is `0` only at statement position** (`{}` parses as a block, leaving unary `+[]`). In
  expression position it is `"[object Object]"`. The answer is about parsing, not coercion.
- **Implement `Symbol.toPrimitive`, not a `toString`/`valueOf` pair** — one function makes the
  `"default"` branch a visible decision instead of an accident.
- 🔴 **There is NO operator overloading.** You influence what an object *converts to*, never what an
  operator *does*: `v1 + v2` on vectors can only yield a number or a string.
- 🔴 **Four different protocols, routinely confused:** conversion (`Symbol.toPrimitive`),
  serialisation (**`toJSON`** — `JSON.stringify` never calls `toString`), type tag
  (`Symbol.toStringTag`), and debugger output (`util.inspect.custom` on Node). **A class holding its
  state in `#private` fields with no `toJSON` serialises to `{}` — silently.**
- **`sort()` stringifies by default** — `[1,10,2].sort()` is `[1,10,2]`, and an array of objects
  sorted with no comparator compares `"[object Object]"` against itself, so the order is meaningless.
- **Locale formatting does not belong in `toString`** — that is `Intl.NumberFormat` /
  `Intl.DateTimeFormat`.

## Topic 18 · Mixins and composition over inheritance (Know)

**The page's value is that it answers "why HERE" rather than repeating the slogan.** Four
JavaScript-specific reasons:

1. **`extends` takes one parent and there are no runtime interfaces** — TypeScript's are erased at
   build, so at runtime there is no way to declare a contract without inheriting an implementation.
   `extends` is the only *language* mechanism for shared behaviour, which is why it gets stretched.
2. **Nothing enforces an abstract method.** No `abstract` keyword; a base-class `throw` fires only
   when called. A `new.target` guard stops direct instantiation but says nothing about methods.
3. 🔴 **The fragile base class is worse here because fields initialise late.** A base constructor
   calling an overridable method dispatches to the subclass override *before* the subclass's fields
   exist — `undefined`, or a `TypeError` with `#private`. Generalised: every method a base class
   calls on `this` is effectively public API, because the call is a dynamic prototype lookup.
4. **Duck typing pays no dividend to the hierarchy** — consumers ask for `then`/`length`/`pipe`, and
   `instanceof` is unreliable across realms and duplicate copies anyway.

- **The practical test for a broken hierarchy:** a subclass overriding a method *to disable it*
  (`throw new Error("not supported")`). That is code sharing between things that are not the same
  kind of thing.
- **Depth guide:** two levels fine, four a smell, six a rewrite.
- **The ecosystem's own answer:** React mixins → HOCs → hooks, each step driven by implicit
  inter-dependencies and silent name collisions, each moving closer to "just call a function".
- **Pattern 1, `Object.assign(C.prototype, mixin)`:** methods land **enumerable** (class methods are
  not), collisions are silent, and 🔴 **`super` is a `SyntaxError`** — the copied function's home
  object is the literal it was written in, so there is nothing above it to look through.
- **Pattern 2, the subclass factory** `(Base) => class extends Base {}`: real chain links, so `super`
  works and constructors compose via `super(...args)`. ⚠️ Still silent collisions (by chain order),
  **no `x instanceof MyMixin`** (a mixin is a function — brand it and add
  `static [Symbol.hasInstance]`), and the returned classes are **anonymous unless named**, which is
  what makes them hard to debug. Name them: `class Serializable extends Base`.
- **Pattern 3, composition** is the default: the dependency is visible in the constructor,
  collisions are impossible, and a test can inject a fake without touching prototypes.
- **Keep mixin state on a `Symbol` key** so two independent mixins cannot collide on a field name.

## Topic 19 · `Proxy` and `Reflect` (Know)

- **A proxy intercepts internal operations, not syntax.** Target does the work, handler holds the
  traps, and **an undefined trap falls through unchanged** — `new Proxy(t, {})` behaves like `t`.
- ⚠️ **`ownKeys` alone does not control `Object.keys`.** That operation calls `ownKeys` *and then*
  `getOwnPropertyDescriptor` per key, keeping only the enumerable ones — fake keys without fake
  descriptors give an empty `Object.keys`.
- 🔴 **Forward with `Reflect`, and pass the `receiver`.** `obj[prop]` loses it, so a getter reached
  through a proxied **prototype** runs with the target as `this` and returns the wrong object's
  data. And **`set` must return a boolean** — `undefined` counts as failure and throws a `TypeError`
  in strict mode (every module). `return Reflect.set(...arguments)`.
- **The invariants stop a proxy lying:** a trap cannot contradict a non-configurable, non-writable
  target property; `ownKeys` must include every non-configurable key. 🔴 **So proxying a frozen
  object achieves nothing** — freezing makes everything non-configurable.
- 🔴 **Internal slots do not forward.** `new Proxy(new Map(), {}).get(k)` throws *"Method
  Map.prototype.get called on incompatible receiver"*; same for `Set`, `Date`, typed arrays and
  **`#private` fields**. The standard compromise is to `value.bind(obj)` functions in the `get`
  trap — which fixes the crash and means their internal writes bypass your traps. **This is why
  reactivity libraries hand-write collection handlers.**
- **A proxy is never `===` its target**, so `WeakMap`/`Set`/cache keys see two objects.
  ⚠️ **`Array.isArray` follows a proxy to its target** and returns `true`.
- **Why `Proxy` displaced `defineProperty` for reactivity** — the accessor model instruments
  *properties*, so Vue 2 could not see a property added later (hence `Vue.set`), could not detect
  `delete` at all, and missed array index/`length` writes (hence hand-patched array methods). A
  proxy intercepts the *operation*.
- **The unique capability worth naming:** validating or tracking properties that **do not exist
  yet**. A setter covers a known property; only a proxy covers `obj.anything = v`.
- **Costs:** a handler call per intercepted operation (**no timings given** — measure your own hot
  path), harder debugging, and reflective operations like `JSON.stringify` firing many traps per
  object. It is a framework-author's tool; prefer a setter, `seal`, `freeze` or an explicit call.
- **`Reflect` without `Proxy`:** `Reflect.ownKeys` (strings **and** symbols), `Reflect.has`,
  `Reflect.apply`, `Reflect.construct` with an explicit `new.target`.

## Topic 20 · Private state before `#` (Know) — and the phase's closing thread

- **Four older patterns, only two of them private.** `_underscore` (public, enumerable, **serialised
  into API responses**, and 🔴 **silently collides across a class hierarchy** — the concrete thing a
  convention structurally cannot fix); closures (private, but no prototype sharing); a module-scoped
  **`WeakMap`** (private *and* keeps methods on the prototype — the shape Babel/TS compiled `#` to);
  and **`Symbol` keys, which are NOT private** — `Object.getOwnPropertySymbols` and
  `Reflect.ownKeys` list them, devtools show them. Symbols are collision avoidance.
- 🔴 **`Weak` is load-bearing.** A plain `Map` for per-instance data holds every instance strongly
  forever — an unbounded leak.
- ⚠️ **TypeScript's `private` is the same category as `_`** — compile-time and erased at build.
- **`#` enforcement is syntactic:** outside access is a **`SyntaxError` at parse time**; access on a
  non-instance is a **`TypeError`**. It cannot be forged, borrowed or added later.
- 🔴 **`#x in obj` is the brand check** (ES2022) — a boolean, no `try/catch` — and it beats
  `instanceof` because it tests the real brand, so it **survives realms and duplicate package
  copies**.
- **The phase's closing thread:** `#` fields are **not properties**, which is one fact with four
  consequences already met separately — `Object.freeze` cannot reach them (topic 12), a `Proxy`
  throws on them (topic 19), `JSON.stringify` misses them so an all-private class serialises to
  **`{}`** silently (topic 17), and reflection never lists them. Devtools *do* show them.
- **No `protected`:** `#` is per-class, so a subclass cannot read a parent's private field. The
  options are a public accessor or composition.
- ⚠️ **Do not migrate `_x` → `#x` as a sweep** — it changes `JSON.stringify` output, `Object.keys`,
  proxy behaviour and test access. Those are behaviour changes, not a rename.
- **Test through the public API.** If an assertion is impossible without reaching private state, the
  class is usually missing a public observation its real callers need too.

