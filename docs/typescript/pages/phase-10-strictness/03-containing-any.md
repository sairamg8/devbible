---
title: "Containing any"
sidebar_label: "03 · Containing any"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Everyday Types → `any`*,
> *The `unknown` type*) and the **`tsconfig` reference** for `noImplicitAny`,
> `allowJs`/`checkJs` and `suppressImplicitAnyIndexErrors`. `JSON.parse`'s
> return type was read from **`lib.es5.d.ts`** as shipped with the compiler, and
> `TS7006`/`TS7016`/`TS7053` from the **compiler's own diagnostic table**.
> **No sandbox, no console block.**

`any` is not a type. It is an instruction to stop checking.

> **Every other type in TypeScript adds information. `any` removes it** — and it
> removes it not just where it is written, but everywhere the value subsequently
> travels. That asymmetry is why a single `any` in the wrong place is worth more
> attention than a hundred `unknown`s.

The practical problem is that nobody writes `any` on purpose very often. It
arrives, through four doors.

## Door 1 — untyped dependencies

```ts
import legacy from 'some-old-package';   // no types, no @types/*
legacy.doThing().whatever.anything;      // all any
```

```text
error TS7016: Could not find a declaration file for module '{0}'. '{1}' implicitly has an 'any' type.
```

`noImplicitAny` turns this into an error rather than a silent hole
([topic 01 chunk 03](./01-strict-flag-by-flag/03-the-other-eight.md)) — which is
the single strongest argument for that flag, because this door is the one you
do not control.

The three answers, in order:

1. **`@types/*` if it exists.** Check DefinitelyTyped first.
2. **A local `.d.ts` shim** declaring only what you use:
   ```ts
   // types/some-old-package.d.ts
   declare module 'some-old-package' {
     export function doThing(input: string): { id: string };
   }
   ```
   ⚠️ This is a **claim**, exactly like the `ProcessEnv` augmentation in
   [phase 7](../phase-7-server/03-typing-process-env/02-augmenting-processenv.md).
   Declare narrowly — the less you assert, the less you can be wrong about.
3. **Wrap it in one module** whose exports are honest, so the untyped surface
   touches exactly one file.

## Door 2 — `as`, and especially `as any`

```ts
const user = response as User;      // no check, ever
(obj as any).secret = 1;            // the nuclear option
```

An assertion is you telling the compiler you know better. Sometimes true. The
problem is that it is **unverifiable and permanent** — nothing re-checks it when
the shape changes.

🔴 **`as any` is categorically worse than other assertions**, because it does not
just assert a specific wrong type — it disables checking on that expression and
everything downstream of it. `as unknown as T` is the double-assertion form and
is at least *loud*; a lone `as any` is quiet.

The discipline — treat every `as` as a review comment that must justify itself —
is [topic 12](./README.md). The type-level answer is usually a
[type guard](../phase-2-narrowing/07-type-guards.md), which is an assertion the
compiler can actually verify at the point of use.

## Door 3 — `JSON.parse` and the untyped boundary

From `lib.es5.d.ts`:

```ts
parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;
```

**`JSON.parse` returns `any`.** So does `response.json()` in most typings. So
does `.catch()`'s reason
([phase 2](../phase-2-narrowing/12-unknown-in-catch.md)), and Express's
`ErrorRequestHandler`'s `err`
([phase 7](../phase-7-server/05-typed-express-handlers/01-the-five-generics.md)),
and `req.body`.

📌 This is the door that matters most, because it is where **untrusted data**
and **unchecked types** coincide. Everything phase 7 argued reduces to one move
here: **turn the `any` into `unknown` at the door, and parse.**

```ts
const data: unknown = JSON.parse(text);   // annotate it back down
```

That one annotation is free — `any` is assignable to `unknown` — and it converts
"the compiler has stopped helping" into "the compiler will not let me touch this
until I prove something".

## Door 4 — inference holes

The quietest door: places where the compiler cannot infer and falls back.

```ts
function process(items) { … }               // TS7006, if noImplicitAny is on
const cache = {};                           // {} — then indexing it is TS7053
function recurse(n) { return n <= 1 ? 1 : recurse(n - 1); }   // implicit any return
const handlers = [];                        // any[] until first assignment
```

`noImplicitAny` catches most of these. The ones it does not catch are the
`any`s that came from *somewhere else* and were inferred onwards — which is the
next section, and the reason the flag is necessary but not sufficient.

## How it spreads

This is the part that makes `any` different in kind from a wrong type.

```ts
const raw = JSON.parse(body);    // any
const user = raw.user;           // any
const id = user.id;              // any
lookup(id);                      // lookup(id: number) — accepts it silently
```

**`any` is contagious through every expression it participates in.** Property
access, calls, arithmetic, array elements, and — the important one —
**assignment into a typed slot**, which is the moment it stops being visible.
`lookup(id)` accepts `any` without complaint, and from there the wrongness is
inside code that looks fully typed.

⚠️ **Contrast with `unknown`, which is inert.** It spreads nowhere: every use
requires narrowing first. That is the entire design difference, and it is why
"use `unknown` at the door" is the whole containment strategy in five words.

📌 A useful mental model: `any` is not a hole in the type system, it is a
**leak**. The damage is not at the site; it is wherever the fluid reaches.

## Finding the `any` you already have

Compiler flags cannot see most of it, because inherited `any` is not *implicit*
`any` — it is perfectly explicit, just wrong. Three tools that can:

- **`typescript-eslint`'s `no-unsafe-*` family** —
  `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`,
  `no-unsafe-return`, `no-unsafe-argument`. These are *type-aware* rules, so
  they catch exactly the spread above, at each step. They also cost real CI time
  — topic 11.
- **`type-coverage`** — one number, the percentage of expressions with a type
  that is not `any`. Useful as a **ratchet**: it may only go up.
- **Grep.** `as any` and `: any` are honest signals and take a second to count.

🔴 **Ban `suppressImplicitAnyIndexErrors`** if you meet it. It exists to silence
`TS7053` wholesale, which is the opposite of containment. The right fix is a real
index signature or a union-keyed `Record`
([topic 02](./02-nouncheckedindexedaccess.md)).

📌 **Stronger than "deprecated", corrected 2026-08:** the option **stopped
functioning in TypeScript 5.5** (`TS5102`, which `ignoreDeprecations` cannot
silence) and is **absent from the 7.0.2 compiler entirely** (`TS5023`). So on a
current compiler you cannot set it — but ⚠️ **a project upgrading past 5.5 gets
every `TS7053` it was hiding, all at once**, and those are pre-existing `any`s
rather than new ones. Exact behaviour by version:
[topic 10 · chunk 13](./10-the-error-codes/13-the-suppress-codes-are-gone.md).

## The containment strategy

Four rules, in the order they pay off:

1. **`unknown` at every door.** `JSON.parse`, `response.json()`, `catch`,
   `req.body`, any untyped dependency's return. One annotation each.
2. **`noImplicitAny` on**, so new holes cannot open silently.
3. **`any` allowed to exist in exactly one place per boundary** — a shim module,
   a parser — with everything downstream typed.
4. **A ratchet, not a ban.** A hard `no-explicit-any` rule on day one produces
   creative `as unknown as T` casts that are harder to find. Measure, then
   reduce.

The goal is not zero `any`. It is **zero `any` that has escaped the file it
entered through**.

## Gotchas

**Symptom:** a value is `any` and no flag reports it.
**Cause:** it is inherited, not implicit — the `any` was introduced upstream and
propagated. `noImplicitAny` only reports declarations it cannot infer.
**Fix:** the `no-unsafe-*` lint family, which is type-aware and catches
propagation rather than declaration.

**Symptom:** a runtime `TypeError` on a line the compiler checked.
**Cause:** an `any` was assigned into a typed slot somewhere upstream, so the
type at the failure site is a fiction inherited from a boundary nobody parsed.
**Fix:** trace back to the door — it is almost always `JSON.parse`, an
assertion, or an untyped dependency.

**Symptom:** adding a `.d.ts` shim fixed the errors and the bugs remain.
**Cause:** a shim is an assertion. It stopped the complaints without checking
anything.
**Fix:** declare narrowly, and validate the shimmed library's *output* at the
boundary like any other untrusted data.

**Symptom:** `type-coverage` is 98% and the codebase still breaks constantly.
**Cause:** the remaining 2% is at the boundaries, where all the untrusted data
is. Coverage is a count, not a risk weighting.
**Fix:** treat the number as a ratchet, not a score, and look at *where* the
uncovered expressions are.

**Symptom:** banning `any` produced a wave of `as unknown as T`.
**Cause:** a ban without a migration path. The assertion moved rather than
disappearing, into a form that greps do not find.
**Fix:** ratchet instead, and treat the double assertion as at least as serious
as `as any` in review.

## Interview questions

**Why is `any` worse than a wrong type?**
Because a wrong type is checked against — the compiler will eventually contradict
you. `any` disables checking, and it does so not only where it is written but
everywhere the value flows: property access, calls, and especially assignment
into a typed slot, at which point it becomes invisible. It is a leak, not a hole.

**Name the four ways `any` enters a codebase.**
Untyped dependencies (`TS7016`), assertions — especially `as any`, `JSON.parse`
and the other untyped boundaries (`response.json()`, `.catch()`, `req.body`),
and inference holes such as un-annotated parameters and empty-object literals.
Only the last is fully covered by `noImplicitAny`.

**What is the single highest-value habit for containing it?**
Annotating boundary values as `unknown`. `any` is assignable to `unknown`, so it
costs one annotation, and `unknown` is inert — it cannot be used without
narrowing, so it cannot spread. That converts "checking is off" into "prove
something first" at the exact place untrusted data enters.

**`noImplicitAny` is on and the codebase is still full of `any`. Explain.**
The flag reports declarations whose type it cannot infer. It says nothing about
`any` that was introduced deliberately, imported from an untyped package, or
inherited by propagation from an upstream boundary. Catching those needs
type-aware lint rules (`no-unsafe-*`) or a coverage tool.

---

← [Phase 10 index](./README.md) · Next → **04 · Reading a TypeScript error** *(not written yet)*
