---
title: "TypeScript is a checker, not a runtime"
sidebar_label: "01 · Checker, not a runtime"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0** (Active LTS).
> Every console block below was produced by `sandbox/ts-p0/ex9-node-runs-ts.sh`
> and `ex3-emit-despite-errors.sh`.

**TypeScript is a program that reads your code and complains. It is not a
language your computer can run.** Everything else in this syllabus is a
consequence of that one sentence.

## The two jobs, and only one of them is TypeScript's

| Job | Who does it | When |
|---|---|---|
| Decide whether the code is *consistent* | `tsc` (or your editor) | Before it runs |
| Actually execute the code | Node, a browser, Bun, Deno | At runtime |

Nothing carries a type across that line. By the time your code executes, every
annotation you wrote is gone — not "ignored", **gone**, the way a comment is
gone.

## The demonstration

A file whose types are complete nonsense:

```ts
// src-ex9/lying.ts
const weight: number = "heavy";
console.log('node does not care:', weight.toUpperCase());
```

`weight` is declared `number` and assigned a string, then a string method is
called on it. Two contradictions in two lines. Node:

```console
$ node src-ex9/lying.ts
node does not care: HEAVY
exit=0
```

It printed `HEAVY` and exited **0**. Node deleted `: number`, saw
`const weight = "heavy"`, and ran perfectly ordinary JavaScript.

The checker, pointed at the same file:

```console
$ tsc --noEmit src-ex9/lying.ts
src-ex9/lying.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
src-ex9/lying.ts(2,43): error TS2339: Property 'toUpperCase' does not exist on type 'number'.
exit=1
```

Same file. Two completely different verdicts, because they are answering two
different questions. **Neither is wrong** — Node was asked to run it, `tsc` was
asked whether it makes sense.

## Which one runs in your project?

This is the question to ask on day one of any codebase, because the answer is
frequently "neither":

```console
$ node app.ts        # runs. Never checks.
$ tsc --noEmit       # checks. Never runs.
$ vite build         # transpiles. Never checks. (see 10 · Checking vs transpiling)
```

A team can ship for months believing they have types, while nothing in CI ever
executes the checker. The annotations are still there in the editor, still
autocompleting, still *looking* like guarantees. They are decoration.

**If `tsc --noEmit` does not run somewhere automatic, you are writing JavaScript
with extra syntax.**

## The checker will hand you a broken program on request

This surprises people more than anything else on this page. By default `tsc`
reports errors **and emits the JavaScript anyway**:

```ts
// src-ex3/broken.ts
const port: number = "8080";
console.log('port + 1 =', port + 1);
```

```console
$ tsc --target es2022 --outDir out-ex3 src-ex3/broken.ts
src-ex3/broken.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
tsc exit=2

$ cat out-ex3/broken.js
"use strict";
const port = "8080";
console.log('port + 1 =', port + 1);

$ node out-ex3/broken.js
port + 1 = 80801
```

`80801` — string concatenation, exactly the bug the annotation was supposed to
prevent, in a file the compiler already told you was wrong.

Note the **exit code 2**: errors reported, output written. Ask it to stop
instead, and the exit code changes:

```console
$ tsc --noEmitOnError --outDir out-ex3 src-ex3/broken.ts
src-ex3/broken.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
tsc exit=1
files emitted: 0
```

| Invocation | Errors reported | Files written | Exit |
|---|---|---|---|
| `tsc` | yes | **yes** | 2 |
| `tsc --noEmitOnError` | yes | no | 1 |
| `tsc --noEmit` | yes | no (by definition) | 1 |

The design intent is that a type error should not stop you reloading the page
during development. The cost is that **a build script that ignores the exit code
ships broken output**, which is why every CI gate in this syllabus is written as
`tsc --noEmit` with the exit code respected.

## What you actually get for the price

Nothing survives to runtime — so what is the return?

1. **Errors move left.** `TS2339: Property 'toUpperCase' does not exist on type
   'number'` at 11am beats `TypeError: x.toUpperCase is not a function` from
   production at 3am.
2. **The editor knows things.** Completion, rename-across-files, and
   go-to-definition are the type checker answering questions interactively.
3. **Refactoring becomes mechanical.** Rename a field on one type and the
   compiler lists every place that has to change.
4. **Types document the contract** and cannot drift from the code the way a
   comment does — the checker verifies them on every run.

What you do **not** get: any runtime guarantee whatsoever. An API can return
whatever it likes; a `JSON.parse` produces `any`-shaped data; a cast can assert
something false. That gap is the entire subject of
[Phase 9 — Types at the boundary](../../syllabus/03-in-the-stack.md).

## Trade-off

**Cost:** a compiler in your pipeline, a config file to own, a second thing that
can be red, and syntax that is meaningless to the runtime. On a 200-line script
this is a bad trade — `// @ts-check` with JSDoc gets most of the value at none of
the cost ([13 · Playground and @ts-check](./13-playground-and-ts-check.md)).

**Benefit:** on anything a second person touches, the checker is the only tool
that reads *all* of the code every time and holds the whole shape in mind.

## Gotchas

**Symptom:** Type errors reach production even though "we use TypeScript"
**Cause:** Nothing in CI runs the checker — the runtime strips types, and
bundlers transpile without checking.
**Fix:** Add `tsc --noEmit` as a required CI step and fail on a non-zero exit.

**Symptom:** `tsc` printed errors but the `dist/` folder still updated
**Cause:** Emit-on-error is the default; the exit code was 2 and nobody read it.
**Fix:** `--noEmitOnError`, or check the exit code in your build script.

**Symptom:** A value is `number` in the editor but a string at runtime
**Cause:** The annotation was a claim, not a check — usually from `as`,
`JSON.parse`, or an unvalidated API response.
**Fix:** Validate at the boundary and let the type be *derived* from the
validator rather than asserted.

**Symptom:** "Adding types will slow the app down"
**Cause:** Assuming types have a runtime cost.
**Fix:** They have none — the emitted JavaScript is the same code minus the
annotations. Compare `src-ex1/shipping.ts` with its output in
[02 · Erasure](./02-erasure.md).

## Interview questions

**★ Does TypeScript have any runtime behaviour?**
No. It is a static checker plus a transpiler. Every type annotation is erased
before execution, so there is no runtime representation of a type, no runtime
type check, and no performance cost. Anything that must exist at runtime — a
validator, an `instanceof`, a discriminant field — is ordinary JavaScript you
wrote yourself.

**★ If `tsc` reports errors, do you still get JavaScript out?**
Yes, by default — it reports the errors and emits anyway, exiting 2. Only
`--noEmitOnError` (or `--noEmit`, which never emits) stops the output. Teams that
ignore the exit code ship JavaScript the compiler already rejected.

**★ Your build passes but production throws `TypeError`. How is that possible
with TypeScript?**
Several ways, all the same root cause — types are erased and unverified at
runtime: the build ran a transpiler rather than the checker; an `as` assertion
lied; data came from the network unvalidated; or the exit code was ignored.
The type system describes what you *promised*, not what arrived.

**Why is `tsc --noEmit` the recommended CI gate rather than the build command?**
Because the artefact usually comes from a bundler (esbuild, swc, Vite) that
strips types without checking them. `--noEmit` runs the checker alone, so
checking and building stay independent and neither can silently replace the
other.

**What is the difference between what Node does with a `.ts` file and what `tsc`
does?**
Node erases the types and executes the JavaScript underneath, never checking
anything. `tsc` checks the types and, unless told otherwise, writes JavaScript
out. Both accept the same file; only one of them will tell you it is wrong.

---

← [Phase 0 index](./README.md) · Next → [Erasure and what survives it](./02-erasure.md)
