---
title: "Four jobs, not one"
sidebar_label: "01 · Four jobs, not one"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`tsconfig` reference** for `noEmit`,
> `declaration`, `emitDeclarationOnly`, `declarationMap` and `composite`; the
> **esbuild**, **swc**, **Rollup** and **Vite** documentation for what each states
> it does; and the **TypeScript 5.9.3 diagnostic table read from disk**
> (`sandbox/ts-p0`) for `TS5069` and `TS6304`, quoted **verbatim**.
> ⚠️ The *argument* that a transpiler cannot check is
> [topic 01 · chunk 01](../01-type-checking-in-ci/01-the-green-build-that-proves-nothing.md)'s
> and the mechanism is [phase 0 · 10](../../phase-0-how-typescript-runs/10-checking-vs-transpiling.md)'s
> — **neither is repeated here.** **No timing figure is ours. No console block.**

Most confusion about TypeScript build setups comes from one assumption: that
"building TypeScript" is a single job that one tool does. **It is four**, and every
tool in the ecosystem does a different subset.

| Job | What it means |
|---|---|
| **Check** | read the whole program and report type errors |
| **Transform** | turn `.ts` into `.js` — mostly deleting types |
| **Bundle** | resolve the import graph into fewer output files |
| 🔴 **Emit declarations** | produce the `.d.ts` files that describe your API |

Once they are separate, most "which tool should we use" arguments answer themselves,
because the tools are not competing for the same job.

## 🔴 Who does what

| Tool | Check | Transform | Bundle | Emit `.d.ts` |
|---|---|---|---|---|
| **`tsc`** | ✅ | ✅ | ❌ | 🔴 **✅ — and it is alone here** |
| **esbuild** | ❌ | ✅ | ✅ | ❌ |
| **swc** | ❌ | ✅ | ❌ | ❌ |
| **Rollup** | ❌ | via a plugin | ✅ | via a plugin *that calls `tsc`* |
| **Vite** | ❌ | ✅ (esbuild) | ✅ (Rollup) | ❌ |

🔴 **Read the last column first, because it is the one that decides your pipeline
shape: only `tsc` produces declaration files.** Plugins that advertise `.d.ts`
output are orchestrating the compiler, not replacing it.

**So: if you publish types, `tsc` is in your build, whatever bundler you chose.**
That is not a preference and there is no faster alternative to swap in — which makes
it the most useful single fact in this topic.

## Why declaration emit cannot be fast

The reason is structural, and it is the same shape as
[topic 01](../01-type-checking-in-ci/README.md)'s argument in a different place:

> **To write `.d.ts` for an exported function, you have to know its return type. If
> it is not annotated, that means inferring it — which means type checking.**

⚠️ **So `emitDeclarationOnly` is not a cheap subset of a full build.** It needs the
checker, so it costs roughly what checking costs. A pipeline that runs
`tsc --noEmit` *and* `tsc --emitDeclarationOnly` is doing the expensive part twice —
the same two-runs-of-one-job pattern
[topic 01 · chunk 03](../01-type-checking-in-ci/03-where-the-gate-goes.md) finds
between `tsc` and type-aware lint.

📌 **That cost is exactly what `isolatedDeclarations` exists to remove** — by
requiring annotations so declarations can be emitted per file without inference.
**Phase 6 · 15 · `isolatedDeclarations`** *(lane C/D's topic)* owns it.

## The flags that wire it together, and what the compiler says when you get it wrong

Two diagnostics worth knowing verbatim, because they are the ones that appear while
you are assembling a two-tool pipeline:

> `TS5069` · *"Option '{0}' cannot be specified without specifying option '{1}' or
> option '{2}'."*

That is what `declarationMap`, `declarationDir` and `emitDeclarationOnly` each hit
when `declaration` (or `composite`) is not set. 📌 **The message is generic and its
placeholders carry all the information** — read the option names in it rather than
guessing which flag it means.

> `TS6304` · *"Composite projects may not disable declaration emit."*

🔴 **Which tells you something about the design: `composite` and declarations are
not two independent settings.** A composite project exists so other projects can
consume it without recompiling its sources, and that consumption is *through* its
declarations — so switching them off would leave nothing to consume. **Project
references and declaration emit are one feature wearing two names**, which is worth
knowing before you reach for references as a speed lever
([topic 01 · chunk 04](../01-type-checking-in-ci/04-making-it-fast-enough.md)).

## Gotchas

**Symptom:** a bundler was chosen to replace `tsc` and the package ships without
types.
**Cause:** the bundler does not emit declarations, and nothing said so out loud.
**Fix:** 🔴 only `tsc` emits `.d.ts`. If you publish types, it is in your build
regardless of what else is.

**Symptom:** `emitDeclarationOnly` was expected to be quick and is not.
**Cause:** declarations need inferred return types, which needs the checker.
**Fix:** ⚠️ it costs about what checking costs. Do not budget for it as a cheap
extra step, and do not run it alongside a separate `--noEmit` without noticing you
are checking twice.

**Symptom:** `TS5069` on a config that looks complete.
**Cause:** `declarationMap` / `declarationDir` / `emitDeclarationOnly` set without
`declaration` or `composite`.
**Fix:** read the placeholders in the message — it names the option you set and the
two that would satisfy it.

**Symptom:** `TS6304` after turning declarations off in a monorepo package.
**Cause:** the package is `composite`, and composite projects are consumed through
their declarations.
**Fix:** either stop being composite or keep declarations. 📌 They are one feature,
not two settings.

**Symptom:** a Rollup plugin is credited with generating the types.
**Cause:** it is calling `tsc` underneath.
**Fix:** ⚠️ worth knowing because its performance and its failure modes are the
compiler's, not the plugin's — so it is `tsc`'s configuration you debug.

**Symptom:** the team debates esbuild versus `tsc` as though one must win.
**Cause:** the four jobs were collapsed into one.
**Fix:** they do different subsets. The normal answer is *both*, with each doing
what only it can.

## Interview questions

**What are the separate jobs in a TypeScript build?**
Checking, transforming, bundling, and emitting declarations. Most tooling arguments
dissolve once they are named, because the tools do different subsets — esbuild
transforms and bundles but never checks, `tsc` checks, transforms and emits
declarations but does not bundle.

**Which job can only `tsc` do?**
Declaration emit. Bundler plugins that produce `.d.ts` orchestrate the compiler
rather than replacing it, so if you publish types then `tsc` is in your pipeline no
matter which bundler you use. There is no faster substitute to swap in.

**Why is `emitDeclarationOnly` not cheap?**
Because writing a declaration for an exported function requires knowing its return
type, and if it is not annotated that means inferring it — which is type checking.
So it costs roughly what a check costs, and a pipeline that runs `--noEmit` and
`--emitDeclarationOnly` separately is paying for the expensive part twice.

**What does `TS6304` tell you about project references?**
That composite projects and declaration emit are one feature rather than two
settings. A composite project exists to be consumed without recompiling its sources,
and that consumption happens through its declarations — so disabling them would
leave nothing to consume, and the compiler refuses.

**How would you set up a library build?**
Bundler for the JavaScript, `tsc` for the declarations, and one type-check as the
gate — being careful not to pay for the checker twice. The details of what ships and
how consumers resolve it belong to the publishing topic; the pipeline decision is
just that the two tools each do the job only they can.

---

[Topic index](./README.md) · Next → **02 · The two pipeline shapes** *(not written yet)*
