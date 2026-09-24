---
name: devbible-typescript-phase4-know
description: TypeScript phase 4 claims for the Know-tier topics 09-11 — getters and setters, this types, abstract classes and construct signatures
metadata:
  type: reference
---

# TypeScript Phase 4 — the Know tier (topics 09, 10, 11)

Sibling of [[devbible-typescript-phase4-classes]], split out on 2026-08-15 at the
300-line memory cap ([[devbible-memory-file-cap]]). The parent
[[devbible-typescript-phase4]] holds the validation method and the declaration
topics; **open this when writing or reviewing topics 09, 10 or 11**, or at the
phase close.

Know tier throughout — these pages are scoped to recognition, not derivation.
Same evidence rule: no sandbox, handbook and release notes quoted verbatim, error
codes read from the compiler's diagnostic table at TypeScript **6.0.3**.

## Topic 09 — Typing getters and setters (Know, written 2026-08-15)

186 lines. See the parent for the full record — kept there because it was banked
before this split. Headline: **divergent read/write types (TS 4.3), and the rule
is a TEST — if `x.p = x.p` would not compile, the pair is illegal.**

## Topic 10 — `this` types and polymorphic `this` (Know, written 2026-08-15)

228 lines. Organised around **`this` appearing in three distinct positions that
solve three different problems** — recognising which is most of the Know-tier
value.

- 🔴 **Polymorphic `this` is INFERRED, and annotating discards it.** `return this`
  with no return annotation types as `this`, so `new ClearableBox().set("hello")`
  is a `ClearableBox` and the chain keeps the subclass's methods. Writing
  `: Box` instead is not *wrong*, it just throws the subclass away — **which is
  why a fluent chain breaks the moment someone subclasses.** Handbook's
  `Box`/`ClearableBox` quoted.
- **`this` parameters are a fake first parameter, erased at compile time.**
  `function fn(this: SomeType, x: number)`. On a method they turn "detached and
  passed as a callback" from a runtime `undefined` into a compile error —
  handbook's `MyClass.getName` / `const g = c.getName` quoted.
- **`this is T` guards narrow the RECEIVER**, so a base class can tell callers
  which subclass they hold (`FileSystemObject.isFile()`). Useful when the
  alternative is exposing a discriminant field purely for narrowing.
- 📌 **The arrow-vs-method trade is given as a table, not a recommendation**,
  because the handbook's own costs point in different directions: an arrow
  property **guarantees runtime `this`** but allocates **one copy per instance**
  and makes **`super` unavailable**; a method with a `this` parameter is **free at
  runtime**, allows `super`, and **only protects TypeScript callers**. Practical
  read: arrows for callbacks handed to frameworks, methods otherwise.
- **`noImplicitThis`** (part of `strict`) is what surfaces the standalone-function
  case; the fix is one of the three tools above.

## Topic 11 — Abstract classes and construct signatures (Know, written 2026-08-15)

234 lines. Built around the one genuinely non-obvious part: **the difference
between "the class" and "something you can call `new` on".**

- 🔴 **`typeof Base` is NOT "a constructor for a Base".** It is the static side,
  and `Base` is assignable to it — so a parameter typed that way admits the
  abstract class and `new ctor()` would construct it. Handbook's reasoning quoted:
  *"it's perfectly legal to write `greet(Base)`, which would end up constructing
  an abstract class"*.
- 🔴 **The real win of `ctor: new () => Base` is RELOCATION.** With `typeof Base`
  the error lands at the `new` **inside your function**; with a construct
  signature it lands at the **call site**, naming the actual problem —
  *"Cannot assign an abstract constructor type to a non-abstract constructor
  type."* Same bug, reported where a reader can act on it.
- **`abstract new (...args: any[]) => T`** accepts abstract *and* concrete
  classes — for when you need to **name** a class you will never construct
  (registry, `Map` keyed by class, mixin helper).
- ⚠️ **A `Ctor<T>` helper wants `any[]`, not `never[]`.** The "any function" bound
  from phase 3 is for values you never invoke; a construct signature you intend to
  **call** needs parameters you can actually pass.
- **Abstract class vs interface table**, and its last row is the one people
  forget: **an abstract class survives erasure as a real value**, so it works as a
  `Map` key or in `instanceof`. An interface does not.
- Codes: `TS2511` (cannot instantiate), `TS2515`/`TS2653` (unimplemented member),
  `TS1244` (abstract member in a concrete class), **`TS2513`** (*"Abstract method
  '{0}' in class '{1}' cannot be accessed via super expression."* — there is no
  implementation to reach). Plus the mixin rule: *"A mixin class that extends from
  a type variable containing an abstract construct signature must also be declared
  'abstract'."* — carry that into topic 14.

## Topic 12 — Static members and the static side (Know, written 2026-08-15)

242 lines. Built on the idea the phase keeps returning to: **a class declaration
creates TWO types** — the instance type, and the **static side** (the constructor
function, which `typeof C` names). Every rule follows from that split.

- 🔴 **`TS2302`'s reason stated as arithmetic, not a rule to memorise:** `T` is
  per-instantiation, **the constructor is ONE object shared by every
  instantiation** — `Box<string>` and `Box<number>` are the same runtime value,
  so there is no single `T` for a static to have. Hence `static of<U>` in every
  real library.
- 🔴 **`TS2699`** *"Static property '{0}' conflicts with built-in property
  'Function.{0}' of constructor function '{1}'."* — because **a constructor IS a
  function**, so `static name` / `length` / `caller` collide with what every
  function already has. `static name` is the one people actually hit.
- **`TS2417`** *"Class static side '{0}' incorrectly extends base class static
  side '{1}'."* — statics are **inherited and checked**; the phrase "static side"
  in a message is the tell that you are looking at the constructor.
- **Static blocks (TS 4.4)**, quoted verbatim. The point that earns them: *"full
  access to our class's internals"* — a static block can reach **`#private`**
  members, which nothing outside the class body can. Before them this needed an
  exported helper plus a public setter, widening the API purely for
  initialisation. Multiple blocks run **in source order**, once, at class
  definition.
- ⚠️ **Constraints that follow from "initialiser, not function body":** no
  `return`, **no `await`**, no `for await` (all read from the diagnostic table).
  **No-`await` is the one that matters** — class definition is synchronous, so
  async setup needs a factory or a lazily-awaited promise, not a static block.
- **Statics vs module-level values**, because statics are often reflex: an unused
  static **on a used class cannot be tree-shaken**, while an unused export can.
  Statics earn their place when the class name does documentation work at the call
  site (`Color.fromHex`, `Box.of`) or when a factory needs `#private` access.

## Topic 13 — Decorators, stage 3 (Know, written 2026-08-15)

241 lines. Leads with the fact that matters in practice, not with syntax.

- 🔴 **TWO INCOMPATIBLE DECORATOR SYSTEMS are in circulation**, and the first
  thing to establish about any decorator is which one it is. **The fastest tell
  is the parameter list:** `target, propertyKey, descriptor` = legacy;
  `(value, context)` = stage 3 (TS 5.0, no flag needed).
- 🔴 **Why NestJS / TypeORM / Angular cannot move**, both quoted verbatim from
  the 5.0 release notes: the standard proposal **does not allow decorating
  parameters** (NestJS's `@Inject()` on a constructor parameter) and **is not
  compatible with `emitDecoratorMetadata`** (TypeORM, `class-validator`, reading
  design-time types at runtime). **This is not debt you clear by flipping a
  flag** — say so rather than implying migration is a to-do.
- Also quoted: *"while decorators can be written to support both the old and new
  decorators behavior, any existing decorator functions are not likely to do so."*
- **The fully-typed `loggedMethod` is read as a PHASE-3 EXERCISE**, which is the
  page's nicest move: `This` threaded through a `this` parameter (topic 10),
  `Args extends any[]` capturing the parameter list as a tuple and spreading it
  back so arity is still checked, `Return` tied to the original — and **every
  type parameter appears at least twice**, exactly phase 3 topic 13's test.
- **The context object** carries name / `static` / `#private` metadata and is
  typed per position (`ClassMethodDecoratorContext` and five siblings),
  parameterised by the receiver and the member's own type. **Look up the one you
  need; do not memorise six.**
- ⚠️ **The honest cost: a decorator moves behaviour off the page.** The method
  body no longer shows that it retries or logs, breakpoints land in the
  replacement, and stacked decorators apply **bottom-up**. **The comparison to
  make is a higher-order function** — `withRetry(fn)` does the same job visibly
  and needs no compiler feature. Decorators win only where a framework needs a
  declarative, discoverable surface, which is why the pattern is concentrated in
  frameworks rather than application code.

Related: [[devbible-typescript-phase4]] · [[devbible-typescript-phase4-classes]] ·
[[devbible-typescript-build-progress]]
