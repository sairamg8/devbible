---
title: "02 — Every rule it enforces"
sidebar_label: "02 · Every rule it enforces"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by locating every site in the installed **TypeScript 5.9.3**
> checker that consults `getIsolatedModules(compilerOptions)`, and quoting each
> diagnostic verbatim from that build's message table. **No sandbox, no console
> blocks.**

The flag's rules are usually presented as a list to memorise. They are not a
list — they are one idea applied to every place TypeScript lets you write
something whose *emit* depends on another file. Read each rule as an answer to
"what would the transpiler have to look up?".

## 1 · Re-exporting a type

**TS1205** — *"Re-exporting a type when '{0}' is enabled requires using 'export
type'."*

```ts
export { User } from "./types";        // ❌
export type { User } from "./types";   // ✅
```

**What would need looking up:** whether `User` is a type or a value.

Its sibling fires when the name is a *type-only import* somewhere upstream:

**TS1448** — *"'{0}' resolves to a type-only declaration and must be re-exported
using a type-only re-export when '{1}' is enabled."*

🔴 **The two are a diagnosis pair, and the difference matters.** TS1205 means the
thing is a type. TS1448 means the thing might be a value, but somebody upstream
marked it `import type`, so **the fix may belong in the other file** — this is
exactly the distinction topic 02 draws for `verbatimModuleSyntax`, and the same
messages serve both flags.

## 2 · Re-exporting through a local import

Four diagnostics, differing only in which edit they recommend, and the variant
you get is itself information:

| Code | Condition | Suggested fix |
|---|---|---|
| **TS1289** | resolves to a **type-only declaration**, re-exported normally | *"Consider using 'import type' where '{0}' is imported."* |
| **TS1290** | the same, as `export default` | *"Consider using 'export type &#123; {0} as default &#125;'."* |
| **TS1291** | resolves to a **type**, re-exported normally | *"Consider using 'import type' where '{0}' is imported."* |
| **TS1292** | the same, as `export default` | *"Consider using 'export type &#123; {0} as default &#125;'."* |

The pattern behind all four: you imported a name as a value and re-exported it,
so the file's *own* import statement is the thing that has to be marked, not the
export.

## 3 · `export default` of a type

```ts
import { Config } from "./config";
export default Config;    // ❌ if Config is a type
```

A transpiler sees `export default Config` and must emit an assignment. If
`Config` is a type, the assignment references nothing.

## 4 · `export import` on a type

**TS1269** — *"Cannot use 'export import' on a type or type-only namespace when
'{0}' is enabled."*

`export import X = Y` is the namespace-era spelling, and it has the same problem
in a sharper form: the statement is a value declaration whose target may be a
type.

## 5 · Ambient `const enum` access

**TS2748** — *"Cannot access ambient const enums when '{0}' is enabled."*

```ts
// vendor.d.ts
declare const enum Level { Low = 1, High = 2 }

// app.ts
const x = Level.High;   // ❌ under isolatedModules
```

**What would need looking up:** the *value* `2`, which lives in a `.d.ts` the
transpiler never reads. A `const enum` is normally inlined at the use site, and
inlining requires knowing the member's value. Chunk 03 is entirely about this
case, because it is the one with a real trade-off rather than a two-token fix.

## 6 · Enum members a transpiler cannot compute

Two rules, both about the compiler's ability to *evaluate* an enum:

**TS18056** — *"Enum member following a non-literal numeric member must have an
initializer when 'isolatedModules' is enabled."*

```ts
enum E {
  A = someImportedNumber,   // not a literal
  B,                        // ❌ what is B? A + 1 — but A is unknown here
}
```

**TS18055** — *"'{0}' has a string type, but must have syntactically recognizable
string syntax when 'isolatedModules' is enabled."*

```ts
const s = "x";
enum E { A = s }   // ❌ the checker knows it is "x"; the text does not say so
```

🔴 **TS18055 is the clearest statement of the whole flag anywhere in the
compiler.** *"Syntactically recognizable"* is precisely the standard:
type-checking knows the value, and reading the line does not. The flag exists to
insist those two agree.

## 7 · Namespaces in a global script file

**TS1280** — *"Namespaces are not allowed in global script files when '{0}' is
enabled. If this file is not intended to be a global script, set
'moduleDetection' to 'force' or add an empty 'export &#123;&#125;' statement."*

A file with no top-level `import` or `export` is a **script**, and a namespace in
one contributes to the global scope — which is a whole-program property no
single-file tool can reason about.

⚠️ **The message names the fix twice over**, and this is the one rule whose
answer is usually a config change rather than an edit: `"moduleDetection":
"force"` makes every file a module and the problem disappears everywhere at once.
That option is argued in topic 01, and it defaults to `force` under the Node
family of `module` values anyway.

## 8 · Decorator metadata referencing an imported type

**TS1272** — *"A type referenced in a decorated signature must be imported with
'import type' or a namespace import when 'isolatedModules' and
'emitDecoratorMetadata' are enabled."*

`emitDecoratorMetadata` emits a **runtime reference** to a type — that is its
entire purpose. A transpiler cannot tell whether the imported name it is about to
emit is a class (a real value) or an interface (nothing).

⚠️ This one bites hardest in NestJS and TypeORM codebases, which are built on
`emitDecoratorMetadata`, and it is a genuine reason those projects are slower to
adopt fast transpilers. Phase 4 · 13 covers why they cannot simply move to
standard decorators.

## 9 · An import that shadows a value

Two diagnostics, and they are subtler than the rest:

**TS2865** — *"Import '{0}' conflicts with local value, so must be declared with
a type-only import when 'isolatedModules' is enabled."*

**TS2866** — *"Import '{0}' conflicts with global value used in this file, so
must be declared with a type-only import when 'isolatedModules' is enabled."*

```ts
import { Response } from "./http";   // a type
declare function handle(): Response; // used only as a type

const r: Response = fetchIt();       // which Response? the DOM's, or the import?
```

`tsc` erases the import (it is only used as a type) and `Response` resolves to
the DOM global. A transpiler **keeps** the import, so `Response` resolves to the
imported binding — and the two are different types. Same source, two meanings,
depending on which tool built it.

🔴 **The checker's variable for this condition is named
`appearsValueyToTranspiler`**, which is as plain a statement of the flag's
purpose as you will find: the compiler is modelling what a *different tool* would
conclude from the same text.

## The rule table, at a glance

| Code | Refuses | Because a transpiler cannot know |
|---|---|---|
| TS1205 | `export { T } from …` | whether `T` is a type |
| TS1448 | re-export of a type-only import | that an upstream file marked it |
| TS1289–1292 | re-export via a local import | the same, per fix variant |
| TS1269 | `export import X = …` on a type | whether the target is a value |
| TS2748 | ambient `const enum` access | the member's value |
| TS18055 | non-literal string enum member | the string, from the text |
| TS18056 | enum member after a non-literal | the previous member's number |
| TS1280 | namespace in a script file | whether the file is global |
| TS1272 | decorator metadata on an imported type | whether the type is a value |
| TS2865 / TS2866 | an import shadowing a value | whether the import survives |

**Ten diagnostics, one idea.** If you can state what the transpiler would have to
look up, you can predict the rule.

## Gotchas

**Symptom:** TS1205 on a name that is definitely a value.
**Cause:** it is not TS1205 then — check the code. TS1448 fires on a *value*
whose upstream import was marked `import type`, and its fix is in the other file.
**Fix:** read the code number before the message text.

**Symptom:** `export type { X }` fixed the error, and now a consumer says `X` is
undefined at runtime.
**Cause:** `X` really was a value and you erased it.
**Fix:** the error was TS1448, not TS1205. Remove the `import type` upstream
instead.

**Symptom:** TS1280 in one file, and the rest of the codebase is fine.
**Cause:** that file has no top-level `import` or `export`, so it is a script.
**Fix:** `export {}` at the bottom, or `"moduleDetection": "force"` project-wide,
which is what the message suggests.

**Symptom:** TS18056 on an enum you did not change.
**Cause:** an earlier member's initialiser stopped being a literal — often
because someone extracted it to a constant.
**Fix:** give the following member an explicit initialiser, or inline the literal
back.

**Symptom:** TS1272 across an entire NestJS codebase.
**Cause:** `emitDecoratorMetadata` emits runtime references to imported types.
**Fix:** `import type` for the ones used only as types — but note that a type
used *for injection* must stay a value import, so this is not a mechanical
rewrite.

**Symptom:** TS2865/TS2866 on an import that looks harmless.
**Cause:** the imported name collides with a local or global of the same name,
and erasing versus keeping the import changes which one wins.
**Fix:** `import type`, which makes the erasure explicit and the resolution
stable.

**Symptom:** the same file compiles under `tsc` and produces different runtime
behaviour under esbuild, with no error from either.
**Cause:** a TS2866-shaped collision with the flag off. This is the failure the
flag exists to prevent, and it is silent.
**Fix:** turn the flag on. There is no other way to find these.

**Symptom:** a rule fires only in `.d.ts`-adjacent code.
**Cause:** several checks skip nodes with the `Ambient` flag — declarations
inside `declare` blocks are exempt because nothing is emitted for them.
**Fix:** expected; the exemption is correct.

## Interview questions

**What single question generates all of these rules?**
"Would a transpiler have to open another file to emit this line correctly?" If
yes, the line is refused.

**What is the difference between TS1205 and TS1448?**
TS1205 means the re-exported name is a type. TS1448 means it is a value that an
upstream file marked `import type` — so the fix is often in that other file, not
this one.

**Why are there four diagnostics (TS1289–TS1292) for what looks like one
situation?**
They differ by whether the name resolves to a type or a type-only declaration,
and by whether it is a default export. Each names the *specific* edit that fixes
it, so the variant you receive tells you which edit to make.

**What does TS18055's phrase "syntactically recognizable" mean?**
That the value must be readable from the text of the line, not merely known to
the type checker. It is the flag's whole standard, stated in one phrase.

**Why does `isolatedModules` care about namespaces?**
Only in a **script** file, where a namespace contributes to the global scope —
a whole-program property. In a module file, namespaces are unaffected.

**Why is `emitDecoratorMetadata` a problem?**
It emits runtime references to types, so the transpiler must know whether an
imported name is a class or an interface. TS1272 forces you to say.

**What is `appearsValueyToTranspiler`?**
The checker's own name for the condition behind TS2865 — whether a
single-file tool would treat an import as a value and therefore keep it. The
variable name is the clearest evidence of what the flag models.

**Which of these rules has a cost beyond a two-token edit?**
Ambient `const enum` (TS2748), because the fix changes what is emitted rather
than just how it is spelled. That is chunk 03.

---

← [01 · The one-file compiler](./01-the-one-file-compiler.md) · Next → [03 · `const enum` under the flag](./03-const-enum.md)
