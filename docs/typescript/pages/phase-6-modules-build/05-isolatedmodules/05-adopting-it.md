---
title: "05 — Adopting it"
sidebar_label: "05 · Adopting it"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** and the diagnostic
> behaviour established in chunks 02–04, all read from the installed **TypeScript
> 5.9.3** build. **No sandbox, no console blocks.**

Turning the flag on is a one-line edit followed by a finite list of mechanical
fixes. What makes it worth planning is that the list is **not uniformly
mechanical** — one item on it changes runtime behaviour, and it is worth knowing
which before you start.

## The order that works

**1 · Set `moduleDetection: "force"` first.**

It removes an entire rule (TS1280, namespaces in script files) before you ever
see it, by making every file a module. It is also what `tsc --init` writes, and
it is already the default under the Node family of `module` values. Doing this
first means one fewer category of error in the diff you are about to read.

**2 · Turn the flag on and read the whole error list before fixing anything.**

Sort it by diagnostic code. That partitions the work by cost:

| Codes | Cost | Notes |
|---|---|---|
| TS1205, TS1289–1292, TS1448, TS1269 | **two tokens** | add `type` in the right place |
| TS2865, TS2866 | two tokens | `import type`, but check the shadowed name first |
| TS18055, TS18056 | one literal | write the value the checker already knows |
| TS1272 | judgement | decorator metadata — not always safe to make type-only |
| **TS2748** | 🔴 **behaviour** | ambient `const enum` — chunk 03 |

**3 · Fix everything except TS2748 and TS1272.** These are pure syntax and can be
done in one pass, in any order, by anyone.

**4 · Handle TS1272 with care.** A type used only in a signature can become
`import type`. A type used for **dependency injection** cannot — the decorator
metadata needs the runtime value, which is the whole point. Getting this wrong in
a NestJS codebase produces a container that resolves `undefined` at startup, and
the error is a long way from the import.

**5 · Handle TS2748 last, and treat it as a change, not a fix.** Chunk 03's four
options, in order: plain `enum`, `as const` object, literal union, or accept the
emit. If the ambient `const enum` belongs to a dependency, none of them is
available and the conversation is with the package.

## Do it before you need it

The single most useful thing about this flag is **when** the errors arrive.

Enable it during a quiet week and the work is a hundred `export type` edits that
a reviewer can approve at a glance. Enable it *as part of* switching to esbuild
and the same hundred edits arrive mixed into a build migration, alongside
whatever else that migration broke — and any one of them could be the reason
tests fail.

🔴 **Worse, without the flag those cases do not surface as errors at all.** They
surface as `undefined` at runtime, in whichever module happened to re-export a
type. There is no build failure to lead you to them.

## Where it fits with everything else in this phase

`isolatedModules` is the **weakest** of the three related guarantees, and the
weakest is the one to adopt first:

| Guarantee | Says | Cost |
|---|---|---|
| `isolatedModules` | each file is independently emittable | a handful of `export type` edits |
| `verbatimModuleSyntax` | …and the emit is exactly what you wrote | above, plus import-form discipline |
| `erasableSyntaxOnly` | …and nothing you write emits code | above, plus no enums, no namespaces, no `import =`, no parameter properties |

Each strictly contains the one above it. Adopting them in that order means each
step's errors are a subset of the next step's, and no step is ever revisited.

⚠️ **Do not start at `erasableSyntaxOnly` because it sounds most modern.** It is
the right destination if you intend to run TypeScript directly on Node, and it is
a large change for a codebase using enums or decorators — which is most codebases
older than about two years.

## When you would leave it off

Rare, but honest cases exist:

- **A codebase built on ambient `const enum` from a vendor**, where the fix is
  genuinely blocked upstream. Leaving the flag off is preferable to re-declaring
  a dozen vendor constants that can drift.
- **A `emitDecoratorMetadata` codebase mid-migration to standard decorators**,
  where TS1272 would be churn on code that is about to be rewritten.

In both cases, write down *why* in the config, next to the missing flag. An
absent flag with no comment reads as an oversight, and the next person will turn
it on.

## The audit questions for an unfamiliar project

1. **Is the computed value on?** Look for `verbatimModuleSyntax` too — chunk 04.
2. **Is anything already transpiling?** Jest, Vite, Next.js, `tsx`, Bun, `--experimental-strip-types`.
   If yes, the flag is not hypothetical and the code may already be miscompiling.
3. **Are there ambient `const enum`s in `node_modules`?** That is the one item
   with a real cost, so price it before promising a date.
4. **Is `emitDecoratorMetadata` on?** Then TS1272 is coming and it is not a
   mechanical rewrite.
5. **Is `moduleDetection` set?** If not, TS1280 will appear in files nobody
   thinks of as special.

## Gotchas

**Symptom:** the migration PR is enormous.
**Cause:** you turned on `isolatedModules`, `verbatimModuleSyntax` and
`erasableSyntaxOnly` together.
**Fix:** one at a time, weakest first. Each is separately reviewable.

**Symptom:** tests pass, and the app fails at startup with an undefined
dependency.
**Cause:** a TS1272 fix made an injection token `import type`, so the metadata
emitted nothing.
**Fix:** revert that one import. Types used for injection must remain value
imports.

**Symptom:** you fixed a TS1448 with `export type` and a consumer broke.
**Cause:** TS1448's subject is a *value*; the type-only marking was upstream.
Chunk 02's pair.
**Fix:** remove the `import type` in the file that resolves it, not here.

**Symptom:** the error count went up after enabling `moduleDetection: "force"`.
**Cause:** files that were scripts are now modules, so their previously-global
declarations no longer resolve across files.
**Fix:** real, and worth finding — but do it as its own change, before the flag,
which is why it is step 1.

**Symptom:** a colleague reports errors you do not see.
**Cause:** different editor TypeScript version, or the editor resolving a
different `tsconfig.json`.
**Fix:** pin the workspace TypeScript version. Several of these diagnostics are
recent enough for the version to matter.

**Symptom:** enabling the flag changed bundle size.
**Cause:** `preserveConstEnums`, computed on. Chunk 03.
**Fix:** convert the hot `const enum`s to `as const` objects if it matters;
otherwise accept it.

**Symptom:** CI is clean and the dev server shows different behaviour.
**Cause:** CI runs `tsc`; the dev server transpiles. That divergence is the exact
thing the flag removes.
**Fix:** turn it on, and treat any remaining divergence as a tooling bug worth
reporting.

**Symptom:** you turned it on, got zero errors, and doubt it is working.
**Cause:** likely genuine — codebases written with `import type` throughout have
nothing to fix.
**Fix:** confirm by introducing `export { SomeType } from "./x"` in a scratch
file; you should get TS1205.

## Interview questions

**In what order would you adopt these flags?**
`isolatedModules`, then `verbatimModuleSyntax`, then `erasableSyntaxOnly`. Each
strictly contains the previous one, so no step is revisited.

**What is the first thing you would set, and why?**
`moduleDetection: "force"`, because it eliminates TS1280 entirely before the
migration starts and is what `tsc --init` writes anyway.

**Which of the flag's errors is not a mechanical fix?**
TS2748, ambient `const enum`, because the fix changes emitted behaviour rather
than syntax — and TS1272, decorator metadata, because a type used for injection
must stay a value import.

**Why adopt it before switching build tools rather than during?**
Because the same edits arrive either as a reviewable syntax-only PR or as noise
inside a build migration. And without the flag the affected code does not error
at all — it produces `undefined` at runtime.

**How would you audit an unfamiliar project for readiness?**
Check the computed value including `verbatimModuleSyntax`; check whether anything
already transpiles; look for ambient `const enum` in dependencies; check
`emitDecoratorMetadata`; check `moduleDetection`.

**When is leaving it off defensible?**
When a vendor's ambient `const enum` blocks the fix, or when an
`emitDecoratorMetadata` codebase is mid-migration to standard decorators. Both
deserve a comment in the config explaining the absence.

**You enable it and get zero errors. What does that tell you?**
Probably that the codebase already uses `import type` consistently. Verify with a
deliberate `export { SomeType } from "./x"`, which should produce TS1205.

## Where this connects

- **← [Topic 02 · `import type` and `verbatimModuleSyntax`](../02-import-type-and-verbatim-module-syntax/README.md)**
  — the flag that implies this one, argued in full including the elision
  behaviour and the CommonJS caveat.
- **← [Topic 01 · `moduleDetection`](../01-module-and-moduleresolution/07-the-defaults-you-did-not-set.md)**
  — why `force` is already the default under the Node family, and what `auto`
  actually does.
- **→ [Phase 7 · The module format](../../phase-7-server/01-tsconfig-for-a-node-service/02-the-module-format.md)**
  — `erasableSyntaxOnly` argued on a real Node service, where it is a
  prerequisite rather than a preference.
- **← [Phase 4 · Decorators](../../phase-4-classes-declarations/13-decorators.md)**
  — why `emitDecoratorMetadata` codebases cannot simply move, which is the
  context for TS1272.

---

← [04 · And `verbatimModuleSyntax`](./04-and-verbatim-module-syntax.md) · [Topic index](./README.md)
