---
title: "Where types come from"
sidebar_label: "08 · Where types come from"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Console output from
> `sandbox/ts-p0/ex6-where-types-come-from.sh`.

**A type reaches your editor from one of four places. When none of them has it,
you get `TS7016`, and you have a decision to make rather than an error to
suppress.**

## The four sources

| Source | Where it lives | Who wrote it |
|---|---|---|
| **Inference** | Nowhere — computed from your code | The compiler |
| **Bundled declarations** | `.d.ts` inside the package, pointed at by `types`/`exports` | The library author |
| **DefinitelyTyped** | A separate `@types/<pkg>` package | The community |
| **Your own ambient declaration** | A `.d.ts` in your repo | You |

Plus `lib` — the ambient environment (`Array`, `Promise`, `document`) that comes
from TypeScript itself, selected by `lib` and `target`
([06 · tsconfig.json](./06-tsconfig-anatomy.md)).

## When there is nothing

A package with JavaScript and no declarations:

```ts
import { shout } from 'untyped-lib';
console.log(shout('hello'));
```

```console
$ tsc --noEmit --module nodenext src/app.ts
src/app.ts(1,23): error TS7016: Could not find a declaration file for module 'untyped-lib'.
'/…/types-demo/node_modules/untyped-lib/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/untyped-lib` if it exists or add a new declaration (.d.ts)
  file containing `declare module 'untyped-lib';`
exit=1
```

Note what the error is actually telling you: the import **works**, the module
resolves, and the compiler found the JavaScript. What it lacks is a description,
so the import would silently become `any`. `noImplicitAny` is what turns that
silence into `TS7016` — with `strict` off, this compiles and every call into that
library is unchecked.

## Fixing it in order of preference

**1. Install the community types.**

```console
$ npm i -D @types/lodash
```

Automatically picked up: TypeScript looks in `node_modules/@types` and includes
what it finds ([06 · `types: []`](./06-tsconfig-anatomy.md) covers turning that
off).

**2. Write a local ambient declaration** when no `@types` exists:

```ts
// src/untyped-lib.d.ts
declare module 'untyped-lib' {
  export function shout(s: string): string;
}
```

```console
$ tsc --noEmit --module nodenext src/app.ts src/untyped-lib.d.ts
exit=0
```

Clean. And the declaration is load-bearing from that moment on:

```ts
import { shout } from 'untyped-lib';
console.log(shout(42));
```

```console
$ tsc --noEmit --module nodenext src/wrong.ts src/untyped-lib.d.ts
src/wrong.ts(2,19): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
exit=1
```

**This is the point to be clear about: a declaration is a promise, not a check.**
Nothing verified that `shout` really takes a string — you asserted it, and the
compiler now enforces *your assertion* across your codebase. Get it wrong and it
will confidently enforce the wrong thing.

Declare only what you use. A five-line declaration covering the two functions you
call is more accurate and easier to keep true than a hopeful transcription of the
whole API.

**3. The blunt version**, when you need to move now:

```ts
declare module 'untyped-lib';   // everything from it is `any`
```

Honest about knowing nothing, and greppable later.

**4. Upstream the fix.** If the package is popular, a PR to DefinitelyTyped (or
to the package itself) deletes your shim permanently.

## Bundled vs `@types`

| | Bundled | `@types` |
|---|---|---|
| Ships with | the library | a separate package |
| Version drift | impossible | possible — `@types/x@4` against `x@5` |
| Written by | the author | contributors |
| Signal | usually TypeScript source | usually a JavaScript-first library |

Version drift is the failure that wastes an afternoon: the runtime behaves one
way and the types describe an older release. When a signature looks wrong, check
whether `@types/x` and `x` agree on major version before believing either.

## Inference is the source you use most

Most types are written by nobody:

```ts
const rates = { standard: 120, express: 260 };   // { standard: number; express: number }
const keys = Object.keys(rates);                  // string[]
const total = keys.length * 2;                    // number
```

Annotating those adds noise and can *lose* information — writing
`const rates: Record<string, number>` throws away the knowledge that exactly
`standard` and `express` exist. The rule for Phase 1: **annotate boundaries
(parameters, exported returns), let inference handle the interior.**

## Trade-off

**A hand-written declaration** unblocks you immediately and costs a file you now
own, which can drift from the library without any warning.

**Waiting for upstream types** is correct and slow.

**`declare module 'x';`** is instant and turns off checking for that dependency
entirely — fine as a marked temporary step, bad as a habit.

## Gotchas

**Symptom:** `TS7016: Could not find a declaration file for module 'x'`
**Cause:** The package ships no types and no `@types/x` is installed.
**Fix:** Install `@types/x` if it exists; otherwise write a minimal
`declare module` covering what you use.

**Symptom:** Types disagree with runtime behaviour
**Cause:** `@types/x` is a different major version from `x`, or a hand-written
shim is wrong.
**Fix:** Align versions; read the shipped `.d.ts`. Remember a declaration is
asserted, never verified.

**Symptom:** A `.d.ts` in the repo is ignored
**Cause:** It is outside `include`, or inside `exclude`.
**Fix:** Put declarations under an included source root — a `types/` folder that
`include` covers.

**Symptom:** Global types (`describe`, `process`) vanished after setting
`"types": []`
**Cause:** That switches off automatic `@types` inclusion.
**Fix:** List what you need: `"types": ["node", "vitest/globals"]`.

**Symptom:** Two versions of the same `@types` package in one build
**Cause:** Transitive dependencies pinned different majors, so two copies exist.
**Fix:** Deduplicate — a package-manager override, or align the dependency.

## Interview questions

**★ Where can a type come from?**
Inference, declarations bundled with the package, a DefinitelyTyped `@types/*`
package, or an ambient declaration you write. TypeScript's own `lib` files supply
the built-in environment.

**★ What does `TS7016` mean, and what are your options?**
The module resolved but has no declaration file, so it would implicitly be `any`
— surfaced because `noImplicitAny` is on. Options, best first: install `@types/x`;
write a minimal `declare module 'x'` covering what you use; declare it untyped
with `declare module 'x';`; contribute types upstream.

**★ Is a `.d.ts` checked against the library it describes?**
No. It is an assertion. The compiler enforces it throughout your code without
ever verifying it matches the JavaScript, which is why a hand-written shim or a
mismatched `@types` version produces confidently wrong errors.

**Why prefer bundled types over `@types`?**
They cannot drift — they version with the library. A separate `@types` package
can lag or lead the runtime it describes.

**When should you annotate rather than let inference work?**
At boundaries — function parameters, exported function returns, and anything
crossing a module or network edge. Inside a function, inference is usually more
precise than what you would write.

---

← Prev: [TypeScript 7](./07-typescript-7-native-compiler.md) · Next → [The language server is not the build](./09-language-server-vs-build.md)
