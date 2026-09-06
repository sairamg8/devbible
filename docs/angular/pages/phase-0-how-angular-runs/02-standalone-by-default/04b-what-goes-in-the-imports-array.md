---
title: "The `imports` array takes class references and nested arrays of class references — five kinds of entry in all, and an imported NgModule hands you its `exports` and nothing it merely declares"
sidebar_label: "04b · What goes in the array"
sidebar_position: 4.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Anatomy of components](https://angular.dev/guide/components/anatomy-of-components), [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and `angular/angular` at tag `v22.1.5`: [`packages/core/src/metadata/directives.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/directives.ts), [`packages/compiler-cli/src/ngtsc/scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts), [`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**There are exactly five shapes of thing that can appear in a component's `imports`: a
standalone component, a standalone directive, a standalone pipe, an `NgModule`, and a nested
array of any of those. That is not a style guide — it is the four branches of the compiler's
scope loop plus the `ReadonlyArray<any>` arm of the field's own type. The one that surprises
people is the NgModule branch, because a module contributes its `exports` and only its
`exports`; a class it merely `declares` stays invisible no matter how loudly you import the
module. Get that distinction wrong and you spend an afternoon convinced Angular is ignoring
your import.**

## The five kinds of entry, in one worked example

Every legal entry type in one place. Four small files, then the consumer that imports all of
them plus a nested constant.

```ts
// src/app/shared/highlight.directive.ts
import {Directive, ElementRef, effect, inject, input} from '@angular/core';

@Directive({selector: '[appHighlight]'})
export class HighlightDirective {
  readonly appHighlight = input<string>('#fff8c5');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      this.host.nativeElement.style.backgroundColor = this.appHighlight();
    });
  }
}
```

```ts
// src/app/shared/initials.pipe.ts
import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'initials'})
export class InitialsPipe implements PipeTransform {
  transform(fullName: string): string {
    return fullName
      .split(/\s+/)
      .filter((part) => part.length > 0)
      .map((part) => part[0].toUpperCase())
      .join('');
  }
}
```

```ts
// src/app/shared/avatar.component.ts
import {Component, input} from '@angular/core';

@Component({
  selector: 'app-avatar',
  template: `<span class="avatar">{{ label() }}</span>`,
})
export class AvatarComponent {
  readonly label = input.required<string>();
}
```

```ts
// src/app/shared/ui.ts — a plain exported constant, not an NgModule
import {AvatarComponent} from './avatar.component';
import {HighlightDirective} from './highlight.directive';
import {InitialsPipe} from './initials.pipe';

export const SHARED_UI = [AvatarComponent, HighlightDirective, InitialsPipe] as const;
```

```ts
// src/app/users/user-card.component.ts
import {Component, input} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {SHARED_UI} from '../shared/ui';

export interface User {
  id: string;
  fullName: string;
}

@Component({
  selector: 'app-user-card',
  imports: [SHARED_UI, RouterLink, MatButtonModule],
  template: `
    <app-avatar [label]="user().fullName | initials" />
    <a [routerLink]="['/users', user().id]" appHighlight="#e6f4ff">{{ user().fullName }}</a>
    <button mat-button type="button">Open</button>
  `,
})
export class UserCardComponent {
  readonly user = input.required<User>();
}
```

| Entry | Kind | What it makes legal in the template |
|---|---|---|
| `AvatarComponent` (via `SHARED_UI`) | standalone component | the `app-avatar` element |
| `HighlightDirective` (via `SHARED_UI`) | standalone directive | the `appHighlight` attribute |
| `InitialsPipe` (via `SHARED_UI`) | standalone pipe | the `initials` pipe name |
| `RouterLink` | standalone directive from a package | `routerLink` |
| `MatButtonModule` | NgModule | everything that module `export`s, e.g. `mat-button` |
| `SHARED_UI` | nested `ReadonlyArray` | flattened; contributes its three members |

Two things about the nested array are worth being precise on. The flattening is done by
`validateAndFlattenComponentImports`, which calls **itself** on any element that is an array —
so `imports: [[[A]], B]` is legal, if pointless. And a nested array is a compile-time
convenience only; it produces exactly the same scope as spelling the three classes out, and
the compiler emits per class, not per group.

angular.dev states the top-level rule in one line, verbatim from
[Anatomy of components](https://angular.dev/guide/components/anatomy-of-components):

> *"To use a component, directive, or pipe, you must add it to the `imports` array in the
> `@Component` decorator"*

(The words are verbatim; the source markdown links *directive* and *pipe* to angular.dev's own
guides, and only that link markup has been dropped here.)

> *"By default, Angular components are _standalone_, meaning that you can directly add them to
> the `imports` array of other components. Components created with an earlier version of
> Angular may instead specify `standalone: false` in their `@Component` decorator. For these
> components, you instead import the `NgModule` in which the component is defined."*

## An imported NgModule gives you its `exports`, never its `declarations`

This is where most "but I imported it!" tickets end. A module's `declarations` are its
internal membership list; only `exports` is its public surface.

```ts
// src/app/legacy/legacy-widgets.module.ts
import {NgModule} from '@angular/core';
import {CurrencyBadgeComponent} from './currency-badge.component';
import {InternalSpinnerComponent} from './internal-spinner.component';

@NgModule({
  declarations: [CurrencyBadgeComponent, InternalSpinnerComponent],
  exports: [CurrencyBadgeComponent],
})
export class LegacyWidgetsModule {}
```

A component that writes `imports: [LegacyWidgetsModule]` may use `app-currency-badge` and
**may not** use `app-internal-spinner`, which is an unknown element to it. Both classes must
carry `standalone: false` to be legal in `declarations` at all in v22 — see
[03 · Which version changed what](03-standalone-by-default-which-version-changed-what.md).

The `exports` surface is itself transitive, and angular.dev says so, verbatim from
[NgModules overview](https://angular.dev/guide/ngmodules/overview):

> *"An NgModule can _export_ its declared components, directives, and pipes such that they're
> available to other components and NgModules."*

> *"The `exports` property is not limited to declarations, however. An NgModule can also
> export any other components, directives, pipes, and NgModules that it imports."*

That is why one `imports: [MatButtonModule]` can hand you several directives at once: the scope
loop copies in `ngModuleScope.exported.dependencies`, which is the module's already-resolved
export scope, re-exports and all.

🔴 **The transitivity is on the NgModule side only.** Your own `imports` array is flattened
through its nested arrays and then stops. Importing a standalone component does **not** give
you that component's imports — that is exactly the property that makes the graph local, and it
is why the array is a dependency *declaration* rather than a dependency *inheritance*.

## Gotchas

**★ Symptom: you imported the NgModule and the component is still not a known element.**
Cause: the class is in that module's `declarations` but not in its `exports`. Fix: export it —
`exports: [CurrencyBadgeComponent, InternalSpinnerComponent]` — or, better, make the class
standalone and import the class directly instead of the module.

**★ Symptom: two components that render each other, and one of the `imports` entries is
`undefined` at class-evaluation time.** Cause: a genuine ES module cycle — one of the two
classes is not initialised yet when the other's decorator argument is evaluated. Fix:
`forwardRef`, which the component handler resolves through a dedicated
`createForwardRefResolver`:

```ts
// src/app/org/org-children.component.ts
import {Component, forwardRef, input} from '@angular/core';
import {OrgNodeComponent, OrgUnit} from './org-node.component';

@Component({
  selector: 'app-org-children',
  imports: [forwardRef(() => OrgNodeComponent)],
  template: `
    @for (unit of units(); track unit.name) {
      <app-org-node [unit]="unit" />
    }
  `,
})
export class OrgChildrenComponent {
  readonly units = input.required<OrgUnit[]>();
}
```

**★ Symptom: you imported a barrel file's constant and got a directive you never asked for —
and, worse, nothing warned you.** Cause: a nested array is flattened whole, so `SHARED_UI`
contributes every class in it; and the unused-imports rule deliberately steps around exported
shared arrays. Its own doc comment says so, verbatim from
`unused_standalone_imports_rule.ts`: *"Determines if an import reference *might* be coming
from a shared imports array."* — with the reasoning *"The reference might be shared if it comes
from an exported array. If the variable is local to the file, then it likely isn't shared."*
🔴 So an exported group constant is exactly the shape that **silences** NG8113. Fix: name the
classes the template uses, and get the diagnostic back:

```ts
// src/app/users/user-name.component.ts — name the two you use, not the group of three
import {Component, input} from '@angular/core';
import {AvatarComponent} from '../shared/avatar.component';
import {InitialsPipe} from '../shared/initials.pipe';

@Component({
  selector: 'app-user-name',
  imports: [AvatarComponent, InitialsPipe],
  template: `<app-avatar [label]="fullName() | initials" />`,
})
export class UserNameComponent {
  readonly fullName = input.required<string>();
}
```

**★ Symptom: `imports: [SomeService]` or `imports: [SOME_TOKEN]` is rejected.** Cause: the
array is a *template* dependency list; the scope loop has branches for directives, pipes and
NgModules and nothing else, so anything else poisons the scope. Fix: services go in
`providers` — on the component for a per-instance service, or in the application config:

```ts
// src/app/users/user-card.component.ts
import {Component, inject} from '@angular/core';
import {AvatarComponent} from '../shared/avatar.component';
import {UserCardStore} from './user-card.store';

@Component({
  selector: 'app-user-card',
  imports: [AvatarComponent],
  providers: [UserCardStore],
  template: `<app-avatar [label]="store.label()" />`,
})
export class UserCardComponent {
  protected readonly store = inject(UserCardStore);
}
```

## Interview questions

**★ What exactly does importing an NgModule into a standalone component's `imports` give you?**
Its `exports`, fully resolved — including anything it re-exports from modules it imports — and
its `providers`, installed into a lazily-created standalone environment injector for that
component. It does **not** give you anything the module merely `declares`.

**★ What is the difference between `imports: [MatButtonModule]` and importing the button
directive class directly?**
Importing the class gives you that one directive and nothing else. Importing the module gives
you every directive, component and pipe the module exports, plus that module's providers
attached to a standalone injector for your component. When a library exposes standalone
classes, importing the class is the smaller, more local edge — and the one whose unused-import
warning will tell you when it stops being needed.

**Is `imports: [[A, B], C]` legal, and does the nesting change anything?**
Legal — the field's type is `(Type<any> | ReadonlyArray<any>)[]` and
`validateAndFlattenComponentImports` recurses into any array element. The nesting changes
nothing about the resulting scope or the emitted output; it exists so a shared group of
dependencies can be exported as one constant.

**★ A teammate says "just import the shared barrel everywhere, it is only compile-time". What
is wrong with that?**
Two things, and neither is a bundle-size claim. First, it turns the unused-import diagnostic
off: NG8113 skips references that *might* come from an exported shared array, so the tool that
would have told you a dependency went stale says nothing. Second, an NgModule inside that
barrel is emitted whether or not the template uses anything from it, and its providers get a
standalone injector — so a "harmless" group import can quietly change dependency-injection
behaviour. The barrel is a real convenience; it is not free, and what it costs is feedback.

---

← Prev: [What `imports` actually means](04-what-imports-actually-means.md) · Index: [Topic index](README.md) · Next → [What the compiler does with it](04c-what-the-compiler-does-with-the-array.md)
