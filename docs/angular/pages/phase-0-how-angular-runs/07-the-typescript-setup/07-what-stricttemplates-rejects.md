---
title: "The first rejection class you meet is a nullable expression bound to a non-nullable input, and the reason the wall appears all at once is that the flag which used to be off did not skip the check — it wrapped every binding expression in a non-null assertion for you"
sidebar_label: "07 · What strictTemplates rejects"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Template type checking](https://angular.dev/tools/cli/template-typecheck) (the worked example and
> the non-null-assertion guidance, quoted verbatim) — and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> (`strictNullInputTypes`, JSDoc quoted in full).
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured
> from a terminal. Every error string below is quoted from a named source file or doc page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Most of the errors a team meets the first time template type checking is on come from two mistakes
wearing a hundred faces. This page is the first: an expression that can be `null` bound to an input
that cannot.** It is a real defect every time, it has a wrong fix that silences it in one character,
and it has a right fix that costs one line. The second class — `$event.target.value` — is
[07b](07b-the-dollar-event-target-rejection.md). Which escape hatch you are allowed to reach for, and
which file the opt-out belongs in, is [07c](07c-the-escape-hatches-are-ranked.md). Everything else
`strictTemplates` rejects is [07d](07d-the-other-rejection-classes.md).

🔴 **"Strict" is three unrelated switches in an Angular workspace.** `compilerOptions.strict` is
TypeScript's. `angularCompilerOptions.strictTemplates` is Angular's and is the subject of these pages.
`ng new --strict` is a *schematic* flag that decides what gets written into the file — and it writes
neither of the first two. Everything below means `strictTemplates` unless it says otherwise. Which
checks `strictTemplates` turns on is [06](06-what-stricttemplates-switches-on.md); their internal
wiring is [topic 01's](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md) at Master
tier. These pages are what you do at 2am with four hundred errors and a release.

## The rejection, from angular.dev's own example

Quoted verbatim from [Template type checking](https://angular.dev/tools/cli/template-typecheck):

```ts
export interface User {
  name: string;
}

@Component({
  selector: 'user-detail',
  template: '{{ user.name }}',
})
export class UserDetailComponent {
  user = input.required<User>();
}

@Component({
  selector: 'app-root',
  template: '<user-detail [user]="selectedUser"></user-detail>',
})
export class AppComponent {
  selectedUser: User | null = null;
}
```

`selectedUser` is `User | null`; the input's type is `User`. Under `strictTemplates` the binding is
rejected.

## Why the wall appears all at once

Before v22 this compiled, and the JSDoc of the flag that used to be off says exactly why — the second
sentence is the one that matters and almost nobody has read it:

> *"If this is `true`, applications that are compiled with TypeScript's `strictNullChecks` enabled
> will produce type errors for bindings which can evaluate to `undefined` or `null` where the
> inputs's type does not include `undefined` or `null` in its type. If set to `false`, all binding
> expressions are wrapped in a non-null assertion operator to effectively disable strict null
> checks."*

🔴 **Turning `strictNullInputTypes` off does not skip a check. It makes the compiler write `!` for
you** — into every binding expression in the application, in generated code nothing reviews. That is
the state a pre-v22 project was in, which is why switching the flag on does not produce a trickle of
errors: it removes several thousand invisible assertions at once and every place that was relying on
one lights up simultaneously. The wall is not a regression. It is the first time anything has been
checked. (The typo *"inputs's"* is upstream; quoted as published.)

## The fixes, honest one first

```ts
// 1. THE FIX. Narrow at the binding site. The type system now proves the input is safe,
//    and the template says out loud that there is a state with no user.
@Component({
  selector: 'app-root',
  template: `
    @if (selectedUser) {
      <user-detail [user]="selectedUser" />
    } @else {
      <p>No user selected.</p>
    }
  `,
  imports: [UserDetailComponent],
})
export class AppComponent {
  selectedUser: User | null = null;
}
```

```ts
// 2. ALSO A FIX. Widen the input and make the child responsible for the empty case.
//    Correct when "no user" is a state the child should render.
export class UserDetailComponent {
  user = input<User | null>(null);
}
```

```html
<!-- 3. THE ESCAPE HATCH, documented but verified by nothing. -->
<user-detail [user]="selectedUser!"></user-detail>
```

angular.dev names option 3 explicitly — *"the non-null assertion operator `!` at the end of a nullable
expression, such as `<user-detail [user]="user!"></user-detail>`"* — and gives the `async`-pipe form,
where the parentheses are load-bearing:

> *"In the case of the `async` pipe, notice that the expression needs to be wrapped in parentheses, as
> in `<user-detail [user]="(user$ | async)!">`"*

🔴 **`!` in a template is worse than `!` in TypeScript**, and this is the part nobody says. In a `.ts`
file the assertion sits next to the code that established the invariant, and a reader can check it. In
a template it sits in a string the reviewer skims, on an expression the framework re-evaluates on
every change detection cycle, at a moment the component may genuinely hold `null`. The assertion does
not stop the `null` reaching the child. It stops anything telling you it did.

## Deciding between narrowing and widening

Both options 1 and 2 are correct fixes and they are not interchangeable. The question is **who owns
the empty state.**

| The situation | The fix | Why |
|---|---|---|
| The child must not exist at all without a value — a permissions boundary, a route that has not resolved | `@if` in the parent | the child's own code never has to consider `null`, and its input stays `required` |
| "Nothing selected" is a state the child's UI has an appearance for | widen the input to include `null` | the empty markup is written once, in the component that renders it, and gets tested |
| Ten parents all wrap the same child in the same `@if` with the same placeholder | widen the input | the placeholder has already drifted; it just has not been noticed yet |

## Gotchas

**★ Symptom: an `async` pipe result is rejected as possibly `null`.** Cause: `AsyncPipe` returns
`T | null` — it has no value to give you before the source's first emission, and that is a fact about
observables, not a wart in the pipe. Fix, in order of preference:

```html
<!-- narrow, and get a real empty state for free -->
@if (user$ | async; as user) {
  <user-detail [user]="user" />
}

<!-- or the documented assertion; the parentheses are mandatory -->
<user-detail [user]="(user$ | async)!"></user-detail>
```

**★ Symptom: someone cleared the whole error wall with `!` and the build is green.** Cause: `!`
asserts a fact the type system has evidence against. Fix: grep the templates and treat every hit as an
unreviewed claim —

```bash
grep -rn '!"' src --include=*.html
```

Then replace each with an `@if` or a widened input. The count of `!` added divided by errors fixed is
the only honest metric for how a strictness migration went; near zero is the target, and anything else
means the errors were suppressed rather than resolved.

**★ Symptom: the error names a file ending `.ngtypecheck.ts` that is not in your repository.** Cause:
the type-check block is generated into a synthetic file, and this diagnostic escaped before its
position was mapped back to your template. Fix: nothing local — read the template line the message
points at.
[14c](../01-compiler-with-a-framework-attached/14c-the-type-check-file-and-how-errors-get-home.md)
explains the mapping and
[14e](../01-compiler-with-a-framework-attached/14e-the-errors-that-never-arrive.md) covers the cases
where it never happens.

**★ Symptom: the same component compiles in a colleague's fresh project and fails in the shared one,
on the same Angular version.** Cause: the two projects reached v22 differently. `ng new` on v22 writes
no `strictTemplates` key at all and gets the default, which is `true`; an upgrade runs a migration
that writes `"strictTemplates": false` into your tsconfig so the build survives upgrade day. Fix: read
the root `tsconfig.json` before assuming anything about your code —
[05c](05c-what-the-upgrade-wrote-into-your-file.md) documents the migration and exactly what it
writes, and [04 · 07](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md) has the full
upgrade inventory.

**Symptom: `[user]="selectedUser!"` compiles and the child renders `undefined` at runtime.** Cause:
the assertion is erased at emit. Nothing at runtime enforces it, and change detection re-runs the
binding while `selectedUser` is still `null`. Fix: the `@if`. This is the concrete cost of preferring
the hatch to the fix, and it is why the ordering in [07c](07c-the-escape-hatches-are-ranked.md) is
stated as a rule rather than a menu.

**Symptom: you widened the input to `User | null` and now the child's own template fails on
`user.name`.** Cause: you moved the narrowing, you did not remove it — the child now has the `null`
and has to handle it. Fix, in the child:

```ts
@Component({
  selector: 'user-detail',
  template: `
    @if (user(); as u) {
      <p>{{ u.name }}</p>
    } @else {
      <p>No user selected.</p>
    }
  `,
})
export class UserDetailComponent {
  user = input<User | null>(null);
}
```

**Symptom: `[user]="selectedUser ?? undefined"` still errors.** Cause: the input's type is `User`. It
excludes `undefined` exactly as firmly as it excludes `null`, so replacing one absent value with the
other changes nothing. Fix: give the input a type that admits the absent case, or do not bind when
there is nothing to bind:

```ts
user = input<User | undefined>(undefined);
```

**Symptom: a required input is reported missing rather than mis-typed.** Cause: `input.required<T>()`
makes the *presence* of the binding mandatory too, so removing `[user]` to dodge a null error trades
one error for another. Fix: decide who owns the empty state — if the child renders "nothing selected",
the input was never required.

**Symptom: dozens of new null errors appeared in templates you did not touch, after upgrading a
library.** Cause: the library widened one of its input types to include `null` or `undefined`, and
every consumer binding a non-nullable expression to it is now checked against the new type. Fix: read
the library's changelog before rewriting your templates; the correct change is usually one adapter in
your own code, not `!` at forty call sites.

## Interview questions

**★ A colleague has fixed every strict-template error with `!`. What do you say in review?**
That `!` is an assertion, not a fix: it tells the compiler a fact it has evidence against, in a string,
at a point where the framework will re-evaluate the binding while the value may genuinely be `null`.
The result is a green build and the same runtime bug. The documented hatches are ranked — `$any()` for
one expression, a strictness flag for one check, `strictTemplates: false` for all of them — and a
blanket `!` is worse than any of them, because it is invisible in the tsconfig, spread across every
template, and unreviewable at scale. The honest fixes are narrowing at the binding site or widening
the input to include `null` and rendering the empty state.

**★ Your build has four hundred template errors after someone removed the opt-out. What do you do
first?**
Count the distinct error codes, not the errors. Four hundred errors is almost always a handful of
codes repeated — typically a null-assignability code on bindings and `TS2531`/`TS2339` on
`$event.target`. That count tells you whether this is a two-line component-side fix repeated
everywhere or a genuine design problem with who owns the empty state. Only after that does the
escape-hatch question arise, and then it is asked per code, not for the whole wall.

**★ Why does `AsyncPipe` return `T | null`, and what does that force on you?**
Because an observable has not necessarily emitted when the template first renders, and the pipe has to
return *something*. `null` is that something. It forces every consumer of `| async` to state what the
UI does before the first emission — which is a question the template should have answered anyway. The
`@if (source$ | async; as value)` form answers it and gives you the narrowed value in one construct;
`(source$ | async)!` answers it by asserting the question does not arise, which is only true if you
know the source is synchronous.

**Why does turning `strictNullInputTypes` off do more than skip a check?**
Because of what the JSDoc says it does instead: *"all binding expressions are wrapped in a non-null
assertion operator to effectively disable strict null checks."* The compiler actively rewrites the
generated type-check block to add `!`. So the flag is not "check or do not check" — it is "check, or
assert on your behalf everywhere". That framing also explains the shape of the migration: switching it
on removes thousands of invisible assertions simultaneously, which is why the errors arrive as a wall
rather than a trickle.

**When is widening an input to `User | null` better than narrowing with `@if` in the parent?**
When "nothing selected" is a state the child's own UI has an appearance for. If ten parents each wrap
the child in `@if` with a placeholder, that placeholder is written ten times and has already drifted;
moving the empty case into the child writes it once, in the component that renders it, where it can be
tested. Narrowing in the parent is right when the child genuinely must not exist — a permissions
boundary, or a route whose data has not resolved — because then the child's code never has to consider
`null` at all and its input can stay required.

{/* FOOTER */}
