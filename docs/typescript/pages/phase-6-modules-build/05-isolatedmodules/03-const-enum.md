---
title: "03 — `const enum` under the flag"
sidebar_label: "03 · `const enum` under the flag"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from `_computedOptions.preserveConstEnums`,
> `shouldPreserveConstEnums`, `checkEnumDeclarationWorker` and the `TS2748` /
> `TS1294` message texts, all read out of the installed **TypeScript 5.9.3**
> build. **No sandbox, no console blocks.**

Every other rule in this topic has a two-token fix. This one does not, because
`isolatedModules` does not merely *reject* a `const enum` — it **changes what one
compiles to**, and the change removes the only reason to write one.

## What a `const enum` is for

A normal `enum` emits an object:

```ts
enum Level { Low = 1, High = 2 }
const x = Level.High;
```

```js
var Level;
(function (Level) {
    Level[Level["Low"] = 1] = "Low";
    Level[Level["High"] = 2] = "High";
})(Level || (Level = {}));
const x = Level.High;
```

A `const enum` emits **nothing**, and inlines the value at every use site:

```ts
const enum Level { Low = 1, High = 2 }
const x = Level.High;
```

```js
const x = 2 /* Level.High */;
```

No object, no property lookup, no bytes in the bundle. That is the entire
feature: **`const enum` is an optimisation, and inlining is the optimisation.**

## 🔴 `isolatedModules` turns the optimisation off

`preserveConstEnums` is a computed option, and its value is not what its name
suggests:

```js
preserveConstEnums: {
  dependencies: ["isolatedModules", "verbatimModuleSyntax"],
  computeValue: (compilerOptions) =>
    !!(compilerOptions.preserveConstEnums
       || _computedOptions.isolatedModules.computeValue(compilerOptions)),
}
```

**Turning on `isolatedModules` turns on `preserveConstEnums`**, whether or not you
wrote it — and since `isolatedModules` is itself implied by
`verbatimModuleSyntax` (chunk 04), turning on *that* does it too.

The emit decision then reads:

```js
node.kind === EnumDeclaration && (!isEnumConst(node) || shouldPreserveConstEnums(options))
```

So a `const enum` under the flag **emits the object anyway**. You get the runtime
cost of a normal enum, plus the restrictions of a `const` one.

That is the honest summary, and it is not usually stated plainly: under
`isolatedModules`, `const enum` is a **normal enum with extra rules**.

## Why it has to be that way

Because a transpiler cannot inline what it cannot see.

```ts
// levels.ts
export const enum Level { Low = 1, High = 2 }

// app.ts
import { Level } from "./levels";
const x = Level.High;   // inline to… what?
```

Emitting `2` requires reading `levels.ts`. A single-file tool has only `app.ts`.
So either the enum object exists at runtime — which is `preserveConstEnums` — or
the import is unresolvable.

## And the ambient case cannot be saved at all

**TS2748** — *"Cannot access ambient const enums when '{0}' is enabled."*

```ts
// vendor.d.ts
declare const enum Level { Low = 1, High = 2 }

// app.ts
const x = Level.High;   // ❌ TS2748
```

`preserveConstEnums` cannot rescue this one, because there is **nothing to
preserve**: a `.d.ts` declares that something exists elsewhere and emits no
JavaScript at all. The value `2` exists only in the type system, so inlining is
the *only* way it could ever work — and inlining is exactly what a transpiler
cannot do.

🔴 **This is the one genuinely breaking rule in the whole flag**, and it is
usually somebody else's `.d.ts` that trips it. A dependency shipping
`declare const enum` makes its own consumers' migration harder, which is why
publishing one is now widely considered a mistake.

## What to write instead

Four options, in the order worth trying:

**1 · A plain `enum`.** One keyword deleted. Costs an object at runtime, works
everywhere, and is what `isolatedModules` gives you anyway.

```ts
enum Level { Low = 1, High = 2 }
```

**2 · A `const` object with a derived type** — the most common modern answer:

```ts
const Level = { Low: 1, High: 2 } as const;
type Level = (typeof Level)[keyof typeof Level];   // 1 | 2
```

It is a real value and a real type, it needs no compiler feature, and it survives
every tool. Its one weakness is that `Level` as a *type* is the union of the
values, not a nominal type — the enum's mild nominality is gone.

**3 · A union of literals**, when no runtime object is needed at all:

```ts
type Level = "low" | "high";
```

Usually the best answer when the values are strings and only ever compared.

**4 · Keep the `const enum` and accept the emit.** Legitimate if it is
module-local, not ambient, and you value the syntax. You are paying for an object
you did not want, and nothing else breaks.

⚠️ **For a dependency's ambient `const enum` you have none of these.** The
workarounds are to stop using the member, to re-declare the constant yourself
(and accept that it can drift from upstream), or to raise it with the package.

## ⚠️ `erasableSyntaxOnly` goes further and bans enums outright

TypeScript 5.8's `erasableSyntaxOnly` — the flag that restricts you to syntax
Node's own type-stripping can handle — does not negotiate:

```js
// checkEnumDeclarationWorker
if (compilerOptions.erasableSyntaxOnly && !(node.flags & Ambient)) {
  error2(node, Diagnostics.This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled);
}
```

**TS1294** — *"This syntax is not allowed when 'erasableSyntaxOnly' is enabled."*
— on **every** non-ambient enum declaration, `const` or not, because an enum
emits code and erasable syntax by definition does not.

The same check sits on `import x = require(…)` (`checkImportEqualsDeclaration`),
on namespaces, and on parameter properties. So the progression is:

| Flag | `const enum` | plain `enum` |
|---|---|---|
| neither | inlined | object emitted |
| `isolatedModules` | **object emitted**; ambient ones banned | object emitted |
| `erasableSyntaxOnly` | **banned** | **banned** |

If you are heading toward running TypeScript directly on Node, option 2 above is
not a preference — it is the destination.

## Gotchas

**Symptom:** you enabled `isolatedModules` and the bundle grew.
**Cause:** `preserveConstEnums` came on with it, so every `const enum` now emits
an object.
**Fix:** expected, and unavoidable. Convert to `as const` objects if the size
matters.

**Symptom:** `preserveConstEnums` is not in your `tsconfig.json`, but it is on.
**Cause:** it is a computed option; `isolatedModules` (or `verbatimModuleSyntax`)
implies it.
**Fix:** none needed — but do not conclude from the config file's silence that
the option is off. Several options in this phase behave that way.

**Symptom:** TS2748 pointing into `node_modules`.
**Cause:** a dependency ships `declare const enum` and you referenced a member.
**Fix:** there is no local fix that keeps the reference honest. Re-declare the
constant yourself and comment the source, or raise it upstream.

**Symptom:** the `const enum` inlined fine under `tsc` and is `undefined` under
esbuild.
**Cause:** the flag was off, so `tsc` inlined and the transpiler could not.
**Fix:** this is the bug `isolatedModules` exists to surface. Turn it on.

**Symptom:** converting to `as const` broke a function that took the enum type.
**Cause:** `type Level = (typeof Level)[keyof typeof Level]` is `1 | 2`, a
structural union — so any `1` now satisfies it, where the enum was mildly
nominal.
**Fix:** if the nominality mattered, brand it. Phase 4 · 07 covers branded types,
and is explicit that it is a community pattern rather than a language feature.

**Symptom:** `const enum` members that are strings behave differently from
numbers.
**Cause:** string enum members are never auto-incremented, so TS18056 cannot
apply — but TS18055 can, if the initialiser is a non-literal expression the
checker resolves to a string.
**Fix:** write the literal.

**Symptom:** you removed `const` and a `switch` became non-exhaustive.
**Cause:** unrelated to emit — a plain numeric enum's type is wider in some
positions than a `const enum`'s.
**Fix:** annotate the discriminant explicitly, or move to a literal union, which
narrows best of the three.

## Interview questions

**What does `const enum` buy you?**
Inlining. No object is emitted and each use site becomes the literal value. That
is the whole feature.

**What happens to a `const enum` under `isolatedModules`?**
`preserveConstEnums` is computed on, so the object is emitted anyway. You keep
the restrictions and lose the optimisation.

**Why can't a transpiler inline one?**
Inlining requires the member's value, which lives in the file that declares the
enum. A single-file tool has only the importing file.

**Why is an *ambient* `const enum` a hard error rather than a de-optimisation?**
Because a `.d.ts` emits nothing, so there is no object to fall back to. Inlining
is the only mechanism, and it is unavailable.

**What is the modern replacement?**
A `const` object plus a derived type: `const X = {…} as const` with
`type X = (typeof X)[keyof typeof X]`. It needs no compiler feature and survives
every toolchain.

**What does it lose compared with an enum?**
The enum's mild nominality. The derived type is a union of the literal values, so
any matching literal satisfies it.

**How does `erasableSyntaxOnly` change the picture?**
It bans every non-ambient enum declaration outright with TS1294 — `const` or not
— along with `import =`, namespaces and parameter properties. `isolatedModules`
de-optimises; `erasableSyntaxOnly` forbids.

**If a dependency ships `declare const enum`, what are your options?**
Stop using the member, re-declare the value locally and accept the drift risk, or
raise it upstream. None is good, which is why publishing ambient `const enum` is
discouraged.

---

← [02 · Every rule it enforces](./02-every-rule.md) · Next → [04 · Its relationship to `verbatimModuleSyntax`](./04-and-verbatim-module-syntax.md)
