---
title: "The boundary and the generator"
sidebar_label: "09 · The boundary and the generator"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** for `satisfies` (developed in full
> in [phase 2 · topic 10](../../phase-2-narrowing/10-satisfies/README.md)) and for type
> guards and assertion functions (phase 2, topics 07 and 09). **No sandbox, no console
> block** — no run covers this phase, and no specific validation library is endorsed or
> benchmarked here. The comparison table is **judgement**.

Three replacements that are not types at all, plus the one that is a type but comes from
somewhere else. These are the answers when the shape's source of truth lives **outside your
type declarations** — which is where most unreadable type-level code comes from.

## 1 · `satisfies` instead of a derived type

A frequent motivation for a computed type is *"check this object against a shape without
losing its literal types"*. That is precisely what `satisfies` is for:

```ts
const routes = {
  home: "/",
  user: "/users/:id",
} satisfies Record<string, `/${string}`>;

// routes.user is "/users/:id" — the literal survives, and the shape was checked
```

No mapped type, no conditional, and the failure lands on the offending property rather than
on the whole object. An annotation would have *replaced* the inferred type and thrown the
literals away; `satisfies` checks and leaves inference alone
([phase 2 · topic 10](../../phase-2-narrowing/10-satisfies/README.md)).

📌 **Reach for it before writing a "validator type".** A large share of the mapped types
people write over configuration objects exist only to do what one `satisfies` clause does.

## 2 · Derive from a validator, not from a hope

[Chunk 05](./05-is-a-type-the-tool.md)'s test 5 says validate data crossing a boundary. The
productive form keeps **one** source of truth:

```ts
const ConfigSchema = /* schema declared with your validation library */;
type Config = InferSchema<typeof ConfigSchema>;   // the library's inference helper

const cfg: Config = parseConfig(raw);   // throws on bad input
```

The type-level work is now the library's, tested by its authors — and the part that matters:
**the type and the runtime check cannot disagree**, because one is derived from the other.

🔴 **This is the healthiest relationship most codebases can have with this phase.** You are
*consuming* heavy type-level programming rather than writing it, and the machinery you rely
on is maintained by people whose job it is.

⚠️ **The direction matters.** Derive the type from the schema, never the schema from the
type — a schema hand-written to match a type is two sources of truth with a promise between
them, which is the situation you were trying to leave.

## 3 · Generate the declarations

When the shape's source of truth lives outside TypeScript — an OpenAPI document, a SQL
schema, a `.graphql` file, a protobuf definition — the answer is a generator:

| | Type-level parser | Generated declarations |
|---|---|---|
| Error messages | expansions of a parse | ordinary named types |
| Checker cost | paid on every build, forever | zero — they are plain types |
| Debuggability | no debugger exists | open the generated file and read it |
| Tracks the contract | only if you re-derive it | regenerate, in CI |
| Who maintains it | you | the generator's authors |
| Reviewability | one person understands it | anyone can read the output |

🔴 **There is no column where the type-level parser wins.** It is the most impressive thing
in this phase and almost always the wrong engineering decision for an external contract.

📌 **The exception worth naming precisely:** a library that must accept **a string literal
the caller wrote** — a route pattern, a format string, an SQL fragment — has no schema to
generate from, because the contract *is* the caller's argument. That is the legitimate home
of type-level parsing, and it is [chunk 11](./11-the-cases-that-earn-it.md)'s territory.

## 4 · `unknown`, and a check

The last resort, and it is respectable:

```ts
function handle(input: unknown) {
  if (!isCommand(input)) throw new Error("bad command");
  // narrowed from here — a type guard, not a computation
}
```

Returning `unknown` from a boundary and narrowing with a guard
([phase 2 · type guards](../../phase-2-narrowing/07-type-guards.md)) or an assertion
function ([topic 09 there](../../phase-2-narrowing/09-assertion-functions/README.md)) is
honest, readable, and produces errors about *your* code rather than about a derivation.

Compare `any` / `unknown` / `never` in
[phase 1 · topic 06](../../phase-1-type-vocabulary/06-any-unknown-never-void.md) before
choosing — the difference between `any` and `unknown` here is the difference between
skipping the check and requiring it.

## The shape of the whole answer

Judgement, and it is worth holding as one sentence: **compute types over things the compiler
already knows, and check things it does not.**

| Where the shape comes from | Tool |
|---|---|
| Another type in your codebase | derive it — narrowly, and name it ([chunk 06](./06-what-to-write-instead.md)) |
| An object literal you wrote | `satisfies` |
| A schema you declared for runtime | the validator's inference helper |
| A contract owned outside your code | a generator |
| The network, the disk, the environment | `unknown` plus a guard |
| A string literal the caller wrote | type-level parsing — the one case it wins ([chunk 11](./11-the-cases-that-earn-it.md)) |

Every row except the last two is a place where people write conditional types and should
not, and the last row is the only one where the machinery of this phase is the *only*
answer.

## Gotchas

**Symptom:** An object literal loses its literal types when annotated to check its shape.
**Cause:** An annotation replaces inference.
**Fix:** `satisfies` — it checks and leaves inference alone, and reports on the offending
property.

**Symptom:** A mapped type exists purely to validate a config object's keys.
**Cause:** A `satisfies` clause written the long way.
**Fix:** `satisfies Record<…, …>` at the literal, and delete the type.

**Symptom:** The runtime validator and the TypeScript type disagree after a change.
**Cause:** Two sources of truth.
**Fix:** Derive the type from the schema with the library's inference helper.

**Symptom:** The schema was hand-written to match an existing interface, and they have
drifted.
**Cause:** Derivation pointing the wrong way.
**Fix:** Make the schema the source and infer the type from it, or generate both from
something upstream.

**Symptom:** A hand-written type-level parser for an API contract keeps breaking.
**Cause:** A parser re-implemented in the slowest available language, for a contract that
already has a machine-readable definition.
**Fix:** Generate the declarations, and regenerate them in CI so staleness is a build
failure.

**Symptom:** Generated types are enormous and slow the editor down.
**Cause:** The generator emitted everything, including shapes nobody imports.
**Fix:** Narrow the generation scope or re-export a small hand-written façade. Generated
plain types are still cheaper than a type-level parser producing the same shapes.

**Symptom:** `unknown` at the boundary was rejected in review as "giving up".
**Cause:** It looks like less type safety and is usually more.
**Fix:** Point at what the alternative asserts — a derived type over unvalidated input is a
claim nobody checked. `unknown` plus a guard is the same information, verified.

**Symptom:** A type guard was written as a predicate and lies.
**Cause:** `x is T` is an assertion the compiler trusts; a sloppy body makes it a cast with
better manners.
**Fix:** Phase 2's topic 07 covers writing one honestly. A lying guard is worse than `any`,
because it is believed.

**Symptom:** The validated type is right and the code still uses `as` afterwards.
**Cause:** Narrowing was lost between the check and the use — a reassignment, a callback, a
property access.
**Fix:** [Phase 2 · narrowing lost](../../phase-2-narrowing/11-narrowing-lost/README.md), not a
type-level problem.

## Interview questions

**★ When is `satisfies` the answer instead of a computed type?**
When you want a shape checked without losing literal inference. An annotation replaces the
inferred type; `satisfies` checks against the constraint and leaves inference alone, so a
`routes` object keeps `"/users/:id"` as a literal while still being verified against
``Record<string, `/${string}`>`` — and the error lands on the offending property rather than
on the whole object. A large share of hand-written mapped types over config objects are this
clause, written the long way.

**★ How do you keep a runtime validator and a type from drifting?**
Derive one from the other, in the right direction: declare the schema once and use the
library's inference helper for the type. Then the compile-time shape and the runtime check
cannot disagree, because there is one definition. A schema hand-written to match an existing
interface is still two sources of truth with a promise between them.

**★ Someone proposes a type-level parser for your OpenAPI contract. Make the case against.**
There is no dimension on which it wins. Generated declarations give ordinary named types in
errors, zero checker cost, a file you can open and read, automatic tracking when the contract
changes, and maintenance by the generator's authors. The type-level version gives expansions
instead of names, a permanent build tax, no debugger, silent staleness, and sole ownership by
whoever wrote it. The legitimate home for type-level parsing is a caller-written string
literal — a route pattern or format string — where no schema exists to generate from.

**★ Is returning `unknown` from a boundary an admission of defeat?**
No — it is the accurate type for data nobody has checked. The alternative, a derived type
over unvalidated input, asserts a shape no code verified, and the elaborate version makes the
assertion precise rather than obvious. `unknown` plus a type guard or an assertion function
carries the same information, verified, and its errors are about your code rather than about a
derivation.

**Summarise the whole decision in one sentence.**
Compute types over things the compiler already knows, and check things it does not. Derive
narrowly from another type in your codebase; `satisfies` for a literal you wrote; the
validator's inference helper for a schema you declared; a generator for a contract owned
outside your code; `unknown` plus a guard for the network, the disk and the environment. Only a
caller-written string literal leaves type-level parsing as the sole option.

**What is the risk in a type guard, as opposed to a validator?**
That it lies. `x is T` is an assertion the compiler simply trusts, so a sloppy body makes it a
cast with better manners — and worse than `any`, because it is believed rather than suspected.
An assertion function has the same property. Both are fine when the body genuinely checks
every field the type claims, which is exactly what a schema validator does for you.

**Generated types made the editor slow. Does that vindicate the type-level version?**
No — it identifies a generation-scope problem. Emitting every shape in a contract including
ones nobody imports is wasteful, and the fix is to narrow the scope or re-export a small
hand-written façade. Plain generated declarations are still cheaper to check than a type-level
program computing the same shapes, and they remain readable in error messages.

---

← Prev: [08 · Tables, interfaces and base types](./08-structure-and-tooling.md) ·
[Topic index](./README.md) · Next → [10 · Keeping the ones you keep](./10-keeping-the-ones-you-keep.md)
