---
title: "Every constraint the last six chunks described falls out of one design rule — Ivy's locality principle, which the design docs state not as a slogan but as a restriction on the compiler's own source code: a compiler for a decorator is a pure function of that decorator, forbidden from scanning any other file"
sidebar_label: "12 · Ivy and locality"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler/design/separate_compilation.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/separate_compilation.md) and [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md), both quoted verbatim; [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts) for the relayed-`providers` reading.
> ⚠️ Both design documents are **2018 drafts still shipped in the repository.** Their *architecture* claims are quoted here; their *artefacts* — `ngcc`, `.metadata.json`, `NgComponentDef`, "as of TypeScript 2.7" — are obsolete and are flagged at every point where the shipped compiler has moved on.
> Documentation-validated; **no sandbox run** — no build was executed and no output was captured.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Chunks [06](06-what-the-compiler-emits.md) through [11](11-why-defer-can-split-a-bundle.md)
described artefacts and constraints. This chunk names the rule that produced all of them. Ivy's
locality principle is that a class can be compiled knowing only what its own file declares — and
Angular's design docs do not state it as an aspiration, they state it as a coding rule the
compiler's own authors have to obey: *"A Compiler must not depend on any inputs not directly passed
to it (for example, it must not scan sources or metadata for other symbols)."* Every consequence in
this topic is downstream of that one sentence. The `ɵcmp` is a static field rather than an entry in
a global table because a static field can be produced from one file. The `.d.ts` carries ten type
arguments of metadata because a consumer must be able to compile against your component without
reading your source. `@defer` can split a chunk because the compiler already knows this component's
dependency list locally. And the whole error catalogue in chunks 09 and 10 exists because "knowing
only what your own file declares" means reading syntax, not running your program.**

## "The decorator is the compiler"

`separate_compilation.md`, verbatim — this is the sentence the entire design rests on:

> *"The mental model of Ivy is that the decorator is the compiler. That is, the decorator can be
> thought of as parameters to a class transformer that transforms the class by generating
> definitions based on the decorator parameters. A `@Component` decorator transforms the class by
> adding an `ɵcmp` static property, `@Directive` adds `ɵdir`, `@Pipe` adds `ɵpipe`, etc. In most
> cases the values supplied to the decorator are sufficient to generate the definition. However, in
> the case of interpreting the template, the compiler needs to know the selector defined for each
> component, directive and pipe that are in the scope of the template."*

Read it as an equation. **Decorator in, static field out, nothing else consulted.** The decorator is
not an annotation that some later phase looks up; it *is* the input to a transformation whose output
is a property on the class it sits on. Three things follow immediately, and each one is a rule you
have already met somewhere in this topic:

- **A class with no decorator gets no definition.** There is no registry, no global scan, no
  "Angular finds your components". `ComponentType<T>` means *has a `ɵcmp`*
  ([08e](08e-only-compiled-classes-are-renderable.md)), and the only thing that puts a `ɵcmp` on a
  class is a decorator physically written above it.
- **The decorator argument must be readable without executing it.** If the decorator is the input,
  the compiler has to extract that input from source text. That is the whole of
  [09](09-static-analysability-is-the-load-bearing-constraint.md) — the partial evaluator, the
  single-return-function rule, `selector` reducing to a string.
- **The output goes *on the class*, not into a table.** Which is what makes it tree-shakable
  ([08c](08c-the-instruction-set-is-a-la-carte.md)) and what makes reference inversion possible
  ([08b](08b-the-selector-problem-and-reference-inversion.md)).

Note the caveat the quote makes in its own last sentence: *"in the case of interpreting the
template, the compiler needs to know the selector defined for each component, directive and pipe
that are in the scope of the template."* That is the hole in locality, and
[12d](12d-where-locality-breaks.md) is entirely about it.

## Locality is a restriction on the compiler's source, not a slogan

Design principles usually decay because nothing enforces them. Angular wrote this one as a rule
about how compiler code must be *written*. `architecture.md`, section "Compiler design", verbatim:

> *"Each "Compiler" which transforms a single decorator into a static field will operate as a "pure
> function". Given input metadata about a particular type and decorator, it will produce an object
> describing the field to be added to the type, as well as the initializer value for that field (in
> Output AST format)."*

> *"A Compiler must not depend on any inputs not directly passed to it (for example, it must not
> scan sources or metadata for other symbols). This restriction is important for two reasons:"*
> *"1. It helps to enforce the Ivy locality principle, since all inputs to the Compiler will be
> visible."*
> *"2. It protects against incorrect builds during `--watch` mode, since the dependencies between
> files will be easily traceable."*

**Two reasons, and the second is the one nobody quotes.** Reason 1 is the publishing story people
know — libraries, versions, npm. Reason 2 is about *correctness of your daily rebuild*: if a
compiler's inputs are all visible, then the set of files whose compilation a change invalidates is
computable. A compiler allowed to reach out and read another file has a dependency nothing recorded,
and a watch-mode rebuild that skips that file is silently wrong. Locality is not a performance
feature bolted on for library authors; it is what makes incremental compilation *sound*.

There is a third clause worth pulling out, from the same section:

> *"Compilers will also not take Typescript nodes directly as input, but will operate against
> information extracted from TS sources by the transformer. In addition to helping enforce the rules
> above, this restriction also enables Compilers to run at runtime during JIT mode."*

That is why JIT and AOT are *the same compiler*. Strip away the TypeScript AST and what a compiler
consumes is a plain metadata object — which a `@Component` decorator can hand it at runtime just as
easily as a transformer can hand it at build time. Partial compilation, in
[12f](12f-partial-compilation-and-the-linker.md), is this same property used a third way.

## What Ivy was arguing against

The design doc states the prior art it is replacing, and the contrast is what makes locality legible.
`separate_compilation.md`, verbatim:

> *"In 5.0 and prior versions of Angular the compiler performs whole program analysis and generates
> template and injector definitions that use this global knowledge to flatten injector scope
> definitions, inline directives into the component, pre-calculate queries, pre-calculate content
> projection, etc. This global knowledge requires that module and component factories are generated
> as the final global step when compiling a module. If any of the transitive information changed,
> then all factories need to be regenerated."*

Every verb in that list — *flatten*, *inline*, *pre-calculate*, *pre-calculate* — is an optimisation
that requires seeing the whole program, and every one of them is a reason a build had to redo
everything when anything moved. **"If any of the transitive information changed, then all factories
need to be regenerated"** is the cost sentence. Ivy's trade was to stop doing those four things at
build time and do them at run time instead, which is exactly what
[12e](12e-what-locality-costs.md) accounts for.

And the doc states the consequence for npm directly:

> *"Separate component and module compilation is supported only at the module definition level and
> only from the source. That is, npm packages must contain the metadata necessary to generate the
> factories. They cannot contain, themselves, the generated factories. This is because if any of
> their dependencies change, their factories would be invalid, preventing them from using version
> ranges in their dependencies."*

🔴 **Read the last clause slowly: *"preventing them from using version ranges in their
dependencies."*** Pre-Ivy, a published Angular library could not ship compiled output **because
semver exists**. A `peerDependencies` range means the library does not know what it will run
against, and a whole-program-compiled factory is only valid against exactly one resolved graph. So
libraries shipped metadata and every application recompiled them. Locality is what turned that into
"compile once, publish, link at the consumer's version" —
[12f](12f-partial-compilation-and-the-linker.md).

## One definition per class, and the two facts that do not fit in it

`separate_compilation.md` carries a table mapping every field of the old `CompileDirectiveSummary`
to where it lands in the Ivy world. Its conclusions, verbatim:

> *"Only one definition is generated per class. All components are directives so a `ɵcmp` contains
> all the `ɵdir` information. All directives are injectable so `ɵcmp` and `ɵdir` contain `ɵprov`
> information."*

> *"The only pieces of information that are not generated into the definition are the directive
> selector and the pipe name as they go into the module scope."*

**That second sentence is the shape of the entire exception.** Everything about a directive is local
to its own class except the one fact that other files need in order to match it — its selector. A
selector is inherently relational: it is not a property of the directive, it is a claim about
*someone else's template*. So it cannot live only in the definition; it has to be visible from
wherever a template is compiled. In v22 the definition does carry `selectors` as an emitted field
([06](06-what-the-compiler-emits.md)), and the published `.d.ts` carries the selector as a *type
argument* of `ɵɵComponentDeclaration` ([06d](06d-the-factory-and-the-d-ts-declaration.md)) — that is
how a consumer reads it without reading your source. The 2018 draft's phrase *"module scope"* is
also the obsolete half: standalone replaced the module with the component's own `imports` array
([topic 02 · 04c](../02-standalone-by-default/04c-what-the-compiler-does-with-the-array.md)).

## Locality also decides which fields the compiler even looks at

A rule people mis-state constantly: *"metadata must be statically analysable"*. It is more precise
than that, and locality is why. The compiler evaluates only the fields it needs a **value** from in
order to build the definition. Everything else is copied through as an expression and never
inspected — `providers` is the famous case, wrapped verbatim by the directive handler as
`new WrappedNodeExpr(directive.get('providers')!)`. An arrow function in `providers` is emitted
unchanged and works fine, while the same arrow function in `selector` cannot compile.

That is not an inconsistency; it is locality being economical. A `selector` becomes part of a
*string* the compiler must reason about while compiling **other files' templates**, so it must be
resolved to a value now. A `providers` array is only ever consumed by the runtime injector inside
this component's own scope, so relaying it costs nothing and constrains nobody.
[09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) has the full split.

## Gotchas

**★ Symptom: you moved `@Component` metadata into a shared helper so several components could share it, and the build failed even though the helper is correct TypeScript.** Cause: the decorator *is* the compiler's input, so it must be recoverable from the decorator expression by static evaluation, not by running your helper. Fix: the compiler will call a helper, but only one that is a single `return` of an object literal — the rule and its boundaries are [09d](09d-the-single-return-function-rule.md); anything with a statement body fails. Keep the shared part to values, and write the object literal in the decorator:

```ts
// src/app/shared/host-defaults.ts
// A macro-shaped helper: exactly one `return` statement, so the partial evaluator
// can inline it. Add a single `const` line to this body and it stops working.
export function panelHost(role: string): Record<string, string> {
  return {class: 'panel', role, 'data-testid': 'panel'};
}
```

```ts
// src/app/shared/settings-panel.ts
import {Component} from '@angular/core';
import {panelHost} from './host-defaults';

@Component({
  selector: 'app-settings-panel',
  host: panelHost('region'),
  template: `<ng-content />`,
})
export class SettingsPanel {}
```

**★ Symptom: an arrow function is accepted in `providers` and rejected in `selector`, and you concluded the metadata rules are arbitrary.** Cause: the two fields are handled by different mechanisms. `providers` is relayed to the emitted definition as an unexamined expression — the directive handler wraps it as `new WrappedNodeExpr(directive.get('providers')!)` — while `selector` must reduce to a string because other files' template compilations consume it. Fix: stop asking "is this statically analysable" and start asking "does the compiler need a *value* from this field". Both of the following compile:

```ts
// src/app/reporting/report-panel.ts
import {Component, InjectionToken} from '@angular/core';

export const REPORT_FORMATTER = new InjectionToken<(n: number) => string>('REPORT_FORMATTER');

@Component({
  selector: 'app-report-panel',
  // Relayed verbatim into the emitted definition. Never evaluated, so an arrow
  // function here is not a static-analysis question at all.
  providers: [{provide: REPORT_FORMATTER, useFactory: () => (n: number) => n.toFixed(2)}],
  template: `<ng-content />`,
})
export class ReportPanel {}
```

**Symptom: a component works when a colleague imports the class directly and fails — "no `ɵcmp`", or nothing renders — when it comes out of a factory of your own.** Cause: locality says the definition is put on the class by the decorator, at build time. A class produced by a function at runtime was never seen by a decorator and therefore has no definition; nothing retro-fits one under ahead-of-time compilation. Fix: make every renderable variant a real decorated class and select between classes rather than building them:

```ts
// src/app/dashboard/tile-registry.ts
import {Type} from '@angular/core';
import {ChartTile} from './chart-tile';
import {TableTile} from './table-tile';

// Both entries are classes the compiler processed. Selecting one at runtime is fine;
// manufacturing one at runtime is not.
export const TILES: Record<'chart' | 'table', Type<unknown>> = {
  chart: ChartTile,
  table: TableTile,
};
```

## Interview questions

**★ "The decorator is the compiler." What does that sentence actually rule out?**
It rules out anything that would require the compiler to look somewhere other than the decorator it
is currently processing. Concretely: metadata assembled at runtime, because the transformation
happens at build time and its output is a static field; metadata computed by code the compiler would
have to *run*, because it extracts values from source syntax with a partial evaluator; components
created by a factory function, because a class no decorator sat above has no `ɵcmp` and
`ComponentType<T>` is defined as *"has a `ɵcmp`"*; and a base class in another file contributing
inputs implicitly, because the design doc forbids a Compiler from scanning other symbols — which is
why an undecorated base using Angular features is an error rather than a silent merge
([12b](12b-inheritance-and-the-undecorated-base.md)). The positive half is just as strong: because
everything the compiler needs is in the decorator, the same compiler can run at build time from a
transformer or in the browser from a decorator at runtime, and can also emit an intermediate form to
be finished later.

**★ Locality is usually sold as a library-publishing feature. What is the other reason the design doc gives, and why does it matter more day to day?**
The doc gives two reasons for the "must not scan other sources" rule, and the second is *"It
protects against incorrect builds during `--watch` mode, since the dependencies between files will
be easily traceable."* If every input to a compilation is passed in explicitly, then the set of
files a change invalidates is computable; if a compiler may quietly read another file, that
dependency exists in nobody's graph and an incremental rebuild that skips the file is wrong, not
merely stale. Publishing is the story that gets told because it has a product attached to it, but
the reason you personally benefit every day is that `ng serve` can rebuild a subset of your program
and still be correct.

**Why does a `ɵcmp` live as a static field on the class rather than in a registry the framework populates?**
Because a static field is producible from one file and a registry is not. A registry has to be
written by something that has seen every component, which is whole-program analysis by another
name, and it also keeps every registered component reachable — which is the tree-shaking disaster
described in [08b](08b-the-selector-problem-and-reference-inversion.md), where a template resolved
through a module at runtime forces the bundle to contain everything that module could reach. Putting
the definition on the class means the definition dies with the class when nothing imports it, and it
means the compiler processing that file needed no knowledge of any other.

**What did Angular stop doing at build time when it adopted locality, and where did that work go?**
The pre-Ivy compiler used global knowledge to *"flatten injector scope definitions, inline
directives into the component, pre-calculate queries, pre-calculate content projection"* — all four
of which need to see the whole program. Ivy stopped doing them at build time and moved the
equivalent work into the runtime: directives are matched at runtime, host bindings are laid out at
runtime, the `TView` is computed at first render. That is the trade, stated plainly, and it is why
"Angular is a compiler" does not imply "Angular has a small runtime" —
[12e](12e-what-locality-costs.md) itemises the bill.

**A colleague says "Ivy made Angular faster because it compiles more." Is that the right claim?**
No, and the design docs do not make it. Ivy compiles *less* eagerly than ViewEngine did: it declines
to pre-compute the four global optimisations above and pays for them at runtime instead. What it
bought was not raw speed but *independence* — a class that compiles from its own file, a rebuild
whose invalidation set is knowable, output that tree-shakes because it hangs off the class, and a
library that can be compiled once and linked at whichever version the consumer resolved. Those are
different wins, and the honest framing in [08](08-instructions-not-a-virtual-dom.md) applies here
too: different, not automatically faster.

**Why is `providers` allowed to contain an arrow function when `selector` is not?**
Because locality makes the compiler lazy about what it evaluates. It only needs a *value* from a
field if that value has to appear in something it is generating now, or in something another file's
compilation will read. A selector is read while compiling other components' templates, so it has to
be resolved to a string at build time. A `providers` array is consumed only by the runtime injector
of this component, so the handler relays it into the emitted definition as an opaque expression —
literally `new WrappedNodeExpr(directive.get('providers')!)` — and never looks inside. The rule to
carry away is not "metadata must be static", it is "the fields the compiler needs a value from must
be static", and [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) enumerates which those
are.

---

← Prev: [11d · What `@defer` never defers](11d-what-defer-never-defers.md) · Index: [Topic index](README.md) · Next → [12b · Inheritance and the undecorated base](12b-inheritance-and-the-undecorated-base.md)
