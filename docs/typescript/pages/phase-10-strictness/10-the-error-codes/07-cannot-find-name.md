---
title: "Cannot find name — the ladder with a shell command in it"
sidebar_label: "07 · Cannot find name"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the checker functions that choose these
> messages** in the **TypeScript 5.9.3** build —
> `getCannotFindNameDiagnosticForName` (around line 73822) and
> `checkAndReportErrorForMissingPrefix` (around 52726), plus the
> `allowUmdGlobalAccess` branch at 52722 — so the hardcoded identifier list below
> is quoted from the compiler's own `switch`, not collected from experience. Codes
> and templates read from the numbered table in the same file: `TS2304`, `TS2311`,
> `TS2503`, `TS2552`, `TS2580`–`TS2585`, `TS2591`–`TS2593`, `TS2662`, `TS2663`,
> `TS2686`, `TS2693`, `TS2749`, `TS2867`, `TS2868`, `TS18004`. **No sandbox, no
> console block** — this is a file read.

The sibling of [chunk 06](./06-the-name-is-wrong.md), with the same shape and one
genuinely surprising feature.

> 🔴 **`TS2304` — *"Cannot find name '{0}'."* — is also a last resort**, and the
> ladder above it is stranger than the property one. Part of it is a **hardcoded
> `switch` on the identifier's literal text**: the compiler carries a list of the
> global names people most often forget to install types for, and for each one it
> prints **the actual npm command**.

## 🔴 The hardcoded list, quoted from the compiler's `switch`

| Identifier | What the compiler says instead of `TS2304` | Code |
|---|---|---|
| `document`, `console` | *"…Do you need to change your target library? Try changing the `'lib'` compiler option to include `'dom'`."* | `TS2584` |
| `process`, `require`, `Buffer`, `module` | *"…Do you need to install type definitions for node? Try `npm i --save-dev @types/node`."* | `TS2580` / `TS2591` |
| `describe`, `suite`, `it`, `test` | *"…install type definitions for a test runner? Try `npm i --save-dev @types/jest` **or** `npm i --save-dev @types/mocha`."* | `TS2582` / `TS2593` |
| `$` | *"…install type definitions for jQuery? Try `npm i --save-dev @types/jquery`."* | `TS2581` / `TS2592` |
| 🔴 `Bun` | *"…install type definitions for Bun? Try `npm i --save-dev @types/bun`."* | `TS2867` / `TS2868` |
| `Map`, `Set`, `Promise`, `Symbol`, `WeakMap`, `WeakSet`, `Iterator`, `AsyncIterator`, `SharedArrayBuffer`, `Atomics`, `AsyncIterable`, `AsyncIterableIterator`, `AsyncGenerator`, `AsyncGeneratorFunction`, `BigInt`, `Reflect`, `BigInt64Array`, `BigUint64Array` | *"…Do you need to change your target library? Try changing the `'lib'` compiler option to `'{1}'` or later."* | `TS2583` |
| `await`, **in a call position** | *"Cannot find name '{0}'. Did you mean to write this in an async function?"* | `TS2311` |
| anything, in a **shorthand property assignment** | *"No value exists in scope for the shorthand property '{0}'. Either declare one or provide an initializer."* | `TS18004` |
| everything else | `Cannot find name '{0}'.` | `TS2304` |

📌 **`Bun` being on that list is a small piece of ecosystem history in the
compiler source.** So is jQuery, from the other end of it.

⚠️ **The 18-name `lib` list is exact, and its omissions are informative.**
`Map` and `Set` are on it; `Array.prototype.at` is not, because that is a
*property* lookup and belongs to
[chunk 06's step 4](./06-the-name-is-wrong.md) (`TS2550`). **Globals go through
this switch; members go through the property ladder.** Same underlying cause, two
different codes, and neither one mentions the other.

## 🔴 Every install suggestion exists twice, and the pair tells you about `types`

Look at the code pairs: `TS2580`/`TS2591`, `TS2581`/`TS2592`, `TS2582`/`TS2593`,
`TS2867`/`TS2868`. The second of each adds a clause:

```text
Cannot find name 'process'. Do you need to install type definitions for node?
Try `npm i --save-dev @types/node` and then add 'node' to the types field
in your tsconfig.
```

**The selector is one line in the checker: `compilerOptions.types ? long : short`.**

🔴 **And the reason is the single most misunderstood thing about `types`.** By
default, TypeScript includes **every** `@types/*` package it can find under
`node_modules/@types`. The moment you write an explicit `types` array, it becomes
an **allowlist** — nothing not named in it is included, however installed it is.

So `types: ["node"]` does not mean "also include node"; it means "include node
**and nothing else**". Install `@types/jest` under that config and it is invisible
until you add `"jest"` to the array.

📌 **This is why the compiler bothers to print two versions of the same
sentence.** Getting the short message means installing the package is enough;
getting the long one means installing it will not be. **That distinction is
carried entirely in the code number and the trailing clause**, and it is the
difference between a two-minute fix and an hour of "I already installed it".

## The override checks that run before the switch's answer is used

The hardcoded message is a **fallback** passed into name resolution. Three checks
can pre-empt it, and each is a complete diagnosis:

### `TS2662` and `TS2663` — you meant a class member

```ts
class Cart {
  static TAX = 0.2;
  items: Item[] = [];

  total() {
    return items.length * TAX;   // TS2663 on `items`, TS2662 on `TAX`
  }
}
```

| Code | Template |
|---|---|
| `TS2662` | `Cannot find name '{0}'. Did you mean the static member '{1}.{0}'?` |
| `TS2663` | `Cannot find name '{0}'. Did you mean the instance member 'this.{0}'?` |

⚠️ **The two are not symmetric, and the asymmetry is in the checker:** the static
check **walks up every enclosing class**, so it fires from inside a nested class
or a method of an inner class. The instance check fires only for the
**immediate** container and only when that container is **not `static`** — which
is correct, because there is no `this` instance to suggest from a static method.

📌 **These are the errors that catch a JavaScript habit.** In JavaScript there is
no compile-time distinction to violate; in TypeScript, forgetting `this.` is a
name-resolution failure that the compiler can diagnose exactly.

### `TS2686` — a UMD global in a module

```text
'$' refers to a UMD global, but the current file is a module.
Consider adding an import instead.
```

🔴 **This one is reported through `errorOrSuggestion(!allowUmdGlobalAccess, …)`,
so the flag decides its category:** with `allowUmdGlobalAccess: false` (the
default) it is an **Error**; with the flag on it is demoted to a **Suggestion**
that never fails a build.

⚠️ **That is the third instance in this topic of the same demotion mechanism** —
after the 7043–7050 Suggestion twins and `TS2568` in unchecked JS
([chunk 01](./01-what-a-code-is.md)). **A flag changing a finding's *category*
rather than its existence is a recurring TypeScript design, and it is worth
recognising as a pattern**: the compiler almost never stops computing something,
it stops *failing* on it.

### The spelling check — `TS2552`

*"Cannot find name '{0}'. Did you mean '{1}'?"* — the same machinery as `TS2551`,
`TS2724` and `TS2820`, with the exact budget in
[chunk 08](./08-the-spelling-budget.md).

## The type-space / value-space pair

Two codes for the same confusion in opposite directions, and they are the fastest
thing on this page to fix once recognised:

| Code | Template | You did |
|---|---|---|
| `TS2693` | `'{0}' only refers to a type, but is being used as a value here.` | used an `interface` or `type` where a runtime value goes |
| `TS2749` | `'{0}' refers to a value, but is being used as a type here. Did you mean 'typeof {0}'?` | used a `const` or function where a type goes |
| `TS2585` | `'{0}' only refers to a type, but is being used as a value here. Do you need to change your target library?…` | 🔴 **both at once** — it is a type in your `lib`, and the value form arrives in a later slice |

🔴 **`TS2749` hands you the fix in the message: `typeof`.** This is the single most
useful "did you mean" in the language, because `typeof x` in a type position is
not obvious from JavaScript experience — the same keyword means something
completely different there.

```ts
const config = { retries: 3, url: "…" };

function f(c: config) {}          // TS2749
function f(c: typeof config) {}   // the fix, and the message said so
```

📌 **`TS2585` is worth recognising because it looks like `TS2693` and has a
different fix.** `Symbol` is the classic: it exists as a *type* in older libs and
as a *value* only from `es2015` onward, so using it as a value under an old `lib`
produces the combined message. The fix is `lib`, not your code.

**`TS2503`** — *"Cannot find namespace '{0}'."* — is the same failure in namespace
position, chosen when the lookup was for a namespace meaning rather than a value.

## Gotchas

**Symptom:** `Cannot find name 'process'` and you have already installed
`@types/node`.
**Cause:** you have an explicit `types` array, so it is an allowlist and `node` is
not in it.
**Fix:** add `"node"` to `types` — or delete the `types` array entirely and let
automatic inclusion work. 🔴 **The error message told you which of these you
needed**: the long variant means installing is not enough.

**Symptom:** `Cannot find name 'describe'` in test files only.
**Cause:** the test runner's types are missing, or excluded by `types`.
**Fix:** the compiler prints the command. Note that it names both `@types/jest`
and `@types/mocha` because it cannot tell which you use.

**Symptom:** `Cannot find name 'document'` on a project that also has server
code.
**Cause:** `lib` omits `dom`, correctly, and this file needs it.
**Fix:** split the project — a `tsconfig` per environment with project references
— rather than adding `dom` to a server config. **Phase 6 · Project references and
`tsc -b`** *(not written yet)* is the mechanism.

**Symptom:** `Cannot find name` on a field you can see three lines above.
**Cause:** `TS2663` — the missing `this.`.
**Fix:** add `this.`. If it is a static member you get `TS2662` naming the class
instead, and that check walks up **every** enclosing class.

**Symptom:** the missing-`this.` suggestion does not appear inside a `static`
method.
**Cause:** by design — the instance check requires a non-static immediate
container, because there is no instance to suggest.
**Fix:** you probably meant the static member; `TS2662` should be firing instead.

**Symptom:** a type name is rejected in a value position with no obvious reason.
**Cause:** `TS2693` — it is a type-only declaration. Interfaces and type aliases
do not exist at runtime.
**Fix:** if you need a runtime value, you need a `const`, `class` or `enum`. This
is the type-space/value-space split, and it is
[phase 1's](../../phase-1-type-vocabulary/README.md) subject.

**Symptom:** a `const` object rejected in a type position.
**Cause:** `TS2749`.
**Fix:** `typeof theConst`. The message says so, and it is easy to skim past
because the fix looks like a JavaScript operator doing something unrelated.

**Symptom:** `Symbol` works as a type and fails as a value.
**Cause:** `TS2585` — the value form arrives in a later `lib` slice.
**Fix:** raise `lib`. Do not restructure the code.

**Symptom:** `$` errors as a UMD global in some files and not others.
**Cause:** `TS2686` fires only in files that are **modules** (i.e. have an
`import`/`export`). A script file may use the global freely.
**Fix:** import it. Turning on `allowUmdGlobalAccess` only demotes the message to
a Suggestion; it does not make the pattern safer.

**Symptom:** `{ name }` shorthand fails with a message about "no value in scope".
**Cause:** `TS18004`, a dedicated diagnostic for shorthand property assignment.
**Fix:** either declare `name`, or write `{ name: something }`. The specialised
message exists because a bare `{ name }` reads as a *key*, so `Cannot find name`
would be confusing.

## Interview questions

**What is unusual about how TypeScript reports an unresolved global?**
It has a hardcoded `switch` on the identifier's literal text, and for the names
people most often forget it prints an actual install command — `@types/node` for
`process`, `require`, `Buffer` and `module`; `@types/jest` or `@types/mocha` for
`describe`, `it`, `test` and `suite`; `@types/jquery` for `$`; `@types/bun` for
`Bun`; and a `lib` suggestion for eighteen named ES globals. `TS2304`, the plain
"cannot find name", is only the fallback.

**Why does the same "install `@types/node`" message exist under two different
codes?**
Because the compiler checks whether you have an explicit `types` array. Without
one, TypeScript includes every `@types/*` package it can find, so installing is
enough and you get the short message. With one, `types` becomes an allowlist that
excludes everything not named in it, so the long message adds *"and then add
'node' to the types field"*. The code number is the difference between a
two-minute fix and an hour of confusion.

**What does an explicit `types` array in `tsconfig.json` actually do?**
It replaces automatic inclusion of `node_modules/@types` with an allowlist.
`types: ["node"]` means "include `@types/node` and nothing else" — every other
installed type package becomes invisible. It is a narrowing option that is
frequently added believing it is an additive one.

**You get `Cannot find name` on a class field that is clearly declared. Why?**
You omitted `this.`. `TS2663` says so explicitly. The compiler also has `TS2662`
for the static case, naming the class — and that check walks up every enclosing
class, while the instance check only looks at the immediate, non-static container,
because a static method has no instance to suggest.

**What is `TS2749` and why is it worth memorising?**
*"'{0}' refers to a value, but is being used as a type here. Did you mean 'typeof
{0}'?"* It is the most useful suggestion in the language, because `typeof` in a
type position is a different operator from `typeof` in an expression, and nothing
in JavaScript experience prepares you for it. Its mirror is `TS2693`, a type used
where a value is needed — which has no such easy fix, because interfaces and type
aliases genuinely do not exist at runtime.

**Give an example of a flag changing an error into a suggestion rather than
removing it.**
`allowUmdGlobalAccess`. `TS2686` — *"'{0}' refers to a UMD global, but the current
file is a module"* — is reported through `errorOrSuggestion(!allowUmdGlobalAccess,
…)`, so the flag decides its category rather than its existence. It is the same
mechanism as the 7043–7050 Suggestion twins of the `noImplicitAny` errors, and as
`TS2568` in unchecked JavaScript. The compiler almost never stops computing a
finding; it stops failing on it.

---

← [06 · The name is wrong](./06-the-name-is-wrong.md) · [Topic index](./README.md) · Next → [08 · The spelling budget](./08-the-spelling-budget.md)
