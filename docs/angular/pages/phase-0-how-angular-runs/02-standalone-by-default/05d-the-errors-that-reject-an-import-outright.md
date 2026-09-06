---
title: "NG2010, NG2011 and NG2012 are the three hard errors that reject an `imports` entry outright — none is configurable, each is raised from a different file, and the one you will actually hit is a `Module.forRoot()` call that has no business being on a component at all"
sidebar_label: "05d · The errors that reject an import"
sidebar_position: 5.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> [`annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts),
> [`scope/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/util.ts),
> [`typecheck/extended/checks/missing_structural_directive/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/extended/checks/missing_structural_directive/index.ts) —
> and angular.dev [Anatomy of components](https://angular.dev/guide/components/anatomy-of-components).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**NG8113 is a warning about an entry the compiler accepted and you did not use. The NG20xx family is
the opposite: entries the compiler refuses outright, at build time, with no `extendedDiagnostics`
knob to soften them. There are three that matter and they answer three different questions — NG2010
says *this component is not allowed to have an `imports` array at all*, NG2011 says *this entry is a
directive or pipe but it is not standalone*, and NG2012 says *this entry is not a directive, pipe or
NgModule in the first place*. Two of them ship messages that have not aged well: NG2010's hint still
tells you to add `standalone: true` in a version where the fix is almost always to delete
`standalone: false`, and NG2011's most useful suggestion is structurally unavailable for exactly the
libraries you did not write. Knowing which of the three you have tells you which file to open before
you read a word of the stack.**

## NG2010 — `'imports' is only valid on a component that is standalone.`

Enum doc comment, verbatim: *"Raised when a component has `imports` but is not marked as
`standalone: true`."* It is raised from three distinct places in the component handler, with three
different messages.

The first covers the whole import family, and the field name in the message is computed:

```ts
const importsField = rawImports
  ? 'imports'
  : rawDeferredImports
    ? 'deferredImports'
    : 'foreignImports';
diagnostics.push(
  makeDiagnostic(
    ErrorCode.COMPONENT_NOT_STANDALONE,
    component.get(importsField)!,
    `'${importsField}' is only valid on a component that is standalone.`,
    [
      makeRelatedInformation(
        node.name,
        `Did you forget to add 'standalone: true' to this @Component?`,
      ),
    ],
  ),
);
```

The other two are fixed strings for the sibling fields that are equally standalone-only:

```ts
makeDiagnostic(
  ErrorCode.COMPONENT_NOT_STANDALONE,
  component.get('schemas')!,
  `'schemas' is only valid on a component that is standalone.`,
)
```

```ts
makeDiagnostic(
  ErrorCode.COMPONENT_NOT_STANDALONE,
  component.get('standalone') || node.name,
  `Cannot use selectorless with a component that is not standalone`,
)
```

After raising it the compiler deliberately stops analysing the template, with a comment that
explains why you see one error rather than forty:

> *"Poison the component so that we don't spam further template type-checking errors that result
> from misconfigured imports."*

⚠️ **The attached related-information is v14-era text shipped in v22.1.5.**
`Did you forget to add 'standalone: true' to this @Component?` made sense when `standalone` defaulted
to `false`. Since v19.0.0 it defaults to `true`, so a component reaching this error almost always got
there because something wrote `standalone: false` on it — usually the `explicit-standalone-flag`
migration that ships with `ng update @angular/core@19`. The fix is to delete a line, not add one.

## NG2011 — the message that adapts to what it can see

Enum doc comment, verbatim: *"Raised when a type in the `imports` of a component is a directive or
pipe, but is not standalone."* The interesting part is `makeNotStandaloneDiagnostic`, which tries to
tell you which NgModule to import instead:

```ts
let message = `The ${kind} '${ref.node.name.text}' appears in 'imports', but is not standalone and cannot be imported directly.`;
let relatedInformation: ts.DiagnosticRelatedInformation[] | undefined = undefined;
if (scope !== null && scope.kind === ComponentScopeKind.NgModule) {
  // The directive/pipe in question is declared in an NgModule. Check if it's also exported.
  const isExported = scope.exported.dependencies.some((dep) => dep.ref.node === ref.node);
  const relatedInfoMessageText = isExported
    ? `It can be imported using its '${scope.ngModule.name.text}' NgModule instead.`
    : `It's declared in the '${scope.ngModule.name.text}' NgModule, but is not exported. ` +
      'Consider exporting it and importing the NgModule instead.';
  relatedInformation = [makeRelatedInformation(scope.ngModule.name, relatedInfoMessageText)];
}
if (relatedInformation === undefined) {
  // If no contextual pointers can be provided to suggest a specific remedy, then at least tell
  // the user broadly what they need to do.
  message += ' It must be imported via an NgModule.';
}
```

`kind` is `'component' | 'directive' | 'pipe'`, so the strings you can actually hit are:

- `The component 'LegacyBadge' appears in 'imports', but is not standalone and cannot be imported directly. It must be imported via an NgModule.`
- the same first sentence, with related info `It can be imported using its 'LegacyUiModule' NgModule instead.`
- the same first sentence, with related info `It's declared in the 'LegacyUiModule' NgModule, but is not exported. Consider exporting it and importing the NgModule instead.`
- the `directive` and `pipe` variants of each.

⚠️ **The helpful branch is unavailable for third-party code, and Angular says so.** The TODO in the
same file, verbatim: *"the above case handles directives/pipes in NgModules that are declared in the
current compilation, but not those imported from .d.ts dependencies."* So for anything out of
`node_modules` you get the bare sentence and no pointer — which is precisely when you least know
which module to reach for.

## NG2012 — including the `forRoot()` special case

Enum doc comment, verbatim: *"Raised when a type in the `imports` of a component is not a directive,
pipe, or NgModule."* The generic message comes from the scope utilities:

```ts
export function makeUnknownComponentImportDiagnostic(
  ref: Reference<ClassDeclaration>,
  rawExpr: ts.Expression,
) {
  return makeDiagnostic(
    ErrorCode.COMPONENT_UNKNOWN_IMPORT,
    getDiagnosticNode(ref, rawExpr),
    `Component imports must be standalone components, directives, pipes, or must be NgModules.`,
  );
}
```

🔴 And there is a bespoke second message, which is the one most people actually meet:

```ts
makeDiagnostic(
  ErrorCode.COMPONENT_UNKNOWN_IMPORT,
  origin,
  `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call. ` +
    `These calls are not used to configure components and are not valid in standalone component imports - ` +
    `consider importing them in the application bootstrap instead.`,
)
```

A `forRoot()` returns a `ModuleWithProviders` **object**, not a class, and a component's `imports`
array is typed `(Type<any> | ReadonlyArray<any>)[]` — class references only. The message's own
advice is the right one: those providers belong to the application, not to a component.

## Gotchas

**★ Symptom: `Component imports contains a ModuleWithProviders value, likely the result of a
'Module.forRoot()'-style call.`** Cause: a `forRoot()` returns a `ModuleWithProviders` object rather
than a class, and a component's `imports` array only accepts `Type<any>` class references. Fix: the
providers belong in the application config, not on a component:

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { App } from './app/app';
import { routes } from './app/app.routes';

bootstrapApplication(App, { providers: [provideRouter(routes)] });
```

**★ Symptom: `'imports' is only valid on a component that is standalone.` with a hint telling you to
add `standalone: true`.** Cause: NG2010. The class carries `standalone: false`, almost always left
by the v19 `explicit-standalone-flag` migration, and the hint text predates the v19 default flip.
Fix: delete the flag rather than adding the one the message suggests:

```ts
@Component({
  selector: 'app-user-card',
  imports: [DatePipe],
  template: `<p>{{ joinedAt | date }}</p>`,
})
export class UserCard {
  joinedAt = new Date();
}
```

**★ Symptom: NG2011 on a directive from `node_modules`, with no "import its NgModule instead"
hint.** Cause: `makeNotStandaloneDiagnostic` can only look up a declaring `NgModule` inside the
current compilation; for a library shipped as `.d.ts` that lookup fails and the related-information
branch never runs. Fix: import the library's module instead of the class, since that is what its
public API supports:

```ts
@Component({
  selector: 'app-report',
  imports: [LegacyChartModule],
  template: `<legacy-chart [series]="series" />`,
})
export class Report {
  series = [1, 2, 3];
}
```

**Symptom: NG2011 tells you a directive is declared in a module *and* that the module does not
export it.** Cause: the `isExported` branch — the compiler found the declaring `NgModule` in your own
compilation but the class is absent from its resolved export scope, so importing that module would
not help you. Fix: export it from the module that declares it, or make the class standalone and drop
the module hop entirely:

```ts
@NgModule({
  declarations: [LegacyBadge],
  exports: [LegacyBadge],
})
export class LegacyUiModule {}
```

**Symptom: one NG2010 and then silence, even though the template obviously references several
unknown elements.** Cause: the handler sets `isPoisoned = true` after raising NG2010, deliberately —
*"Poison the component so that we don't spam further template type-checking errors that result from
misconfigured imports."* Fix: none needed; fix the decorator and the real template errors surface on
the next build. Do not read the single error as "only one thing is wrong".

**Symptom: `Host directive Foo cannot be a component` on a `hostDirectives` entry that works fine in
`imports`.** Cause: NG2015 — `hostDirectives` accepts directives only, while `imports` accepts
components, directives, pipes and NgModules. They are different lists with different rules. Fix: use
the component in the template through `imports`, and reserve `hostDirectives` for directives:

```ts
@Component({
  selector: 'app-panel',
  hostDirectives: [FocusTrap],
  imports: [PanelHeader],
  template: `<app-panel-header /><ng-content />`,
})
export class Panel {}
```

## Interview questions

**★ What is the difference between NG8113 and NG2011?**
Severity and subject. NG8113 is a configurable *warning* about a **standalone** directive or pipe you
imported and did not use. NG2011 is a non-configurable compile *error* about a **non-standalone**
directive or pipe you tried to import directly at all. The second is checked first: an entry that
fails the `isStandalone` test can never reach the unused-import test, which is why you never see both
codes on the same entry.

**★ You get `'imports' is only valid on a component that is standalone.` and the compiler suggests
adding `standalone: true`. Why is that usually the wrong fix in Angular 22?**
Because since v19.0.0 the flag defaults to `true` — a component that is not standalone got there by
someone writing `standalone: false`, typically the `explicit-standalone-flag` migration run by
`ng update @angular/core@19`. Adding `standalone: true` on top of `standalone: false` is not even
possible; the actual edit is to delete the existing flag. The hint text predates the default flip and
was never updated.

**★ Why does NG2011 sometimes tell you which NgModule to import and sometimes not?**
Because `makeNotStandaloneDiagnostic` resolves the declaring scope from the current compilation, and
that only works for source you are compiling. Angular's own TODO records the gap: the lookup does not
cover *"those imported from .d.ts dependencies"*. So your own modules get a pointer and third-party
libraries do not.

**★ What does the compiler do immediately after raising NG2010, and why?**
It sets `isPoisoned = true` on the component — *"Poison the component so that we don't spam further
template type-checking errors that result from misconfigured imports."* With the `imports` array
rejected, the component's template scope is meaningless, so every element and binding in it would
report as unknown. Suppressing them keeps the one real error visible.

**Why can a `forRoot()` call never appear in a component's `imports`?**
Because it returns a `ModuleWithProviders` object, and the field is typed
`(Type<any> | ReadonlyArray<any>)[]` — class references, or nested arrays of them. The compiler
special-cases the shape so the message can name it, rather than leaving you with the generic
*"Component imports must be standalone components, directives, pipes, or must be NgModules."*

**Which of these codes are configurable, and which are not?**
Only the NG81xx extended diagnostics — NG8113 and NG8116 among them — take a category from
`angularCompilerOptions.extendedDiagnostics`. The NG20xx family is raised with `makeDiagnostic` at
fixed severity inside the component handler and the scope utilities; there is no option that
downgrades or suppresses them.

---

← Prev: **05c · What a stale import costs, and the cleanup** *(not written yet)* · Index: [Topic index](README.md) · Next → **06 · `'x' is not a known element`** *(not written yet)*
