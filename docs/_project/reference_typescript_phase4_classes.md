---
name: devbible-typescript-phase4-classes
description: TypeScript phase 4 claims for topics 02-04 — access modifiers (soft vs hard private), parameter properties, and implements vs extends
metadata:
  type: reference
---

# TypeScript Phase 4 — the class mechanics (topics 02, 03, 04, 07, 08)

Child of [[devbible-typescript-phase4]], split out on 2026-08-15 at the 300-line
memory cap ([[devbible-memory-file-cap]]). The parent holds the validation
method and the declaration topics (01, 05, 06); **open this one when writing or
reviewing topics 02, 03, 04, 07 or 08**, or at the phase close.

Same evidence rule throughout: **no sandbox**, validated against the handbook,
MDN and the release notes, with error codes read out of the compiler's own
diagnostic table. ⚠️ Install inspected is TypeScript **6.0.3** (the Go port), so a
message can be quoted but never shown firing.

## Topic 02 — Access modifiers (Understand, written 2026-08-15)

3 files / 453 lines: `README` 46 · *soft private and hard private* 193 ·
*visibility rules and choosing* 214. 📌 **Drafted flat at 327 lines and SPLIT on a
concept boundary** — "what the two systems are" vs "how they behave and which to
pick". Rule 1 working correctly for once: write it, measure it, split it.

- 🔴 **Two privacy systems, not two flavours of one.** `private` is a type
  annotation, erased. `#` is JavaScript the engine enforces. The handbook's own
  terms — **soft private** and **hard private** — are the vocabulary; quote them.
- **`private` is *"only enforced during type checking"*** (handbook), and
  `obj["secretKey"]` is a **documented escape hatch**, not a loophole — the
  handbook explicitly frames it as convenient for unit tests.
- 🔴 **THE claim of the topic: after erasure a `private` field is an ordinary
  enumerable own property**, so `res.json(user)` serialises a
  `private passwordHash` with the compiler satisfied end to end — nobody ever
  *read* it in TypeScript, and reading is all `private` checks. **Only `#`
  expresses "must not leave the process".** This is the phase README's promise,
  paid off.
- **The serialisation table** (MDN): `#` fields are absent from `JSON.stringify`,
  `Object.keys`, spread and `structuredClone`, and `Object.freeze`/`seal` have
  **no effect** on them — *"private elements are not part of the prototypical
  inheritance model"*.
- **Runtime enforcement is two different failures:** dot access outside the class
  body is a **syntax error** (parse time); dynamic access throws
  `TypeError: Cannot read private member #x from an object whose class did not
  declare it`.
- ⚠️ **Downlevel:** targeting ES2021 or below, TypeScript emits **WeakMaps** in
  place of `#`. Privacy holds; the output stops resembling the source.
- **Cross-instance access is ALLOWED** — `private` is private to the *class*, not
  the instance (handbook contrasts Ruby). That is what makes `equals` writable.
- **Cross-hierarchy `protected` is NOT** — `TS2446`, whose message names **both**
  classes (three placeholders). Access is granted by the class you are writing
  in, not by a shared ancestor; two siblings under one `Base` still fail.
- 🔴 **`#x in obj` beats `instanceof`** — it asks whether *this class body*
  installed the field, so it is immune to the duplicated-package problem that
  produces "this `Foo` is not a `Foo`". ES2022; MDN example quoted. Pairs with the
  type-level half (`TS2442`, declaration-site comparison) — together they are why
  `#` is the honest choice for a nominal type, and the mechanism topic 07 uses.
- **Honest reasons to still pick `private`:** bracket access from tests, a field
  that must serialise, `private readonly`, and **parameter properties** — `#`
  supports none of these and cannot take an accessibility modifier at all
  (*"An accessibility modifier cannot be used with a private identifier."*).

Codes read from the table: `TS2341`, `TS2445`, `TS2446`.

## Topic 03 — Parameter properties (Understand, written 2026-08-15)

Single file, 272 lines — genuinely one subject, so not chunked.

- 🔴 **The organising fact: this is the one class feature in common use that
  EMITS CODE.** Erasing an annotation is a **deletion**; a parameter property has
  to **insert** `this.x = x` into the constructor, which is a **transform**.
  Everything else about the topic follows — Node's strip-only refusal,
  `erasableSyntaxOnly`, bundler support, the portability argument.
- **`erasableSyntaxOnly`** (TS **5.8**) surfaces it at compile time:
  **`TS1294`** *"This syntax is not allowed when 'erasableSyntaxOnly' is
  enabled."* Cheap way to keep a codebase strip-runnable; a one-way door with a
  large first diff.
- **Any ONE of `public`/`private`/`protected`/`readonly` triggers it** — handbook
  wording quoted. A bare parameter creates no field, and **`readonly` alone
  counts**, which is how you get a public readonly field without writing
  `public`.
- 🔴 **Initialization order consequence that actually bites:** the handbook's
  four steps (base fields → base constructor → derived fields → derived
  constructor) mean a **field initializer cannot read a parameter property** —
  the field runs first. That is **`TS2729`** *"Property '{0}' is used before its
  initialization."* Fix by computing in the constructor body.
- ⚠️ **`useDefineForClassFields` / `target >= ES2022`:** handbook says derived
  class fields initialize *after* the parent constructor completes, **overwriting
  any value the parent set**. Real behavioural difference between targets; page
  says check the emit rather than reason about it.
- **`strictPropertyInitialization` never applies to a parameter property** (it is
  always assigned), so `TS2564` is irrelevant here — noted so nobody reads its
  silence as evidence the class is fully initialized.
- **No `#` equivalent, at all** — `#` fields take no accessibility modifier and
  there is no `#` parameter property. Choosing the shorthand is choosing soft
  privacy; links back to topic 02.
- **The honest split:** DI-framework codebases (NestJS, Angular) genuinely earn
  it — six lines instead of eighteen, and they compile properly so portability
  does not apply. Libraries and anything wanting `node file.ts` should avoid it,
  and enforce that with `erasableSyntaxOnly` rather than remembering.

📌 **Deliberately did NOT reproduce the runtime console block.** Phase 0 topic 04
(`04-strip-only-and-erasable-syntax.md`) captured
`SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property
is not supported in strip-only mode` from a **real `ts-p0` run**; this page links
there. Restating another page's measured output as if it were ours is the
fabrication rule's edge case, and linking is both honest and shorter.

Codes read from the table: `TS1294`, `TS2729`, `TS2540`, `TS2564`.

## Topic 04 — `implements` vs `extends` (Understand, written 2026-08-15)

Single file, 276 lines.

- 🔴 **The handbook's own emphatic wording is the page's spine**, quoted verbatim
  because paraphrase weakens it: an `implements` clause *"is only a check that the
  class can be treated as the interface type. It doesn't change the type of the
  class or its methods **at all**. A common source of error is to assume that an
  `implements` clause will change the class type - it doesn't!"* The italics and
  the exclamation mark are the handbook's.
- **Why people arrive wrong:** in Java/C#, `implements` **does** feed types into
  the implementation. Naming that explicitly is what makes the rule stick.
- **Consequence 1 — no contextual typing.** The handbook's `NameChecker` example:
  `check(s)` is `any` even though `Checkable` declares `name: string`.
  ⚠️ **Honest nuance added:** `strict` *does* catch it — but via **`TS7006`**, the
  implicit-any rule, **not** via the interface. The interface still supplies
  nothing, which is exactly why the same code is silently `any` in a non-strict
  codebase. Worth keeping; it is the kind of half-truth ("strict fixes it") that
  spreads.
- **Consequence 2 — optional members are not created.** `class C implements A`
  with `y?: number` on `A`: `c.y = 10` fails, *"Property 'y' does not exist on
  type 'C'."* The class is **assignable to** `A` and is not **an** `A`.
- 🔴 **The pair the compiler ships to catch this exact confusion**, each
  suggesting the other keyword — a gift of a structural device for the page:
  - **`TS2720`** *"Class '{0}' incorrectly implements class '{1}'. Did you mean to
    extend '{1}' and inherit its members as a subclass?"*
  - **`TS2689`** *"Cannot extend an interface '{0}'. Did you mean 'implements'?"*
- **You MAY `implements` a class** (a class declaration creates a type) — it means
  "match this shape, inherit nothing", so every member must be reimplemented, and
  private members make it impossible anyway (declaration-site comparison, topic
  02).
- **`TS2422`** *"A class can only implement an object type or intersection of
  object types with statically known members."* — no unions.
- **What only `extends` gives:** inherited members at runtime, types flowing down
  to overrides, `super`, `instanceof`, `TS2416` on a bad override, and abstract
  enforcement (`TS2515`, `TS2653`).
- **The deciding arithmetic:** one class, many interfaces. And `implements` is
  **free** — emits nothing — so use it liberally for documentation value.
- ⚠️ **Structural typing means you often need neither.** What the clause actually
  buys is *where the error appears*: at the class, rather than at the first call
  site that passes it somewhere.
- Lands on: **`implements` for contracts, `extends` for code, `abstract class`
  when you want both.**

Codes read from the table: `TS2420`, `TS2720`, `TS2689`, `TS2422`, `TS2416`,
`TS2515`, `TS2653`.

## Topic 07 — Branded / nominal types (Understand, written 2026-08-15)

Single file, 264 lines.

- ⚠️ **Labelled honestly at the top: branding is a COMMUNITY PATTERN, not a
  language feature.** There is no handbook chapter. What is doc-validated is the
  **primitives** — intersection types, `unique symbol`, declaration-site privacy —
  plus the error codes. Worth keeping as a template for other pattern topics:
  say what is documented and what is convention.
- 🔴 **The claim the page is built around: the value is NOT that `as UserId`
  becomes impossible — it is that it appears ONCE**, in a constructor function
  that validates, instead of nowhere and everywhere. **A brand with assertions
  scattered across the codebase is worse than no brand**: it costs the ceremony
  and provides none of the guarantee. It converts an invisible convention into a
  single auditable choke point.
- ⚠️ **A brand is not validation.** `'' as UserId` compiles. Same family as the
  `process.env` and return-position-generic traps — telling the compiler
  something does not make it so.
- **`unique symbol` has placement rules:** `TS1332` *"A variable whose type is a
  'unique symbol' type must be 'const'."* and `TS1331` *"A property of a class
  whose type is a 'unique symbol' type must be both 'static' and 'readonly'."*
  📌 **Recommend the plain string key** (`{ readonly __brand: B }`) except in a
  published library — marginally weaker, much more readable in error messages.
- **The honest four-axis comparison with the class-with-a-private-member route**
  (which is nominal typing already built in): runtime cost (none vs an allocation),
  still-a-`string` (yes vs no), JSON round-trip (survives vs needs rebuilding),
  runtime check (impossible vs `#brand in obj`). Type-level brand for identifiers
  and primitives; class when runtime identity is genuinely wanted.
- **Where it earns its keep:** IDs across tables, validated strings, units, and —
  the strongest case — **trust boundaries** (`RawHtml` vs `SanitisedHtml`), because
  it turns a convention that lived in code review into something the compiler
  checks.
- **Where it does not:** values you cannot funnel through a constructor, small
  codebases, and values crossing serialisation constantly.
- `TS2367` (*"This comparison appears to be unintentional… no overlap"*) shows up
  when comparing two differently-branded values — the brand working.

## Topic 08 — `readonly` and definite assignment `!:` (Understand, written 2026-08-15)

Single file, 264 lines.

- 🔴 **The framing that carries the page: `readonly` is a GUARANTEE the compiler
  enforces; `!:` is a WAIVER that asserts nothing.** Both read as *"trust me,
  this field is fine"*, and conflating them is how a `strict` codebase fills up
  with `undefined`. One adds safety, the other removes it.
- **`readonly` permits assignment only in the constructor or the declaration's
  initialiser** — `TS2540` anywhere else. Two limits people miss: it is
  **shallow** (`readonly items: string[]` stops reassignment, not `push`; you
  want `readonly string[]`) and it is **erased** like `private`, so a JavaScript
  caller reassigns freely and `Object.freeze` is the runtime tool.
- **`TS4104`** *"The type '{0}' is 'readonly' and cannot be assigned to the
  mutable type '{1}'."* — where a readonly array from `as const` or a
  `<const T>` parameter meets something wanting a mutable one. **Widen at that
  boundary with a spread, never by removing the `readonly` upstream.**
  **`TS2542`** is the index-signature version.
- 🔴 **`!` silences `TS2564` and puts nothing in its place.** If nothing assigns
  the field, the type still claims `string` while the value is `undefined` — the
  exact bug `strictPropertyInitialization` exists to prevent. The handbook's
  warranted case is quoted, and **"external library" is the operative phrase**:
  a DI container, a test lifecycle hook, an ORM hydrating an entity. Not "make
  the error go away".
- 📌 **The four honest alternatives to `!`**, as a table: optional `?`; a default;
  a constructor parameter; or **a private-optional field behind a getter that
  throws**. That last is the page's best contribution — same ergonomics at the
  use site as `!` (the property is typed `User`, no narrowing), but the failure
  is **loud, immediate and named** instead of `Cannot read properties of
  undefined` three frames away.
- **`!` also works on a `let`** (`TS2454`; property sibling `TS2565`), needs a
  type annotation (*"Declarations with definite assignment assertions must also
  have type annotations."*), and is refused on parameters and `abstract`/`declare`
  members (`TS1255`).
- ⚠️ **`name!: string` and `user!.name` are different operators sharing a
  character** — definite assignment assertion vs non-null assertion. Both
  overrule the compiler; that is all they have in common.

Codes read from the table: `TS2540`, `TS2564`, `TS2454`, `TS2565`, `TS4104`,
`TS2542`, `TS1255`.

## Topics 09–11 — the Know tier

Split into a sibling at the 300-line cap: **[[devbible-typescript-phase4-know]]**
— getters/setters, `this` types, abstract classes.

Related: [[devbible-typescript-phase4]] (parent — validation method and the
declaration topics 01, 05, 06) · [[devbible-typescript-build-progress]]
