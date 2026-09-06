---
title: "Five of the eighteen checks are the same mistake in five syntactic disguises — you named a callable and meant to call it — and four more catch failures whose symptom points nowhere near the cause, including a `@defer` that fetches despite your condition"
sidebar_label: "15c · The checks worth understanding"
sidebar_position: 15.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev's per-check pages — [`unusedStandaloneImports` (NG8113)](https://angular.dev/extended-diagnostics/NG8113), [`interpolatedSignalNotInvoked` (NG8109)](https://angular.dev/extended-diagnostics/NG8109), [`deferTriggerMisconfiguration` (NG8021)](https://angular.dev/extended-diagnostics/NG8021) —
> and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> plus the [v22.0.0 and 22.1.5 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md).
> Documentation-validated; **no sandbox run** — every quotation is doc text or a source doc comment from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[15b](15b-the-roster-of-checks.md) listed all eighteen with the compiler's one-line description of
each. Most need nothing more. This page is the handful that do — either because the same underlying
mistake is spread across five separate checks in a way that tells you something about the template
language, or because the symptom appears nowhere near the cause. `{{ count }}` rendering a
function's source text, content projection silently going nowhere after you add an `@if`, and a
`@defer` block that loads early despite the condition you configured are all in the second category:
you will not connect the symptom to the check without having read this once.**

## Five checks, one mistake

These are all "you named a callable and meant to call it":

| check | the position it hides in |
|---|---|
| `uninvokedFunctionInEventBinding` | `(click)="save"` — the binding evaluates `save`, gets a function, discards it |
| `uninvokedFunctionInTextInterpolation` | `{{ total }}` where `total` is a method — stringifies the function |
| `interpolatedSignalNotInvoked` | `{{ count }}` where `count` is a signal — signals *are* zero-argument functions |
| `uninvokedTrackFunction` | `@for (… ; track trackById)` — `track` receives a function it will never call |
| `missingNgForOfLet` | `*ngFor="user of users"` without `let` — the variable is never bound |

🔴 **That one mistake needed five separate checks, and the reason is the template language itself.**
An Angular template has several syntactic positions where a bare identifier is legal and useless: an
event binding evaluates and discards, an interpolation stringifies, `track` takes a value rather than
calling it. In TypeScript, `save` on its own line is an unused-expression warning; in a template it
is a valid binding. This is the strongest single argument for why this family exists at all — none of
these is a type error, and no amount of strictness from
[14h](14h-the-input-side-flags.md) onward would catch them.

## `interpolatedSignalNotInvoked` — the one that looks like a framework bug

The doc page, verbatim: > *"Angular Signals are zero-argument functions (`() => T`). When executed,
they return the current value of the signal. This means they are meant to be invoked when used in
template interpolations to render their value."*

Without the check, `{{ count }}` renders the *function*, which stringifies to its own source text.
The output looks like `function () { … }` or similar in the page, which reads as a framework fault
rather than a missing pair of parentheses.

```html
<!-- before: renders the function's source -->
<p>{{ count }}</p>
<!-- after -->
<p>{{ count() }}</p>
```

**22.1.5 made it smarter.** The CHANGELOG records a compiler-cli fix, *"check uninvoked signal
aliases in extended diagnostic"* (commit `d90698dae7`) — so a signal reached through an alias is
caught too, where previously only a direct reference was.

## `unusedStandaloneImports` — a performance diagnostic, not tidiness

The doc page, verbatim: > *"This diagnostic detects cases where the `imports` array of a `@Component`
contains symbols that aren't used within the template."* · *"The unused imports add unnecessary noise
to your code and can increase your compilation time."* · *"Delete the unused import."*

**The compilation-time claim is the interesting half**, and it follows from
[09f](09f-imports-and-the-rule-about-lazy-loading.md): an entry in `imports` is a real dependency the
compiler must resolve and consider during template matching. An unused one is work done for no
result — the selector is matched against every element in the template and matches nothing.

So this is not a lint rule about neatness. It is the standalone model's bookkeeping asking to be kept
accurate, because the array *is* the component's dependency list rather than a formality.

## `controlFlowPreventingContentProjection` — the silent one

NG8011, and one of the two checks with no documentation page at all. The doc comment, verbatim: > *"A
control flow node is projected at the root of a component and is preventing its direct descendants
from being projected, because it has more than one root node."*

The failure is genuinely confusing because **nothing errors**. You wrap projected content in an `@if`
at a component's root; the component now has more than one root node; content projection stops
selecting what you expected, and the content goes to a different slot or nowhere at all. There is no
type error, no runtime exception, just missing content.

```html
<!-- before: the @if at the root changes the root node count, and projection stops matching -->
@if (isReady) {
  <span header>Title</span>
  <p>Body</p>
}

<!-- after: keep the root shape stable, put the condition inside -->
<span header>@if (isReady) { Title }</span>
<p>@if (isReady) { Body }</p>
```

⚠️ **This is a check worth promoting to `error` in most projects**, because the warning is the only
signal you will get and a missing piece of UI is easy to not notice in review.

## `deferTriggerMisconfiguration` — new in v22, and it catches a real bug

NG8021, added in 22.0.0 — CHANGELOG, compiler-cli: *"Adds warning for prefetch without main defer
trigger"* (commit `7f9450219f`). Four cases, per the docs: *"`immediate` with prefetch triggers"*,
*"Prefetch timer not earlier than main timer"*, *"Prefetch without main triggers"*, and *"Identical
prefetch and main triggers"*.

The third is the one worth quoting in full, because the doc's explanation is the clearest statement
of the underlying trap, verbatim:

> *"This configuration may suggest that the prefetch will only run when `someFlag` becomes true.
> However, since the main trigger still defaults to `on idle`, the deferred content can be fetched
> earlier during the browser's idle period, effectively bypassing the intended condition."*

🔴 **A reader of [11](11-why-defer-can-split-a-bundle.md) should be able to predict this.** A `@defer`
block *always* has a main trigger; omitting one does not mean "never load", it means `on idle`. So
configuring only a prefetch trigger gates nothing at all — the content loads during the browser's
first idle period regardless of your condition, and the prefetch you carefully wrote is redundant.

All four cases share a shape: a trigger configuration that expresses an intention the runtime cannot
honour, because another trigger will fire first.

## Two more with a mechanism worth naming

**`textAttributeNotBinding`** (NG8104), verbatim: > *"A text attribute is not interpreted as a binding
but likely intended to be. For example: `attr.x="value"`, `class.blue="true"`,
`style.margin-right.px="5"` … All of the above attributes will just be static text attributes and
will not be interpreted as bindings by the compiler."*

The mistake is forgetting the brackets. `class.blue="true"` sets a literal attribute named
`class.blue` to the string `"true"`; `[class.blue]="true"` sets a class conditionally. Both are valid
HTML-ish syntax and only one does anything.

**`suffixNotSupported`** (NG8106), verbatim: > *"Style bindings support suffixes like
`style.width.px`, `.em`, and `.%`. These suffixes are not supported for attribute bindings. For
example `[attr.width.px]="5"` becomes `width.px="5"` when bound. This is almost certainly
unintentional…"*

Same family: a syntax that works in one binding namespace and is silently literal in another.

```html
<!-- works: unit suffixes are a style-binding feature -->
<div [style.width.px]="5"></div>
<!-- silently sets an attribute literally named "width.px" -->
<div [attr.width.px]="5"></div>
```

## Gotchas

**★ Symptom: `{{ count }}` renders something like `function () { … }` instead of a number.** Cause: a
signal interpolated without being invoked — signals are zero-argument functions, so the interpolation
stringifies the function itself. NG8109 exists for exactly this. Fix: call it:

```html
<p>{{ count() }}</p>
```

**★ Symptom: `<button (click)="save">` does nothing when clicked and there is no error.** Cause: the
binding evaluates the expression `save`, gets a function reference, and discards it. Valid Angular,
no type error. NG8111. Fix: invoke it:

```html
<button (click)="save()">Save</button>
```

**★ Symptom: `@for` re-renders the whole list on every change despite a `track` function.** Cause:
`track trackById` passes the function rather than calling it, so `track` receives a value that never
varies per item. NG8115 catches it. Fix: call it with the item:

```html
@for (user of users; track trackById(user)) {
  <app-user-row [user]="user" />
}
```

**★ Symptom: content projection stops working after you wrap the projected content in an `@if`.**
Cause: NG8011 — a control flow node at the component root gives it more than one root node, which
prevents its direct descendants from being projected. Nothing errors; the content simply goes
nowhere. Fix: keep the root node shape stable and put the condition inside each projected element.

**★ Symptom: a `@defer` block fetches earlier than the condition you configured.** Cause: you set a
prefetch trigger and no main trigger, so the main trigger is still the default `on idle` and fires
during the browser's first idle period. NG8021, new in v22. Fix: set the main trigger explicitly if
the condition is meant to gate the load:

```html
@defer (when isVisible; prefetch on idle) {
  <app-heavy-chart />
}
```

**★ Symptom: `[attr.width.px]="5"` silently does nothing.** Cause: unit suffixes are a style-binding
feature and are not supported for attribute bindings, so the binding target becomes the literal
attribute name `width.px`. NG8106. Fix: use a style binding, or build the string yourself if it must
be an attribute.

**★ Symptom: `class.blue="true"` never applies the class.** Cause: no brackets, so it is a static
text attribute literally named `class.blue`. NG8104 covers this whole family — `attr.x`, `class.x`,
`style.x` without brackets. Fix: add them:

```html
<div [class.blue]="isSelected"></div>
```

**Symptom: an unused `@let` produces a warning you did not know existed.** Cause: NG8112
`unusedLetDeclaration`, one of the two checks with no doc page. Fix: delete the declaration. It is
also a hint worth following — an unused `@let` often means a refactor left a computation behind that
nothing consumes.

**Symptom: removing an entry from `imports` measurably improved build time on a large component.**
Cause: not a coincidence. Each entry is a dependency the compiler resolves and matches against every
element in the template, so unused entries are pure cost. NG8113 says so directly. Fix: keep the
array accurate; consider promoting the check to `error` on large codebases.

## Interview questions

**★ Several extended diagnostics look like the same mistake. Which, and what does that tell you about
Angular templates?**
`uninvokedFunctionInEventBinding`, `uninvokedFunctionInTextInterpolation`, `uninvokedTrackFunction`
and `interpolatedSignalNotInvoked` are all "you named a callable and meant to call it", with
`missingNgForOfLet` as a fifth variant. That one mistake needed five checks because Angular templates
have several syntactic positions where a bare identifier is legal and useless — an event binding
evaluates and discards it, an interpolation stringifies it, `track` receives a function it will not
call, and a signal is itself a zero-argument function. In TypeScript a bare `save;` is an unused
expression; in a template it is a valid binding. It is the clearest demonstration of why the family
exists: none of these is a type error, and no strictness flag would catch any of them.

**★ Why is `unusedStandaloneImports` a performance diagnostic rather than a tidiness rule?**
Because an entry in a component's `imports` array is a real dependency the compiler must resolve and
then consider during template matching — its selector is checked against every element in the
template. An unused entry is work done for no result. Angular's page states both halves: unused
imports *"add unnecessary noise to your code and can increase your compilation time"*. It follows
from the standalone model, where the array genuinely is the component's dependency list rather than a
formality, so its accuracy has a measurable cost attached.

**★ What does NG8021 catch that a reader of the `@defer` chunk should already suspect?**
That a `@defer` block always has a main trigger, defaulting to `on idle`, so configuring only a
prefetch trigger gates nothing. Angular's own wording is that the content *"can be fetched earlier
during the browser's idle period, effectively bypassing the intended condition"*. The check is new in
v22 and its other three cases are the same family of contradiction — multiple main triggers,
`immediate` combined with others, and a prefetch timer that is not earlier than the main timer. Each
is a configuration expressing an intention the runtime cannot honour because something else fires
first.

**★ Which extended diagnostic would you promote to `error` first, and why?**
`controlFlowPreventingContentProjection`, because it is the one whose failure is completely silent.
Wrapping projected content in an `@if` at a component's root changes the root node count and content
projection stops selecting what you expected — no type error, no runtime exception, just missing UI
that is easy to miss in review. Every other check on this page has a symptom you eventually notice; a
piece of content that never renders in one state is the kind of thing that reaches production. It is
also one of the two checks with no documentation page, so nobody will look it up on their own.

**Why does `[style.width.px]="5"` work while `[attr.width.px]="5"` silently does nothing?**
Unit suffixes are a feature of style bindings specifically. The attribute-binding namespace has no
such parsing, so the target is taken literally and you get an attribute named `width.px`. Angular's
own doc comment for NG8106 calls this *"almost certainly unintentional"*. It belongs to the same
family as `textAttributeNotBinding`: a syntax that is meaningful in one binding namespace and inert
in another, with nothing at the language level to stop you.

**How did `interpolatedSignalNotInvoked` change recently?**
22.1.5 taught it to check uninvoked signal *aliases*, per the CHANGELOG entry *"check uninvoked signal
aliases in extended diagnostic"*. Before that it caught a direct reference to a signal but not one
reached through an alias, so a whole class of the same mistake went unreported. It is a good example
of the semver caveat in practice — the check got stricter in a patch, which is fine as a warning and
would have been a new build failure for anyone running `defaultCategory: "error"`.

---

← Prev: [15b · The roster of checks](15b-the-roster-of-checks.md) · Index: [Topic index](README.md) · Next → **15d · Configuring it, and getting it wrong** *(not written yet)*
