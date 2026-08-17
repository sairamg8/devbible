---
title: "The green build that proves nothing"
sidebar_label: "01 · The green build"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** and the `tsconfig`
> reference for `noEmit` and `isolatedModules`, the **esbuild** and **swc**
> documentation for their stated scope, and the **Vite** documentation on how it
> transforms TypeScript. ⚠️ **No timing figures on this page are ours** — there is
> no sandbox for a build pipeline
> ([the mechanism is phase 0's](../../phase-0-how-typescript-runs/10-checking-vs-transpiling.md)).
> **No console block.**

Here is the sequence, and it is common enough to be worth writing out in full
because every step of it is *working correctly*:

1. A developer writes code with a type error in it.
2. The editor shows a red squiggle. It is a Friday.
3. `git commit`. The pre-commit hook runs Prettier and ESLint. **Both pass** —
   neither of them type-checks.
4. CI runs `npm run build`. It uses Vite, which uses esbuild. **It passes in nine
   seconds.**
5. The tests run against the built bundle. **They pass** — the error is on a path
   the tests do not cover.
6. It deploys.
7. `TypeError: undefined is not a function`, in production, on a line that a type
   checker would have refused to compile.

🔴 **Nothing in that pipeline malfunctioned. Nothing in it type-checked either.**

## What each step actually verified

| Step | What it checked | What it did **not** |
|---|---|---|
| Prettier | formatting | anything semantic |
| ESLint (syntactic config) | rule violations it can see from one file's AST | types — unless type-aware rules are on ([phase 10 · 11](../../phase-10-strictness/11-typescript-eslint/README.md)) |
| esbuild / swc / Vite | **that the syntax parses**, then it deleted the types | 🔴 **whether any of them were consistent** |
| the test suite | the paths the tests cover | every path they do not |

⚠️ **The build step is the one people believe.** It has the word *build* in it, it
consumes `.ts` files, it fails loudly on a syntax error, and it produces the
artefact that ships. It looks exactly like a compiler. **It is a transpiler, and
the difference is that it never formed an opinion about the types it removed.**

## 🔴 Why a transpiler *cannot* do this, even in principle

This is not a missing feature that esbuild might add in a later release. **It is
structural**, and the reason is the one phase 0 establishes in detail
([checking vs transpiling](../../phase-0-how-typescript-runs/10-checking-vs-transpiling.md)):

> **A transpiler processes one file at a time. Type checking requires the whole
> program.**

To know whether `save(user)` is correct, the checker needs `save`'s declaration,
which is in another file, which imports a type from a third, which may come from a
`.d.ts` in `node_modules`. A tool built to transform files independently — which is
exactly what makes esbuild and swc fast, and what lets them parallelise — has
**deliberately given up the thing type checking needs.**

📌 **The speed and the blindness are the same design decision.** That is worth
saying plainly to anyone proposing to replace `tsc` with a faster tool: you are not
buying the same check faster, you are buying a different, smaller job.

⚠️ **And TypeScript makes the bargain explicit.** `isolatedModules` exists to forbid
the constructs that single-file transpilation cannot handle correctly — it is the
compiler agreeing to the transpiler's terms. Turning it on is how you keep the fast
tool honest; it does not make the fast tool a checker.

## The same hole, three other places

Once the shape is clear you start seeing it everywhere:

- 🔴 **Node's type stripping.** Running `.ts` directly means the types are erased at
  load, unchecked — the same bargain, now at runtime
  ([phase 0 · 04](../../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md)).
- 🔴 **A test suite run through the same transpiler.** Vitest and Jest with an
  esbuild/swc transform will run tests *containing type errors*, happily. **So "the
  tests pass" is not evidence about types either**, and this is the step most teams
  believe covers them.
- ⚠️ **The editor.** It *does* check, which is why the error was visible in step 2 —
  but it checks a different program, with possibly a different compiler version and
  a different file set ([phase 0 · 09](../../phase-0-how-typescript-runs/09-language-server-vs-build.md)).
  **An editor is a development aid, not a gate**: it cannot fail a pull request, and
  it only checks the files someone happened to open.

## The one-line consequence

> 🔴 **If no step in your pipeline runs a whole-program type check, your types are
> documentation.**

They are still useful documentation — editors read them, refactors use them, and
they are checked *while you work*. But nothing enforces them at the point where
enforcement matters, and a guarantee nobody verifies decays silently: the first
error merges, the second is easier, and by the time anyone looks the number is
large enough that turning the check on is its own project.

📌 **That decay is the real cost, and it compounds.** [Chunk 05](./05-when-the-gate-fails.md)
is about turning the check on when the number is already large; this chunk is the
argument for never being in that position.

## Gotchas

**Symptom:** *"the build passes, so the types are fine."*
**Cause:** the build is a transpiler — it removed the types without reading them.
**Fix:** add `tsc --noEmit` as its own step. 🔴 And note this is not a criticism of
the bundler: it is doing the job it advertises, at the speed that job allows.

**Symptom:** *"the tests pass, so it compiles."*
**Cause:** the test runner uses the same transpiler, so it runs code containing type
errors.
**Fix:** ⚠️ the test suite is the step most often believed to cover this, and it is
the one that covers it least — it checks the paths it covers, in a build that never
checked anything.

**Symptom:** someone proposes dropping `tsc` because esbuild is faster.
**Cause:** the two are being compared as if they did the same job.
**Fix:** they do different jobs, and the speed comes *from* the difference. Keep
both: the transpiler builds, `tsc --noEmit` checks.

**Symptom:** the editor shows an error and CI is green.
**Cause:** the editor is checking and CI is not — or they are checking different
programs.
**Fix:** phase 0 · 09 for the four ways they disagree. **The resolution is always to
make CI authoritative**, because it is the one that can block a merge.

**Symptom:** a file has errors and nothing reports them, even with `tsc` in the
pipeline.
**Cause:** the file is not in the program — an `include`/`exclude` question, and the
subject of [chunk 02](./02-what-the-gate-guarantees.md).
**Fix:** ⚠️ the gate only guarantees what it was pointed at, which is the most
common way a green `tsc` is also misleading.

**Symptom:** `isolatedModules` was enabled and the team believes the build now
checks types.
**Cause:** it constrains what you may write so single-file transpiling stays
correct.
**Fix:** it makes the fast tool *safe*, not *thorough*. It is a precondition for
transpiling, not a substitute for checking.

## Interview questions

**Why does a green `vite build` prove nothing about your types?**
Because Vite transpiles rather than checks — esbuild strips the type annotations and
never forms an opinion about them. It will fail on a syntax error and pass on a type
error, which is exactly the failure mode that reaches production, since the artefact
it produced is the one that ships.

**Could esbuild add type checking?**
Not without giving up what makes it fast. Type checking needs the whole program —
`save`'s declaration lives in another file, importing from a third, possibly from a
`.d.ts` in `node_modules` — and esbuild's design is to process files independently
so it can parallelise. The speed and the blindness are the same decision.

**What is `isolatedModules` for, then?**
It forbids the constructs that single-file transpilation cannot handle correctly, so
the fast tool stays *correct*. It is TypeScript agreeing to the transpiler's terms.
It does not make the transpiler a checker, and reading it as one is a common and
expensive mistake.

**"The tests pass" — what does that tell you about types?**
Nothing, if the test runner transpiles. Vitest and Jest with an esbuild or swc
transform will happily run a file containing type errors, so a green suite is
evidence about the paths it covers and not about type consistency at all. It is the
step teams most often believe covers them.

**The editor shows the error. Is that not enough?**
No, for two reasons. It only checks what someone has open, and it cannot fail a pull
request. It is also checking a different program from the build — potentially a
different compiler version, file set and config — so agreement between them is not
guaranteed. A gate has to be something that can block a merge.

**What is the actual cost of not having the gate?**
Decay, and it compounds. The first type error merges because nothing objected, the
second is easier, and by the time anyone measures, turning the check on has become a
project rather than a configuration change. The types are still useful documentation
throughout — they are just not a guarantee, and nobody notices the difference until
production does.

---

[Topic index](./README.md) · Next → [02 · What the gate guarantees](./02-what-the-gate-guarantees.md)
