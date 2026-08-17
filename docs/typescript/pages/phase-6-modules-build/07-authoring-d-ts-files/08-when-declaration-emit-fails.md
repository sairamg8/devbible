---
title: "When declaration emit fails"
sidebar_label: "06 · When emit fails"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — every diagnostic below is read out of the compiler's own
> message table (installed **TypeScript 5.9.3**), and the `TS9005`/`TS9006`
> wording is cross-checked against the **7.0.2** native binary. 🔴 The claim that
> `TS9005`/`TS9006` come from the **JavaScript** declaration path is read from
> the emitter source — `transformDeclarationsForJS` in
> `src/compiler/transformers/declarations.ts` is their only call site in the
> installed 5.9.3 build. **No sandbox, no console blocks.**

Turn on `declaration` and a codebase that compiled cleanly for years will produce
errors. They are not new bugs and they are not the flag being fussy — they are a
different question being asked for the first time.

## The question declaration emit asks

Ordinary compilation only has to **check** a type. Declaration emit has to
**write it down**, in a different file, using only names that file can reach.

```ts
// src/service.ts
import { Client } from 'some-db';

const client = new Client();

export function getClient() {
  return client;          // inferred: Client
}
```

The emitter must produce a `.d.ts` that says what `getClient` returns. To do
that it needs to *name* `Client` in the output — which means the output file
needs an import for it, from a specifier that will still resolve for your
consumers. When it cannot arrange that, it stops and tells you.

🔴 **The universal fix is the same in almost every case: write the annotation
down yourself.** Once you have said `export function getClient(): Client`, the
emitter has a name to copy instead of a type to invent, and the import it needs
is one you already wrote.

## Group A — "has or is using private name"

The type is *reachable* but not *exported*, so the declaration file cannot refer
to it. Four members of the family, differing only in where the offending type
appears:

> **TS4025:** *"Exported variable '{0}' has or is using private name '{1}'."*
> **TS4081:** *"Exported type alias '{0}' has or is using private name '{1}'."*
> **TS4020:** *"'extends' clause of exported class '{0}' has or is using private
> name '{1}'."*
> **TS4060:** *"Return type of exported function has or is using private name
> '{0}'."*

```ts
interface Config { retries: number }        // ← not exported

export function load(): Config {            // ❌ TS4060
  return { retries: 3 };
}
```

**Fix:** export `Config`. "Private" here means *not exported from this module* —
nothing to do with the `private` keyword. If you genuinely do not want it in the
public API, the return type has to change; you cannot have an unexported type on
an exported signature.

⚠️ **This is the flag doing its job.** Every one of these is a real hole: your
consumers can call `load()` and have no way to name what they got back.

## Group B — "cannot be named"

The type *is* exported — but from somewhere the output file cannot reach. This is
the group that breaks monorepos and pnpm installs, and `TS2742` is the one you
will actually meet:

> **TS2742:** *"The inferred type of '{0}' cannot be named without a reference to
> '{1}'. This is likely not portable. A type annotation is necessary."*
> **TS4023:** *"Exported variable '{0}' has or is using name '{1}' from external
> module {2} but cannot be named."*
> **TS4053:** *"Return type of public method from exported class has or is using
> name '{0}' from external module {1} but cannot be named."*

Read `TS2742`'s wording carefully, because it tells you the whole story: *"cannot
be named **without a reference to**"* a specifier, and *"this is likely not
**portable**"*. The compiler could write the type — by importing from a path like
`../../node_modules/.pnpm/some-db@1.0.0/node_modules/some-db` — but that path is
an artefact of *your* install layout and will not exist for a consumer.

**When it fires:**

- **pnpm and strict node_modules layouts**, where a transitive dependency's types
  are not addressable by a bare specifier from your package.
- **A library that re-exports a type from a package you did not declare as a
  dependency.** You use its API, so the type leaks into your inferred signatures,
  but you have no import path to it.
- **A monorepo package returning a type owned by a sibling** you depend on only
  through the workspace root.

**Fixes, in order of preference:**

1. **Annotate explicitly** and import the type yourself. The import you add is
   the reference the compiler said it needed.
2. **Add the package as a direct dependency**, so a bare specifier resolves.
3. **Do not leak the type** — wrap it, or return your own interface.

## The rest of the family

Groups A and B are the two you will meet weekly. There are three more — types the
emitter can *reach* but cannot *write down*, augmentations split across files, and
the JavaScript-specific pair — plus the reason the whole family exists and the
`any` shortcut that is not one. They are
[chunk 09](./09-the-rarer-emit-failures.md).

## Gotchas

**Symptom:** `TS4060: Return type of exported function has or is using private
name 'Config'.`
**Cause:** The type is declared in your module but not exported.
**Fix:** `export interface Config`. "Private" means unexported, not the `private`
keyword.

**Symptom:** `TS2742: The inferred type of 'x' cannot be named without a
reference to '…/node_modules/…'`.
**Cause:** The type lives in a package your output file cannot address portably —
classically a pnpm or monorepo layout.
**Fix:** Annotate explicitly and import the type, or add the package as a direct
dependency. Do not disable `declaration`.

**Symptom:** `TS2742` mentions a package you have never heard of.
**Cause:** A dependency's return type leaked through your inferred signature.
**Fix:** Add it as a direct dependency, or stop leaking it — return your own
type.

**Symptom:** These errors appeared the day someone turned on `composite`.
**Cause:** `composite` implies `declaration`
([chunk 04](./04-generated-or-handwritten.md)).
**Fix:** Fix them — they are real API holes. Turning `declaration` back off ships
a package with no usable types.

## Interview questions

**★ Why does turning on `declaration` produce errors that normal compilation
never reported?**
Because checking a type and *writing it down* are different jobs. Emit has to
name every exported type in a separate output file using specifiers that will
resolve for consumers. Types that are unexported, unreachable, cyclic or simply
too large are checkable but not printable.

**★ What does `TS2742` actually mean?**
That the inferred type could only be written by referencing a path specific to
your install layout — so the compiler refuses, because the resulting `.d.ts`
would not be portable. It is most common under pnpm and in monorepos. The fix is
an explicit annotation with an import you control, or making the package a direct
dependency.

**★ What is the single fix that resolves most of this family?**
Writing the type annotation explicitly on the exported declaration. The compiler
says so itself — *"A type annotation is necessary"*, *"An explicit type
annotation may unblock declaration emit"*. It replaces a type the emitter has to
invent a name for with a name you already imported.

**★ "Private name" in `TS4025`/`TS4060` — private in what sense?**
Not exported from the module. It has nothing to do with the `private` keyword. An
exported signature that mentions an unexported type is a real hole: consumers can
obtain the value and cannot name its type.

---

← Prev: [07 · `declare module`, and choosing](./07-declare-module-and-choosing.md) · Next → [09 · The rarer emit failures](./09-the-rarer-emit-failures.md)
