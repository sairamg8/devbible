---
title: "The `type` modifier, every form"
sidebar_label: "02 · The `type` modifier"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (the `type`
> modifier examples are quoted verbatim) and the **TypeScript handbook** on
> type-only imports. `TS1363`, `TS2822`, `TS2857`, `TS1454`, `TS2865` and
> `TS2866` are verbatim from the compiler's message table in the installed
> **5.9.3** build. `import type` arrived in **TypeScript 3.8**; the inline
> `{ type X }` form in **4.5**. **No sandbox, no console block.**

There are more spellings than people use. Knowing all of them matters because
they are not interchangeable — two of them cannot be combined, one of them is the
only form that works in a mixed import, and one is illegal outside a declaration
file's world.

## The five forms

```ts
// 1 — statement-level, named
import type { User, Role } from "./user.js";

// 2 — statement-level, namespace
import type * as user from "./user.js";

// 3 — statement-level, default
import type User from "./user.js";

// 4 — inline, per specifier  (TypeScript 4.5+)
import { createUser, type User, type Role } from "./user.js";

// 5 — export side
export type { User } from "./user.js";
export { createUser, type User } from "./user.js";
```

The 5.0 release notes' own summary of what each does to the output:

> ```ts
> // This statement can be dropped entirely in JS output
> import type * as car from "./car";
>
> // The named import/export 'Car' can be dropped in JS output
> import { type Car } from "./car";
> export { type Car } from "./car";
> ```

## Statement-level versus inline — the real difference

**Statement-level `import type`** says: *nothing in this statement is a value.*
The whole line disappears.

**Inline `type`** says: *this one specifier is not a value.* The statement
survives if anything else in it does.

That makes inline the form for a **mixed** import, and it is the one that solves
the elision bug from [chunk 01](./01-import-elision.md) without splitting the
statement:

```ts
// Before — Handler is type-only, so the whole line is elided and the
// module never runs.
import { Handler, register } from "./handlers/email.js";

// After — the statement survives because `register` is a value.
import { type Handler, register } from "./handlers/email.js";
```

📌 **This is the single most useful thing to know about the inline form.** People
learn `import type` first, split every mixed import into two statements, and
never discover that one line does it.

## What the forms cannot do

**A type-only import cannot have both a default and named bindings.**

```ts
import type User, { Role } from "./user.js";
//     ~~~~
// TS1363: A type-only import can specify a default import or named bindings,
//         but not both.
```

The reason is genuine ambiguity rather than pedantry: in a type-only import,
`import type Foo` already means "the default export's type", so a form that also
carried named bindings would have two plausible readings of what `type` scopes
over. The inline form has no such problem — `import Foo, { type Role }` is fine.

**A type-only import cannot carry an import attribute.**

```text
TS2857  Import attributes cannot be used with type-only imports or exports.
TS2822  Import assertions cannot be used with type-only imports or exports.
```

Two codes because attributes (`with { … }`) replaced assertions (`assert { … }`),
and both are still reachable depending on your `module` value
([topic 01, chunk 03](../01-module-and-moduleresolution/03-preserve-and-the-node-family.md)).

⚠️ **With exactly one exception**, and it is the exception that proves the rule:

```text
TS1454  `resolution-mode` can only be set for type-only imports.
```

`resolution-mode` is the *only* attribute permitted on a type-only import, and it
is permitted **only** there. It exists because a `.d.ts` in a CommonJS file
sometimes has to say "resolve this specifier as if I were an ESM file" — see
[chunk 05](./05-the-commonjs-caveat.md).

## The forms that `isolatedModules` forces on you

Two diagnostics that appear even without `verbatimModuleSyntax`, because they are
about single-file transpilation rather than emit fidelity:

```text
TS2865  Import '{0}' conflicts with local value, so must be declared with a
        type-only import when 'isolatedModules' is enabled.

TS2866  Import '{0}' conflicts with global value used in this file, so must be
        declared with a type-only import when 'isolatedModules' is enabled.
```

Both describe a shadowing situation a single-file tool cannot resolve: the name
exists both as an import and as a local or global value, and only whole-program
knowledge could say which one a given reference means. Marking the import
type-only removes the ambiguity by removing the import from the runtime entirely.

## Where the modifier goes, precisely

A table, because the placement rules are the part people get wrong:

| Intent | Spelling |
|---|---|
| Everything in this import is a type | `import type { A, B } from "m"` |
| One specifier is a type, others are values | `import { a, type B } from "m"` |
| The default export's type only | `import type A from "m"` |
| The default's type **and** a named value | `import A, { type B } from "m"` ✅ |
| The default's type **and** a named type | `import type A, { B } from "m"` ❌ `TS1363` |
| Re-export a type | `export type { A } from "m"` |
| Re-export a mix | `export { a, type B } from "m"` |
| Import a namespace for types only | `import type * as m from "m"` |
| Run a module for its side effect | `import "m"` — never elided, never `type` |

📌 The fourth and fifth rows are the whole of `TS1363`. Row four works because
the `type` is *inside* the braces and scopes to `B`; row five fails because a
statement-level `type` cannot scope over a default and a named list at once.

## Gotchas

**People split mixed imports into two statements because they never learned the
inline form.** *Symptom:* every file has an `import type { … }` immediately above
an `import { … }` from the same module. *Cause:* the 4.5 inline syntax is less
well known than the 3.8 statement form. *Fix:* one line with `type` inside the
braces. It is not just tidier — it keeps the two in sync when someone edits one.

**`import type A, { B }` is not the same as `import A, { type B }`.**
*Symptom:* `TS1363` on a line that looks reasonable. *Cause:* a statement-level
`type` cannot cover a default and named bindings together. *Fix:* use the inline
form, which can.

**Adding `assert`/`with` to a type-only import fails, and the error names a
feature you were not using.** *Symptom:* `TS2857` about import attributes.
*Cause:* attributes describe how to *load* a module, and a type-only import
never loads anything. *Fix:* if you need both the attribute and the type, they
belong on separate imports.

**`resolution-mode` looks like a general attribute and is not.** *Symptom:*
`TS1454` when adding it to an ordinary import. *Cause:* it is legal *only* on
type-only imports. *Fix:* the import it belongs on is a `import type`.

**`TS2865`/`TS2866` are about shadowing, not about types.** *Symptom:* an
`isolatedModules` error on an import that is obviously a value. *Cause:* the name
also exists as a local or a global in the same file. *Fix:* rename one of them,
or mark the import type-only if it really was type-only.

**Inline `type` is invisible to a reviewer skimming imports.** *Symptom:* a
reviewer asks why a module is imported but "unused". *Cause:* `type` inside
braces reads as part of the name. *Fix:* nothing mechanical — but it is a reason
some teams prefer the statement form despite its cost.

**A namespace import used only in type position is still elided.** *Symptom:*
`import * as validators from "./validators.js"` disappears. *Cause:* `import *`
is not a value usage; using `validators.Schema` as a type is not either. *Fix:*
`import type * as` to say so, plus a bare import if the module has side effects.

**Auto-import does not always add the modifier.** *Symptom:* the editor inserts a
plain import for something that is a type, which then errors under
`verbatimModuleSyntax`. *Cause:* editor setting. *Fix:* most editors have a
"prefer type-only auto imports" preference; turning it on removes a recurring
class of small fixes.

## Interview questions

**What is the difference between `import type { A }` and `import { type A }`?**
The first says the whole statement is type-only, so the entire line is erased.
The second marks one specifier, so the statement survives if any other specifier
is a value. The inline form is what you want for a mixed import — and it is the
one-line fix for a side effect lost to elision.

**Why can't a type-only import have both a default and named bindings?**
Because in a type-only import `import type Foo` already means the default
export's type, so a statement that also carried a named list would have two
readings of what the `type` keyword scopes over. `TS1363` rules it out. The
inline form has no ambiguity, so `import Foo, { type Bar }` is legal.

**Which import attribute is allowed on a type-only import?**
Only `resolution-mode`, and it is allowed *only* there — `TS1454` if you put it
anywhere else, `TS2857` if you put any other attribute on a type-only import. It
exists so a declaration file in a CommonJS context can ask for a specifier to be
resolved under ESM rules.

**When does `isolatedModules` force a type-only import even without
`verbatimModuleSyntax`?**
When the imported name collides with a local or global value in the same file —
`TS2865` and `TS2866`. A single-file transpiler cannot tell which binding a
reference means, and marking the import type-only removes it from the runtime
entirely, which resolves the ambiguity.

**How do you keep a module's side effect while importing only its types?**
Two statements: `import type { X } from "./m.js"` for the type and
`import "./m.js"` for the side effect. A bare import has no bindings to analyse,
so it is never elided. Alternatively, if the same statement also imports a value,
inline `type` keeps the statement alive on its own.

**Is there a reason to prefer statement-level `import type` over the inline
form?**
Reviewability, mostly. `type` inside braces reads as part of the identifier and
is easy to miss when skimming, whereas a whole `import type` line announces
itself. It is a real trade-off — the inline form keeps related specifiers
together and cannot drift out of sync — and worth deciding as a team rather than
per file.

**What happens to `import * as m` if every use of `m` is in type position?**
It is elided like any other type-only import. `import *` is not itself a value
usage, and referencing `m.Thing` as a type is not one either. Say `import type *
as m` if that is what you meant, and add a bare import if the module needs to
run.

---

← [01 · Import elision](./01-import-elision.md) · Next → [03 · `verbatimModuleSyntax`](./03-verbatim-module-syntax.md)
