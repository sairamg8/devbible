---
title: "What strict actually is"
sidebar_label: "01 · What it actually is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 by **enumerating the compiler's own option table** — every
> option carrying `strictFlag: true` was extracted from the **TypeScript 5.9.3**
> build's option records, and each description below is the **verbatim
> `description` string** from that table, not a paraphrase. The count and the
> presence of `strictBuiltinIteratorReturn` were cross-checked against the
> **TypeScript 7.0.2** native binary. `strict`'s default of `true` is
> [phase 0's sandbox-proven measurement](../../phase-0-how-typescript-runs/05-strict.md),
> cited rather than re-derived. **No sandbox, no console block.**

## `strict` is a meta-flag over nine options

Not a check of its own. Setting `strict: true` sets nine other options, each of
which can be overridden individually afterwards.

Here they are, with the compiler's own one-line description of each:

| Flag | Description, verbatim from the option table |
|---|---|
| `noImplicitAny` | Enable error reporting for expressions and declarations with an implied 'any' type. |
| `strictNullChecks` | When type checking, take into account 'null' and 'undefined'. |
| `strictFunctionTypes` | When assigning functions, check to ensure parameters and the return values are subtype-compatible. |
| `strictBindCallApply` | Check that the arguments for 'bind', 'call', and 'apply' methods match the original function. |
| `strictPropertyInitialization` | Check for class properties that are declared but not set in the constructor. |
| `strictBuiltinIteratorReturn` | Built-in iterators are instantiated with a 'TReturn' type of 'undefined' instead of 'any'. |
| `noImplicitThis` | Enable error reporting when 'this' is given the type 'any'. |
| `useUnknownInCatchVariables` | Default catch clause variables as 'unknown' instead of 'any'. |
| `alwaysStrict` | Ensure 'use strict' is always emitted. |

⚠️ **Nine, not seven.** The list is worth deriving rather than remembering,
because it has grown — `useUnknownInCatchVariables` arrived in 4.4 and
`strictBuiltinIteratorReturn` in 5.6, and most writing about `strict` predates
one or both. The derivation is mechanical: every option record in the compiler
carrying `strictFlag: true` is a member, and nothing else is.

📌 **Correction worth carrying:** this corpus's own
[phase 0 · `strict`](../../phase-0-how-typescript-runs/05-strict.md) page opens
with *"a switch over seven"*. Against the 5.9.3 and 7.0.2 option tables the
count is **nine**. That page's *measurement* — that `strict` now defaults to
`true` — stands and is cited throughout; only its count is stale.

## The default is `true`, and that changes how you read a config

Phase 0 measured it out of `tsc --help --all`: `strict` defaults to `true` in
TypeScript 7. So the interesting line in a `tsconfig.json` is no longer
`"strict": true` — it is:

```json
{ "compilerOptions": { "strict": false } }
```

or, more insidiously, a single member switched back off:

```json
{ "compilerOptions": { "strictNullChecks": false } }
```

🔴 **That second form is the one to grep for in any codebase you inherit.** It
looks like a small local exception. It is not: it changes what every type in the
program *means* — see [chunk 02](./02-strictnullchecks.md).

The override direction works both ways, and the specificity rule is simple:
**an explicit flag beats `strict`, regardless of order.**

```json
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false   // everything strict except this one
  }
}
```

That particular combination is common and defensible — it is the usual escape
hatch for classes populated by an ORM or a DI container, where the constructor
genuinely does not assign the fields.

## Three of the nine are not about types at all

Grouping them makes the list much easier to hold:

**`alwaysStrict`** is an *emit* flag — it puts `"use strict"` in the output and
parses your source in strict mode. It has nothing to do with the type system.
📌 Under `module: nodenext` with ESM-detected files this is close to a no-op,
because ES modules are always in strict mode already
([phase 7 · the module format](../../phase-7-server/01-tsconfig-for-a-node-service/02-the-module-format.md)).

**`noImplicitThis`** is about a single keyword — it reports when `this` would
silently be `any`, typically in a standalone `function` used as a callback. The
fix is usually a `this` parameter:

```ts
function handler(this: HTMLButtonElement, ev: Event) { … }
```

**`strictBuiltinIteratorReturn`** is the narrowest and newest: built-in iterators
get `TReturn` of `undefined` rather than `any`. You will meet it only if you
write generic code over iterators — and it is a good example of the *shape* of
these flags. Each one closes a specific hole where `any` used to leak in.

The remaining six are the ones with day-to-day consequences, and
[chunk 03](./03-the-other-eight.md) takes them one at a time — after
[chunk 02](./02-strictnullchecks.md) deals with the one that outweighs all the
others combined.

## Why "just turn it all on" is the right default *and* not always possible

For a new codebase: turn it on, leave it on, and never look at this page again.
The cost is zero because there is no existing code to fix.

For an inherited one, `strict: true` on a large JavaScript-derived codebase can
produce thousands of errors, the overwhelming majority from `strictNullChecks`.
The honest options are:

1. **A stricter config for new code** — a second `tsconfig.json` covering a
   directory, extending the base with `strict: true`, so new work is held to the
   standard while old work is not.
2. **Flag-by-flag adoption** — turn on the eight cheap ones first, leave
   `strictNullChecks` for a dedicated effort. This is why knowing which flag
   costs what is a practical skill and not trivia.
3. **Ratcheting** — a counted error budget that may only go down.

⚠️ What does **not** work is turning everything on and suppressing the fallout
with `!` and `@ts-ignore`. That produces a codebase which *claims* strictness,
fails no build, and has the same bugs — plus a suppression comment on each one
telling future readers it was considered and dismissed. Topics 08 and 12 are
about exactly this failure.

## Gotchas

**Symptom:** `strict: true` is in the config and implicit `any` still is not
reported.
**Cause:** an explicit `"noImplicitAny": false` elsewhere in the same
`compilerOptions`, or in a config this one `extends`. An explicit flag beats
`strict`.
**Fix:** grep the whole `extends` chain for the individual flag names, not just
for `strict`.

**Symptom:** a codebase "is strict" and is full of `!`.
**Cause:** the flags were enabled without the work; every error was silenced at
the site rather than fixed.
**Fix:** treat `!` as an unresolved review comment (topic 12). The count of `!`
is a better strictness metric than the config.

**Symptom:** you cannot find `strictBuiltinIteratorReturn` in any tutorial.
**Cause:** it is from 5.6. Most writing about `strict` lists seven flags, and
some lists six.
**Fix:** derive the list from the compiler rather than from an article — every
option with `strictFlag: true`, and nothing else.

**Symptom:** `strict` was never written in the config and the build is strict
anyway.
**Cause:** it defaults to `true` in TypeScript 7.
**Fix:** none needed — but write it explicitly anyway, because a config outlives
the compiler version it was authored against.

## Interview questions

**What does `strict: true` actually do?**
Nothing by itself — it is a meta-flag that enables nine other options:
`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
`strictPropertyInitialization`, `strictBuiltinIteratorReturn`, `noImplicitThis`,
`useUnknownInCatchVariables` and `alwaysStrict`. Each can be overridden
individually, and an explicit flag wins over `strict` regardless of order.

**Which of the nine are not really type-checking flags?**
`alwaysStrict` is an emit flag — it emits `"use strict"` and parses in strict
mode — and it is close to a no-op for ES modules, which are strict already.
`noImplicitThis` governs one keyword. `strictBuiltinIteratorReturn` only affects
generic code over built-in iterators.

**A codebase has `strict: true` and thousands of `!` operators. Is it strict?**
No, in the sense that matters. The flags were turned on and the resulting errors
suppressed one by one, so the unchecked accesses are still there with the
warnings removed. It is arguably worse than not enabling them, because the
config now asserts a guarantee the code does not have.

**How would you adopt `strict` on a large legacy codebase?**
Not all at once. Enable the eight cheaper flags first and leave
`strictNullChecks` — which is responsible for most of the errors and is the only
one that changes what existing types *mean* — for a dedicated effort. Alongside
that, a stricter config scoped to new directories so new code is held to the
standard immediately.

---

← [Topic index](./README.md) · Next → [02 · `strictNullChecks`](./02-strictnullchecks.md)
