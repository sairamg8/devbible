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

🚧 **14 of 17 numbered chunks written, across 57 files.** Eight of the fourteen exhausted their
subject past the 300-line cap and split into lettered siblings — the cap is a file size, never a
content budget, so a chunk that ran long became five, six or seven files rather than a shorter
page. The rows without links are planned and named; a link to a page that does not exist breaks
the build, so they stay as plain text until they land.

⚠️ **Chunk 10 is a catalogue and is deliberately unfinished.** It carries its own coverage note
naming every error it does *not* yet reach — `10g` (calls and enums) and `10h` (unsupported
syntax) are planned, and the `NG2xxx` field-shape family after them. Read the note before
concluding an error is absent because it cannot happen.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The template is a separate language](01-the-template-is-a-separate-language.md)** | Not JSX, not JavaScript, not HTML — Angular's own tokenizer, HTML AST, template AST and template function; 🔴 the four-stage pipeline every template goes through |
| 02 | **[What an expression may contain](02-what-a-template-expression-may-contain.md)** | The full supported/unsupported operator tables, the two globals you get, why `new` and every bitwise operator are out |
| 03 | **[Declarations and `@let`](03-declarations-and-the-let-block.md)** | Why declarations are banned, why `@let` is a *block* rather than an expression, and the three instructions it lowers to |
| 04 | **[Arrow functions in templates](04-arrow-functions-in-templates.md)** | ⚠️ the one place the docs and the shipped compiler disagree — what v21.2 actually added, what it rejects, and NG8111 |
| 05 | **[Expressions, statements and safe navigation](05-expressions-statements-and-safe-navigation.md)** | Binding context vs action context, why assignment is legal in one and not the other, and 🔴 the v22 change that made `?.` return `undefined` |
| 06 | **[What the compiler emits: `ɵcmp`](06-what-the-compiler-emits.md)** | The three artefacts a `@Component` becomes, and 🔴 why the emitted field order is what the compiler does *today* and not a contract |
| 06b | **[Inside `ɵɵdefineComponent`](06b-inside-definecomponent.md)** | A normaliser wrapped in a `toString` trick — the four fields it computes that the compiler never emitted |
| 06c | **[`decls`, `vars`, `consts`, `dependencies`](06c-decls-vars-consts-and-dependencies.md)** | Two integers that pre-size an array, the constants pool the instruction indices point into, and why the dependency list is sometimes a *function* |
| 06d | **[The `ɵfac` and the `.d.ts`](06d-the-factory-and-the-d-ts-declaration.md)** | 🔴 `ɵɵComponentDeclaration` is `unknown` — a phantom type whose ten type *arguments* are your component's entire published metadata |
| 07 | **[The create pass and the update pass](07-the-create-pass-and-the-update-pass.md)** | `RenderFlags.Create` vs `RenderFlags.Update`, and why the two passes are one function |
| 07b | **[The view is an array](07b-the-view-is-an-array-decls-and-vars.md)** | A 27-slot header and two regions — `decls` and `vars` are literally those region lengths, which is why the compiler can count them and cannot count directive instances |
| 07c | **[Addressing the array](07c-how-instructions-address-the-array.md)** | Create instructions carry a slot index because they assign addresses; update instructions carry none because they ride two implicit cursors in global state |
| 07d | **[`ɵɵadvance`](07d-advance-is-relative-and-forward-only.md)** | A delta rather than an index, asserted positive, flushing child `ngOnInit` on the way past — 🔴 why a template's shape is fixed at compile time |
| 07e | **[What performs the diff](07e-what-actually-performs-the-diff.md)** | The whole diff is `Object.is` against one array slot per expression; `bindingUpdated` is nine lines and there is no tree to walk |
| 08 | **[Instructions, not a virtual DOM](08-instructions-not-a-virtual-dom.md)** | 🔴 Nowhere from `@Component` to a mutated DOM node does a value representing the tree exist — Angular deleted the vnode and kept the annotations |
| 08b | **[The selector problem and reference inversion](08b-the-selector-problem-and-reference-inversion.md)** | The reason is written down: a template resolved through a module at runtime forces the bundle to contain everything that module *could* reach |
| 08c | **[The instruction set is à la carte](08c-the-instruction-set-is-a-la-carte.md)** | Every instruction is a `{name, moduleName}` pair and there are 215 — which is why the interpolation and pure-function families are numbered |
| 08d | **[What the fixed shape costs](08d-what-the-fixed-shape-costs.md)** | First half of the bill: a slot count decided at build time, and markup no code of yours may produce |
| 08e | **[Only compiled classes are renderable](08e-only-compiled-classes-are-renderable.md)** | `ComponentType<T>` defines *consumable for rendering* as *has a `ɵcmp`*, making the renderable set a build-time fact |
| 08f | **[The cost of generated code](08f-the-cost-of-generated-code.md)** | Second half of the bill: positional and unreadable on purpose, a private ABI with an expiry date, and a compiler that picks your TypeScript |
| 09 | **[Static analysability is the load-bearing constraint](09-static-analysability-is-the-load-bearing-constraint.md)** | 🔴 Every constraint in this topic reduces to one sentence — the compiler must resolve your metadata to a value without executing your program |
| 09b | **[What is evaluated and what is relayed](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)** | The rules apply not to your `@Component` but to the enumerable subset of fields the compiler needs a *value* from; everything else is relayed untouched |
| 09c | **[The partial evaluator is the grammar](09c-the-partial-evaluator-is-the-grammar.md)** | There is no spec of what metadata may contain — there is a 40-line `if/else` chain, and its final `else` is the rule |
| 09d | **[The single-return-function rule](09d-the-single-return-function-rule.md)** | ⚠️ The folk rule that a helper function cannot build metadata is **false** — the compiler will call it, provided the body is one `return` |
| 09e | **[`selector` must reduce to a string](09e-selector-must-reduce-to-a-string.md)** | ⚠️ *"A selector cannot be computed"* is the wrong rule — identifiers, property access, template literals and macro calls all work |
| 09f | **[`imports` and the rule about lazy loading](09f-imports-and-the-rule-about-lazy-loading.md)** | 🔴 *"`imports` must be identifiers"* is false as a **compilation** rule and true as a **lazy-loading** one |
| 09g | **[Reading a metadata failure](09g-reading-a-metadata-failure.md)** | The prediction procedure: an error is always two sentences and the **second** is the diagnosis |
| 10 | **[Metadata errors, one by one](10-metadata-errors-one-by-one.md)** | The decoder: every metadata error is one two-part object. ⚠️ Carries the coverage note listing what this catalogue does not yet reach |
| 10b | **[The decorator argument itself](10b-the-decorator-argument-itself.md)** | Two gates run before the evaluator starts — exactly one argument, and that argument a syntactic object literal — which is why NG1001 has three messages |
| 10c | **[Symbols the compiler cannot resolve](10c-symbols-the-compiler-cannot-resolve.md)** | 🔴 Three failures look identical and have three unrelated fixes: never found, found but not exported, found but unimportable |
| 10d | **[Import cycles and local compilation](10d-import-cycles-and-local-compilation.md)** | NG3003 is not about your symbol but about which *file* it lives in; plus the two local-compilation errors |
| 10e | **[Values that resolve but do not fold](10e-values-that-resolve-but-do-not-fold.md)** | A variable declaration has four outcomes and only one is an error — which is why `export let SELECTOR;` fails the way it does |
| 10f | **[Destructuring in metadata](10f-destructuring-in-metadata.md)** | ⚠️ Destructuring **works** — the guides saying otherwise quote a compiler Angular stopped shipping; the three forms that genuinely fail share one cause |
| 11 | **[Why `@defer` can split a bundle no bundler could](11-why-defer-can-split-a-bundle.md)** | The `dependencyResolverFn` the compiler generates, and the two emit modes it hoists |
| 11b | **[The nine conditions and the barrel trap](11b-the-nine-conditions-and-the-barrel-trap.md)** | 🔴 The guide names two conditions; `registerDeferrableCandidate` applies eight, plus a ninth at the import-declaration level — and **not one of the nine produces a line of build output** |
| 11c | **[Diagnosing a `@defer` that did not split](11c-diagnosing-a-defer-that-did-not-split.md)** | There is no build error, so this is a procedure: rule out HMR, turn the silence into a diagnostic with `deferredImports`, then read the bundle |
| 11d | **[What `@defer` never defers](11d-what-defer-never-defers.md)** | Only the primary block gets a resolver — a design-system spinner in a `@placeholder` can cancel the whole benefit |
| 12 | **[Ivy and locality](12-ivy-and-locality.md)** | 🔴 "The decorator is the compiler" — the locality principle stated as the compiler's own design constraint, and why it is what makes separate compilation possible |
| 12b | **[Inheritance and the undecorated base](12b-inheritance-and-the-undecorated-base.md)** | The one place locality is deliberately broken: a base class in another file whose metadata the derived class must inherit |
| 12c | **[What inheritance never carries](12c-what-inheritance-never-carries.md)** | The list is short and the omissions are the interesting part — a template, a selector and `imports` are never inherited |
| 12d | **[Where locality breaks](12d-where-locality-breaks.md)** | The four places the compiler must read another file anyway, each with the reason it has no choice |
| 12e | **[What locality costs](12e-what-locality-costs.md)** | Faster incremental rebuilds bought with a compiler that cannot see your whole program — and the errors that buys you |
| 12f | **[Partial compilation and the linker](12f-partial-compilation-and-the-linker.md)** | `ɵɵngDeclareComponent`, `compilationMode: 'partial'`, and the linker that finishes the job at the consumer's version |
| 12g | **[Version skew is a coded concern](12g-version-skew-is-a-coded-concern.md)** | The declaration format carries a version field on purpose — skew is a case the design handles, not an accident it survives |
| 13 | **[Where the compiler runs: `ngtsc`](13-where-the-compiler-runs-ngtsc.md)** | `@angular/compiler-cli` as a TypeScript *transformer* rather than a separate pass, and the `.ngtypecheck.ts` shims that exist in both programs |
| 13b | **[`ngc` is `tsc`, and the pin](13b-ngc-is-tsc-and-the-typescript-pin.md)** | 🔴 Why a transformer forces the hard TypeScript `>=6.0 <6.1` peer pin, and why "which TypeScript" is never a property of your repository alone |
| 13c | **[The `NG` code is a TypeScript code](13c-the-ng-error-code-is-a-typescript-code.md)** | Angular's diagnostics ride TypeScript's reporting surface — and the negative-enum encoding that decides which codes get a docs link |
| 13d | **[`compilationMode` and the local portability trap](13d-compilation-mode-and-the-local-portability-trap.md)** | Three modes, one source: what `full`, `partial` and `experimental-local` each decline to look at |
| 13e | **[The option surface and config-time diagnostics](13e-the-option-surface-and-config-time-diagnostics.md)** | 🔴 When angular.dev and the compiler disagree about whether an option exists, the checked-in golden wins |
| 14 | **[Template type checking](14-template-type-checking.md)** | `strictTemplates`, the Type Check Block, the strictness flags, and the class of bugs that moves from runtime to build time |
| 14b | **[How each construct is translated](14b-how-each-construct-is-translated.md)** | Construct by construct: what each piece of template syntax becomes in the TCB, and what the TCB is structurally unable to see |
| 14c | **[The type-check file](14c-the-type-check-file-and-how-errors-get-home.md)** | One shared shim per source file, hoisting what several blocks need — and the inline fallback for any component whose type that shim cannot import (NG8900, NG8901) |
| 14d | **[How a diagnostic gets home](14d-how-a-diagnostic-gets-home.md)** | 🔴 The source map is made of comments, because comments are the only channel that survives an unmodified `tsc` — and an unmappable diagnostic is dropped, never guessed at |
| 14e | **[The errors that never arrive](14e-the-errors-that-never-arrive.md)** | 🔴 "Wrong template, green build" has three causes of wildly different frequency — four suppressed codes, and the much larger class where no statement was generated at all |
| 14f | **[`strictTemplates` is on by default](14f-what-stricttemplates-actually-switches.md)** | ⚠️ The default flipped in v22.0.0 and angular.dev still says otherwise — four CHANGELOG artefacts prove it, and `typeCheckHostBindings` flipped on the same day |
| 14g | **[What turning it off costs](14g-what-turning-strict-templates-off-costs.md)** | 🔴 `strictTemplates: false` disables `checkTemplateBodies` and extended diagnostics — the middle tier the guide describes is unreachable at v22 |
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
- **Phase 14 — Performance and the build** *(not written yet)* — `@defer` from chunks 11–11d
  becomes a budget and a bundle-analysis question there.

---

← Prev: [Phase 0 — How Angular runs](../README.md) · Start → [01 · The template is a separate language](01-the-template-is-a-separate-language.md) · Next topic → [02 · Standalone by default](../02-standalone-by-default/README.md)
