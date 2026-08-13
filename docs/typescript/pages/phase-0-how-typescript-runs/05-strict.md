---
title: "`strict`, and the flags it turns on"
sidebar_label: "05 · strict"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**, compared against **5.9.3** installed
> side by side. Console output from `sandbox/ts-p0/ex4-strict.sh`.
> **`strict` now defaults to `true`** — measured, see below.

**`strict` is not one check. It is a switch over seven, and it decides what the
language *means*.** Without `strictNullChecks`, `string` includes `null`; with
it, `string` means a string. The same code is a different program.

## The default changed in TypeScript 7

This caught out the first version of the measurement script, which used "no flag"
as its loose baseline and got identical results on both sides:

```console
$ tsc --help --all | grep -A3 -- '^--strict$'
Enable all strict type-checking options.
type: boolean
default: true
```

```console
$ tsc --noEmit --strict false --target es2022 src-ex4/loose.ts
exit=0

$ tsc --noEmit --target es2022 src-ex4/loose.ts
src-ex4/loose.ts(1,19): error TS7006: Parameter 'id' implicitly has an 'any' type.
src-ex4/loose.ts(6,13): error TS18047: 'user' is possibly 'null'.
src-ex4/loose.ts(9,3): error TS2564: Property 'token' has no initializer and is not definitely assigned in the constructor.
src-ex4/loose.ts(13,44): error TS18046: 'err' is of type 'unknown'.
exit=1
```

The same flag on 5.9.3 reports `default: false`.

| | TypeScript 5.9.3 | TypeScript 7.0.2 |
|---|---|---|
| `strict` | `false` | **`true`** |
| `esModuleInterop` | `false` | **`true`** |
| `moduleResolution` | `Node`/`Classic` (legacy) | **`bundler`**, or `node16`/`nodenext` following `module` |

**Practical consequence:** an old project that never wrote `"strict": true` and
only ever passed because the default was off will light up on upgrade. That is
the upgrade working, not breaking — but plan for it rather than meeting it in CI.
It also means `"strict": false` is now a *deliberate* statement in a config, and
worth a comment explaining why.

## The file under test

```ts
// src-ex4/loose.ts
function findUser(id) {
  return id === 1 ? { name: 'Asha' } : null;
}

const user = findUser(1);
console.log(user.name.toUpperCase());

class Session {
  token: string;
  start() { this.token = 'abc'; }
}

try { start(); } catch (err) { console.log(err.message); }
function start() { throw new Error('nope'); }
```

Four separate bugs, all invisible to the loose compiler. Each strict sub-flag
finds exactly one:

```console
$ tsc --noEmit --strict false --noImplicitAny src-ex4/loose.ts
src-ex4/loose.ts(1,19): error TS7006: Parameter 'id' implicitly has an 'any' type.

$ tsc --noEmit --strict false --strictNullChecks src-ex4/loose.ts
src-ex4/loose.ts(6,13): error TS18047: 'user' is possibly 'null'.

$ tsc --noEmit --strict false --useUnknownInCatchVariables src-ex4/loose.ts
src-ex4/loose.ts(13,48): error TS2339: Property 'message' does not exist on type 'unknown'.
```

And one flag that refuses to work alone:

```console
$ tsc --noEmit --strict false --strictPropertyInitialization src-ex4/loose.ts
error TS5052: Option 'strictPropertyInitialization' cannot be specified without specifying option 'strictNullChecks'.
```

## What each flag does

| Flag | Catches | Error seen |
|---|---|---|
| `noImplicitAny` | A parameter or variable the compiler cannot infer, silently becoming `any` | `TS7006` |
| `strictNullChecks` | Using a value that may be `null`/`undefined` | `TS18047`, `TS2531` |
| `strictPropertyInitialization` | A class field never assigned in the constructor. **Requires `strictNullChecks`** | `TS2564` |
| `useUnknownInCatchVariables` | Treating a caught value as an `Error` without proving it | `TS18046`, `TS2339` |
| `strictFunctionTypes` | Unsound function-parameter assignment (checks contravariantly) | `TS2322` |
| `strictBindCallApply` | Wrong argument types through `bind`/`call`/`apply` | `TS2345` |
| `alwaysStrict` | Emits `"use strict"` and parses in strict mode | — |

`strictNullChecks` is the load-bearing one. Everything else on the list is
worth having; that one changes what every type in the codebase means.

## Why `strictNullChecks` is the whole argument

Without it:

```ts
function findUser(id: number): { name: string } | null { /* … */ }
const user = findUser(1);
user.name;          // compiles. Crashes when the user is missing.
```

`null` is assignable to every type, so the `| null` you carefully wrote is
decoration. With it, that line is `TS18047: 'user' is possibly 'null'` and you
must narrow first:

```ts
const user = findUser(1);
if (user === null) return;
user.name;          // narrowed to { name: string }
```

That is the entire discipline of Phase 2, and it does not exist as a concept
until this flag is on.

## `tsc --init` already agrees

The compiler's own scaffold goes further than `strict`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}
```

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are **not** part of
`strict` — they are opt-in beyond it, and `tsc --init` turns them on anyway.
Both are covered in [Phase 10](../../syllabus/04-rigour-and-tooling.md).

## Trade-off

**Cost of `strict` on an existing codebase:** a large error count on day one, and
real work to fix. On a JavaScript port it can be thousands.

**Cost of not having it:** every type in the codebase quietly includes `null`,
and `any` enters wherever inference fails without saying so. You are paying for a
type system and receiving a subset of one.

**The migration answer is never "turn it off".** It is per-directory adoption and
a ratchet — [Phase 11](../../syllabus/04-rigour-and-tooling.md).

## Gotchas

**Symptom:** Upgrading to TypeScript 7 produced hundreds of new errors in a
project nobody changed
**Cause:** `strict` now defaults to `true`; the project relied on the old `false`.
**Fix:** Set `"strict": false` explicitly to reproduce the old behaviour, then
adopt strictness deliberately rather than all at once.

**Symptom:** `TS5052: Option 'strictPropertyInitialization' cannot be specified
without specifying option 'strictNullChecks'`
**Cause:** The flag is meaningless without null tracking — "never assigned" and
"assigned `undefined`" are the same thing otherwise.
**Fix:** Enable `strictNullChecks` too, or use `strict`.

**Symptom:** `TS2564` on a field assigned by a framework or an `init()` method
**Cause:** The compiler only counts assignments in the constructor.
**Fix:** Definite assignment `token!: string` when you genuinely know better, or
better, assign in the constructor and make the field type honest.

**Symptom:** `'err' is of type 'unknown'` in every `catch`
**Cause:** `useUnknownInCatchVariables`. JavaScript can throw anything, and the
compiler stopped pretending otherwise.
**Fix:** Narrow it — `if (err instanceof Error)` — then use it. Phase 7 covers
the server-side pattern.

**Symptom:** Two developers get different errors on the same file
**Cause:** The editor is using a different `tsconfig.json` (or a different
TypeScript version) from CI.
**Fix:** [09 · The language server is not the build](./09-language-server-vs-build.md).

## Interview questions

**★ What does `strict` actually turn on?**
Seven flags: `noImplicitAny`, `strictNullChecks`, `strictPropertyInitialization`,
`useUnknownInCatchVariables`, `strictFunctionTypes`, `strictBindCallApply` and
`alwaysStrict`. `strictNullChecks` is the significant one — without it `null` and
`undefined` are assignable to every type, so all other null-safety is theatre.

**★ Is `strict` on by default?**
On **TypeScript 7 it is** — `tsc --help --all` reports `default: true`, and an
unflagged run of a loose file reports `TS7006`, `TS18047`, `TS2564` and `TS18046`.
On 5.x the default was `false`. That difference is one of the more disruptive
parts of the upgrade.

**★ Why can't you enable `strictPropertyInitialization` on its own?**
`TS5052` — it needs `strictNullChecks`. Without null tracking there is no
difference between "never assigned" and "holds `undefined`", so the check has
nothing to detect.

**How would you introduce `strict` into a large legacy codebase?**
Never in one commit. Turn on one sub-flag at a time starting with
`noImplicitAny`, or apply a stricter `tsconfig` to new directories only, and put
a ratchet in CI so the error count can fall but never rise.

**Is `noUncheckedIndexedAccess` part of `strict`?**
No. It is separate and off by default, though `tsc --init` enables it. It makes
`arr[0]` and `record[key]` return `T | undefined`, which finds a large class of
real bugs and is the flag most likely to be argued about in review.

---

← Prev: [Strip-only mode](./04-strip-only-and-erasable-syntax.md) · Next → [tsconfig.json anatomy](./06-tsconfig-anatomy.md)
