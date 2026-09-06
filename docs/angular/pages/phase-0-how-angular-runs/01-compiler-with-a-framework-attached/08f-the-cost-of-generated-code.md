---
title: "The second half of the bill is paid in the debugger and in the build — the emitted function is positional and unreadable on purpose, what it emits is a private ABI that changes between versions, the runtime still recovers at runtime everything locality stopped the compiler from encoding, and the compiler is not something you may decline"
sidebar_label: "08f · The cost of generated code"
sidebar_position: 8.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts) (`ClassDebugInfo` and the `debugInfo` field comment, verbatim), [`packages/core/src/render3/interfaces/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/view.ts) (`expandoStartIndex`, verbatim), [`packages/core/src/render3/instructions/property.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/property.ts), [`goldens/public-api/compiler-cli/compiler_options.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/compiler-cli/compiler_options.api.md) (`compilationMode?: 'full' | 'partial' | 'experimental-local'`); angular.dev [AOT compilation](https://angular.dev/tools/cli/aot-compiler); and [React Compiler](https://react.dev/learn/react-compiler/introduction) for the contrast, quoted verbatim.
> Documentation-validated; **no sandbox run** — no build was executed, no stack trace was reproduced and no output was captured.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[08d](08d-what-the-fixed-shape-costs.md) and [08e](08e-only-compiled-classes-are-renderable.md)
covered what the fixed shape costs you while writing. This chunk covers what generated code costs
you afterwards — the part nobody puts in the pitch. The emitted function is positional and
slot-indexed, so it is unreadable by construction and Angular carries a dev-only debug record to
claw some of that back. What it emits is a private ABI that the source says outright may change
between versions, which is why a library cannot simply publish compiled output. Locality means the
runtime still has to work out at runtime everything the compiler declined to encode, so "compiled"
does not mean "small runtime". And unlike React's, this compiler is not optional — it is a
TypeScript transformer, which is how it ends up choosing your TypeScript version for you.**

## Cost 4 — the emitted function is unreadable, and Angular knows

Everything [07b](07b-the-view-is-an-array-decls-and-vars.md) through
[07d](07d-advance-is-relative-and-forward-only.md) established makes the output opaque on purpose:
slots are addressed by integer, the update pass carries no indices at all, and the meaning of any
number depends on a `consts` pool and a `TView` that live elsewhere. A stack frame from generated
code gives you a synthetic function name and a position, not your markup.

Angular's compensation is a record it attaches in dev builds only.
`packages/core/src/render3/interfaces/definition.ts`, verbatim:

```ts
export interface ClassDebugInfo {
  className: string;
  filePath?: string;
  lineNumber?: number;
  forbidOrphanRendering?: boolean;
}
```

and, verbatim, the field on the directive definition that holds it:

> *"Info related to debugging/troubleshooting for this component. This info is only available in dev
> mode."*

🔴 **Read the granularity.** It names a *class*, a *file* and a *line* — the class's line, not the
binding's. Nothing maps slot 7 of an `LView` back to the third interpolation in your template at
runtime. The mapping that does exist is the compiler's, and it lives in build-time diagnostics,
which is why a template error can name a position in your `.html` file while a runtime failure
cannot.

## Cost 5 — you are debugging against a private ABI with an expiry date

Every symbol in the emitted output starts with `ɵ`, and that prefix is the contract: private. The
`ComponentDef` header says the shape may change between versions
([06b](06b-inside-definecomponent.md)), and the instruction table carries parallel families —
`ɵɵelement` beside `ɵɵdomElement`, `ɵɵproperty` beside `ɵɵdomProperty`
([08c](08c-the-instruction-set-is-a-la-carte.md)) — so which call the compiler picks is itself an
internal decision. Anything you learn by reading generated code is knowledge with a version
attached.

The expensive consequence is not for your debugging; it is for publishing. **A library cannot ship
fully compiled Angular output**, because that output is tied to one runtime version, and a library
declares a *range*. Angular's answer is a third compilation mode, and it is in the public option
surface, verbatim:

```ts
compilationMode?: 'full' | 'partial' | 'experimental-local';
```

A library builds in `partial` mode, publishing `ɵɵngDeclare*` declarations rather than final
definitions, and the consumer's build links them — re-compiling the declaration at the application's
Angular version. **[12 · Ivy and locality](12-ivy-and-locality.md)** owns that story.

## Cost 6 — the runtime still does at runtime what locality kept out of the build

The most common wrong inference from "Angular is a compiler" is "so there is not much runtime". The
source says the opposite, twice, in comments written to explain exactly this. From
`interfaces/view.ts`, on the expando region of a view, verbatim:

> *"Unlike the "decls" and "vars" sections of `LView`, the length of this section cannot be
> calculated at compile-time because directives are matched at runtime to preserve locality."*

and from `instructions/property.ts`, on deciding whether a binding is an element property or a
directive input, verbatim:

> *"This check must be conducted at runtime so child components that add new `@Inputs` don't have to
> be re-compiled"*

Both sentences say the same thing: **a cost was moved into the runtime on purpose, to keep the
compiler local.** Directive matching, host-binding layout and input resolution are all runtime work
that a whole-program compiler could have pre-computed — and pre-computing them is precisely what
made pre-Ivy builds require regenerating the world when anything changed. This is why the honest
claim in [08](08-instructions-not-a-virtual-dom.md) is *different*, not *faster*: Angular did not
spend its compiler budget on eliminating runtime work, it spent it on eliminating whole-program
knowledge.

## Cost 7 — the compiler is not optional, and it picks your TypeScript

React's compiler is a choice. From react.dev, verbatim:

> *"React Compiler is now stable and has been tested extensively in production. While it is still an
> optional addition to React today, in the future some features may require the compiler in order to
> fully work."*

Angular's cannot be, because it is not an optimiser bolted onto working code — it is what turns your
template into something executable at all. There is a runtime-compilation path, but it is not a way
to skip the compiler; it is a way to ship it, and the documentation prices that: *"The compiler is
roughly half of Angular itself, so omitting it dramatically reduces the application payload."*

The second-order cost is the one that shows up in a dependency bump. `ngtsc` runs as a TypeScript
transformer inside `tsc`, so it is coupled to TypeScript's internal API, and `@angular/compiler-cli`
declares a hard peer range — at 22.1.5, `typescript: ">=6.0 <6.1"`. **Your TypeScript version is not
yours to choose**; it is chosen by whichever Angular you are on.
**[13 · Where the compiler runs: `ngtsc`](13-where-the-compiler-runs-ngtsc.md)** covers the mechanism.

## Gotchas

**★ Symptom: a production stack trace names something like `MyComponent_Template` and a number, and that number appears nowhere in your template.** Cause: the number is an `LView` slot index or a binding index, and neither means anything without the `TView` and `consts` pool beside it; `ClassDebugInfo` is dev-only, so a production build has no `filePath` or `lineNumber` to offer either. Fix: make production frames map back to source by emitting source maps, and reproduce in a development build where `ngDevMode` assertions and debug info exist. Source maps are not emitted unless you ask:

```json
{
  "projects": {
    "storefront": {
      "architect": {
        "build": {
          "configurations": {
            "production": {
              "sourceMap": true,
              "namedChunks": true
            }
          }
        }
      }
    }
  }
}
```

**★ Symptom: you added a directive to a component's `imports` for one element, and an unrelated element in the same template started behaving differently.** Cause: directive matching happens **at runtime**, against the whole selector set the component brought in — *"directives are matched at runtime to preserve locality"* — so an attribute selector matches everywhere it applies, not only where you were thinking about it. The compiler never froze a list of "this element has these directives"; it left the matching to be redone per view. Fix: treat the `imports` array as the scope it is, keep it minimal, and let the unused-import diagnostic do the pruning ([topic 02 · 05](../02-standalone-by-default/05-unused-imports-and-the-compiler-diagnostics.md)):

```ts
import {Component} from '@angular/core';
import {SortableColumn} from './sortable-column';

// Only the directives this template actually needs. Every extra entry widens the
// selector set that every element in the template is matched against at runtime.
@Component({
  selector: 'app-order-table',
  imports: [SortableColumn],
  template: `
    <table>
      <thead>
        <tr><th appSortable="date">Date</th><th>Total</th></tr>
      </thead>
    </table>
  `,
})
export class OrderTable {}
```

**★ Symptom: you bumped TypeScript and the Angular build refused to run, or `ng build` warns about an unsupported TypeScript version.** Cause: `ngtsc` is a `tsc` transformer, so it binds to TypeScript's internal API and `@angular/compiler-cli` declares a narrow peer range — `">=6.0 <6.1"` at 22.1.5. This is the one dependency in an Angular project that a version-bump bot must not be allowed to move on its own. Fix: pin TypeScript to the range the installed compiler declares, and let the Angular update schematic move both together:

```json
{
  "devDependencies": {
    "@angular/build": "22.1.7",
    "@angular/cli": "22.1.7",
    "@angular/compiler-cli": "22.1.5",
    "typescript": "~6.0.0"
  }
}
```

**Symptom: you published a library built the same way as your application, and consumers on a different Angular version get failures inside your components.** Cause: full compilation emits final definitions against one runtime's private ABI, and a library's `peerDependencies` allow a range. Fix: build libraries in partial mode so they publish `ɵɵngDeclare*` declarations that the consumer's build links at the consumer's version — the CLI library builder does this for you, and the option is in the public surface as `compilationMode`:

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  },
  "angularCompilerOptions": {
    "compilationMode": "partial"
  }
}
```

## Interview questions

**★ "Angular is a compiler with a framework attached" — why does that not mean Angular has a small runtime?**
Because the compiler was spent on a different goal. Ivy's design target was *locality*: compiling
each file from what that file says, with no whole-program knowledge, so that a change to one
component does not invalidate the compilation of everything that can see it. Buying locality means
declining to pre-compute anything that would require looking at other files, and the source says so
in its own comments — the expando region's length *"cannot be calculated at compile-time because
directives are matched at runtime to preserve locality"*, and the element-property-versus-input check
*"must be conducted at runtime so child components that add new `@Inputs` don't have to be
re-compiled"*. So directive matching, host-binding layout and input resolution all still happen at
runtime. What the compiler removed was the *interpretation* of templates and the need to search a
module scope, not the runtime itself.

**★ React Compiler is optional. Why can Angular's compiler never be?**
Because they do different jobs. React Compiler inserts memoization into code that already runs — the
docs describe it as *"still an optional addition to React today"*, and an app that skips it works,
just with more re-renders. Angular's compiler is what makes the code exist: a template is a separate
language that no JavaScript engine can execute, and `@Component` metadata is only a decorator
argument until something turns it into a `ɵcmp`. Skipping the step is not an option, it is only a
choice of *when*: at build time with ahead-of-time compilation, or in the browser with just-in-time,
which means shipping `@angular/compiler` — *"roughly half of Angular itself"*, in the docs' phrase.

**★ Why can a library not simply publish fully compiled Angular output?**
Because compiled output targets one runtime's private ABI, and a library declares a version *range*.
Every symbol in the output is `ɵ`-prefixed, the definition interfaces state that their shape can
change between versions, and even the choice of instruction family is an internal decision that
moves. So a fully compiled library would be correct against exactly the Angular it was built with.
Angular's answer is partial compilation: the public option surface has
`compilationMode?: 'full' | 'partial' | 'experimental-local'`, and a library built in `partial` mode
publishes `ɵɵngDeclare*` declarations instead of definitions, which the consuming application's build
links — re-compiling them at the version the consumer is actually running.

**Why is the emitted template function so hard to read, and what did Angular add to compensate?**
Because it is positional. Create instructions carry integer slot indices, update instructions carry
no index at all and ride cursors held in global state, and every number is meaningless without the
`TView` and the `consts` pool that give it context. That is exactly what makes the code fast and
compact, and exactly what makes a stack frame useless on its own. The compensation is
`ClassDebugInfo` — `className`, `filePath`, `lineNumber`, `forbidOrphanRendering` — attached to the
directive definition and, in the source's own words, *"only available in dev mode"*. Note the
granularity: it identifies the class and where the class is declared. Nothing at runtime maps a
binding index back to the expression that produced it, which is why the precise template positions
you see in error messages come from the compiler at build time, not from the runtime.

**If you had to argue against Angular's approach, what is the strongest honest case?**
That it trades generality for a set of framework-provided constructs, and you are stuck with the set.
Everything shape-varying must be `@if`, `@for`, `@switch`, `@defer`, `ng-template` or
`ViewContainerRef`; markup cannot be produced by code at all; only classes the compiler processed can
be rendered; the generated output is unreadable and privately versioned; the build step is mandatory
and it dictates your TypeScript version. A vnode framework gives all of that up in exchange for a
reconciler that must walk everything, which is a real cost — but it is a cost paid in *runtime work*,
and runtime work can be optimised later, whereas an expressiveness limit is structural. The
counter-argument is the one the design doc makes: without the fixed shape there is no reference
inversion, and without reference inversion the bundle contains everything the runtime might have
needed.

---

← Prev: [08e · Only compiled classes are renderable](08e-only-compiled-classes-are-renderable.md) · Index: [Topic index](README.md) · Next → [Static analysability is the load-bearing constraint](09-static-analysability-is-the-load-bearing-constraint.md)
