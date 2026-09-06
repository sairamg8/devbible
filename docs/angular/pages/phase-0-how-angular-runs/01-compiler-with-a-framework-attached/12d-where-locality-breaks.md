---
title: "Locality is exact for `@Injectable`, `@Pipe` and `@Directive` and only approximate for `@Component` — the design docs name the two places file-by-file compilation fails, and the whole of standalone is the story of shrinking that exception from a whole module's declarations down to one class's `imports` array"
sidebar_label: "12d · Where locality breaks"
sidebar_position: 12.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md) (the "file by file", "module scope" and "Watch mode" passages, all verbatim) and [`packages/compiler/design/separate_compilation.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/separate_compilation.md).
> ⚠️ Both design documents are **2018 drafts still shipped in the repository.** Their architecture claims are quoted here; their vocabulary is pre-standalone, and every place where "module scope" has since become "the component's `imports` array" is flagged in the text.
> Documentation-validated; **no sandbox run** — no build was executed, no rebuild was timed and nothing was measured.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A principle you cannot state the exceptions to is a slogan. Angular's design docs state them, in
one sentence, and they are worth memorising: compilation is done *"file by file with no global
knowledge except during the type-checking and for reference inversion"*. Everything else in this
chunk unpacks the second half of that sentence. Three of the four decorator compilers are genuinely
local — `@Injectable`, `@Pipe` and `@Directive` need nothing but their own decorator. `@Component`
is not, because interpreting a template requires knowing the selectors of everything in that
template's scope, and those live in other files. That single exception is where incremental-rebuild
correctness gets hard, and it is the exact thing standalone components shrank: from "every
declaration of the `NgModule` this component belongs to" down to "the classes named in this
component's own `imports` array".**

## The sentence that names the exception

`architecture.md`, verbatim:

> *"This transformation is done file by file with no global knowledge except during the
> type-checking and for reference inversion discussed below."*

and, on the decorator compilers specifically:

> *"Most of the compilers are straight forward translations of the metadata specified in the
> decorator to the information provided in the corresponding definition and, therefore, do not
> require anything outside the source file to perform the conversion. However, the component, during
> production builds and for type checking a template require the module scope of the component which
> requires information from other files in the program."*

**Read the split precisely.** *Most* compilers are pure translations. The component compiler is not,
and the doc names the two moments it is not: *production builds* (because it has to resolve which
directive matches each element in order to emit a `dependencies` list —
[06c](06c-decls-vars-consts-and-dependencies.md)) and *type checking a template* (because it has to
know the input types of the directives that matched — that is chunk **[14 · Template type checking](14-template-type-checking.md)**).

The reason is not an implementation shortcut. It is the fact `separate_compilation.md` states in its
own terms: *"The only pieces of information that are not generated into the definition are the
directive selector and the pipe name as they go into the module scope."* A selector is a claim about
other people's templates. It cannot be a purely local fact, because its whole purpose is to be
matched from elsewhere.

## The two named exceptions, and why they are those two

| Exception | Why it cannot be local | Where it is covered |
|---|---|---|
| **Reference inversion** | A template that says `<app-child/>` must become an emitted *import* of the `ChildComponent` class, so the bundler can see the edge. Working out which class a tag refers to needs the selectors of everything in scope. | [08b](08b-the-selector-problem-and-reference-inversion.md) |
| **Template type-checking** | Checking `[count]="total"` needs the declared type of `count` on whichever directive matched, which is in that directive's `.d.ts`, in another file. | [06d](06d-the-factory-and-the-d-ts-declaration.md) for the `.d.ts` side; chunk **[14 · Template type checking](14-template-type-checking.md)** for the checking |

Both exceptions have the same shape: **the compiler needs to know about the classes in this
template's scope, and only those.** That is a bounded, explicit set — not "the whole program". The
design is not "locality except when convenient"; it is "locality plus one declared dependency edge,
which the build system can therefore track".

## Watch mode is where the exception becomes your problem

The same doc, section "Watch mode", verbatim — this is the passage that turns a design principle
into a thing you feel every day:

> *"This mode works for the Angular transformer and most of the decorator compilers, because they
> operate only using the metadata from one particular file. The exception is the `@Component`
> decorator, which requires the selector scope for the module in which the component is declared
> in. Effectively, this means that all components within a selector scope must be recompiled
> together, as any changes to the component selectors or type names, for example, will invalidate
> the compilation of all templates of all components in the scope. Since TypeScript will not track
> these changes, it's the responsibility of `ngtsc` to ensure the re-compilation of the right set of
> files."*

Three things to take from it, in order of how often they matter:

1. **The invalidation unit is a scope, not a file.** Change a selector and every template compiled
   against that scope is invalid — including templates in files you did not touch and whose
   TypeScript did not change.
2. **TypeScript will not help.** *"TypeScript will not track these changes"* — the dependency is
   semantic (a selector string matching a tag name), not syntactic (an import edge), so `tsc`'s own
   incremental machinery cannot see it. `ngtsc` maintains it separately.
3. **A selector is therefore a rebuild-surface decision**, not just a naming decision. It is the one
   piece of a component that other files' compilations read.

## Standalone shrank the exception, and that is the whole point of it

The draft says *"the selector scope for the module in which the component is declared"* because in
2018 there was nothing else. With standalone components the scope of a component's template is the
set of classes named in that component's own `imports` array
([topic 02 · 04c](../02-standalone-by-default/04c-what-the-compiler-does-with-the-array.md)), and the
ambient module scope it replaced is described in
[topic 02 · 04d](../02-standalone-by-default/04d-the-ambient-ngmodule-scope-it-replaced.md).

The arithmetic of that change is the interesting part:

| | `NgModule` scope | Standalone `imports` |
|---|---|---|
| Where the scope is written | in a **different file** from the component | in the component's own decorator |
| What a selector change invalidates | every declaration in that module | the components that named this class in `imports` |
| Can you tell, from a component's file, what its template may use? | no | yes — it is the array right there |
| Is "who can use this class?" answerable by text search? | no | yes, and completely |

**So standalone did not merely delete boilerplate.** It moved the one non-local fact a component
compilation needs into the component's own file, which is as close to restoring exact locality as
the exception allows. [Topic 02 · 10c](../02-standalone-by-default/10c-incremental-compilation-and-the-scope-cache.md)
follows this through to the compiler's scope cache, whose key is the component class — meaning the
invalidation unit for a standalone component really is one component.

## Gotchas

**★ Symptom: you renamed a component's `selector` and a completely different file's template broke — or worse, quietly stopped matching the directive and rendered a plain element.** Cause: a selector is the one part of a component that other files' compilations consume, so it is *scope* information, and *"any changes to the component selectors or type names … will invalidate the compilation of all templates of all components in the scope"*. Fix: treat a selector as published API. Prefix it, change it deliberately, and when you do, search for the tag rather than the class — the class name and the selector are independent strings and only one of them appears in templates:

```bash
# Both halves of the rename. The class rename is a TypeScript refactor your editor can do;
# the selector rename is a text change in every template that matched it, and nothing in
# the type system will find those for you.
grep -rn '<app-order-table' src/
grep -rn "selector: 'app-order-table'" src/
```

**★ Symptom: after editing a component, `ng serve` shows a result that does not match the source, and a full restart fixes it.** Cause: the dependency between a selector and the templates compiled against it is semantic, not an import edge, and the design doc is explicit that *"TypeScript will not track these changes, it's the responsibility of `ngtsc`"*. When a rebuild looks stale, scope invalidation is the first suspect, not your code. Fix: eliminate the cache as a variable before you debug anything else, then reproduce:

```bash
# The CLI's persistent build cache lives at .angular/cache by default.
rm -rf .angular/cache
npx ng serve
```

**★ Symptom: in an `NgModule` codebase, touching one component appears to make the dev server rebuild far more than that component.** Cause: the scope is the module, so every declaration in it shares one invalidation unit — *"all components within a selector scope must be recompiled together"*. That is not a bug and no configuration changes it; it is what a module-level scope means. Fix: shrink the scope by making the components standalone, which moves each component's scope into its own decorator. The migration is a schematic, not a manual edit:

```bash
npx ng generate @angular/core:standalone
```

**Symptom: a component in a library renders correctly in the library's own tests and is not matched at all in the consuming application.** Cause: matching is a scope question and scope is per-consumer. The library's test bed declared the component in a scope; the application's component did not name it in `imports`, so as far as that template's compilation is concerned the selector does not exist. Fix: import it where the template lives — and let the unknown-element diagnostic tell you when you have not ([topic 02 · 06](../02-standalone-by-default/06-not-a-known-element.md)):

```ts
// src/app/orders/orders-page.ts
import {Component} from '@angular/core';
import {OrderTableComponent} from '@acme/order-widgets';

@Component({
  selector: 'app-orders-page',
  imports: [OrderTableComponent],
  template: `<acme-order-table [rows]="[]" />`,
})
export class OrdersPage {}
```

## Interview questions

**★ Locality says a class compiles from its own file alone. Where does that break, and what did standalone do to the exception?**
It breaks in exactly one place and the design doc names it: the `@Component` compiler needs the
selectors of everything in its template's scope, because interpreting a template means deciding
which class each tag and attribute refers to. Three of the four decorator compilers do not have this
problem — `@Injectable`, `@Pipe` and `@Directive` are, in the doc's words, *"straight forward
translations of the metadata specified in the decorator"*. Before standalone, that scope was the
`NgModule` the component was declared in, which is a *different file* listing an arbitrary number of
other classes; the whole set had to be recompiled together on a selector change. Standalone moved
the scope into the component's own decorator as the `imports` array, so the non-local fact is now
written in the same file as the thing that needs it. The exception did not disappear, it shrank to
the smallest set that still makes template compilation possible.

**★ Why is template type-checking listed as an exception to locality alongside reference inversion?**
Because both need the same missing information — the identity and shape of the classes in the
template's scope — for two different purposes. Reference inversion needs to know *which class* a tag
refers to so it can emit an import of that class into the definition, which is what lets a bundler
see the edge and drop everything else. Type-checking needs to know *what types* that class declares
for its inputs, so it can check the expressions you bound to them. Neither is answerable from the
component's own file. What keeps both compatible with locality is that the needed set is declared:
it is the `imports` array, and everything the compiler reads comes from those classes' `.d.ts`
files, never from their source.

**The doc says "it's the responsibility of `ngtsc` to ensure the re-compilation of the right set of files". What does that sentence actually mean for you?**
It means Angular maintains a dependency graph that TypeScript does not have, and that graph is the
only thing standing between you and a stale build. A selector change creates no import edge and
changes no type signature, so `tsc`'s incremental machinery has no reason to reconsider any other
file; `ngtsc` has to know that templates compiled against that scope are now invalid and rebuild
them. Practically, this tells you where to look when a dev-server result does not match the source:
the suspect is scope invalidation and the build cache, not your component. It is also why the design
rule forbidding a compiler from scanning other files matters — every dependency that is *not*
explicit is a dependency this graph cannot contain.

**If locality has an exception, why is it still worth calling a principle?**
Because the exception is bounded and declared. "No global knowledge except during type-checking and
for reference inversion" is a very different statement from "mostly local"; it names the two moments,
and in both of them the extra information comes from a set the component itself wrote down. That is
what makes the consequences tractable: the invalidation set is computable, the published `.d.ts` is
sufficient for a consumer to compile against, and a library can be compiled without knowing who will
use it. A principle with two named, bounded exceptions still supports all of those. A principle with
unbounded exceptions supports none of them, which is precisely the pre-Ivy situation where *"if any
of the transitive information changed, then all factories need to be regenerated"*.

---

← Prev: [12c · What inheritance never carries](12c-what-inheritance-never-carries.md) · Index: [Topic index](README.md) · Next → [12e · What locality costs](12e-what-locality-costs.md)
