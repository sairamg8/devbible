---
title: "Import elision"
sidebar_label: "01 · Import elision"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes**, section
> *`--verbatimModuleSyntax`* — the description of import elision, the
> side-effect observation and the `export { Car } from "./car"` undecidability
> example are quoted verbatim from it. **No sandbox, no console block.**

Before you can care about `import type`, you have to know what the compiler does
without it. It is more aggressive than most people realise.

## What elision is

The release notes describe it directly:

> By default, TypeScript does something called *import elision*. Basically, if
> you write something like
>
> ```ts
> import { Car } from "./car";
> export function drive(car: Car) {
>     // ...
> }
> ```
>
> TypeScript detects that you're only using an import for types and drops the
> import entirely. Your output JavaScript might look something like this:
>
> ```js
> export function drive(car) {
>     // ...
> }
> ```

Read what happened. Not "the binding was removed from the import list" —
**the statement is gone.** There is no `import "./car"` left behind.

## Why it exists, and why it is usually right

> Most of the time this is good, because if `Car` isn't a value that's exported
> from `./car`, we'll get a runtime error.

That is the whole justification, and it is a good one. `interface Car {}` exists
only in the type system. If the compiler emitted `import { Car } from "./car"`
against a module whose JavaScript has no `Car` export, the program would crash on
load. Elision is the compiler cleaning up after a language feature that has no
runtime representation.

📌 This is the erasure model from
[Phase 0](../../phase-0-how-typescript-runs/README.md) reaching all the way out
to the module system. Types do not exist at runtime, so imports *of* types must
not either.

## The first problem: side effects

The release notes flag it in one sentence, and it is the sentence this whole
topic exists for:

> But it does add a layer of complexity for certain edge cases. For example,
> notice there's no statement like `import "./car";` - the import was dropped
> entirely. That actually makes a difference for modules that have side-effects
> or not.

Concretely:

```ts
// registry.ts
import { Handler } from "./handlers/email";   //  ← also self-registers on load

export function dispatch(kind: string) {
  return registry[kind];                       //  ← Handler used only as a type
}
```

If `Handler` is an interface, this import is elided. The `./handlers/email`
module **never executes**, so it never registers, so `dispatch("email")` returns
`undefined` — in production, on a code path nobody exercised locally, from a line
of code that does not appear in the output.

**The fix, once you know:** state the side effect separately.

```ts
import type { Handler } from "./handlers/email";
import "./handlers/email";                     //  ← survives, because nothing is imported
```

⚠️ **A bare `import "x"` is never elided**, because there is no binding whose
usage could be analysed. That makes it the correct and only way to say "run this
module". Every plugin registry, polyfill and `reflect-metadata` import depends on
it.

## The second problem: the compiler cannot always decide

This is the deeper one, and it is why a *flag* was needed rather than better
inference.

> TypeScript's emit strategy for JavaScript also has another few layers of
> complexity - import elision isn't always just driven by how an import is used -
> it often consults how a value is declared as well. So it's not always clear
> whether code like the following
>
> ```ts
> export { Car } from "./car";
> ```
>
> should be preserved or dropped. If `Car` is declared with something like a
> `class`, then it can be preserved in the resulting JavaScript file. But if
> `Car` is only declared as a `type` alias or `interface`, then the JavaScript
> file shouldn't export `Car` at all.

🔴 **The decision depends on a declaration in another file.** Nothing in
`export { Car } from "./car"` tells you the answer. You have to open `./car` and
look — and if `./car` re-exports from somewhere else, you have to keep going.

And then the sentence that ends the argument:

> While TypeScript might be able to make these emit decisions based on
> information from across files, not every compiler can.

That is the case for the flag in twelve words. `tsc` builds a whole program and
can follow the chain. esbuild, SWC, Babel and Node's type stripper process **one
file at a time** and cannot — so they must either guess or refuse. What they
actually do is keep the import, which produces a runtime failure looking for an
export that was only ever a type.

The applied version of that argument, on a real Node service, is
[Phase 7 · Emit layout and programs](../../phase-7-server/01-tsconfig-for-a-node-service/05-emit-layout-and-programs.md).
This page owns the language rule; that page owns the build decision.

## What elision does *not* remove

Worth being precise, because people over-estimate it in the other direction:

| Written | Emitted |
|---|---|
| `import { Car } from "./car"` where `Car` is a class you call | kept |
| `import { Car } from "./car"` where `Car` is only a type | **dropped entirely** |
| `import { Car, drive } from "./car"`, `drive` used as a value | kept, `Car` removed from the list |
| `import "./car"` | **always kept** |
| `import * as car from "./car"`, namespace used as a value | kept |
| `import type { Car } from "./car"` | dropped, by your instruction |

📌 The third row is the one people forget: elision operates **per binding**, not
just per statement. A statement survives if any one of its bindings is a value.

## Gotchas

**A side effect can vanish because of a change in a different file.** *Symptom:*
a plugin stops registering after someone converts a `class` to an `interface`.
*Cause:* the import became type-only, so the whole statement was elided. *Fix:*
a separate bare `import "./x"` for the side effect — and note that this class of
bug has no diff to point at in the file that broke.

**"It works in `tsc` and breaks in esbuild" is almost always this.** *Symptom:*
the production bundle throws about a missing export that the dev build resolves.
*Cause:* whole-program elision versus single-file transpilation. *Fix:*
`verbatimModuleSyntax`, which makes both tools agree by removing the inference
([chunk 03](./03-verbatim-module-syntax.md)).

**Elision is per binding, so removing one usage can change the emit.**
*Symptom:* deleting a line of code changes which modules load. *Cause:* the last
value usage in an import went away, so the statement became fully type-only and
was dropped. *Fix:* nothing to fix in that commit — but it is why "I only deleted
a function call" can produce a load-order bug.

**A bare `import "x"` looks like dead code to reviewers and linters.**
*Symptom:* it gets deleted in a cleanup PR. *Cause:* it imports nothing, so it
reads as pointless. *Fix:* a comment on the line saying what side effect it is
for. This is the single most valuable comment in a codebase that uses them.

**`import * as x` is not automatically kept.** *Symptom:* a namespace import
disappears. *Cause:* if every use of `x` is in type position, the namespace is
type-only too. *Fix:* the same as any other — say so with `import type`, or add
the bare import.

**Elision interacts with decorators in ways that surprise.** *Symptom:* a
decorator-based framework loses a type it needed at runtime. *Cause:* the type
was only referenced in an annotation, so it was elided, but
`emitDecoratorMetadata` wanted it as a value. *Fix:* this is the historical
reason `preserveValueImports` existed — see
[chunk 06](./06-adopting-it.md).

## Interview questions

**What is import elision?**
TypeScript's default behaviour of deleting imports whose bindings were only ever
used in type position. Not just removing the binding — if every binding in the
statement is type-only, the entire `import` statement is dropped from the output,
including its side effect.

**Why does TypeScript do it at all?**
Because types have no runtime representation. If the compiler emitted an import
of an `interface`, the runtime would look for an export that does not exist and
crash. Elision is the module-system consequence of erasure.

**Give an example where elision causes a bug.**
An import used only for its type from a module that also registers something at
load time. The statement is elided, the module never executes, the registration
never happens, and the failure appears at a call site with no connection to the
deleted line. The fix is a separate bare `import "./x"`, which is never elided.

**Why can't a single-file transpiler do elision correctly?**
Because the decision can depend on how a name is *declared* in another file.
`export { Car } from "./car"` should be kept if `Car` is a class and dropped if
it is an interface, and nothing in that line says which. `tsc` can follow the
chain across the program; esbuild, SWC, Babel and Node's stripper see one file
and cannot.

**Is `import "./x"` ever elided?**
No. There is no binding whose usage could be analysed, so there is nothing to
infer. That makes it the reliable way to express "load this module for its side
effects" — and it is why the fix for the elision bug is to split the statement in
two.

**Does elision work per statement or per binding?**
Per binding, with the statement dropped only if every binding is type-only. So
`import { Car, drive }` with `drive` used as a value keeps the statement and
removes `Car` from the list — which means deleting the last value usage in a file
can silently change which modules load.

**Your build works with `tsc` and fails with esbuild. What is your first
hypothesis?**
Elision. `tsc` removed a type-only import that esbuild kept, or `tsc` kept a
re-export that esbuild dropped. The general fix is `verbatimModuleSyntax`, which
replaces the inference with an explicit `type` modifier that every tool can read.

---

← [Topic index](./README.md) · Next → [02 · The `type` modifier, every form](./02-the-type-modifier.md)
