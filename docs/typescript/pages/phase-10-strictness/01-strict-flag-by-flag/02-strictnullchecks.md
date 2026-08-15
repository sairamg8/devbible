---
title: "strictNullChecks"
sidebar_label: "02 · strictNullChecks"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** on typescriptlang.org
> and the **compiler's own diagnostic table** — `TS18047`, `TS18048`, `TS18049`,
> `TS2531`, `TS2532`, `TS2533` and `TS2322` and their exact `{0}` message text
> were read out of the **TypeScript 5.9.3** numbered table rather than recalled.
> The flag's own description, *"When type checking, take into account 'null' and
> 'undefined'"*, is the verbatim string from the option table
> ([chunk 01](./01-what-strict-actually-is.md)). **No sandbox, no console
> block.**

Of the nine flags, this is the one that matters. The other eight find bugs.
**This one changes what the language means.**

> **Without `strictNullChecks`, `null` and `undefined` are members of every
> type.** `string` includes `null`. `User` includes `undefined`. Every annotation
> in the codebase is quietly weaker than it reads.
>
> **With it, `string` means a string.**

That is not a stylistic difference. The same source file is a different program
under the two settings, and a `.d.ts` written under one is misleading under the
other.

## What actually changes

```ts
function greet(name: string) {
  return name.toUpperCase();
}

greet(null);        // off: fine.  on: error
```

Off, `null` is assignable to `string`, so this compiles and throws at runtime.
On:

```text
error TS2345: Argument of type 'null' is not assignable to parameter of type 'string'.
```

The flag does three things, and they compound:

**1. `null` and `undefined` get their own types.** They stop being universal
members and become values you must admit to:

```ts
let a: string;              // string
let b: string | null;       // you asked for it
```

**2. Optionality becomes visible.** `user?: User` is `User | undefined`, and the
compiler makes you handle the second half. Every lookup that can miss —
`array.find`, `map.get`, `document.querySelector`, `JSON.parse` of anything —
starts telling the truth.

**3. Narrowing starts to mean something.** This is the part people miss: without
`strictNullChecks`, every page in
[phase 2](../../phase-2-narrowing/README.md) is theatre. Narrowing a
`string | null` to `string` is only valuable if `string` excluded `null` to
begin with. **The flag is what gives control-flow analysis something to
subtract.**

## The errors, and what each one tells you

Six codes, and the distinction between the two families is worth knowing because
it tells you *where* to look:

| Code | Message | When |
|---|---|---|
| `TS18047` | `'{0}' is possibly 'null'.` | a **named** value |
| `TS18048` | `'{0}' is possibly 'undefined'.` | a **named** value |
| `TS18049` | `'{0}' is possibly 'null' or 'undefined'.` | a **named** value |
| `TS2531` | Object is possibly 'null'. | an **expression** with no name to report |
| `TS2532` | Object is possibly 'undefined'. | an **expression** with no name to report |
| `TS2533` | Object is possibly 'null' or 'undefined'. | an **expression** with no name to report |

📌 The `18xxx` family names the culprit; the `253x` family cannot, because the
receiver was an expression rather than an identifier. **Getting `TS2532` instead
of `TS18048` is a hint to extract the expression into a variable** — which both
improves the error and usually makes the fix obvious.

## The three fixes, in order of preference

**Narrow it.** The point of the flag:

```ts
const user = users.find(u => u.id === id);
if (!user) return notFound();
user.email;                     // User — earned
```

**Default it.** When absence has a sensible meaning:

```ts
const port = process.env.PORT ?? '3000';
```

⚠️ `??` and `||` differ on `''` and `0` — [phase 7 · `process.env`](../../phase-7-server/03-typing-process-env/01-what-process-env-actually-is.md)
has the case where that distinction is a real bug.

**Assert it — and treat that as a failure.** `!` removes the error without
removing the possibility:

```ts
user!.email;                    // compiles. still throws if user is undefined
```

🔴 **`!` is the single most abused operator in TypeScript**, because it is the
one-character way to make `strictNullChecks` stop talking. Every one is a claim
that the compiler's analysis is wrong and yours is right — sometimes true, and
worth a comment saying why. Topic 12 treats each as an unresolved review comment;
[phase 2 · the non-null assertion](../../phase-2-narrowing/13-non-null-assertion.md)
covers the mechanics.

The tell that a migration went wrong is a `!` count that rose in step with the
flag being enabled.

## Definite assignment is a different `!`

Confusingly, the same character in a declaration position means something else:

```ts
class Service {
  private client!: Client;      // "I promise this is assigned before use"
  init() { this.client = new Client(); }
}
```

This is the escape hatch for `strictPropertyInitialization`
([chunk 03](./03-the-other-eight.md)), not for `strictNullChecks`, and it carries
the same warning: it is a promise, not a check.

## 🔴 The dependency problem

A `.d.ts` compiled without `strictNullChecks` does not mark anything nullable —
because under that setting *nothing needs marking*. Consume it from a strict
project and you get a declaration that claims `getUser(): User` for a function
that genuinely returns `undefined` when the user is missing.

**Your strictness does not reach into someone else's declarations.** The
compiler believes the `.d.ts`, and there is no flag that fixes it.

Two mitigations, both partial:

- Prefer packages that ship strict types. `arethetypeswrong` (phase 12) surfaces
  some of this.
- At the boundary, treat a third-party return as unverified and narrow it
  anyway — the same discipline as
  [phase 7 · `catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md),
  applied to a return value.

📌 This is also the strongest argument for enabling the flag *early*: every year
you wait, more of your own `.d.ts` output ships the same defect to your
consumers.

## Adopting it on a codebase that has not

Expect this one flag to produce **most** of the errors from turning `strict` on,
and expect them to be concentrated in exactly the places that matter — lookups,
optional config, API responses.

What works:

1. **File by file**, not repo-wide. A `// @ts-check`-style ratchet per directory,
   or a second config covering a growing list of paths.
2. **Fix by narrowing, and count the `!`.** A migration that adds a thousand
   non-null assertions has converted a compiler warning into a silent runtime
   risk and called it progress.
3. **Start at the leaves.** A shared module's signature change ripples; a leaf's
   does not.

⚠️ Do **not** enable it and set `noImplicitAny: false` to reduce noise. They
find different bugs, and the combination produces the worst of both: nullable
analysis over values whose types nobody stated.

## Gotchas

**Symptom:** narrowing "does nothing" — the type is the same before and after
the check.
**Cause:** `strictNullChecks` is off, so `null` was never excluded from the type
to begin with and there is nothing to subtract.
**Fix:** the flag. Every narrowing page in phase 2 assumes it.

**Symptom:** `TS2532: Object is possibly 'undefined'` with no clue which object.
**Cause:** the receiver is an expression, not a named identifier, so the compiler
has no name to report.
**Fix:** extract it into a `const`. The error becomes `TS18048` and names it.

**Symptom:** a library function documented as returning `T | undefined` is typed
`T`.
**Cause:** its `.d.ts` was produced without `strictNullChecks`, so nothing is
marked nullable.
**Fix:** narrow it yourself at the boundary. No flag of yours can correct someone
else's declarations.

**Symptom:** the `!` count doubled during the strictness migration.
**Cause:** errors were silenced rather than fixed.
**Fix:** treat the count as the migration's real progress metric — flags enabled
is an input, `!` avoided is the output.

**Symptom:** a class field is `Client` but is `undefined` at runtime.
**Cause:** a definite-assignment `!` in the declaration, promising an assignment
that a code path skipped.
**Fix:** initialise in the constructor, or type it `Client | undefined` and
narrow.

## Interview questions

**Why is `strictNullChecks` different in kind from the other strict flags?**
Because it changes what every existing type *means* rather than adding a check.
Without it `null` and `undefined` are members of every type, so `string`
includes `null`. The same file is a different program under the two settings —
which is also why a `.d.ts` produced without it is misleading to a strict
consumer.

**What is the relationship between `strictNullChecks` and narrowing?**
Narrowing subtracts possibilities from a union. Without the flag, `null` is not
in the type to be subtracted, so control-flow analysis has nothing to do —
every narrowing result is the same type it started as. The flag is what makes
phase 2 meaningful.

**You get `TS2532: Object is possibly 'undefined'` and cannot tell what is
undefined. What now?**
Extract the receiver into a named `const`. The `253x` family fires when the
receiver is an unnamed expression; with a name, the compiler reports `TS18048`
and tells you which value it means.

**A dependency's types say `getUser(): User` but it returns `undefined` for a
missing user. Which flag fixes that?**
None. The declaration was compiled without `strictNullChecks`, so nothing in it
is marked nullable, and your own settings do not reach into it. You narrow the
return at the boundary and treat third-party declarations as claims rather than
guarantees.

---

← [01 · What `strict` actually is](./01-what-strict-actually-is.md) · Next → [03 · The other eight](./03-the-other-eight.md)
