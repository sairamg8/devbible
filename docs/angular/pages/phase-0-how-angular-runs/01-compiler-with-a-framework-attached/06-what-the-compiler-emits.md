---
title: "The compiler does not rewrite your class or generate a parallel file — it bolts three artefacts onto the class you wrote, `ɵcmp` and `ɵfac` as static fields and a type declaration in the emitted `.d.ts`, and the canonical design-doc example of that is wrong in four specific ways"
sidebar_label: "06 · What the compiler emits: ɵcmp"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md) (⚠️ a 2018 draft — quoted for shape only, and corrected below),
> [`packages/compiler/src/render3/view/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/compiler.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/factory.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/factory.ts),
> [`packages/core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts),
> [`packages/core/src/render3/interfaces/public_definitions.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/public_definitions.ts);
> and angular.dev [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), ⚠️ which is stale on this subject and is contradicted below.
> Documentation-validated; **no sandbox run** — no compiled output was produced or measured, and every
> code block below is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Chunks 01–05 were about the language you write. This one is about what is left of it after the
compiler has run, and the shape is not what most people picture. `ngtsc` does not rewrite your class and
it does not generate a parallel file. It leaves the class exactly where it is and bolts **static fields**
onto it: `ɵcmp`, produced by a call to `ɵɵdefineComponent`, and `ɵfac`, produced by a sibling factory
compiler. It then writes a **type declaration** into the emitted `.d.ts` so that a downstream
compilation — someone else's application, six months later — can read your component's selector, inputs
and outputs back out without ever seeing your source. Everything a later phase asks about locality,
libraries, partial compilation and tree-shaking is a consequence of that additive design, and the
easiest way to get it wrong is to read the design doc in the repo, which is a 2018 draft and is wrong in
four specific ways.**

## Three artefacts, one class

The compiler's job for a `@Component` is to produce:

1. a static field **`ɵcmp`** on the class, built by `ɵɵdefineComponent`
   ([06b](06b-inside-definecomponent.md));
2. a static field **`ɵfac`**, built by the factory compiler
   ([06d](06d-the-factory-and-the-d-ts-declaration.md));
3. a **type declaration** in the emitted `.d.ts` — `ɵɵComponentDeclaration<…>`, which is the interchange
   format between separately compiled libraries ([06d](06d-the-factory-and-the-d-ts-declaration.md)).

…plus a fourth that exists for the duration of the build only: a **Type Check Block**, emitted into a
synthetic `.ngtypecheck.ts` file that is never written to disk. **[14 · Template type checking](14-template-type-checking.md)** owns that one.

Nothing else. There is no `.metadata.json`, no generated `.ngfactory.ts`, no separate output file — those
belong to ViewEngine, which `ngtsc` replaced. angular.dev's
[AOT page](https://angular.dev/tools/cli/aot-compiler) still describes the old metadata collector and its
`.metadata.json` sidecar; **it is stale on this point**, and everything on this page is read from the
v22.1.5 source instead.

## The canonical before/after — and four things wrong with it

The Ivy architecture design doc in the repo carries the clearest before/after anyone has written.
⚠️ **It is a 2018 draft, still shipped in the tree, and it is wrong in four specific ways at v22.1.5.**
Quoted here for *shape*, then corrected field by field. Verbatim, the input:

```ts
import {Component, Input} from '@angular/core';

@Component({
  selector: 'greet',
  template: '<div> Hello, {{name}}! </div>',
})
export class GreetComponent {
  @Input() name: string;
}
```

and the doc's *"In `ngtsc` this is instead emitted as"*:

```js
const i0 = require('@angular/core');
class GreetComponent {}
GreetComponent.ɵcmp = i0.ɵɵdefineComponent({
  type: GreetComponent,
  tag: 'greet',
  factory: () => new GreetComponent(),
  template: function (rf, ctx) {
    if (rf & RenderFlags.Create) {
      i0.ɵɵelementStart(0, 'div');
      i0.ɵɵtext(1);
      i0.ɵɵelementEnd();
    }
    if (rf & RenderFlags.Update) {
      i0.ɵɵadvance();
      i0.ɵɵtextInterpolate1('Hello ', ctx.name, '!');
    }
  },
});
```

and the `.d.ts`:

```ts
import * as i0 from '@angular/core';
export class GreetComponent {
  static ɵcmp: i0.NgComponentDef<GreetComponent, 'greet', {input: 'input'}>;
}
```

The doc's own sentence about that last block is worth keeping, because it is still true and it is the
thesis of [06d](06d-the-factory-and-the-d-ts-declaration.md):

> *"The information needed by reference inversion and type-checking is included in the type declaration
> of the `ɵcmp` in the `.d.ts`."*

🔴 **The four corrections, each readable in the v22.1.5 source:**

| The draft says | v22.1.5 emits | Where |
|---|---|---|
| `tag: 'greet'` | `selectors: [['greet']]` — a *list* of selectors, because a directive may match several | `compiler.ts`, `definitionMap.set('selectors', asLiteral(selectors))` |
| `factory: () => new GreetComponent()` inside the definition | a **separate static** `ɵfac` on the class | `annotations/common/src/factory.ts`, `name: 'ɵfac'` |
| a `.d.ts` type `NgComponentDef` with three type parameters | `ɵɵComponentDeclaration` with **ten** | `interfaces/public_definitions.ts` |
| a bare `ɵɵdefineComponent({...})` call | the whole call wrapped in `noSideEffects(() => …)` | `render3/definition.ts` ([06b](06b-inside-definecomponent.md)) |

The *shape* the draft gets right, and it is the load-bearing part: a `template` function of the form
`(rf, ctx) => { … }` with two `if` blocks keyed on bit flags, plus bare integer indices in the
instruction calls. [Chunk 07](07-the-create-pass-and-the-update-pass.md) is entirely about why that
function looks like that.

⚠️ **Nothing on this page is a dump of real compiled output.** The block above is a verbatim quote from a
design document; no build was run to produce it, and the four corrections come from reading the compiler,
not from reading a bundle.

## The emission order, from the compiler that writes it

`packages/compiler/src/render3/view/compiler.ts` builds the definition object one `definitionMap.set`
call at a time. `baseDirectiveFields` runs first — verbatim, comments included:

```ts
// e.g. `type: MyDirective`
definitionMap.set('type', meta.type.value);

// e.g. `selectors: [['', 'someDir', '']]`
if (selectors.length > 0) {
  definitionMap.set('selectors', asLiteral(selectors));
}
```

then `compileComponentFromMetadata` adds the component-only fields:

```ts
definitionMap.set('decls', o.literal(tpl.root.decls as number));
definitionMap.set('vars', o.literal(tpl.root.vars as number));
if (tpl.consts.length > 0) {
  if (tpl.constsInitializers.length > 0) {
    definitionMap.set(
      'consts',
      o.arrowFn([], [...tpl.constsInitializers, new o.ReturnStatement(o.literalArr(tpl.consts))]),
    );
  } else {
    definitionMap.set('consts', o.literalArr(tpl.consts));
  }
}
definitionMap.set('template', templateFn);
```

Note `selectors` is emitted only `if (selectors.length > 0)` and `consts` only `if (tpl.consts.length > 0)`
— **fields are omitted rather than set to a default**, which is why two components' definitions can have
different key sets.

⚠️ **That is what the compiler does today, not a contract.** `ComponentDef`'s own interface header says
so, verbatim:

> *"NOTE: Always use `defineComponent` function to create this object, never create the object directly
> since the shape of this object can change between versions."*

The order is worth knowing because it is what you read in a stack frame or a source map, not because
anything promises it will hold. [06c](06c-decls-vars-consts-and-dependencies.md) takes `decls`, `vars`,
`consts` and `dependencies` in turn.

## Two emission quirks with visible consequences

Both from `compileComponentFromMetadata`, verbatim:

```ts
if (!hasStyles && meta.encapsulation === core.ViewEncapsulation.Emulated) {
  // If there is no style, don't generate css selectors on elements
  meta.encapsulation = core.ViewEncapsulation.None;
}

// Only set view encapsulation if it's not the default value
if (meta.encapsulation !== core.ViewEncapsulation.Emulated) {
  definitionMap.set('encapsulation', o.literal(meta.encapsulation));
}
```

A component with **no styles** silently compiles as `ViewEncapsulation.None` — no `_ngcontent-*`
attributes are emitted on its elements — and `encapsulation` is omitted from the definition entirely
whenever it is `Emulated`. Neither is a bug; both surprise people reading emitted output or writing CSS
that depends on the attribute being there.

## Gotchas

**★ Symptom: you read a blog post or a doc page about `.ngfactory.ts` files or `.metadata.json` and cannot find either in your build output.** Cause: those are ViewEngine artefacts. `ngtsc` is a TypeScript *transformer* that adds static fields to your existing classes and writes type declarations into the normal `.d.ts`; it emits no sidecar files. angular.dev's AOT page still describes the old collector and its `.metadata.json`, and it is stale. Fix: read the class's static fields instead — everything the compiler produced for a component is `ɵcmp`, `ɵfac` and the `.d.ts` declaration, and all three live on or beside the class you wrote:

```ts
// src/app/reports/report-badge.ts — the compiler adds ɵcmp and ɵfac to THIS class
import {Component, input} from '@angular/core';

@Component({
  selector: 'app-report-badge',
  template: `<span class="badge">{{ label() }}</span>`,
})
export class ReportBadge {
  readonly label = input.required<string>();
}
```

**★ Symptom: your CSS selector `[_ngcontent-abc]` matches nothing, or a global style leaks into a component you expected to be encapsulated.** Cause: `if (!hasStyles && meta.encapsulation === core.ViewEncapsulation.Emulated) { meta.encapsulation = core.ViewEncapsulation.None; }` — a component with no styles of its own compiles as `None`, so no content attributes are emitted for it. Emulated encapsulation is a property of components that *have* styles. Fix: if you need the attribute, give the component a style block; if you were relying on encapsulation to protect it, encapsulation was never active:

```ts
// src/app/reports/report-shell.ts
import {Component} from '@angular/core';

@Component({
  selector: 'app-report-shell',
  styles: `:host { display: block; }`,
  template: `<ng-content />`,
})
export class ReportShell {}
```

**★ Symptom: you wrote a test or a codemod that reads a field off `ɵcmp` and it broke on a patch upgrade.** Cause: the field set and the field order are what `definitionMap.set` happens to do at a version — `selectors` is only emitted when there is at least one, `consts` only when the template has constants, `encapsulation` only when it is not `Emulated`. `ComponentDef`'s header warns outright that *"the shape of this object can change between versions."* Fix: never read `ɵcmp`. If you need a component's metadata at runtime, `reflectComponentType` is the public, supported way to ask:

```ts
// src/app/tooling/describe-component.ts
import {reflectComponentType, Type} from '@angular/core';

export function describeSelector(component: Type<unknown>): string | null {
  return reflectComponentType(component)?.selector ?? null;
}
```

**Symptom: you opened your component's `.ts` file looking for `ɵcmp` and it is not there.** Cause: the static fields are added during *emit*, not written back to your source. The file on disk is the file you wrote; `ɵcmp` and `ɵfac` exist in the emitted JavaScript and the emitted `.d.ts`. Fix: look in the build output, or — better — do not look at all, because the definition's shape is explicitly not stable. What you can inspect from your own code is the public reflection API, which reads the same information through a supported surface:

```ts
// src/app/tooling/is-component.ts
import {reflectComponentType, Type} from '@angular/core';

export function isComponent(candidate: Type<unknown>): boolean {
  return reflectComponentType(candidate) !== null;
}
```

**Symptom: a class you decorated with `@Directive` has no `ɵcmp` and your tooling reports it as "not a component".** Cause: it is not one. The compiler emits `ɵcmp` for components and `ɵdir` for directives — different field, different definition shape, no template function and no `decls`/`vars`, because a directive has no view of its own. Fix: if you are branching on what a class is, branch through the public API rather than on field presence; `reflectComponentType` returns `null` for a directive, which is the answer you wanted:

```ts
// src/app/ui/focus-trap.ts — this class gets ɵdir, not ɵcmp
import {Directive, ElementRef, inject} from '@angular/core';

@Directive({selector: '[appFocusTrap]'})
export class FocusTrap {
  private readonly host = inject(ElementRef<HTMLElement>);

  focus(): void {
    this.host.nativeElement.focus();
  }
}
```

**Symptom: your `templateUrl` component and its inline-`template` twin produce different definitions and you cannot see why.** Cause: they do not — the compiler reads the external file at build time and inlines it, which [chunk 01](01-the-template-is-a-separate-language.md) establishes. What *does* differ is `styles`: a component with `styleUrl` has styles, so `hasStyles` is true and the encapsulation quirk above does not fire. Fix: compare the style inputs, not the template inputs, when two apparently identical components render differently:

```ts
// src/app/reports/report-card.ts — has styles, so Emulated encapsulation stays on
import {Component} from '@angular/core';

@Component({
  selector: 'app-report-card',
  templateUrl: './report-card.html',
  styleUrl: './report-card.css',
})
export class ReportCard {}
```

## Interview questions

**★ What exactly does the Angular compiler do to a component class — does it rewrite it, or generate a new file?**
Neither. It leaves the class where it is and adds static fields to it: `ɵcmp`, built by `ɵɵdefineComponent`, and `ɵfac`, built by the factory compiler. It also writes a type declaration into the normal emitted `.d.ts`, and during the build only it produces a Type Check Block in a synthetic file that is never written to disk. There is no `.ngfactory.ts` and no `.metadata.json` — those were ViewEngine, and angular.dev's AOT page has not caught up. That "additive static fields" design is what the locality principle buys: your class is still your class, and everything the compiler knows about it travels with it, in the same file, into the same bundle.

**★ The Ivy design doc in the repo shows a `tag:` field and an `NgComponentDef` type. Should you trust it?**
For the shape, yes; for the artefacts, no. It is a 2018 draft still shipped in the tree, and it is correct about the thing that matters — a `template` function of the form `(rf, ctx) => { … }` with two flag-keyed `if` blocks and integer-indexed instruction calls. It is wrong on four specifics at v22.1.5: the field is `selectors` (a list, because a directive can match several), the factory is a separate `ɵfac` static rather than a `factory:` property, the `.d.ts` type is `ɵɵComponentDeclaration` with ten type parameters rather than `NgComponentDef` with three, and the whole call is wrapped in `noSideEffects`. Citing a design doc for architecture and the source for artefacts is the general rule, and it applies to angular.dev's AOT page too.

**★ Why does a component with no styles get `ViewEncapsulation.None`, and when does that matter?**
Because emulated encapsulation is implemented by stamping `_ngcontent-*` attributes onto elements and rewriting the component's CSS selectors to match them — and with no CSS there is nothing to rewrite, so the compiler skips the whole mechanism: `if (!hasStyles && meta.encapsulation === core.ViewEncapsulation.Emulated) { meta.encapsulation = core.ViewEncapsulation.None; }`. It matters when something outside the component depends on those attributes existing — a global stylesheet targeting them, a test selector, or an assumption that a style defined elsewhere cannot reach into this component. The last reading is the dangerous one: a styleless component was never protected in the first place.

**Why are some fields missing from an emitted definition rather than present with a default value?**
Because the compiler guards each `definitionMap.set` — `selectors` only when there is at least one, `consts` only when the template produced constants, `encapsulation` only when it is not `Emulated`. An absent key is smaller than a key holding a default, and the runtime supplies the default anyway when it builds the `ComponentDef` from the definition object. The practical consequence is that two components can produce definitions with different key sets, so any code that iterates a definition's keys — a test assertion, a devtools panel, a codemod — is reading an implementation detail the framework explicitly declines to freeze.

**Why is it correct to describe `ngtsc` as a TypeScript transformer rather than a separate compiler?**
Because it runs inside the TypeScript compilation rather than beside it: it is wired in as a custom transformer, so it sees the same `ts.Program`, the same type checker and the same emit pipeline that compiles the rest of your code. That is what makes the output *additive* — there is one emit, producing your `.js` and your `.d.ts`, with Angular's static fields and type declarations added into them. It is also why Angular's TypeScript peer range is a hard pin (`>=6.0 <6.1` at 22.1.5) rather than a suggestion: a transformer depends on compiler internals, and **[13 · Where the compiler runs](13-where-the-compiler-runs-ngtsc.md)** is that argument in full.

---

← Prev: [05 · Expressions, statements and safe navigation](05-expressions-statements-and-safe-navigation.md) · Index: [Topic index](README.md) · Next → [Inside `ɵɵdefineComponent`](06b-inside-definecomponent.md)
