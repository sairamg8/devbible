---
title: "Choosing it, and turning it on"
sidebar_label: "05 · Choosing and migrating"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** for `esModuleInterop`,
> `allowSyntheticDefaultImports`, `verbatimModuleSyntax` and `importHelpers`, and
> the compiler's **computed-option table** for the defaults (installed
> **TypeScript 5.9.3**). **No sandbox, no console blocks.**

The decision, and the migration — which is the part that surprises people,
because `esModuleInterop` moves in **both** directions at once.

## First: check whether you already have it

Before deciding anything, establish the current state. From
[chunk 02](./02-the-two-flags.md):

| If your config has… | Then… |
|---|---|
| `"module": "node16"` / `"node18"` / `"node20"` / `"nodenext"` / `"preserve"` | `esModuleInterop` is **on**, unless explicitly set |
| `"moduleResolution": "bundler"` | `allowSyntheticDefaultImports` is **on** |
| `"module": "system"` | `allowSyntheticDefaultImports` is **on** |
| An explicit `"esModuleInterop": false` | It is **off**, and that beats every default above |

⚠️ **A surprising number of "should we enable interop?" discussions are about a
project that already has it.** Establish the fact first; `tsc --showConfig`
prints the resolved configuration.

## The decision

**Ask one question: who emits the JavaScript you actually run?**

- **`tsc` does** → `esModuleInterop`. You want the helpers, because nothing else
  is going to perform the interop.
- **A bundler does** (Vite, webpack, esbuild, Rollup) → `allowSyntheticDefaultImports`
  is sufficient, and with `moduleResolution: bundler` you may already have it.
  Running `esModuleInterop` as well means two implementations of the same
  convention in one pipeline ([chunk 03](./03-the-emit.md)).
- **You are publishing a library** → `esModuleInterop`, and read the section
  below, because this one leaks.

🔴 **When in doubt, `esModuleInterop`.** It is the flag whose behaviour is
self-contained: what it promises, it also implements. The type-only flag is a
promise that something *else* will implement it, and it is only correct when you
can name that something.

## What breaks when you turn it on

This is the part worth planning for. `esModuleInterop` **allows** something that
was an error and **forbids** something that worked:

### It allows: default imports of CommonJS

```ts
import express from 'express';     // was TS1259 / TS2596, now fine
```

That is the reason people turn it on, and it needs no migration work.

### 🔴 It forbids: calling or constructing a namespace import

```ts
import * as express from 'express';
const app = express();             // ← was fine, now TS2497
```

Because with the flag on, `import * as` is modelled as a real ES module namespace
object, which the specification says is neither callable nor constructible
(chunk 01). **This is a correctness improvement that presents as a wave of new
errors**, and in an old codebase it can be a large one — every
`import * as` of a CommonJS package that is then called.

**The fix is mechanical and safe:**

```ts
import express from 'express';     // default import
import * as path from 'path';      // fine — never called, only its members used
```

📌 **Only the *called* or *constructed* namespace imports need changing.** An
`import * as path from 'path'` that only ever does `path.join(…)` is untouched,
because accessing members of a namespace object is exactly what it is for.

⚠️ **Do the migration in one commit and read the diff.** Each change is a
one-line edit with no behavioural difference under the new emit, but mixing them
with unrelated work makes the review meaningless.

## The interaction that catches library authors

`esModuleInterop` has `affectsEmit`, so **it changes the JavaScript you publish**
— and it also changes what your `.d.ts` implicitly assumes about consumers.

The failure mode: you build with `esModuleInterop: true`, your emitted code
performs the interop correctly, and your published `.d.ts` describes an API a
consumer imports with *their* flags. If they have interop off and your
declarations lead them to a default import, they get the green-build-`undefined`
outcome.

**Two things keep this honest:**

1. **Declare what the runtime does.** `export =` for CommonJS output, real
   `export default` only when there is one. This is
   [topic 07 · chunk 06](../07-authoring-d-ts-files/06-the-export-forms.md), and
   it is the whole defence — a declaration that matches the runtime cannot
   mislead anyone's flags.
2. **Test your package as a consumer would**, with interop both on and off. That
   is what `arethetypeswrong` automates, and it is **11 · Publishing a typed
   package** *(not written yet)*.

🔴 **`importHelpers` is the other library-specific decision.** Without it the
helpers are inlined per file across everything you ship; with it, `tslib` becomes
a real runtime dependency that must be in `dependencies` (chunk 03).

## `verbatimModuleSyntax` sits next to this and is not the same thing

They are often set together and answer different questions:

- **`esModuleInterop`** — how an import of a *CommonJS* module is typed and
  emitted.
- **`verbatimModuleSyntax`** — whether import *syntax* is preserved exactly as
  written rather than being elided or rewritten.

The connection worth knowing: `verbatimModuleSyntax` makes emit predictable by
refusing to transform your import statements, which is the opposite instinct to
interop's *"emit additional JavaScript"*. In a `nodenext` project you commonly
have both, and they do not conflict — but if you are reasoning about why an
import looks the way it does in the output, you need to know which one is
responsible. That flag is **02 · `import type` / `export type` and
`verbatimModuleSyntax`** *(not written yet)*.

## The applied case is already written

**This topic owns the general rule. The concrete decision on a real Node 24
service — the module format, why `nodenext` is the answer, and what follows from
it — is
[Phase 7 · `tsconfig.json` for a Node service](../../phase-7-server/01-tsconfig-for-a-node-service/README.md).**
Read that for the worked configuration rather than assembling one from this page.

## Gotchas

**Symptom:** A long discussion about enabling interop in a project that has
`module: nodenext`.
**Cause:** It is already on by the computed default.
**Fix:** `tsc --showConfig` first. Establish the state before debating the
change.

**Symptom:** Enabling `esModuleInterop` produced dozens of new errors.
**Cause:** `TS2497` on every namespace import of a CommonJS module that is then
called — the flag forbids as well as allows.
**Fix:** Convert those to default imports. Mechanical, safe, and only the *called*
ones need it.

**Symptom:** `import * as path from 'path'; path.join(…)` also got flagged.
**Cause:** It should not have — member access on a namespace object is fine.
**Fix:** Check whether something is calling or constructing it, or spreading it.
Those are the operations a namespace object does not support.

**Symptom:** Both `esModuleInterop` and the bundler's interop are active and an
import behaves oddly.
**Cause:** Two implementations of the `__esModule` convention in one pipeline.
**Fix:** Decide which tool emits your production JavaScript and let only that one
do interop.

**Symptom:** Your published package works for you and gives consumers
`undefined`.
**Cause:** Your declarations assume your flags. Their configuration differs.
**Fix:** Declare what the runtime does — `export =` for CommonJS output — and
test the package as a consumer with interop off.

**Symptom:** `"esModuleInterop": false` in a copied config.
**Cause:** An explicit value beats the computed default, so it is a real
downgrade even under `nodenext`.
**Fix:** Delete the line unless someone can say why it is there.

**Symptom:** You cannot tell whether interop or `verbatimModuleSyntax` is
responsible for the shape of an emitted import.
**Cause:** They both affect emit and are usually set together.
**Fix:** `verbatimModuleSyntax` governs whether the *statement* is preserved;
`esModuleInterop` governs the CommonJS *value* handling. Change one at a time.

**Symptom:** Bundle size grew after enabling interop in a library.
**Cause:** Helpers inlined per emitted file.
**Fix:** `importHelpers: true`, with `tslib` in `dependencies`.

**Symptom:** The migration commit is unreviewable.
**Cause:** Interop conversions were mixed with other changes.
**Fix:** Do them alone. Every edit is a one-liner with no behavioural difference
under the new emit, which is only obvious in an isolated diff.

## Interview questions

**★ How do you decide between the two flags?**
Ask who emits the JavaScript you run. `tsc` → `esModuleInterop`, because you want
the helpers. A bundler → `allowSyntheticDefaultImports` is enough, and you may
already have it from `moduleResolution: bundler`. The type-only flag is a promise
that something else does the work, so it is only correct when you can name that
something.

**★ What breaks when you enable `esModuleInterop`?**
Namespace imports that are called or constructed — `import * as express from
'express'; express()` becomes `TS2497`, because the flag starts modelling
`import * as` as a real module namespace object, which is not callable. The flag
allows default imports *and* forbids this, which is why migrations feel
contradictory.

**★ Why is this a problem for library authors specifically?**
Because `esModuleInterop` has `affectsEmit`: it changes the JavaScript you
publish, while consumers compile against your `.d.ts` with *their* flags. The
defence is declaring what the runtime actually does — `export =` for CommonJS —
so no consumer's configuration can be misled, and testing the package as a
consumer with interop off.

**★ Your `tsconfig.json` says `module: nodenext` and nothing about interop. Is it
on?**
Yes. The computed default is `true` for `node16`, `node18`, `node20`, `nodenext`
and `preserve`. An explicit `false` copied in from elsewhere would override it,
and that is a real downgrade rather than a no-op.

**★ Which namespace imports need converting during a migration?**
Only the ones being **called or constructed**. `import * as path from 'path'`
followed by `path.join(…)` is member access on a namespace object and is exactly
what the form is for — it is untouched.

**How does `verbatimModuleSyntax` relate to this?**
It is adjacent, not the same. `verbatimModuleSyntax` decides whether import
*syntax* survives to the output unchanged; `esModuleInterop` decides how a
CommonJS module's *value* is handled. They are commonly set together under
`nodenext` and do not conflict, but only one of them explains any given shape in
the emit.

**What would you check first before opening a discussion about enabling interop?**
`tsc --showConfig`. The flag is on by default under the whole Node family and is
implied by `moduleResolution: bundler` for the type-only variant, so the
discussion is often about a setting the project already has.

---

← Prev: [04 · The errors](./04-the-errors.md) · Back to [the topic index](./README.md)
