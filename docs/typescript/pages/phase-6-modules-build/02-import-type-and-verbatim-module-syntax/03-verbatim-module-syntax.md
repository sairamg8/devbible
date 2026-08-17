---
title: "`verbatimModuleSyntax`"
sidebar_label: "03 · `verbatimModuleSyntax`"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (the rule
> statement and all three rewrite examples are quoted verbatim). The option
> record — `affectsEmit`, `affectsSemanticDiagnostics`, `affectsBuildInfo`,
> `category: Interop_Constraints`, `defaultValueDescription: false` — and the
> diagnostics `TS1484`, `TS1485`, `TS1286`, `TS1287`, `TS1288`, `TS1269` and
> `TS5105` were read out of the installed **TypeScript 5.9.3** build.
> **No sandbox, no console block.**

The flag exists to delete a question. Before it, "will this import survive?" was
an inference over the whole program. After it, the answer is written in the
source.

## The rule, in one sentence

> The rules are much simpler: **any imports or exports without a `type` modifier
> are left around. Anything that uses the `type` modifier is dropped entirely.**

The release notes' own worked examples:

> ```ts
> // Erased away entirely.
> import type { A } from "a";
>
> // Rewritten to 'import { b } from "bcd";'
> import { b, type c, type d } from "bcd";
>
> // Rewritten to 'import {} from "xyz";'
> import { type xyz } from "xyz";
> ```

🔴 **Look at the third example.** `import { type xyz } from "xyz"` becomes
`import {} from "xyz"` — an import of nothing, which still **loads the module**.
That is the flag's philosophy made concrete: you wrote a statement without a
`type` modifier on the statement, so a statement survives. Under elision it would
have vanished, side effect and all.

The release notes summarise it in five words, and they are the reason to adopt
it:

> With this new option, what you see is what you get.

## What the compiler's own record says

```text
name: "verbatimModuleSyntax"
type: "boolean"
affectsEmit: true
affectsSemanticDiagnostics: true
affectsBuildInfo: true
category: Interop Constraints
defaultValueDescription: false
```

Three things worth extracting:

- **`affectsEmit` *and* `affectsSemanticDiagnostics`.** It is not a lint rule
  bolted on — it changes the output and the errors. That is why turning it on can
  change behaviour, not just add red squiggles.
- **`category: Interop Constraints`**, alongside `esModuleInterop`,
  `allowSyntheticDefaultImports` and `isolatedDeclarations`. The compiler files it
  as a *constraint you accept for the benefit of other tools*, which is exactly
  what it is.
- **`defaultValueDescription: false`.** Off by default, in every configuration,
  including `strict`. It appears in all three of the handbook's recommended
  configs ([topic 01, chunk 11](../01-module-and-moduleresolution/11-choosing-and-migrating.md))
  and in almost no real project's, which is the gap this topic is trying to
  close.

## The five errors it adds to imports

Two are the everyday ones:

```text
TS1484  '{0}' is a type and must be imported using a type-only import when
        'verbatimModuleSyntax' is enabled.

TS1485  '{0}' resolves to a type-only declaration and must be imported using a
        type-only import when 'verbatimModuleSyntax' is enabled.
```

📌 **The distinction between them is worth internalising**, because it recurs
across the whole family. `TS1484` — *"is a type"* — means the thing you imported
is an `interface` or a `type` alias. `TS1485` — *"resolves to a type-only
declaration"* — means it is a perfectly good value *somewhere*, but the module
you imported it from re-exported it with `export type`, so from here it is
type-only. The first is about what the thing is; the second is about how it
travelled.

That second case is the one that surprises people, because the fix is not
obviously in your file: someone else marked the re-export type-only, and now your
import must match. It is the reason [chunk 04](./04-re-exports.md) exists.

Then the three about aliases and CommonJS files:

```text
TS1288  An import alias cannot resolve to a type or type-only declaration when
        'verbatimModuleSyntax' is enabled.

TS1269  Cannot use 'export import' on a type or type-only namespace when '{0}'
        is enabled.

TS1287  A top-level 'export' modifier cannot be used on value declarations in a
        CommonJS module when 'verbatimModuleSyntax' is enabled.
```

`TS1288` is about `import Foo = Bar.Baz` — the alias form. `TS1269` is the
namespace-export version, and note its `{0}`: it is shared with
`isolatedModules`, so the same error text serves two flags. `TS1287` belongs to
[chunk 05](./05-the-commonjs-caveat.md).

## What it makes impossible

One configuration is ruled out entirely:

```text
TS5105  Option 'verbatimModuleSyntax' cannot be used when 'module' is set to
        'UMD', 'AMD', or 'System'.
```

🔴 **That is a coherent consequence rather than an arbitrary restriction.** The
flag's promise is that your import and export statements are emitted *verbatim*,
in the output file's format. UMD, AMD and System have no verbatim form for an ES
import — every statement must be rewritten into `define(…)` or
`System.register(…)`. There is nothing for the flag to preserve, so it is
refused.

📌 Read the other way, this is a useful signal: if `verbatimModuleSyntax` cannot
be enabled in your project, your `module` value is one the handbook already tells
you not to use ([topic 01, chunk 02](../01-module-and-moduleresolution/02-every-module-value.md)).

## What it does not do

It does **not** make your imports correct. It makes them *honest*.

- It will not tell you an import is unnecessary — that is `noUnusedLocals`.
- It will not add the `type` modifier for you — though every editor's quick fix
  will, and `TS95182: "Fix all with type-only imports"` is a real code action in
  the compiler's table.
- It does not subsume `isolatedModules`. It covers most of the same import/export
  ground, but `isolatedModules` additionally catches things like `const enum`
  across file boundaries. Both on is the normal answer; the differences are
  **Phase 6 · 05 · `isolatedModules`** *(not written yet)*.

## Gotchas

**Enabling it changes emit, not just errors.** *Symptom:* behaviour changes in a
commit that "only turned on a flag". *Cause:* `affectsEmit: true` — imports that
were being elided now survive, so modules that were not loading now load. *Fix:*
this is usually a fix, not a regression, but it belongs in its own commit so it
can be reverted independently.

**`TS1485` points at a file you did not write.** *Symptom:* an error saying your
import "resolves to a type-only declaration" for something that is plainly a
class. *Cause:* an intermediate module re-exported it with `export type`. *Fix:*
either mark your import type-only, or fix the intermediate re-export — and the
second is often the right answer, because the intermediate one may be wrong.

**It is off under `strict`.** *Symptom:* a team assumes `strict: true` covers it.
*Cause:* it is an interop constraint, not a type-safety flag, so `strict` does
not touch it. *Fix:* set it explicitly. Its absence from a `strict` project is
not evidence of a decision.

**A project on `module: "umd"` cannot enable it at all.** *Symptom:* `TS5105`.
*Cause:* UMD/AMD/System have no verbatim form for ES module syntax. *Fix:* the
real fix is the `module` value; the flag is telling you something true about the
project.

**The error count on first enabling is proportional to the codebase, not to the
number of bugs.** *Symptom:* hundreds of `TS1484`s. *Cause:* every type-only
import in the project needs a modifier. *Fix:* the editor's fix-all code action
handles nearly all of it mechanically; budget an afternoon and one large,
boring, reviewable diff.

**Auto-import will keep reintroducing plain imports.** *Symptom:* the same fix
recurring in review. *Cause:* the editor's auto-import preference. *Fix:* turn on
the editor's type-only auto-import setting at the same time as the flag, or the
flag will feel like a permanent tax.

**`import {} from "m"` looks like a mistake to everyone.** *Symptom:* someone
deletes it. *Cause:* it is genuinely unusual-looking output, and it can also
appear in source. *Fix:* if you mean "load this module", write `import "m"` — it
is the same thing and it reads as intentional.

**Turning it on does not let you delete `isolatedModules`.** *Symptom:* a new
`const enum` error after removing the other flag. *Cause:* the two overlap but do
not nest. *Fix:* keep both.

## Interview questions

**State `verbatimModuleSyntax`'s rule in one sentence.**
Any import or export without a `type` modifier is left in the output; anything
with a `type` modifier is dropped entirely. It replaces a whole-program inference
with an explicit declaration, so what you see is what you get.

**What does `import { type xyz } from "xyz"` emit under the flag?**
`import {} from "xyz"` — an import of nothing that still loads the module. Under
default elision the whole statement would have vanished, taking the module's side
effect with it. That example is the clearest single demonstration of what the
flag changes.

**What is the difference between `TS1484` and `TS1485`?**
`TS1484` says the thing you imported *is* a type — an interface or type alias.
`TS1485` says it resolves to a *type-only declaration*: it may be a real value
elsewhere, but the module you imported it from re-exported it with `export type`.
The first is about what it is, the second about how it reached you — and the
second's fix may belong in the intermediate module, not yours.

**Why is `verbatimModuleSyntax` incompatible with `module: "umd"`?**
Because there is nothing to preserve verbatim. UMD, AMD and System have no form
of an ES import statement — every one must be rewritten into a loader call — so
the flag's guarantee cannot be honoured. `TS5105` says so directly, and it is a
signal that the `module` value is itself the problem.

**Does `strict: true` enable it?**
No. The compiler files it under *Interop Constraints*, not type safety, and its
default is `false` in every configuration. Its absence from a strict project
tells you nothing about whether anyone considered it.

**Is it a lint rule?**
No, and this matters when planning the change: its option record sets both
`affectsEmit` and `affectsSemanticDiagnostics`, so it changes the JavaScript that
gets produced as well as the errors reported. Enabling it can make a module start
loading that previously did not.

**Does it replace `isolatedModules`?**
No. It covers most of the same import and export rules, but `isolatedModules`
catches additional single-file hazards such as `const enum` across file
boundaries. Running both is the normal configuration and the handbook's recipes
assume it.

**How would you roll it out on a large codebase?**
As its own commit, with nothing else in it, using the editor's fix-all code
action for the mechanical `type` modifiers. Turn on type-only auto-imports in the
editor at the same time so the change does not immediately start eroding. And
review the `TS1485`s separately from the `TS1484`s — those may indicate a
mis-marked re-export upstream rather than a missing modifier locally.

---

← [02 · The `type` modifier](./02-the-type-modifier.md) · Next → [04 · Re-exports, the hardest case](./04-re-exports.md)
