---
title: "Adopting it"
sidebar_label: "06 · Adopting it"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. The deprecation statement is verbatim from the **TypeScript
> 5.0 release notes**; the `importsNotUsedAsValues` and `preserveValueImports`
> option records — including `category: Backwards_Compatibility` and their
> defaults — were read out of the installed **TypeScript 5.9.3** build. The
> recommended configs are verbatim from the **handbook**, *Modules — Choosing
> Compiler Options*. **No sandbox, no console block.**

Five chunks of rules. This is what to do on Monday.

## The two flags it replaced

Before 5.0 there were two partial answers, and knowing them is useful because you
will meet them in old configs and because their shapes explain why a third flag
was needed.

**`importsNotUsedAsValues`** — three values, from the option record:

| Value | Behaviour |
|---|---|
| `remove` | The default. Elide type-only imports (classic behaviour) |
| `preserve` | Keep the statement, drop the bindings — i.e. emit `import "m"` |
| `error` | Report when an import could have been written `import type` |

**`preserveValueImports`** — a boolean, whose description reads *"Preserve unused
imported values in the JavaScript output that would otherwise be removed."* It
existed for the case where a value is referenced only somewhere the compiler
cannot see — a template string in a framework, or `emitDecoratorMetadata`.

The deprecation, verbatim:

> Because `--verbatimModuleSyntax` provides a more consistent story than
> `--importsNotUsedAsValues` and `--preserveValueImports`, those two existing
> flags are being deprecated in its favor.

📌 **Both are filed under `category: Backwards_Compatibility` in the compiler**,
which is where `keyofStringsOnly`, `suppressExcessPropertyErrors` and the other
"we regret this" options live. That categorisation is the compiler's own verdict.

🔴 **Why they were not enough:** each described what to do with an import *after*
the compiler had decided its nature. Neither removed the decision. `preserve`
still needed whole-program knowledge to know which bindings to drop;
`preserveValueImports` still needed it to know what counted as "unused".
`verbatimModuleSyntax` is different in kind — it moves the decision into the
source text, where any tool can read it.

## The rollout

**1. Turn on `isolatedModules` first, if it is not on.** It is the smaller change
and it catches the same class of problem from a different angle. Its errors are a
subset of the work you are about to do anyway.

**2. Turn on the editor's type-only auto-import preference.** Do this *before*
the flag, not after. Otherwise every new file adds work and the migration erodes
while you do it. In VS Code the setting is under
`typescript.preferences.preferTypeOnlyAutoImports`.

**3. Enable `verbatimModuleSyntax` in its own commit, with nothing else in it.**
It sets `affectsEmit`, so it can change behaviour
([chunk 03](./03-verbatim-module-syntax.md)); a commit that changes emit should be
revertible on its own.

**4. Run the fix-all code action, not a manual pass.** The compiler ships
`TS95182: "Fix all with type-only imports"` and
`TS1365: "Convert all re-exported types to type-only exports"`. Most of the diff
is mechanical.

**5. Review the `TS1485`s separately.** Everything else is "add a modifier here".
`TS1485` — *resolves to a type-only declaration* — means something upstream marked
a value as type-only, and the correct fix may be in that file rather than yours
([chunk 04](./04-re-exports.md)).

**6. Deal with the CommonJS files last**, because they are a different decision
and not a mechanical one ([chunk 05](./05-the-commonjs-caveat.md)).

⚠️ **The one ordering mistake that costs a day:** enabling the flag in the same
commit as a `module` or `"type": "module"` change. Then `TS1286` (this file is
CommonJS) and `TS1484` (this is a type) arrive together, and neither is
diagnosable in the presence of the other.

## When the answer is genuinely no

Three cases where not adopting it is defensible:

- **`module` is `umd`, `amd` or `system`.** `TS5105` forbids it outright. The
  real work is the `module` value.
- **A large CommonJS codebase with no migration budget.** The flag would demand
  `import x = require()` throughout, which is a bigger and less useful change
  than the one it prevents. Keep `isolatedModules` on instead — it catches the
  overlapping cases without the emit constraint.
- **`tsc` is genuinely the only thing that ever compiles your code**, including
  in tests, tooling and any editor-driven build. Then whole-program elision is
  reliable, and the flag buys predictability rather than correctness. That is
  still worth having, but it is a preference rather than a fix.

📌 Note that the third case is rarer than teams think. Jest with SWC, Vitest with
esbuild, `tsx`, `ts-node --swc` and Node's own type stripper are all single-file
transpilers, and most projects have at least one of them somewhere.

## Where it appears in the handbook's own configs

All three recommended configurations set it — bundler, Node.js and library — and
the library rationale is the most quotable:

> `verbatimModuleSyntax: true` — This setting protects against a few
> module-related pitfalls…it prevents writing any import statements that could be
> interpreted ambiguously based on the user's value of `esModuleInterop` or
> `allowSyntheticDefaultImports`.

🔴 **Read that reason carefully, because it is a different one from the rest of
this topic.** For a *library*, the flag is not primarily about elision — it is
about not writing imports whose meaning depends on flags your *consumer*
controls. A library author cannot know the consumer's `esModuleInterop` setting,
so writing an import that means different things under different values of it is
shipping ambiguity.

## The one-line summary per project type

| Project | Setting |
|---|---|
| New anything | On, from the first commit. It costs nothing before there is code |
| Bundled app | On — the bundler is a single-file transpiler |
| Node service compiled by `tsc` | On — and required if Node strips types ([Phase 7](../../phase-7-server/01-tsconfig-for-a-node-service/05-emit-layout-and-programs.md)) |
| Published library | On — for the consumer-ambiguity reason above, not the elision one |
| Legacy CommonJS, no budget | `isolatedModules` only, and revisit when the module format does |

## Gotchas

**`importsNotUsedAsValues` and `preserveValueImports` in a config are a sign, not
a problem.** *Symptom:* deprecated-option warnings. *Cause:* the config predates
5.0. *Fix:* replace both with `verbatimModuleSyntax` — but note it is not a
drop-in, because it also adds the CommonJS constraint they never had.

**Enabling the flag alongside a format change makes both undiagnosable.**
*Symptom:* an error list you cannot reason about. *Cause:* `TS1286` and `TS1484`
interleaved. *Fix:* two commits, format first.

**Skipping the editor preference makes the migration permanent.** *Symptom:* the
same class of fix appearing in review for months. *Cause:* auto-import keeps
adding plain imports. *Fix:* the editor setting, ideally repo-wide in
`.vscode/settings.json`.

**"We only use `tsc`" is usually false.** *Symptom:* a team declines the flag,
then hits an elision bug in the test runner. *Cause:* Vitest, Jest+SWC, `tsx` and
`ts-node --swc` are all single-file. *Fix:* audit what actually transpiles your
code, including in CI and in tests, before concluding you are safe.

**The library reason is not the app reason, and using the wrong one loses the
argument.** *Symptom:* a library maintainer unconvinced by an elision example
they have never hit. *Cause:* for a library the point is consumer-side ambiguity
around `esModuleInterop`. *Fix:* use the handbook's own wording.

**A fix-all action can mark a value type-only if the file is already wrong.**
*Symptom:* a clean build and a runtime failure after the migration commit.
*Cause:* the action trusts the current resolution, and an upstream
`export type` on a value propagates. *Fix:* this is why `TS1485` gets a separate
review pass — it is the one class the automation can entrench.

**Deprecated does not mean removed, so nothing forces the change.** *Symptom:* a
config still carrying both old flags in 2026. *Cause:* they still work. *Fix:*
none required, but `category: Backwards_Compatibility` is the compiler telling
you where they sit.

## Interview questions

**What did `verbatimModuleSyntax` replace, and why were the old flags not
enough?**
`importsNotUsedAsValues` and `preserveValueImports`. Both described what to do
with an import *after* the compiler had decided whether it was type-only — so
both still required whole-program knowledge. `verbatimModuleSyntax` is different
in kind: it moves the decision into the source, where a single-file tool can read
it.

**How would you roll the flag out on a large codebase?**
`isolatedModules` first, then the editor's type-only auto-import preference, then
the flag in its own commit because it affects emit. Use the fix-all code action
for the mechanical modifiers, review the `TS1485`s separately because their fix
may be upstream, and handle CommonJS files last as a separate decision.

**Why does the handbook recommend it for libraries?**
Not for elision — for consumer-side ambiguity. It *"prevents writing any import
statements that could be interpreted ambiguously based on the user's value of
`esModuleInterop` or `allowSyntheticDefaultImports`"*. A library author does not
control those settings, so an import whose meaning depends on them is shipped
ambiguity.

**When is it reasonable not to enable it?**
When `module` is `umd`/`amd`/`system` and the compiler forbids it; when a large
CommonJS codebase would need rewriting in `import x = require()` for a smaller
benefit than the cost; and when `tsc` truly is the only thing that ever compiles
the code — which is rarer than teams believe once you count the test runner.

**Which single ordering mistake makes the migration painful?**
Enabling the flag in the same commit as a `module` or `"type": "module"` change.
Format errors (`TS1286`) and modifier errors (`TS1484`) then arrive together and
neither is diagnosable while the other is present.

**What does `category: Backwards_Compatibility` tell you about a compiler
option?**
That the compiler team considers it a legacy accommodation rather than a feature.
`importsNotUsedAsValues`, `preserveValueImports`, `keyofStringsOnly` and
`suppressExcessPropertyErrors` share the category — it is the compiler's own
verdict on an option, available without reading a single blog post.

**Your team says "we only use `tsc`, so we do not need it." How do you check?**
Audit everything that transpiles the code, not just the build: the test runner
(Vitest and Jest+SWC are single-file), any `tsx`/`ts-node --swc` scripts, the dev
server, and whether anything runs `.ts` through Node's stripper. One single-file
transpiler anywhere in the pipeline makes the flag a correctness matter rather
than a preference.

---

← [05 · The CommonJS caveat](./05-the-commonjs-caveat.md) · Back to [the topic index](./README.md) · Next topic → **03 · Path aliases (`paths`)** *(not written yet)*
