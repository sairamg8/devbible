---
title: "The reason Angular emits instructions is written down: a template resolved through a module at runtime forces the bundle to contain everything that module could possibly match, and the fix — inverting the link so each component carries its own dependency list — is the array you now write as `imports`"
sidebar_label: "08b · The selector problem"
sidebar_position: 8.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md) — ⚠️ a 2018 draft still shipped in the tree, quoted here for its *argument* and never for its artefacts, which [06](06-what-the-compiler-emits.md) corrects field by field.
> Documentation-validated; **no sandbox run** — no bundle was built, measured or compared.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Most explanations of "why Angular has no virtual DOM" are reconstructions. This one does not have
to be: the argument is written down in the repo, in a design document that predates the shipped
implementation, and it is not primarily about rendering speed at all — it is about what a bundler
can delete. The doc calls the problem *the selector problem*. A template that is interpreted at
runtime needs the runtime to know which components, directives and pipes could match it; that
candidate list came from an `NgModule`; a tree-shaker computes the transitive closure of everything
*referenced*, so the whole list ships whether or not a single template ever matches any of it. The
proposed fix has a name — *reference inversion* — and you use it every day without hearing the term,
because it is now called `imports`.**

## The problem, in the authors' own words

⚠️ **`packages/compiler/design/architecture.md` is a 2018 draft.** Its artefacts are obsolete: it
shows a `tag:` field that is really `selectors`, a `factory:` property that is really a separate
`ɵfac` static, and an `NgComponentDef` type with three parameters where v22 has
`ɵɵComponentDeclaration` with ten ([06](06-what-the-compiler-emits.md),
[06d](06d-the-factory-and-the-d-ts-declaration.md)). Quote the argument; never the shapes. From the
section titled "The selector problem", verbatim:

> *"To interpret the content of a template, the runtime needs to know what component and directives
> to apply to the element and what pipes are referenced by binding expressions. The list of
> candidate components, directives, and pipes are determined by the `NgModule` in which the
> component is declared. Since the module and component are in separate source files, mapping which
> components, directives, and pipes referenced is left to the runtime. Unfortunately, this leads to
> a tree-shaking problem. Since there no direct link between the component and types the component
> references then all components, directives, and pipes declared in the module, and any module
> imported from the module, must be available at runtime or risk the template failing to be
> interpreted correctly. Including everything can lead to a very large program which contains many
> components the application doesn't actually use."*

*(The grammatical slips are the draft's own; it is quoted unedited.)*

Then the definition of the tool the argument turns on, verbatim:

> *"The process of removing unused code is traditionally referred to as "tree-shaking". To determine
> what codes is necessary to include, a tree-shakers produces the transitive closure of all the code
> referenced by the bootstrap function. If the bootstrap code references a module then the
> tree-shaker will include everything imported or declared into the module."*

🔴 **That sentence is the load-bearing one, and it is about *reachability*, never about *usage*.** A
tree-shaker answers "is this symbol referenced from the entry point?". It cannot answer "is this
symbol ever executed?", and no amount of bundler cleverness changes that, because the second
question is undecidable in general. So the moment a template's dependencies are resolved by
consulting a list at runtime, that list is a reference, and everything in it is retained — including
components whose selector no template in the application ever matches.

## The fix, and its name

Same document, verbatim:

> *"This problem can be avoided if the component would contain a list of the components, directives,
> and pipes on which it depends allowing the module to be ignored altogether. The program then need
> only contain the types the initial component rendered depends on and on any types those
> dependencies require."*

> *"The process of determining this list is called reference inversion because it inverts the link
> from the module (which hold the dependencies) to component into a link from the component to its
> dependencies."*

Notice what reference inversion requires in order to be possible at all: the compiler has to be able
to determine, at build time, exactly which classes a template depends on. That is only true if the
template is *analysed* rather than *interpreted* — which is the same requirement that makes an
instruction stream emittable in the first place. **The tree-shaking argument and the
no-virtual-DOM decision are the same decision, seen from two ends.** You cannot have a compiler that
knows enough to write out `ɵɵelementStart(0, 'app-data-table')` and simultaneously a runtime that
has to go looking for what `app-data-table` means.

## Reference inversion is now spelled `imports`

"Reference inversion" appears in no v22 error message and on no angular.dev page, because it stopped
being a build-time optimisation and became the ordinary way you write a component. The chain is
short, and every link is documented elsewhere in this corpus:

1. You write `imports: [DataTable, CurrencyPipe]` on a standalone component
   ([topic 02 · 04](../02-standalone-by-default/04-what-imports-actually-means.md)).
2. The compiler resolves that array to the classes it names — which is why it has to be a literal
   array of identifiers, the constraint chunk 09 is built on — and emits them as the `dependencies`
   field of `ɵcmp` ([06c](06c-decls-vars-consts-and-dependencies.md),
   [topic 02 · 04c](../02-standalone-by-default/04c-what-the-compiler-does-with-the-array.md)).
3. The link now runs **component → its dependencies**. A tree-shaker following references from the
   bootstrap function reaches exactly the transitive closure of those arrays, and nothing else.
4. Because the graph is per-component and per-file, it is also *splittable*, which is what lets
   `@defer` name a chunk boundary no bundler could have discovered on its own
   ([11](11-why-defer-can-split-a-bundle.md),
   [topic 02 · 10](../02-standalone-by-default/10-why-standalone-makes-the-graph-splittable.md)).

The 2018 draft describes reference inversion as an optional production-build step performed against
an `NgModule` scope. Standalone did two things to it: it made it the default, and it shrank the
scope from "everything the declaring module can see" to "the `imports` array of this one class". The
dependency list stopped being something the compiler derives and became something you write.

```ts
import {Component} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {DataTable} from './data-table';

// The dependency list lives here, in this file, next to the template that needs it.
// Nothing has to consult a registry at runtime to find out what `<app-data-table>` is,
// and nothing else in the application is retained on this component's account.
@Component({
  selector: 'app-invoice-list',
  imports: [DataTable, CurrencyPipe],
  template: `
    <app-data-table [rows]="rows">
      <span class="total">{{ total | currency: 'EUR' }}</span>
    </app-data-table>
  `,
})
export class InvoiceList {
  protected readonly rows: ReadonlyArray<{id: number; amount: number}> = [];
  protected readonly total = 0;
}
```

## The honest claim is "different", not "faster"

Angular's documentation makes four claims for compiling ahead of time — smaller download, faster
rendering, fewer requests, better security — and
[08c](08c-the-instruction-set-is-a-la-carte.md) quotes all four verbatim alongside the one piece of
hard evidence you can check in your own lockfile. **None of the four is a claim that instructions
beat a vnode diff.**

🔴 **There is no measurement on this page and none may be added.** This track ships no timings, no
bundle sizes and no benchmark output, because there is no sandbox behind it. If the number matters
to you, it has to come from your application — and the framework hands you a tool for the half of it
that can be automated, which is size.

## Gotchas

**★ Symptom: you justified choosing Angular — or blocked a change — with "Angular has no virtual DOM, so it's faster", and someone asked for the number.** Cause: the absence of a vnode tree is an argument about what a bundler can delete and what the runtime is permitted to assume. It is not a benchmark result, and neither Angular's documentation nor this corpus offers one. Fix: stop arguing and put the claim in the build, where a size regression fails CI instead of being debated. Budgets live in the production configuration in `angular.json`:

```json
{
  "projects": {
    "storefront": {
      "architect": {
        "build": {
          "configurations": {
            "production": {
              "budgets": [
                {"type": "initial", "maximumWarning": "450kB", "maximumError": "600kB"},
                {"type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB"}
              ]
            }
          }
        }
      }
    }
  }
}
```

**★ Symptom: you quoted the design doc's "selector problem" to argue that an `NgModule` application on v22 cannot tree-shake.** Cause: the draft describes the pre-Ivy world it was written to fix. Reference inversion shipped — every component's `ɵcmp` carries its own `dependencies` list ([06c](06c-decls-vars-consts-and-dependencies.md)) — and that is true whether the component is standalone or declared in a module. Quoting a 2018 problem statement as current behaviour is the same error as quoting the draft's `tag:` field. Fix: make the argument you can actually defend, which is about the *shape and locality of the graph* rather than about tree-shaking being broken, and point at where locality is cashed in:

```ts
import {Routes} from '@angular/router';

// The dependency graph is per-file, so this boundary is real: nothing outside
// `./reporting/reporting-dashboard` is pulled in until the route is visited.
export const routes: Routes = [
  {path: '', loadComponent: () => import('./home/home').then((m) => m.Home)},
  {
    path: 'reporting',
    loadComponent: () =>
      import('./reporting/reporting-dashboard').then((m) => m.ReportingDashboard),
  },
];
```

**★ Symptom: you deleted every `<app-legacy-chart>` usage in the application and the component is still in the production bundle.** Cause: *"a tree-shakers produces the transitive closure of all the code referenced by the bootstrap function"* — reachability, not usage. Something still **names the class**: a barrel `index.ts` that re-exports it, a route table entry, a `providers` array, a test helper imported by production code, or a value import kept alive because it is used as a type without `import type`. Reference inversion changed *what gets referenced*; it did not give the bundler a way to tell referenced from used. Fix: remove the last reference, and make type-only imports explicit so they erase:

```ts
// ⛔ Retains the class at runtime: a value import used only for its type.
// import {LegacyChart} from './legacy-chart';

// ✅ Erased completely by TypeScript — no runtime reference, so the class can go.
import type {LegacyChart} from './legacy-chart';

export function describeChart(chart: LegacyChart): string {
  return `${chart.title} (${chart.series.length} series)`;
}
```

**Symptom: a shared barrel file makes one lazy route pull in half the application.** Cause: exactly the structure the selector problem describes, rebuilt by hand. A barrel is a module that references everything in it, so importing one symbol from it makes the whole barrel reachable — the bundler may or may not narrow that back down, and whether it does is a property of your bundler, not of Angular. This is the same mechanism that makes a `@defer` block silently fail to split ([11b](11b-the-nine-conditions-and-the-barrel-trap.md)). Fix: import from the defining file, not from the barrel:

```ts
// ⛔ Reaches the whole barrel, and everything the barrel names.
// import {DataTable} from '../shared';

// ✅ Reaches one file.
import {DataTable} from '../shared/data-table/data-table';

export const SHARED_TABLE = DataTable;
```

## Interview questions

**★ Why does Angular emit imperative instruction calls instead of building a virtual DOM tree?**
Because a tree that has to be interpreted at runtime forces the runtime to be able to interpret
*anything*, and that defeats tree-shaking. The Ivy design doc calls this the selector problem: if a
template's candidate components, directives and pipes come from an `NgModule` consulted at runtime,
then every declarable in that module — and in every module it imports — has to be present in the
bundle, because a tree-shaker computes the transitive closure of what is *referenced* rather than
what is *used*. Emitting instructions removes the interpretation step: the template becomes code
that already knows which element it is creating and which directive it is talking to, so the only
symbols referenced are the ones that template genuinely needs. The other half of the same idea is
reference inversion — putting the dependency list on the component instead of the module — and the
two together are what make a component definition droppable.

**★ What is "reference inversion", and what is it called today?**
It is the design doc's name for inverting the link between a module and the things it declares:
instead of the module holding a list of declarables and the runtime searching that list, each
component holds a list of what its own template depends on. Today it is called `imports`. You write
`imports: [DataTable, CurrencyPipe]`, the compiler resolves the array and emits it as the
`dependencies` field of that component's `ɵcmp`, and a tree-shaker walking references from the
bootstrap function reaches exactly the transitive closure of those arrays. The doc frames it as an
optional production-build step against an `NgModule` scope; standalone made it the default and
shrank the scope to a single class's `imports` array, which is the change that makes per-route
splitting and `@defer` possible.

**★ A tree-shaker "produces the transitive closure of all the code referenced by the bootstrap function." Why does that one sentence explain both the NgModule problem and why deleting a component's last usage is not enough?**
Because it makes bundling a reachability question and never a usage question. Under the module
model, a component's template contained no reference to `DataTable` at all — the reference came from
the declaring module's array, so `DataTable` was reachable, and so it shipped, even in an
application where no template ever matched its selector. The identical rule bites in the other
direction today: a component you removed every usage of is still reachable if anything still *names
the class* — a barrel re-export, a route entry, a leftover provider, a value import used only for a
type. Tree-shaking cannot distinguish "referenced" from "used", which is why reference inversion had
to change what gets referenced rather than asking bundlers to get smarter.

**★ Why is the tree-shaking argument and the no-virtual-DOM decision the same decision?**
Because reference inversion is only possible if the compiler can determine at build time exactly
which classes a template depends on, and that requires the template to be *analysed* rather than
*interpreted*. Once you have a compiler that can resolve `<app-data-table>` to a class, you no
longer need a runtime that can search for it — and once you no longer need that search, there is
nothing left for a vnode tree to do that direct DOM mutation cannot. Conversely, if you keep the
runtime search, the dependency list has to exist at runtime, and the bundle has to contain it. The
two designs are not independent choices that Angular happened to make in the same direction; each
one is what makes the other viable.

**The design doc calls reference inversion a production-build step against an NgModule scope. Standalone changed that. What exactly changed?**
Two things. First, it stopped being optional and conditional: the dependency list is now emitted for
every component, in every build, rather than being derived during a production pass. Second, and more
importantly, the *scope* shrank. Under a module, the compiler had to compute what the declaring
module could see — a whole-program question that made incremental rebuilds pessimistic, since a
change to any component in a scope can invalidate the compilation of every template in it. With
standalone, the answer is a literal array written in the same file as the template, so the
compilation of a component depends on that file plus the files it names, and nothing else. That is
the same locality that makes an incremental rebuild cheap and a route split precise.

---

← Prev: [08 · Instructions, not a virtual DOM](08-instructions-not-a-virtual-dom.md) · Index: [Topic index](README.md) · Next → [08c · The instruction set is à la carte](08c-the-instruction-set-is-a-la-carte.md)
