---
title: "Angular is a compiler with a framework attached — the template is a separate language that is parsed, type-checked and lowered into instruction calls before a browser ever sees it"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Expression syntax](https://angular.dev/guide/templates/expression-syntax), [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer), [Template type checking](https://angular.dev/tools/cli/template-typecheck), [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options), [Extended diagnostics](https://angular.dev/extended-diagnostics) — the Ivy design docs in `angular/angular` ([architecture.md](https://github.com/angular/angular/blob/main/packages/compiler/design/architecture.md), [separate_compilation.md](https://github.com/angular/angular/blob/main/packages/compiler/design/separate_compilation.md)), the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md), and the published `@angular/core` / `@angular/compiler-cli` **22.1.5** type definitions and package metadata.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · TypeScript peer `>=6.0 <6.1` · Node `^22.22.3 || ^24.15.0 || >=26.0.0`. Documentation-validated; **no sandbox run**.

**Every other framework you have used treats its markup as a convenience. Angular does not.
An Angular template is a language with its own grammar, its own parser, its own type system
and its own error codes, and it is compiled — ahead of time, by a program that ships in your
`devDependencies` — into a JavaScript function made of imperative instruction calls. That
single fact is upstream of almost every "why does Angular make me do this?" you will ask in
the next fifteen phases.** Why `imports` has to be a literal array. Why you cannot build a
`@Component` argument with a helper function. Why `Math.max()` fails in a binding but
compiles fine one line above in the class. Why a template error names a line in an `.html`
file that TypeScript has never heard of. Why `@defer` can split a chunk out of your bundle
that no bundler on earth could have found. And why the TypeScript version in your
`package.json` is not yours to choose.

This topic is the anchor of the whole Angular track. Read it once properly and later phases
stop being a list of rules and start being consequences.

## Chunks

🚧 **5 of 17 chunks written.** The rows without links are planned and named; a link to a
page that does not exist breaks the build, so they stay as plain text until they land.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The template is a separate language](01-the-template-is-a-separate-language.md)** | Not JSX, not JavaScript, not HTML — Angular's own tokenizer, HTML AST, template AST and template function; 🔴 the four-stage pipeline every template goes through |
| 02 | **[What an expression may contain](02-what-a-template-expression-may-contain.md)** | The full supported/unsupported operator tables, the two globals you get, why `new` and every bitwise operator are out |
| 03 | **[Declarations and `@let`](03-declarations-and-the-let-block.md)** | Why declarations are banned, why `@let` is a *block* rather than an expression, and the three instructions it lowers to |
| 04 | **[Arrow functions in templates](04-arrow-functions-in-templates.md)** | ⚠️ the one place the docs and the shipped compiler disagree — what v21.2 actually added, what it rejects, and NG8111 |
| 05 | **[Expressions, statements and safe navigation](05-expressions-statements-and-safe-navigation.md)** | Binding context vs action context, why assignment is legal in one and not the other, and 🔴 the v22 change that made `?.` return `undefined` |
| 06 | **What the compiler emits: `ɵcmp`** *(not written yet)* | The static component definition, `ɵɵdefineComponent`, `decls` / `vars` / `dependencies`, the `ɵfac`, and what lands in the `.d.ts` |
| 07 | **The create pass and the update pass** *(not written yet)* | `RenderFlags.Create` vs `RenderFlags.Update`, the slot/index model, `ɵɵadvance`, and why the two passes are one function |
| 08 | **Instructions, not a virtual DOM** *(not written yet)* | Why Angular emits imperative calls instead of building a vnode tree; the tree-shaking argument; what it costs |
| 09 | **Static analysability is the load-bearing constraint** *(not written yet)* | 🔴 NG1001 and the object-literal rule; the partial evaluator; why a `selector` cannot be computed and `imports` must be identifiers |
| 10 | **Metadata errors, one by one** *(not written yet)* | Non-exported symbols, uninitialised `export let`, destructuring, ambient types, computed enum members, tagged templates — symptom → cause → fix for each |
| 11 | **Why `@defer` can split a bundle no bundler could** *(not written yet)* | The `dependencyResolverFn` the compiler generates, the two conditions a dependency must meet, 🔴 the barrel-file trap that silently un-splits your chunk |
| 12 | **Ivy and locality** *(not written yet)* | "The decorator is the compiler", the locality principle, separate compilation, incremental rebuilds and what locality buys the ecosystem |
| 13 | **Where the compiler runs: `ngtsc`** *(not written yet)* | `@angular/compiler-cli`, a TypeScript *transformer* rather than a separate pass, `ngc`, and 🔴 why that forces the hard TS `>=6.0 <6.1` peer pin |
| 14 | **Template type checking** *(not written yet)* | `strictTemplates`, the type-check block, all ten strictness flags, and the class of bugs that moves from runtime to build time |
| 15 | **Extended diagnostics** *(not written yet)* | The NG81xx warnings for code that is legal but wrong, how to promote them to errors, and the semver caveat when you do |
| 16 | **Arriving from React, Vue or Svelte** *(not written yet)* | What "compiled" means in each of the four, what Angular buys with it and what it costs |
| 17 | **Consequences you actually hit** *(not written yet)* | Errors in a file TypeScript never compiled, NG3003 import cycles, NG8001/NG8002, and expressions that work in the class and fail in the template |

## The one question this topic exists to answer

**"Why does Angular need all this ceremony when React just runs my JavaScript?"**

Because Angular does not run your template. It *reads* it, at build time, with a compiler
that must be able to resolve every piece of metadata to a value without executing your
program. Everything Angular gains from that — build-time template type errors, a template
dependency graph precise enough to lazy-load from, tree-shakable component definitions,
libraries that compile once and work across versions — is paid for with the constraint that
your metadata must be *statically analysable*. The ceremony is the price. This topic is
about what you get for it.

## Phase gate

You are done with this topic when you can take an arbitrary component, say which parts of
the emitted output the compiler generated and which you wrote, explain why a given
`@Component` argument would or would not compile, and predict — before running the build —
whether a particular `@defer` block will produce a separate chunk.

## Where this connects

- **[02 · Standalone by default](../02-standalone-by-default/README.md)** — a component's
  `imports` array is the local dependency list this topic's locality principle depends on.
  Standalone is what makes the template dependency graph knowable per file.
- **[03 · The provider array is the wiring](../03-the-provider-array/README.md)** — the `provide*` convention
  exists partly because tree-shakable provider functions survive the static analysis that
  `NgModule.forRoot()` fought against.
- **10 · Partial compilation** *(not written yet)* — `ɵɵngDeclareComponent` and the linker
  are locality taken to its conclusion: a library compiled once, linked at your version.
- **11 · JIT vs AOT** *(not written yet)* — the same compiler, run at a different time, and
  why that is a debugging tool rather than a deployment option.
- **Phase 1 — Components and templates** *(not written yet)* — this topic explains the
  machine; that phase explains the language it reads.
- **Phase 14 — Performance and the build** *(not written yet)* — `@defer` from chunk 08
  becomes a budget and a bundle-analysis question there.

---

← Prev: [Phase 0 — How Angular runs](../README.md) · Start → [01 · The template is a separate language](01-the-template-is-a-separate-language.md) · Next topic → [02 · Standalone by default](../02-standalone-by-default/README.md)
