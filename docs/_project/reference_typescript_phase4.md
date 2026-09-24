---
name: devbible-typescript-phase4
description: TypeScript phase 4 (Classes, objects and declaration merging) — the load-bearing claims per topic and the sources they were read from, banked as each topic lands
metadata:
  type: reference
---

# TypeScript Phase 4 — Classes and declarations: claims and sources

Opened 2026-08-15 by Part A session `3af83cbb`. **Open this when writing or
reviewing a phase-4 page**, or at the phase close. The live cursor is
[[devbible-typescript-build-progress]].

## How claims here are validated

**No sandbox** (rule 7). Three sources, named on each page's `> Verified:` line:

1. The **TypeScript handbook** — *Declaration Merging*, *Classes*, *Modules*.
2. The **release notes** for anything with a version.
3. 🔴 **Installed `.d.ts` files and the compiler's diagnostic table, read rather
   than recalled.** This phase leans on the first far more than phase 3 did,
   because its subject *is* other people's type declarations.
   - `grep -o '"[A-Za-z_0-9]*_NNNN", "[^"]*"' <ts>/lib/typescript.js` → the exact
     `{0}`-templated message for an error code. ⚠️ Install is TypeScript
     **6.0.3** (the Go port), not the 7.0.2 the corpus targets — say so on the
     page. Its JS package carries the string table but **not the checker**, so a
     message can be quoted, never shown firing.
   - devbible's **own `node_modules/@types/`** has real, current type packages —
     `@types/express` 4.17.25 and `@types/express-serve-static-core` **5.1.3**
     were read directly for topic 01. This is documentation, not a run.

## Topic 01 — Module augmentation (Master, written 2026-08-15)

4 files / 677 lines: `README` 65 · *what merging and augmentation are* 167 ·
*augmenting a package* 214 · *why it did not load* 231.

### The framing that makes the rules stop needing memorisation

- **`interface` and `namespace` are OPEN; `type` and `class` are CLOSED.**
  Declare an interface twice and the members merge; declare a type alias twice
  and it is `TS2300: Duplicate identifier`. **Augmentation is not a separate
  feature — it is that openness aimed at a name in another file.** From this,
  everything follows: you can add to something open, you cannot invent something
  new, and the file has to be one the compiler reads.
- ⚠️ **Consequence worth stating on the page:** a library that exports its shapes
  as **type aliases cannot be augmented at all**. Nothing you write reopens them.
  Check before promising an augmentation will work.

### The merge rules (handbook, quoted not paraphrased)

- *"Non-function members of the interfaces should be unique. If they are not
  unique, they must be of the same type."* → **merging ADDS and never overrides.**
  There is no augmentation-based way to turn a library's `id: string` into
  `id: number`. This kills most of what people first try.
- *"Each function member of the same name is treated as describing an overload of
  the same function."*
- **Ordering: a LATER declaration's group goes ABOVE an earlier one's** — the
  opposite of the intuition, and what makes augmentation useful at all.
- 🔴 **The exception, and it is load-bearing in real life:** signatures whose
  parameter is a **single string literal** (not a union) bubble to the top of the
  merged overload list. That is why `document.createElement('div')` yields
  `HTMLDivElement` rather than matching the general `string` overload declared in
  another file. Every `createElement` call depends on it.

### 🔴 The Express finding — read from the installed types

`@types/express-serve-static-core@5.1.3` contains, verbatim:

```ts
declare global {
    namespace Express {
        // These open interfaces may be extended in an application-specific manner via declaration merging.
        // See for example method-override.d.ts (...)
        interface Request {}
        interface Response {}
        interface Locals {}
        interface Application {}
    }
}
```

…and the wiring that makes it reach every handler:

```ts
export interface Request<...> extends http.IncomingMessage, Express.Request {
```

**This reframes the whole technique.** `req.user` augmentation is not a
workaround — the maintainers ship **empty interfaces whose only purpose is to be
merged into**, and say so in a source comment. Quote the comment on the page; it
is more persuasive than any explanation.

Consequence: you augment the **global `Express` namespace**, not the `'express'`
package. Augmenting `'express'` does nothing, and it fails silently.

### Claims worth carrying

- 🔴 **The type half and the runtime half are separate.** `declare module` emits
  nothing. Augment without assigning `X.prototype.m` → clean compile, runtime
  `TypeError`. The mirror case (library patches at runtime, nobody wrote the
  augmentation) → `Property does not exist` on code that works. **Knowing which
  half you owe is the skill.**
- 🔴 **`export {};` is the line everyone omits.** A file with no top-level
  import/export is a **script**, not a module — `declare global` is invalid in it
  (`TS2669`) and declarations leak globally instead. ⚠️ **This is why an
  augmentation can break from deleting an unrelated import**: the file silently
  changes kind. Keep an explicit `export {}` even when an import already makes it
  a module.
- **`user?: User`, not `user: User`.** The property is genuinely absent until the
  auth middleware runs; required is a lie the compiler believes and never checks.
  Noted the legitimate alternative (a per-route `AuthedRequest extends Request`)
  rather than presenting augmentation as the only answer.
- **The two absolute limitations** (handbook, quoted): *"You can't declare new
  top-level declarations in the augmentation — just patches to existing
  declarations."* and *"Default exports also cannot be augmented, only named
  exports."* → a package whose whole API is a default export is unaugmentable.
- ⚠️ **`process.env` augmentation is unearned confidence** — it removes
  `| undefined` without making the variable exist. Same shape as phase 3's
  return-position generic. Page says validate at startup, which makes the
  declaration *true*.
- **Augmenting your own code is usually wrong** — the member appears from nowhere
  and "go to definition" lands in an unopened file. The exception that earns it is
  a genuine plugin boundary, which is the same shape as the library case.

### 🔴 The failure catalogue — because a missing augmentation is NOT an error

The governing fact, and the reason this topic is Master tier: **if the file never
loads, nothing says so.** The original type is used and the symptom appears at
the *use* site, in a file that is correct. Ordered by frequency:

1. **The compiler never read the file** — `include` does not cover it. Settle it
   empirically: **`npx tsc --listFiles | grep <file>`**. No line, no
   augmentation. This is the phase gate's second half.
2. **The file is a script, not a module** → `TS2669` *"Augmentations for the
   global scope can only be directly nested in external modules or ambient module
   declarations."* Sibling: `TS2670` (missing `declare` modifier).
3. **The specifier does not resolve** → `TS2664` *"Invalid module name in
   augmentation, module '{0}' cannot be found."* Relative specifiers resolve
   relative to the augmenting file; **sub-paths are distinct modules**.
4. **The package ships no types** → `TS2665` *"…resolves to an untyped module at
   '{1}', which cannot be augmented."* Needs an ambient `declare module 'pkg';`
   first — a different thing, and Phase 6's subject.
5. **Target is not a module** → `TS2671` / `TS2649` *"…resolves to a non-module
   entity."*
6. **Only the type half was written** → compiles, throws.

All six codes read from the 6.0.3 diagnostic table.

## Topic 05 — Interface declaration merging (Understand, written 2026-08-15)

3 files / 438 lines: `README` 46 · *what merges with what* 195 · *the accidents*
197. 📌 **Drafted flat at 308 and split on the page's own two halves** — the
second time in phase 4 the cap did its job instead of being budgeted around.

- 🔴 **The handbook's Namespace/Type/Value declaration table is the whole key**,
  and it is worth more than any rule list. `Namespace` fills all three slots;
  `Class` and `Enum` fill Type+Value; `Interface` and `Type Alias` fill Type
  only; `Function` and `Variable` fill Value only. **Two declarations coexist
  when they do not collide in the same slot.** That single sentence derives:
  namespace+function (typed properties on a function), namespace+class
  (`Album.AlbumLabel`), namespace+enum, why `interface Foo` and `const Foo`
  coexist, why `typeof Foo` is meaningful for a class, and why **classes cannot
  merge with classes or variables**.
- **Disallowed, quoted:** *"classes can not merge with other classes or with
  variables."*
- 🔴 **The accident that costs the most: a duplicated interface COMBINES
  SILENTLY.** The result is a type *wider than either author intended*, and the
  errors appear at **construction sites** — files whose authors never saw the
  second declaration. The distance between cause and symptom is the expense.
  A duplicated `type` is `TS2300` on the spot, which is **the practical argument
  for `type` as the application-code default** — not elegance, but that a
  collision is reported where it happened.
- 🔴 **`TS2717`'s word "subsequent" is the tell.** *"Subsequent property
  declarations must have the same type. Property '{0}' must be of type '{1}', but
  here has type '{2}'."* Seeing it for a name you believed was declared once
  means **a second declaration exists** — search the name, do **not** change the
  type it names, which is the instinctive and wrong response.
- **`TS2428`** *"All declarations of '{0}' must have identical type parameters."*
  — names, order, constraints and defaults, not just the count.
- 🔴 **The cross-package hazard, derived from two documented facts:** interfaces
  merge within a scope, and a file with no top-level import/export is a **script**
  whose declarations are global. So two `.d.ts` files — yours and a dependency's —
  each declaring `interface Options` merge **across the package boundary**,
  silently. That is the mechanism behind *"installing a package broke types in an
  unrelated file"*, and it is hard to diagnose because the error surfaces in a
  third file. **Defence: `export {};` in every `.d.ts` that is not deliberately
  contributing globals.**
- **When merging is right — all three share "you do not own both declarations":**
  augmenting a library, a genuine plugin boundary, publishing an extension point.
  Inside one codebase, `extends` or an intersection is visible, local and cannot
  fire by accident.

Codes read from the table: `TS2300`, `TS2717`, `TS2428`.

## Topics 02, 03, 04, 07, 08 — the class mechanics

Split into a child at the 300-line memory cap ([[devbible-memory-file-cap]]);
**07 and 08 moved there on the second split, 2026-08-15**:
**[[devbible-typescript-phase4-classes]]** — access modifiers, parameter
properties, `implements` vs `extends`, branded/nominal types, and `readonly` /
definite assignment. Open it when writing or reviewing any of those five.

**This parent now holds the declaration side only** — 01 module augmentation,
05 interface merging, 06 global augmentation.

Its three highest-value claims, so you know whether you need it:

- 🔴 **After erasure a `private` field is an ordinary enumerable own property**,
  so `res.json(user)` serialises a `private passwordHash` with the compiler
  satisfied end to end. Only `#` expresses "must not leave the process".
- 🔴 **Parameter properties are the one class feature in common use that EMITS
  code** — an inserted `this.x = x`, which is a transform, not a deletion. Hence
  Node's strip-only refusal and `erasableSyntaxOnly` / `TS1294`.
- 🔴 **`implements` *"doesn't change the type of the class or its methods at
  all"*** (handbook's emphasis) — no contextual typing, no optional members
  created.

## Topic 06 — Global augmentation (Understand, written 2026-08-15)

Single file, 263 lines. Scoped deliberately narrow — 01 and 05 already carry
`declare global`, the Express case, `TS2669`/`TS2670` and the cross-package
hazard, so this page **links rather than restates**.

- 🔴 **THE claim, quoted verbatim from the TS 3.4 release notes:** *"global
  variables declared with `let` and `const` don't show up on `globalThis`"*, with
  the error *"Property 'answer' does not exist on 'typeof globalThis'."* So
  **`declare global { var x: T }` is the only correct spelling** for a global
  variable. It is JavaScript's rule, not TypeScript's — `var`/`function` at the
  top level of a script become global-object properties; `let`/`const` create
  bindings in a separate declarative environment.
- ⚠️ **`no-var` is wrong in exactly that position.** Worth an eslint-disable with
  a comment, or the next person "fixes" it and silently breaks
  `globalThis.__APP_VERSION__`.
- **`interface Window` vs `declare global { var }` is a real fork:** `Window`
  only exists where the DOM lib is loaded, so it is a **compile error in a Node
  build of shared code**. The `var` form is environment-independent and gives you
  both the bare name and `globalThis.x`. Prefer it unless genuinely
  browser-specific.
- **Downlevel caveat, quoted:** TypeScript *"doesn't transform references to
  `globalThis`"* on older targets — it is a **runtime identifier, not syntax**, so
  there is nothing to rewrite and type-checking does not create it. Polyfill.
- **When a global is the wrong answer** — config (unmockable, untraceable),
  caches/singletons (test pollution), and anything whose absence should be an
  error. The legitimate cases all share one property: **something outside your
  module graph really puts the value there** (platform globals, bundler defines,
  extension hooks, test harnesses).

## Topic 09 — Typing getters and setters (Know, written 2026-08-15)

Single file, 186 lines. Know tier — scoped to recognition, not derivation.

- **Divergent read/write types since TS 4.3.** The handbook's `Thing` class
  (setter takes `string | number | boolean`, coerces, getter always returns
  `number`, backed by `#size`) quoted verbatim, plus the interface form
  `get size(): number; set size(value: number | string | boolean);`.
  **Write wide, read narrow** — the coercion lives in the setter so nothing
  downstream handles the union.
- 🔴 **The rule, given as a TEST rather than a statement:** the getter's type must
  be assignable to the setter's. Release notes' justification quoted — *"so that
  a property is always assignable to itself"* — and turned into the usable form:
  **if `x.p = x.p` would not compile, the pair is illegal.**
- 📌 **`#size` as the backing field is load-bearing** — `private` is soft, so
  `obj["_size"]` bypasses the setter's validation entirely. Divergent accessors
  are only as good as the field they guard.
- **Two cautions the feature invites:** an accessor pair that only reads and
  writes a field **is** a field (and converting a public field to an accessor
  later touches no call site — that is the point of property syntax); and **a
  getter doing real work is a lie about cost**, because property syntax makes it
  look free. Make it a method.

## Still to bank

Topics **10–14**. Next is **10 · `this` types and polymorphic `this`** (Know) —
fluent builders that keep the subclass type through a chain, plus `this`
parameters and `noImplicitThis`.

Related: [[devbible-typescript-build-progress]] · [[devbible-typescript-phase3]] ·
[[devbible-typescript-syllabus]]
