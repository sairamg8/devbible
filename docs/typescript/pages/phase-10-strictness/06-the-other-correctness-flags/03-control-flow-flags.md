---
title: "The control-flow flags"
sidebar_label: "03 · Control-flow flags"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own option table** in the **TypeScript
> 5.9.3** build. `noFallthroughCasesInSwitch` — *"Enable error reporting for
> fallthrough cases in switch statements"*, `defaultValueDescription: false`, and
> 🔴 uniquely in this group **`affectsBindDiagnostics: true`**.
> `noImplicitReturns` — *"Enable error reporting for codepaths that do not
> explicitly return in a function"*, `defaultValueDescription: false`. Neither
> carries `strictFlag`. `TS7029` and `TS7030` come from the numbered diagnostic
> table. **No sandbox, no console block.**

Two flags about the shape of your control flow rather than the types flowing
through it. Both catch a **missing** piece of code, which is why neither can be
found by reading types alone.

## `noFallthroughCasesInSwitch`

```ts
switch (status) {
  case 'pending':
    notify();
  case 'active':          // TS7029: Fallthrough case in switch.
    activate();
    break;
}
```

`'pending'` runs `notify()` **and then** `activate()`, because a `case` without
`break` falls into the next one. This is real JavaScript semantics and
occasionally what someone wants; it is almost never what someone wrote by
accident on purpose.

### What counts as a fallthrough

The flag is narrower than it sounds, and the exclusions are what make it usable:

```ts
switch (kind) {
  case 'a':
  case 'b':               // ✅ fine — an EMPTY case group, not a fallthrough
    handleAB();
    break;
  case 'c':
    return handleC();     // ✅ fine — return also terminates
  case 'd':
    throw new Error();    // ✅ fine — so does throw
  case 'e':
    log();                // ❌ TS7029 — a non-empty clause that falls through
  default:
    handleDefault();
}
```

📌 **Stacked empty cases are not fallthrough**, which is the single most useful
thing to know about the flag. The idiomatic "these three values are handled the
same way" spelling is untouched, so the flag produces far fewer errors than
people expect.

Any statement that terminates the clause satisfies it: `break`, `return`,
`throw`, and `continue` inside a loop.

### 🔴 It is a binder diagnostic, not a checker one

Alone among the flags in this topic, `noFallthroughCasesInSwitch` sets
**`affectsBindDiagnostics: true`** in its option record — the others set only
`affectsSemanticDiagnostics`.

That is a structural fact with a practical consequence: the check runs during
**binding**, when the control-flow graph is built, rather than during type
checking. So it is **purely syntactic** — it needs no type information at all,
and it works identically on `.js` files under `checkJs`, on a file full of `any`,
and on code the checker has otherwise given up on.

⚠️ **The reverse is worth stating too:** because it is syntactic, it cannot tell
an *intentional* fallthrough from an accidental one. There is no equivalent of
ESLint's `// falls through` comment escape in the compiler. If you genuinely want
fallthrough, you restructure — usually into stacked empty cases, or by extracting
the shared work into a function both clauses call.

### Where it interacts with exhaustiveness

A `switch` over a discriminated union that returns from every clause never falls
through, so this flag is quiet on well-typed code. Its errors concentrate in
`switch` statements that **mutate and break** rather than **compute and return**
— which is a hint about the shape, not just the flag. Converting such a switch to
one that returns a value usually removes the error and enables exhaustiveness
checking at the same time:
[phase 2 · Exhaustiveness](../../phase-2-narrowing/06-exhaustiveness.md).

## `noImplicitReturns`

```ts
function grade(score: number): string {   // TS7030: Not all code paths return a value.
  if (score > 90) return 'A';
  if (score > 80) return 'B';
  // falls off the end — returns undefined
}
```

A function whose declared return type is `string` but which can reach the end of
its body without returning. At runtime it returns `undefined`, and the caller
receives a `string` that is not one.

### Why `strictNullChecks` does not already catch this

It does — **when the return type is annotated and non-nullable**. `grade` above
errors under `strictNullChecks` too, because the inferred `undefined` path does
not fit `string`.

🔴 **The gap `noImplicitReturns` fills is the function with no annotation.**

```ts
function grade(score: number) {           // inferred: string | undefined
  if (score > 90) return 'A';
  if (score > 80) return 'B';
}
```

With no annotation, TypeScript **infers** `string | undefined` — the falling-off
path is folded into the return type and nothing is wrong. The bug is now in the
*type*, silently, and every caller inherits an `| undefined` nobody intended.
`noImplicitReturns` reports `TS7030` here regardless of annotation.

📌 **That is the whole argument for the flag in one sentence:** without it, a
missing `return` is not an error, it is a wider inferred return type — and a
wider type is exactly the thing that does not look like a bug in review.

### What it does not flag

- **Functions that never return a value.** A body with no `return` at all is
  `void` and is fine — the flag is about *inconsistency*, not about returning.
- **Functions ending in `throw`**, or in an infinite loop, or in a call typed
  `never`. Those paths do not fall off the end.
- **Explicit `return;`.** `if (x) return 'a'; return;` is still flagged, because
  one path returns a value and another does not. The bare `return` does not
  satisfy it — it *is* the inconsistency.

⚠️ **A common wrong fix is to add a bare `return;` to the end**, which silences
nothing and is the same bug written more explicitly. The two honest fixes are to
return a real value on the remaining path, or to widen the type to `string |
undefined` **deliberately** so callers are forced to handle it.

### The `void` and `any` escape

A function annotated `: void` or `: any` is not flagged, because every path
trivially satisfies the return type. So the flag is weakened exactly where
[`any` has spread](../03-containing-any.md) — another instance of the general
rule that one escape disables checks that look unrelated.

## Gotchas

**Symptom:** `TS7029` on `case 'a': case 'b':` with nothing between them.
**Cause:** it should not fire — stacked empty cases are explicitly allowed.
Something is in between, often a stray comment-with-code or a `console.log`.
**Fix:** read the clause again; there is a statement there.

**Symptom:** an intentional fallthrough now errors and there is no way to
annotate it.
**Cause:** the compiler check is syntactic and has no comment escape, unlike
ESLint's.
**Fix:** restructure — stacked empty cases, or extract the shared work into a
function that both clauses call.

**Symptom:** the flag reports nothing on a large codebase full of switches.
**Cause:** they return or throw from every clause, which is the well-shaped form.
**Fix:** none — this is the flag being cheap, which is the argument for enabling
it.

**Symptom:** `TS7030` on a function that obviously always returns.
**Cause:** the compiler cannot prove it. A `for` loop with a `return` inside, or
a `switch` with no `default`, both leave a theoretically-reachable end.
**Fix:** add the `default` clause (which also buys exhaustiveness checking), or
`throw` at the end to state that the path is impossible.

**Symptom:** adding `return;` at the end did not silence `TS7030`.
**Cause:** a bare `return` is the inconsistency, not the cure — one path returns a
value and another does not.
**Fix:** return a real value, or widen the return type deliberately.

**Symptom:** `noImplicitReturns` is on and a function still returns `undefined`
at runtime.
**Cause:** its return type is `void` or `any`, so every path satisfies it.
**Fix:** annotate the real return type. Where `any` is involved, this is a
containment problem — [topic 03](../03-containing-any.md).

**Symptom:** enabling `noImplicitReturns` changed no types, only added errors.
**Cause:** correct — it reports; it does not alter inference.
**Fix:** none. Note the contrast: the fix you apply *will* change the inferred
type, usually narrowing it, which is the actual benefit.

## Interview questions

**What does `noFallthroughCasesInSwitch` consider a fallthrough, and what does it
allow?**
A non-empty `case` clause that reaches the next clause without terminating.
Stacked *empty* cases are explicitly allowed, as is any clause ending in `break`,
`return`, `throw` or `continue`. That exclusion is why the flag produces far
fewer errors than its name suggests.

**What is structurally unusual about that flag?**
It is a **binder** diagnostic — its option record sets `affectsBindDiagnostics`,
unlike every other flag in this group. The check runs while the control-flow
graph is built rather than during type checking, so it is purely syntactic: it
needs no type information and works the same on `.js` under `checkJs` or on code
full of `any`. The cost is that it cannot recognise an intentional fallthrough,
and the compiler offers no comment escape.

**Doesn't `strictNullChecks` already catch a missing return?**
Only when the return type is annotated and excludes `undefined`. With no
annotation, TypeScript *infers* `string | undefined` and nothing is wrong — the
missing return has become a wider return type instead of an error, and every
caller silently inherits the `| undefined`. `noImplicitReturns` reports it either
way.

**Why is a bare `return;` not a fix for `TS7030`?**
Because the error is about inconsistency between code paths, not about the
absence of the keyword. One path returning a value and another returning nothing
is exactly what it reports. The honest fixes are to return a real value or to
widen the return type deliberately so callers must handle the empty case.

**Where are these two flags weakest?**
`noImplicitReturns` is disabled by a `void` or `any` return type, so it degrades
wherever `any` has spread. `noFallthroughCasesInSwitch` cannot distinguish
intentional fallthrough from accidental, so a codebase that uses the pattern
deliberately has to restructure rather than annotate.

**Which of the two would you enable first on a legacy codebase?**
`noFallthroughCasesInSwitch`, without hesitation. It is syntactic, so it needs no
type information to be useful, it produces very few errors because the common
stacked-case idiom is exempt, and every error it does produce is either a real
bug or a restructure worth doing.

---

← [02 · Index-signature access](./02-index-signature-access.md) · Next → [04 · The unused-code flags](./04-unused-code-flags.md)
