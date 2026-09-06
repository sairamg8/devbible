---
title: "The last five `@NgModule` responsibilities: `bootstrap` and `schemas` moved almost unchanged onto smaller things, `entryComponents` was deleted outright in v16, and `id` and `jit` are still here because nothing standalone needs them"
sidebar_label: "07c · The fields that moved, and the ones deleted"
sidebar_position: 7.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5` —
> [`packages/core/src/metadata/ng_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/ng_module.ts),
> [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts);
> `ng_module.ts` at tag `15.2.10` for the `entryComponents` deprecation notice; and the
> [v16.0.0 release notes](https://github.com/angular/angular/releases/tag/16.0.0).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**These five rows are the quiet ones, and each is quiet for a different reason. `bootstrap` became the first argument of a function and nothing else changed. `schemas` kept its exact name and its exact tokens and simply moved onto a smaller container, which is the entire improvement — a `CUSTOM_ELEMENTS_SCHEMA` on a module bought silence for every template it declared, and on a component it buys silence for one. `entryComponents` was not relocated at all: Ivy made it inert in v9, it was deprecated then, and it was deleted from the public API in 16.0.0 with the release notes saying plainly that usages *"weren't doing anyting"*. And `id` and `jit` are still on `@NgModule` at 22.1.5, unchanged, with no standalone equivalent — correctly, because both exist to support runtime lookup of a module, and a standalone component is reached by importing its class.** The full nine-row table is on [chunk 07](07-what-replaced-each-ngmodule-responsibility.md).

## `bootstrap` → the first argument of `bootstrapApplication`

```ts
// before
@NgModule({ declarations: [App], imports: [BrowserModule], bootstrap: [App] })
export class AppModule {}
```

```ts
// after — src/main.ts
bootstrapApplication(App, appConfig).catch(err => console.error(err));
```

A standalone class left in a module's `bootstrap` array is the compile-time error NG6009, `NGMODULE_BOOTSTRAP_IS_STANDALONE`, whose enum doc reads *"Raised when a standalone component is part of the bootstrap list of an NgModule."* Both that error and the `BrowserModule` question belong to [chunk 02 · The `NgModule` bootstrap it replaced](01b-the-ngmodule-bootstrap-it-replaced.md) and [chunk 01 · `bootstrapApplication`, line by line](01-bootstrapapplication-line-by-line.md); nothing further is added here.

## `schemas` → the same field, on a smaller thing

The tokens did not change. `CUSTOM_ELEMENTS_SCHEMA` and `NO_ERRORS_SCHEMA` are both still exported from `@angular/core` 22.1.5, both typed `SchemaMetadata`. What changed is the blast radius — and there is a readable type difference between the two declarations in the goldens:

```ts
// @NgModule
schemas?: Array<SchemaMetadata | any[]>;

// @Component
schemas?: SchemaMetadata[];
```

The module form allows nested arrays; the component form does not. That is a small tell about intent: a module's schemas were expected to be composed from shared constants across a large surface, a component's are expected to be a literal one-element list.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';

@Component({
  selector: 'app-video-panel',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<vendor-video-player [src]="src()"></vendor-video-player>`,
})
export class VideoPanelComponent {
  readonly src = input.required<string>();
}
```

**What you lost.** Nothing, except the ability to silence unknown-element checking for forty templates with one line.

**What you gained.** Exactly that. Under `NgModule`, one custom element anywhere in a feature forced every template declared in that module to lose the check, so a typo like `<dvi>` in an unrelated file went unreported for as long as the module lived. Now the escape hatch stops at the file that needs it.

**The surprise.** `schemas` on a `standalone: false` component is **NG2010**, and the message is verbatim from `annotations/component/src/handler.ts`:

```ts
makeDiagnostic(
  ErrorCode.COMPONENT_NOT_STANDALONE,
  component.get('schemas')!,
  `'schemas' is only valid on a component that is standalone.`,
)
```

The unknown-element and unknown-property errors that `schemas` suppresses — NG8001, NG8002, and their runtime counterparts — are chunk **06 · `'x' is not a known element`** *(not written yet)*.

## `entryComponents` → deleted, not replaced

The historical deprecation notice, verbatim from `ng_module.ts` at tag `15.2.10`:

```ts
/**
 * @deprecated
 * Since 9.0.0. With Ivy, this property is no longer necessary.
 * (You may need to keep these if building a library that will be consumed by a View Engine
 * application.)
 */
entryComponents?: Array<Type<any>|any[]>;
```

and the v16.0.0 release notes, verbatim — the typo *"anyting"* is upstream and is quoted as written:

> *"`entryComponents` has been deleted from the `@NgModule` and `@Component` public APIs. Any usages can be removed since they weren't doing anyting."*

> *"`ANALYZE_FOR_ENTRY_COMPONENTS` injection token has been deleted. Any references can be removed."*

Dynamic creation is now a function call, and both v22.1.5 signatures are in the core golden:

```ts
export function createComponent<C>(component: Type<C>, options: {
    environmentInjector: EnvironmentInjector;
    hostElement?: Element;
    elementInjector?: Injector;
    projectableNodes?: Node[][];
    directives?: (Type<unknown> | DirectiveWithBindings<unknown>)[];
    bindings?: Binding[];
}): ComponentRef<C>;
```

```ts
// ViewContainerRef
abstract createComponent<C>(componentType: Type<C>, options?: {
    index?: number;
    injector?: Injector;
    ngModuleRef?: NgModuleRef<unknown>;
    environmentInjector?: EnvironmentInjector | NgModuleRef<unknown>;
    projectableNodes?: Node[][];
    directives?: (Type<unknown> | DirectiveWithBindings<unknown>)[];
    bindings?: Binding[];
}): ComponentRef<C>;
```

**The surprise.** The factory machinery `entryComponents` existed to feed is gone too. `ComponentFactory`, `ComponentFactoryResolver` and `createNgModuleRef` were removed in **22.0.0** and are absent from the v22.1.5 public-API golden. [Chunk 03](03-standalone-by-default-which-version-changed-what.md) owns that timeline.

## `id` and `jit` → still `NgModule`-only, and correctly so

Both survive at 22.1.5 with their doc comments unchanged:

```ts
/**
 * A name or path that uniquely identifies this NgModule in `getNgModuleById`.
 * If left `undefined`, the NgModule is not registered with `getNgModuleById`.
 */
id?: string;

/**
 * When present, this module is ignored by the AOT compiler.
 * It remains in distributed code, and the JIT compiler attempts to compile it
 * at run time, in the browser.
 * To ensure the correct behavior, the app must import `@angular/compiler`.
 */
jit?: true;
```

There is no standalone equivalent to either, and neither absence is an oversight. `getNgModuleById<T>(id: string): Type<T>` exists so code that only has a *string* can find a module; a standalone component is reached by importing its class, so there is nothing to look up. `jit: true` opts a module out of AOT, and a standalone component has no container to opt out on its behalf — the equivalent decision is made per build, not per class.

`id` carries its own runtime error codes — `NG_MODULE_ID_NOT_FOUND = 920` and `DUPLICATE_NG_MODULE_ID = 921` — and its own compiler warning, `WARN_NGMODULE_ID_UNNECESSARY = -6100`, whose enum doc reads:

> *"Indicates that an NgModule is declared with `id: module.id`. This is an anti-pattern that is disabled explicitly in the compiler, that was originally based on a misunderstanding of `NgModule.id`."*

⚠️ **A negative number in that enum does not mean "warning".** Angular's error codes are negated so the TypeScript formatter's hard-coded `TS` prefix reads as `NG`; a *negative* value additionally signals that the code has an error-guide page on angular.dev. Severity is decided elsewhere. Do not read sign as severity.

## Gotchas

**★ Symptom: after migrating a feature, forty templates suddenly report `'vendor-video-player' is not a known element`.** Cause: the old module carried `schemas: [CUSTOM_ELEMENTS_SCHEMA]` and that suppression covered every component it declared. Per-component `schemas` does not inherit from anywhere. Fix: add the schema to the handful of components that genuinely render custom elements, and treat the rest as the real bugs the module had been hiding:

```ts
@Component({
  selector: 'app-player-shell',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<vendor-video-player [src]="src()"></vendor-video-player>`,
})
export class PlayerShellComponent {
  readonly src = input.required<string>();
}
```

⚠️ Never reach for `NO_ERRORS_SCHEMA` to make the wall of errors go away. It disables the check for *every* element and property in that template, including your own typos.

**★ Symptom: `'schemas' is only valid on a component that is standalone.`, with a related note asking `Did you forget to add 'standalone: true' to this @Component?`** Cause: NG2010 — the component still carries `standalone: false`. ⚠️ That related note is v14-era phrasing shipped unchanged in 22.1.5; in v22 the fix is almost never to *add* a flag. Fix: delete the `standalone: false` line, and remove the class from its module's `declarations` in the same edit:

```ts
@Component({
  selector: 'app-video-panel',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<vendor-video-player [src]="src()"></vendor-video-player>`,
})
export class VideoPanelComponent {
  readonly src = input.required<string>();
}
```

**★ Symptom: `entryComponents` in an `@NgModule` stops type-checking after an upgrade.** Cause: it was deleted from the `@NgModule` and `@Component` public APIs in 16.0.0, so it is no longer a member of the interface the decorator's object literal is checked against, and TypeScript's excess-property check on that literal rejects it. Fix: delete the key. The v16.0.0 release notes are explicit that nothing is lost — *"Any usages can be removed since they weren't doing anyting."* Delete any `ANALYZE_FOR_ENTRY_COMPONENTS` reference in the same pass; that token was deleted too.

**★ Symptom: `ComponentFactoryResolver` cannot be imported from `@angular/core` after upgrading to v22.** Cause: `ComponentFactory`, `ComponentFactoryResolver` and `createNgModuleRef` were removed in 22.0.0 and are absent from the 22.1.5 public API. Fix: create the component directly — the resolver step no longer exists:

```ts
@Component({ selector: 'app-modal-host', imports: [], template: `<ng-container #slot />` })
export class ModalHostComponent {
  private readonly slot = viewChild.required('slot', { read: ViewContainerRef });

  open(): ComponentRef<ConfirmDialogComponent> {
    return this.slot().createComponent(ConfirmDialogComponent);
  }
}
```

Outside a `ViewContainerRef`, use the standalone function and give it an environment injector explicitly:

```ts
const ref = createComponent(ConfirmDialogComponent, {
  environmentInjector: inject(EnvironmentInjector),
  hostElement: document.querySelector('#dialog-root')!,
});
```

**Symptom: a surviving `NgModule` with `id: module.id` produces a compiler warning.** Cause: `WARN_NGMODULE_ID_UNNECESSARY`, whose enum doc calls it *"an anti-pattern that is disabled explicitly in the compiler, that was originally based on a misunderstanding of `NgModule.id`"*. Fix: delete the `id` field. Keep it only if you actually call `getNgModuleById('some-stable-name')` somewhere — and if you do, give it a stable literal, not `module.id`:

```ts
@NgModule({ id: 'legacy-reporting', declarations: [ReportGrid], exports: [ReportGrid] })
export class LegacyReportingModule {}
```

**Symptom: two `NgModule`s in the same app both declare the same `id`.** Cause: `DUPLICATE_NG_MODULE_ID = 921` — the registry `getNgModuleById` reads is keyed on that string, so a second registration under an existing key is an error rather than a silent overwrite. Its sibling `NG_MODULE_ID_NOT_FOUND = 920` is the other half: asking for an id nobody registered. Fix: ids are global names; scope them like package names (`'billing/legacy-reporting'`) rather than by file.

**Symptom: a module marked `jit: true` behaves differently in a production build than in development.** Cause: the doc comment says exactly what it does — *"this module is ignored by the AOT compiler. It remains in distributed code, and the JIT compiler attempts to compile it at run time, in the browser."* If `@angular/compiler` is not in the bundle there is nothing to do that compiling. Fix: the same doc comment names it — *"To ensure the correct behavior, the app must import `@angular/compiler`"*:

```ts
// src/main.ts
import '@angular/compiler';
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

platformBrowser().bootstrapModule(AppModule).catch(err => console.error(err));
```

Better: delete `jit: true`. It exists for runtime-compiled scenarios, and an application that ships the compiler pays for it in every build.

## Interview questions

**★ Why is `schemas` per-component an improvement over per-module, given it is the same field with the same tokens?**
Because `CUSTOM_ELEMENTS_SCHEMA` and `NO_ERRORS_SCHEMA` turn off a safety check, and the value of a suppression is inversely proportional to its reach. On an `NgModule` the switch covered every component the module declared, so one legitimate custom element bought silence for every typo in every sibling template — and nothing ever told you it had. Per-component, the suppression stops at the file that needs it. The migration is unpleasant for exactly this reason: moving a module's schema onto components surfaces every error it had been hiding, and that is the feature working rather than the migration failing.

**★ What actually replaced `entryComponents`, and why could it simply be deleted?**
Nothing replaced it. It existed for the View Engine compiler, which needed to know at build time which components would be created without appearing in any template, so it could generate a factory for each. Ivy puts the definition on the class itself, so the factory is always reachable from the class reference and the field became inert — deprecated in v9 with *"With Ivy, this property is no longer necessary"*, and deleted from the public API in 16.0.0 along with `ANALYZE_FOR_ENTRY_COMPONENTS`. Dynamic creation today is `createComponent(component, { environmentInjector })` or `ViewContainerRef.createComponent(componentType)`, and in 22.0.0 the last of the old machinery — `ComponentFactory`, `ComponentFactoryResolver`, `createNgModuleRef` — was removed too.

**★ Your `@NgModule` still compiles unchanged in Angular 22. Does that mean nothing about it changed?**
No — it means the decorator is not deprecated, which is a different claim. `@NgModule` and every field it still has are undeprecated at 22.1.5, and so are `standalone: true`, `standalone: false` and `platformBrowser().bootstrapModule()`. What changed is that one field was deleted (`entryComponents`, v16), the machinery two of them fed was deleted (`ComponentFactory` and friends, v22), and the *default* for every component, directive and pipe flipped in v19 — so a module that compiles today may be declaring classes that are now standalone by default and therefore cannot legally be declared at all. The compile succeeding tells you about the module; it tells you nothing about the classes it lists.

**Why do `id` and `jit` have no standalone equivalent, and is that a gap?**
Not a gap. `id` registers a module in the registry `getNgModuleById(id)` reads, which exists so code holding only a string can obtain a module type — a need that arises from lazy-loading modules by name. A standalone component is obtained by importing its class, so the indirection has nothing to index. `jit: true` opts one module out of AOT so the browser compiles it at runtime, which requires shipping `@angular/compiler`; there is no per-component version because the decision is about how the build treats a unit of compilation, and for standalone classes that unit is the file, governed by build configuration rather than metadata.

**What is the difference between `@NgModule.schemas` and `@Component.schemas` at the type level, and does it matter?**
`@NgModule.schemas` is `Array<SchemaMetadata | any[]>`, so it accepts nested arrays; `@Component.schemas` is `SchemaMetadata[]`, flat only. It matters mostly as evidence of intent: the module form was designed to be composed from shared constants applied broadly, the component form to be a literal one- or two-element list written at the point of need. Practically, if you try to reuse a `const SCHEMAS = [[CUSTOM_ELEMENTS_SCHEMA]]` helper from the module era on a component, it will not type-check, and the fix is to inline the token.

**Why is a negative Angular error-code number not a sign that the diagnostic is a warning?**
Because the sign encodes something else entirely. Angular's compiler codes are negated and offset so the TypeScript formatter's hard-coded `TS` prefix renders as `NG` — the source comment says all Angular error codes start with `-99` so the sequence `TS-99` can be assumed to be an Angular code. A negative value in the `ErrorCode` enum additionally signals that the code has an associated error-guide page on angular.dev, which is why `SCHEMA_INVALID_ELEMENT = -8001` is negative while `UNUSED_STANDALONE_IMPORTS = 8113` is not. Severity is set separately, at the point the diagnostic is constructed.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **08 · Interop, honestly — `importProvidersFrom`** *(not written yet)*
