---
title: "The last two causes never show you NG8001 at all — a `standalone: false` declarable is NG2011 with an adaptive message, and a genuine custom element is the one case where a schema is the right answer"
sidebar_label: "06d · Legacy declarables and custom elements"
sidebar_position: 6.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8001 Invalid Element](https://angular.dev/errors/NG8001) —
> and `angular/angular` at tag `v22.1.5`:
> [`compiler-cli/src/ngtsc/scope/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/util.ts),
> [`compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> [`core/src/metadata/schema.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/schema.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Causes four and five are the two that change the shape of the error rather than its wording. A
`standalone: false` component does not give you NG8001 when you try to use it — the moment you put it
in an `imports` array you get NG2011 instead, with a message the compiler *adapts* depending on
whether it can see the declaring `NgModule`, and with the component's scope deliberately poisoned so
the error does not multiply. A genuine custom element gives you NG8001 and keeps giving it until you
tell the compiler, per component, that this template is allowed to contain tags Angular does not own.
Those are the only two causes where the fix is structural rather than a corrected reference, and they
are the two most often mishandled: the first by adding `standalone: true` to a class that never needed
it, the second by reaching for `NO_ERRORS_SCHEMA`.**

## 4. It is a legacy `standalone: false` declarable

The moment you add it to `imports` you get **NG2011** at compile time, whose enum doc reads, verbatim:

> *"Raised when a type in the `imports` of a component is a directive or pipe, but is not standalone."*

The message is built by `makeNotStandaloneDiagnostic`, and it is *adaptive* — that is the interesting
part:

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

`kind` is one of `'component' | 'directive' | 'pipe'`, so the strings you can actually hit are:

- `The component 'LegacyBadge' appears in 'imports', but is not standalone and cannot be imported directly. It must be imported via an NgModule.`
- the same first sentence, with related information `It can be imported using its 'LegacyUiModule' NgModule instead.`
- the same first sentence, with related information `It's declared in the 'LegacyUiModule' NgModule, but is not exported. Consider exporting it and importing the NgModule instead.`
- the `directive` and `pipe` variants of each.

**Two fixes.** Preferred — delete the flag and give the class its own `imports`:

```ts
import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'legacy-badge',
  imports: [DatePipe],
  template: `<span class="badge">{{ issued() | date }}</span>`,
})
export class LegacyBadge {
  readonly issued = input.required<Date>();
}
```

Or, when you cannot edit it, import the module that exports it:

```ts
@Component({
  selector: 'app-team-page',
  imports: [LegacyUiModule],
  template: `<legacy-badge [issued]="today" />`,
})
export class TeamPage {
  readonly today = new Date();
}
```

⚠️ Angular's own TODO admits the hint is incomplete, verbatim: *"TODO(alxhub): the above case handles
directives/pipes in NgModules that are declared in the current compilation, but not those imported
from .d.ts dependencies."* For a third-party library shipped as `.d.ts` you get the bare sentence with
no related information at all, and you have to find the module yourself.

Note also that the compiler poisons the scope after raising a bad-import diagnostic, with this comment
verbatim: *"Poison the component so that we don't spam further template type-checking errors that
result from misconfigured imports."* That is why one bad import produces one legible error rather than
fifty downstream template failures — and why fixing it can reveal a second wave of real errors that
were being suppressed.

🔴 **In v22, "add `standalone: true`" is almost never the fix.** The compiler still says it — NG2010's
related information reads `Did you forget to add 'standalone: true' to this @Component?`, phrasing that
predates the v19 default flip. What the class actually has is an explicit `standalone: false` that the
v19 `explicit-standalone-flag` migration wrote, and the fix is to **delete** it.

## 5. It is a genuine custom element

Only now is a schema the right answer. In v22 `schemas` is a `@Component` field, not a module field —
per component, so an escape hatch opened for one checkout form no longer disables element validation
for forty other components that happened to be declared beside it.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import './vendor/stripe-card-element';

@Component({
  selector: 'app-checkout',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<stripe-card-element [publishableKey]="key" />`,
})
export class Checkout {
  readonly key = 'pk_live_placeholder';
}
```

The field's declared type is `schemas?: SchemaMetadata[]`, and its doc comment states the same
standalone-only restriction that `imports` carries, verbatim:

> *"The set of schemas that declare elements to be allowed in a standalone component. Elements and
> properties that are neither Angular components nor directives must be declared in a schema. This
> property is only available for standalone components - specifying it for components declared in an
> NgModule generates a compilation error."*

🔴 Putting `schemas` on a `standalone: false` component is **NG2010**, message verbatim:
`'schemas' is only valid on a component that is standalone.`

**Before you reach for it, answer one question: which class would match this tag?** If a class exists,
a schema is the wrong tool — it suppresses the diagnostic while the element renders as an inert tag
with none of your bindings applied. If no class exists and the tag comes from a script that registers
a custom element, the schema is the only answer. What the two schema tokens actually do inside the
registry, and why `CUSTOM_ELEMENTS_SCHEMA` refuses to rescue some tags, is chunk 06e.

## Gotchas

**★ Symptom: NG2011 with no hint about which `NgModule` to import.** Cause: the related information is
only computed when the declaring module is in the current compilation; the source's own TODO says
`.d.ts` dependencies are not covered. Fix: read the library's public entry point for the module that
exports the component and import that module by name:

```ts
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-toolbar',
  imports: [MatButtonModule],
  template: `<button mat-flat-button type="button">Save</button>`,
})
export class Toolbar {}
```

**★ Symptom: you added `standalone: true` to silence NG2011 and the component's own template now
fails.** Cause: the class was declared in an `NgModule`, so its template dependencies came from that
module's ambient scope. Making it standalone removes that scope and gives it only itself. Fix: flip
the flag *and* move its dependencies into its own `imports` in the same change:

```ts
@Component({
  standalone: true,
  selector: 'legacy-badge',
  imports: [DatePipe, AppTooltip],
  template: `<span class="badge" appTooltip="Issued">{{ issued() | date }}</span>`,
})
export class LegacyBadge {
  readonly issued = input.required<Date>();
}
```

**★ Symptom: fixing one NG2011 uncovers a dozen new template errors.** Cause: the compiler poisoned
the component's scope at the first bad import, deliberately, to avoid spamming downstream type-check
failures. Those errors were always there. Fix: expect a second wave and work it in the same sitting;
it is a sign the diagnostic did its job, not that your change broke something.

**★ Symptom: `schemas: [CUSTOM_ELEMENTS_SCHEMA]` produces `'schemas' is only valid on a component that
is standalone.`** Cause: the component still carries `standalone: false`, so NG2010 fires on the
`schemas` property before the template is ever checked. Fix: delete `standalone: false` and move the
class's template dependencies into its own `imports`; `schemas` becomes legal in the same edit.

**★ Symptom: the custom element renders as an empty tag with `CUSTOM_ELEMENTS_SCHEMA` in place and no
errors anywhere.** Cause: the schema tells Angular's compiler to stop checking, not the browser to
define the element — if the script that calls `customElements.define()` never ran, nothing upgrades
the tag. Fix: import the vendor module for its side effect in the component file so the definition is
part of the same chunk:

```ts
import './vendor/stripe-card-element';
```

**★ Symptom: `standalone: true` is flagged in code review as redundant, and nobody can cite a rule.**
Cause: the field is redundant since v19 but is **not deprecated** in 22.1.5, so neither the compiler
nor a lint rule has an opinion and both sides of the argument can cite "no warning". Fix: settle it
with `strictStandalone` rather than a preference, and delete redundant flags as you touch files —
covered in [Which version changed what](03-standalone-by-default-which-version-changed-what.md).

## Interview questions

**★ You import a component and get NG2011 instead of NG8001. What have you learned?**
That the class exists, is reachable, is a real declarable — and carries `standalone: false`. NG8001
means nothing in scope matched the tag; NG2011 means the thing in your array is a directive, component
or pipe that belongs to an `NgModule` and cannot be imported directly. It is a strictly more
informative failure, and if the declaring module is in the same compilation the diagnostic even names
it and says whether it is exported. The compiler then poisons the scope deliberately, so you get one
error rather than a cascade.

**★ Which of the five causes is `CUSTOM_ELEMENTS_SCHEMA` the correct fix for, and how do you know
before you try it?**
Only the fifth: a genuine custom element that no Angular component defines. You know before trying
because you can answer "which class would match this tag?" — if there is a class, a schema is the
wrong tool and will merely suppress the error while the element renders inert with none of your
bindings applied. If there is no class, and the tag comes from a script that registers a custom
element, the schema is the only answer. A hyphen in the tag is a necessary condition, not a sufficient
one.

**Why is the compiler's own suggestion — "Did you forget to add `standalone: true`?" — usually wrong
in Angular 22?**
Because the phrasing predates v19, when `standalone` defaulted to `false` and adding the flag was the
migration step. Since 19.0.0 the default is `true`, so a class that is not standalone in a v22 app got
that way by carrying an explicit `standalone: false` — written by the `explicit-standalone-flag`
migration or copied from an old template. The fix is to delete that line, not to add its opposite. It
is a message that has aged rather than a message that is wrong.

**Why does NG2011 change its wording depending on the project?**
Because `makeNotStandaloneDiagnostic` looks up the declaring scope and, if it is an `NgModule` in the
current compilation, checks whether the class is in that module's `exports`. It then emits one of two
related-information messages — "import its NgModule instead" or "it is declared there but not
exported" — and only falls back to the generic "It must be imported via an NgModule" when it has no
contextual pointer. That fallback is what you get for a library shipped as `.d.ts`, which the source's
own TODO acknowledges.

**★ What is the difference between `CUSTOM_ELEMENTS_SCHEMA` on a component and the old
`@NgModule.schemas`?**
Scope. In the module world one entry in `schemas` relaxed element validation for every component the
module declared, which meant one integration with a third-party widget silently disabled typo
detection across a whole feature area. In v22 `schemas` is a `@Component` field and applies to that
component's template only, and putting it on a non-standalone component is NG2010. The escape hatch
got narrower without getting weaker.

**If a component is not standalone, why can't the compiler just treat it as standalone and move on?**
Because the two have different scopes, and guessing would silently change what its template is allowed
to reference. A module-declared component's template resolves against the module's ambient compilation
scope; a standalone one resolves against its own `imports`. Treating the first as the second would
turn a clear import error into a pile of unrelated template failures inside a file the developer never
edited. Raising NG2011 and poisoning the scope keeps the failure at the place the decision was made.

---

← Prev: [The five causes (1–3)](06c-the-five-causes.md) · Index: [Topic index](README.md) · Next → [`CommonModule` and `schemas`](06e-commonmodule-and-schemas.md)
