---
title: "The third artefact is the interesting one — `ɵɵComponentDeclaration` is declared as `unknown`, a phantom type with no structure and no runtime, whose ten type *arguments* are the entire published metadata of your component and are how a library compiled six months ago still type-checks against your template today"
sidebar_label: "06d · The ɵfac and the .d.ts"
sidebar_position: 6.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/factory.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/factory.ts),
> [`packages/compiler/src/render3/r3_factory.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_factory.ts),
> [`packages/compiler/src/compiler_facade_interface.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/compiler_facade_interface.ts) (`FactoryTarget`),
> [`packages/compiler/src/render3/view/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/compiler.ts) (`createComponentType`, `createBaseDirectiveTypeParams`),
> [`packages/core/src/render3/interfaces/public_definitions.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/public_definitions.ts).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two artefacts remain from [06](06-what-the-compiler-emits.md)'s list of three, and the second is the
one worth staying up for. `ɵfac` is a separate static holding a factory function that takes one
parameter — `__ngFactoryType__` — so a subclass can reuse a base class's constructor logic, and whose
unresolvable dependencies become calls to `ɵɵinvalidFactoryDep(index)` rather than build failures. The
`.d.ts` declaration is stranger and more important: `ɵɵComponentDeclaration` is declared as **`unknown`**.
It has no structure, no members and no runtime existence at all. Its ten *type arguments* carry the
component's selector, its input map, its output map, its query field names, its `ngContent` selectors and
its standalone and signal flags — and a downstream compilation reads all of it straight back out of a
type that erases to nothing. That is why the `.d.ts` is Angular's interchange format instead of a JSON
sidecar, and it is the mechanical answer to "how does a library compiled six months ago still type-check
against my template?"**

## `ɵfac` — the factory, and its one parameter

The field name is set in `packages/compiler-cli/src/ngtsc/annotations/common/src/factory.ts`, verbatim:

```ts
export function compileNgFactoryDefField(metadata: R3FactoryMetadata): CompileResult {
  const res = compileFactoryFunction(metadata);
  return {
    name: 'ɵfac',
    initializer: res.expression,
    statements: res.statements,
    type: res.type,
    deferrableImports: null,
  };
}
```

The generated function takes one parameter, and `packages/compiler/src/render3/r3_factory.ts` names it:

```ts
export function compileFactoryFunction(meta: R3FactoryMetadata): R3CompiledExpression {
  const t = o.variable('__ngFactoryType__');
  // …
  const typeForCtor = !isDelegatedFactoryMetadata(meta)
    ? new o.BinaryOperatorExpr(o.BinaryOperator.Or, t, meta.type.value)
    : t;
```

`t || meta.type.value` — the emitted body instantiates `__ngFactoryType__ || MyComponent`. **That `||` is
how a subclass reuses a base class's factory:** the runtime passes the concrete type, the factory
constructs *that* type with the base class's resolved dependency list, and if nothing is passed it falls
back to the class the factory was generated for.

Which kind of thing is being constructed is carried by `FactoryTarget`, from
`packages/compiler/src/compiler_facade_interface.ts`, verbatim:

```ts
export enum FactoryTarget {
  Directive = 0,
  Component = 1,
  Injectable = 2,
  Pipe = 3,
  NgModule = 4,
  Service = 5,
}
```

`Service = 5` is new in v22, for the `@Service` decorator.

### An unresolvable dependency does not fail the build

From the same file:

```ts
if (dep.token === null) {
  return o.importExpr(R3.invalidFactoryDep).callFn([o.literal(index)]);
}
```

A constructor parameter the compiler cannot turn into a DI token becomes a **call to
`ɵɵinvalidFactoryDep(index)` in the emitted factory**, not a compile error. The build succeeds; the
failure moves to the moment something tries to construct the class, and the index tells you which
parameter. That is a deliberate trade — one bad parameter should not stop an entire compilation — and it
is why "it built fine and blew up at runtime" is a legitimate outcome for a DI mistake rather than a sign
something is broken.

## What lands in the `.d.ts`

`packages/compiler/src/render3/view/compiler.ts` builds the type, verbatim:

```ts
export function createComponentType(meta: R3ComponentMetadata<R3TemplateDependency>): o.Type {
  const typeParams = createBaseDirectiveTypeParams(meta);
  typeParams.push(stringArrayAsType(meta.template.ngContentSelectors));
  typeParams.push(o.expressionType(o.literal(meta.isStandalone)));
  typeParams.push(createHostDirectivesType(meta));
  if (meta.isSignal) {
    typeParams.push(o.expressionType(o.literal(meta.isSignal)));
  }
  return o.expressionType(o.importExpr(R3.ComponentDeclaration, typeParams));
}

function createBaseDirectiveTypeParams(meta: R3DirectiveMetadata): o.Type[] {
  // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
  // string literal, which must be on one line.
  const selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, '') : null;

  return [
    typeWithParameters(meta.type.type, meta.typeArgumentCount),
    selectorForType !== null ? stringAsType(selectorForType) : o.NONE_TYPE,
    meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
    o.expressionType(getInputsTypeExpression(meta)),
    o.expressionType(stringMapAsLiteralExpression(meta.outputs)),
    stringArrayAsType(meta.queries.map((q) => q.propertyName)),
  ];
}
```

Six base parameters, four more for components. And the type they are arguments *to*, from
`packages/core/src/render3/interfaces/public_definitions.ts` — 🔴 **read the last line**:

```ts
/**
 * @publicApi
 */
export type ɵɵComponentDeclaration<
  T,
  Selector extends String,
  ExportAs extends string[],
  // `string` keys are for backwards compatibility with pre-16 versions.
  InputMap extends {
    [key: string]: string | {alias: string | null; required: boolean; isSignal?: boolean};
  },
  OutputMap extends {[key: string]: string},
  QueryFields extends string[],
  NgContentSelectors extends string[],
  // Optional as this was added in Angular v14. All pre-existing components
  // are not standalone.
  IsStandalone extends boolean = false,
  HostDirectives = never,
  IsSignal extends boolean = false,
> = unknown;
```

**`= unknown`.** The type has no structure, no members and no runtime. It is a phantom whose *type
arguments* are the entire published metadata of the component, and a downstream compilation reads the
selector, the input map, the output map, the query field names, the `ngContent` selectors and the
standalone and signal flags straight back out of the type arguments of a type that erases to nothing.

That is how a library compiled six months ago still type-checks against your template today, and it is
why the `.d.ts` is the interchange format rather than a JSON sidecar. It costs nothing in the emitted
declaration file, it travels wherever the types travel, and it needs no separate resolution step — which
is exactly what ViewEngine's `.metadata.json` had to be, and why nobody misses it.

The siblings in the same file follow the same design:

| Declaration | Shape |
|---|---|
| `ɵɵDirectiveDeclaration` | the same six base parameters, with `NgContentSelectors extends never = never` — the comment in `createDirectiveType` reads *"Directives have no NgContentSelectors slot, but instead express a `never` type so that future fields align"* |
| `ɵɵPipeDeclaration<T, Name, IsStandalone>` | name and standalone flag |
| `ɵɵNgModuleDeclaration<T, Declarations, Imports, Exports>` | the three module lists, as types |
| `ɵɵInjectorDeclaration<T>` | one parameter |
| `ɵɵFactoryDeclaration<T, CtorDependencies>` | `= (parent?: Type<any>) => any`, with `CtorDependency` carrying the `@Attribute` / `@Optional` / `@Host` / `@Self` / `@SkipSelf` flags |

⚠️ There is a second, later compilation mode in which a library ships `ɵɵngDeclareComponent(...)` calls
instead of `ɵɵdefineComponent(...)` and a linker converts them at the *application's* Angular version.
**12 · Ivy and locality** *(not written yet)* owns it; the `.d.ts` declarations above are the same in
both modes, which is precisely what makes the scheme work.

## Gotchas

**★ Symptom: you tried to read `ɵɵComponentDeclaration` — importing it, inspecting it, checking a component against it at runtime — and there is nothing there.** Cause: it is `= unknown`. It is a pure type alias that erases completely; no value is emitted, no property exists, and the only information it carries lives in its type arguments at compile time. Fix: the runtime question has a public answer, and it is `reflectComponentType`:

```ts
// src/app/tooling/component-report.ts
import {reflectComponentType, Type} from '@angular/core';

export function componentReport(component: Type<unknown>): string {
  const mirror = reflectComponentType(component);
  if (mirror === null) {
    return 'not a component';
  }
  return `${mirror.selector} · standalone=${mirror.isStandalone} · inputs=${mirror.inputs.length}`;
}
```

**★ Symptom: you renamed a library component's selector, the library's source is correct, and consumer templates still type-check against the old name.** Cause: the consumer never reads your source. It reads the `ɵɵComponentDeclaration` type arguments in your published `.d.ts`, so until that file is regenerated the old selector is still the published fact. Fix: rebuild the library so the declaration is re-emitted, and treat the `.d.ts` as the artefact under review — it is the API surface, not a by-product:

```ts
// packages/report-widgets/src/report-badge.ts
import {Component, input} from '@angular/core';

@Component({
  selector: 'rw-report-badge',
  template: `<span>{{ label() }}</span>`,
})
export class ReportBadge {
  readonly label = input.required<string>();
}
```

**★ Symptom: your build succeeded and the app throws when a particular service or component is constructed, naming a parameter index.** Cause: `if (dep.token === null) { return o.importExpr(R3.invalidFactoryDep).callFn([o.literal(index)]); }` — a constructor parameter the compiler could not turn into a DI token becomes a call to `ɵɵinvalidFactoryDep(index)` inside the emitted factory instead of a compile error. The index is the parameter position. Fix: give the parameter a resolvable token — an interface is not one, because interfaces do not exist at runtime:

```ts
// src/app/reports/report-exporter.ts
import {inject, Injectable, InjectionToken} from '@angular/core';

export interface ExportOptions {
  readonly format: 'csv' | 'pdf';
}

export const EXPORT_OPTIONS = new InjectionToken<ExportOptions>('EXPORT_OPTIONS', {
  providedIn: 'root',
  factory: () => ({format: 'csv'}),
});

@Injectable({providedIn: 'root'})
export class ReportExporter {
  private readonly options = inject(EXPORT_OPTIONS);

  extension(): string {
    return this.options.format;
  }
}
```

**Symptom: a selector written across several lines in the decorator appears on one line in the `.d.ts` and a string comparison against it fails.** Cause: `createBaseDirectiveTypeParams` strips them, and says why in a comment: *"On the type side, remove newlines from the selector as it will need to fit into a TypeScript string literal, which must be on one line."* The runtime `selectors` field and the `.d.ts` `Selector` type parameter are therefore not always character-identical. Fix: keep multi-element selectors on one line so both sides agree:

```ts
// src/app/ui/focus-trap.ts
import {Directive} from '@angular/core';

@Directive({selector: '[appFocusTrap], [app-focus-trap]'})
export class FocusTrap {}
```

**Symptom: a `.d.ts` from an older library has fewer type arguments than ten and still compiles against v22.** Cause: the last three parameters have defaults, and the source says why in a comment — *"Optional as this was added in Angular v14. All pre-existing components are not standalone."* So `IsStandalone` defaults to `false`, `HostDirectives` to `never`, and `IsSignal` to `false`, which is exactly the correct reading of a pre-v14 declaration. Fix: nothing to fix — this is the mechanism that lets one compiler consume declarations emitted by several older ones, and it is worth copying if you ever design a type-level interchange format.

**Symptom: you expected a directive's declaration to have an `NgContentSelectors` slot and found `never`.** Cause: `createDirectiveType`'s comment states the design — *"Directives have no NgContentSelectors slot, but instead express a `never` type so that future fields align"*. The slot is kept and filled with `never` rather than omitted, so that the parameter positions of `ɵɵDirectiveDeclaration` and `ɵɵComponentDeclaration` stay aligned. Fix: nothing to fix; read it as deliberate padding, and do not infer that a directive can project content.

## Interview questions

**★ Why is `ɵɵComponentDeclaration` declared as `= unknown`?**
Because nothing reads it at runtime — only its type arguments matter, and only during a downstream compilation. The declaration exists so that a consumer's compiler can recover a component's selector, input map, output map, query field names, `ngContent` selectors and standalone/signal flags from the published `.d.ts`. All of that lives in the type arguments; the type itself never needs members, never needs a value, and never needs to be assignable to anything. Erasing it to `unknown` costs nothing in the emitted declaration file and makes it impossible for anyone to build a runtime dependency on it by accident.

**★ How does a library compiled six months ago still type-check against a template you wrote today?**
Through its `.d.ts`. Angular's interchange format is a type-level one: `ɵɵComponentDeclaration<…>` in the published declaration file carries the entire metadata of each exported component as type arguments, and the consuming compilation reads them out when it type-checks your template. Nothing in your build reads the library's source, and there is no sidecar file to resolve — which is exactly what ViewEngine's `.metadata.json` had to be. The design doc's own sentence is still accurate: *"The information needed by reference inversion and type-checking is included in the type declaration of the `ɵcmp` in the `.d.ts`."*

**★ Why is the factory a separate `ɵfac` static rather than a `factory:` property inside the definition, as the 2018 design doc shows?**
Because a factory is not component-specific. `FactoryTarget` has six members — `Directive`, `Component`, `Injectable`, `Pipe`, `NgModule` and `Service` — and all of them need the same construction logic, so it belongs in its own field rather than nested inside a component definition. Keeping it separate is also what makes inheritance work: the generated function takes one parameter, `__ngFactoryType__`, and constructs `__ngFactoryType__ || MyComponent`, so a subclass can call its base class's `ɵfac` with its own type and get an instance of *itself* built with the base's resolved dependency list.

**What does `ɵɵinvalidFactoryDep` do, and why does an unresolvable dependency not fail the build?**
The compiler emits `ɵɵinvalidFactoryDep(index)` in place of the injection for any constructor parameter whose token it could not determine — `if (dep.token === null)`. The build succeeds and the failure is deferred to the moment something constructs the class, with the parameter index carried in the call. The trade is deliberate: one unresolvable parameter should not abort an entire compilation, and the common causes — an interface used as a type, a missing `@Inject`, a type that erases — are all things a developer can only fix in one place anyway. The practical consequence is that "it compiled" is not evidence that DI is wired correctly.

**Why do the last three type parameters of `ɵɵComponentDeclaration` have defaults?**
So that declarations emitted by older compilers remain readable by newer ones. The source comment says it directly — *"Optional as this was added in Angular v14. All pre-existing components are not standalone."* A `.d.ts` published before v14 supplies seven type arguments; the defaults fill in `IsStandalone = false`, `HostDirectives = never` and `IsSignal = false`, which is the correct interpretation of a pre-v14 component. It is the same versioning discipline as adding an optional field to a wire format, applied to TypeScript's type parameter list, and it is the reason an application can consume libraries built against several different Angular versions in one compilation.

---

← Prev: [`decls`, `vars`, `consts` and `dependencies`](06c-decls-vars-consts-and-dependencies.md) · Index: [Topic index](README.md) · Next → [07 · The create pass and the update pass](07-the-create-pass-and-the-update-pass.md)
