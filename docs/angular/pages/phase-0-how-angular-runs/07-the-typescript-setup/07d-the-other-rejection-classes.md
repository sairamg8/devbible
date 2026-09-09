---
title: "The remaining rejection classes each trace to one flag, and the best of them — `<input matInput disabled>` — is a correct rejection of code that genuinely misbehaves at runtime, which is the strongest argument the feature has; meanwhile the intermediate mode every older article tells you to migrate through no longer exists"
sidebar_label: "07d · The other rejection classes"
sidebar_position: 7.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** —
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> at tag `v22.1.5` (every option description below is its JSDoc, quoted verbatim), and angular.dev
> [Template type checking](https://angular.dev/tools/cli/template-typecheck) for the three documented
> modes and the `fullTemplateTypeCheck` deprecation.
> ⚠️ angular.dev still documents a three-mode model; topic 01 established from the v22 public-API
> golden that `fullTemplateTypeCheck` is no longer in the option surface. Where the guide and the
> source disagree this page follows the source and says so.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Past nullable inputs and `$event.target`, the remaining rejections are a short, finite list, and
each one traces to exactly one flag.** Knowing which flag an error belongs to is what turns a wall
into a work queue — and one of them, the attribute check, is worth understanding on its own merits
because it rejects code that is genuinely broken at runtime and had never been called out by anything
before.

This page closes the triage sequence that starts at [07](07-what-stricttemplates-rejects.md); the
ranked escape hatches are [07c](07c-the-escape-hatches-are-ranked.md) and the baseline these flags
correct is [06](06-what-stricttemplates-switches-on.md). The per-flag internals live in topic 01's [14h](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md),
[14i](../01-compiler-with-a-framework-attached/14i-attributes-literals-and-safe-navigation.md),
[14j](../01-compiler-with-a-framework-attached/14j-the-event-reference-and-generics-flags.md) and
[14k](../01-compiler-with-a-framework-attached/14k-the-checks-with-no-switch.md) at Master tier.

## The classes, each traced to its flag

Every description below is the option's own JSDoc, quoted verbatim.

| Flag | What it starts rejecting | Its own words |
|---|---|---|
| `strictInputTypes` | an expression of the wrong type assigned to an input | *"Whether to check the type of a binding to a directive/component input against the type of the field on the directive/component."* |
| `strictNullInputTypes` | a nullable expression bound to a non-nullable input | *"Whether to use strict null types for input bindings for directives."* — see [07](07-what-stricttemplates-rejects.md) |
| `strictAttributeTypes` | a text attribute consumed as a typed input | *"Whether to check text attributes that happen to be consumed by a directive or component."* |
| `strictSafeNavigationTypes` | `a?.b` silently typed `any` | *"Whether to use a strict type for null-safe navigation operations."* |
| `strictDomLocalRefTypes` | a `#ref` on a DOM node silently typed `any` | *"Whether to infer the type of local references."* |
| `strictOutputEventTypes` | `$event` silently typed `any` on an output | *"Whether to infer the type of the `$event` variable in event bindings for directive outputs or animation events."* |
| `strictContextGenerics` | a generic component's parameters collapsed to `any` | *"Whether to include the generic type of components when type-checking the template."* |
| `strictLiteralTypes` | an inline `{}` or `[]` treated as `any` | *"Whether object or array literals defined in templates use their inferred type, or are interpreted as `any`."* |

🔴 **Read that column again as a list of things that used to be `any`.** Six of the eight are not
"new rules" at all — they are places where the previous behaviour was to *give up* and type the
expression `any`. Nothing was checking them; nothing was telling you so. The wall of errors is a
backlog being presented, not a set of new requirements.

## The best argument the feature has: `<input matInput disabled>`

`strictAttributeTypes` has the longest JSDoc of the set, and it is worth quoting in full because it
explains a real runtime bug:

> *"in a template containing `<input matInput disabled>` the `disabled` attribute ends up being
> consumed as an input with type `boolean` by the `matInput` directive. At runtime, the input will be
> set to the attribute's string value, which is an empty string for attributes without a value, so
> with this flag set to `true`, an error would be reported."*

**The attribute delivers `""`, not `true`.** An empty string is falsy. So the template that reads as
"this input is disabled" hands the directive a value that means the opposite of what the author
intended, and it did that for years without anything saying so. The compiler is right, the template
was always wrong, and this is the one rejection nobody should argue with.

```html
<!-- WRONG: the directive receives "" — an empty string, which is falsy -->
<input matInput disabled>

<!-- RIGHT: a property binding delivers the boolean -->
<input matInput [disabled]="true">

<!-- RIGHT, and usually what was meant -->
<input matInput [disabled]="form.readonly()">
```

[14i](../01-compiler-with-a-framework-attached/14i-attributes-literals-and-safe-navigation.md) covers
the directive-side machinery — input transforms and the coercion members a library declares to make
the bare-attribute form legal.

## The rest, in one line each with the mechanism

**`strictSafeNavigationTypes`** — the JSDoc gives the exact resulting type, which is more useful than
any description of it:

> *"If this is `false`, then the return type of `a?.b` or `a?()` will be `any`. If set to `true`, then
> the return type of `a?.b` for example will be the same as the type of the ternary expression
> `a != null ? a.b : a`."*

So `a?.b` is not "the type of `b`, optionally" — it is precisely the union that ternary produces.

**`strictDomLocalRefTypes`** — where a `#ref` gets its type from:

> *"the type of a `#ref` variable on a DOM node in the template will be determined by the type of
> `document.createElement` for the given DOM node. If set to `false`, the type of `ref` for DOM nodes
> will be `any`."*

`document.createElement` is overloaded per tag name, so `#box` on an `<input>` becomes
`HTMLInputElement` and `#box` on an unknown tag becomes the generic element type. References to
*components and directives* are typed by a different, unflagged mechanism that is on regardless —
see [14k](../01-compiler-with-a-framework-attached/14k-the-checks-with-no-switch.md).

**`strictOutputEventTypes`** — *"the type of `$event` will be inferred based on the generic type of
`EventEmitter`/`Subject` of the output."* This is the flag that makes a typo in an output handler's
argument an error rather than an `any`.

**`strictContextGenerics`** — *"If a component has generic type parameters and this setting is `true`,
those generic parameters will be included in the context type for the template. If `false`, any
generic parameters will be set to `any`."* A generic list component's `item` is only correctly typed
in a consumer's template because of this flag.

**`strictLiteralTypes`** — the reason a misspelled key inside `[config]="{ retires: 3 }"` starts
erroring. ⚠️ **Two readings of `compiler.ts` at `v22.1.5` are in circulation in this corpus and they
disagree about whether setting `strictLiteralTypes: false` is honoured while `strictTemplates` is on**
— one reads the unconditional assignment in the strict branch, the other reads a matching clause in
the block that applies explicitly-configured flags afterwards. **This page does not settle it.** Do
not build a plan on that flag; move the literal onto the class, which is the better change regardless
and is what [14i](../01-compiler-with-a-framework-attached/14i-attributes-literals-and-safe-navigation.md)
recommends.

## The three modes, for a reader arriving with older knowledge

Every pre-v22 article, and angular.dev's own guide today, describes three modes. Verbatim:

- **Basic** — *"Angular validates only top-level expressions in a template."* Its stated limitation is
  the one that matters: *"it doesn't check embedded views, such as `*ngIf`, `*ngFor`, other
  `<ng-template>` embedded view."*
- **Full** — *"Angular is more aggressive in its type-checking within templates."*
  *"Embedded views (such as those within an `*ngIf` or `*ngFor`) are checked"* and *"Pipes have the
  correct return type"*, but *"The following still have type `any`: Local references to DOM elements;
  The `$event` object; Safe navigation expressions."* And: *"The `fullTemplateTypeCheck` flag has been
  deprecated in Angular 13."*
- **Strict** — *"Strict mode is a superset of full mode, and is accessed by setting the
  `strictTemplates` flag to true. This flag supersedes the `fullTemplateTypeCheck` flag."*

🔴 **At v22 there are two, not three.** Topic 01 established from the v22 public-API golden that
`fullTemplateTypeCheck` is no longer in the option surface and the getter does not consult it —
[14g](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md) is the
page, and it is the single most consequential thing the stale guide gets wrong. A migration plan built
around "step down to full mode first" has no floor to land on: the step down goes two.

⚠️ There is also a configuration diagnostic, `CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK`
(4002), still present in the error-code enum for a rule about `fullTemplateTypeCheck`. Whether it can
still be produced at 22.1.5 was not determined here; treat it as documented-but-probably-unreachable,
as [13e](../01-compiler-with-a-framework-attached/13e-the-option-surface-and-config-time-diagnostics.md)
does.

## Gotchas

**★ Symptom: `<input matInput disabled>` now errors and it used to be fine.** Cause:
`strictAttributeTypes`. The attribute delivers the attribute's string value — an empty string for a
valueless attribute — to an input declared `boolean`. Fix:

```html
<input matInput [disabled]="true">
```

The compiler is correct and the template was always broken; this is the one rejection to fix rather
than suppress.

**★ Symptom: errors appear only inside `@if` and `@for` bodies, nowhere else.** Cause: the project was
previously in basic mode, which per the guide *"doesn't check embedded views"*. The bodies were never
checked, so this is a first check rather than a regression. Fix: fix them — and expect the density to
be highest in the oldest control-flow blocks, because they have been unchecked the longest.

**★ Symptom: a `#ref` on a DOM element lost its `any` and errors on a property.** Cause:
`strictDomLocalRefTypes` types the ref from `document.createElement` for that tag. Fix: use the real
element type, or take the event instead —

```html
<!-- the ref is an HTMLInputElement, so .value is fine and .valeu is now an error -->
<input #box (input)="rename(box.value)">
```

If the element genuinely is not what the tag implies — a web component, a directive-hosted custom
tag — cast at the call site with `$any(box)`, narrowly.

**★ Symptom: you added `"fullTemplateTypeCheck": true` and nothing changed.** Cause: it is not in the
v22 public option surface and the getter does not consult it. Depending on your setup it may not even
be reported as unknown, so it looks accepted. Fix: delete it —

```json
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

— and note that `strictTemplates: true` is itself redundant at v22, because the default is already
`true`. The two reachable modes are strict and basic.

**★ Symptom: `[config]="{ retires: 3 }"` used to compile and now reports an unknown property.** Cause:
`strictLiteralTypes` — the literal gets its inferred type instead of `any` and is checked against the
input. Fix: correct the key, and consider moving the object to the class, where it is created once
instead of on every change detection cycle and where the error message has less distance to travel:

```ts
export class RetryPanel {
  protected readonly config = {retries: 3} as const;
}
```

**Symptom: `a?.b` stopped being `any` and an error appeared further along the chain.** Cause:
`strictSafeNavigationTypes`. The type is now *"the same as the type of the ternary expression
`a != null ? a.b : a`"*, which means the short-circuit branch is in the union and the next hop has to
cope with it. Fix: narrow with `@if` once rather than chaining `?.` through four levels — the chain
was hiding the same problem at every level.

**Symptom: a generic component's `item` is `any` in a parent's template.** Cause:
`strictContextGenerics` is off, so *"any generic parameters will be set to `any`"*. Fix: it is on
under `strictTemplates`; if it is off, something explicitly set it. Remove that override — a generic
component whose parameters do not reach the template is a generic component in name only.

**Symptom: `$event` is precisely typed on one handler and `any` on another in the same template.**
Cause: two different flags. Component outputs are `strictOutputEventTypes`; DOM events are
`strictDomEventTypes` and are covered in [07b](07b-the-dollar-event-target-rejection.md). One of the
two has been turned off.

**Symptom: pipe return types are still checked in a project that set `strictTemplates: false`.**
Cause: `checkTypeOfPipes` is hard-coded on in both branches — per the source comment, pipes were
already checked before the strictness flags existed, so they never got one. Fix: nothing; there is no
flag. [14k](../01-compiler-with-a-framework-attached/14k-the-checks-with-no-switch.md) lists everything
in this category.

**Symptom: a DOM property binding with an obviously wrong type is not reported, and no flag turns it
on.** Cause: `checkTypeOfDomBindings` is hard-coded **off** in both branches, with the source comment
*"Even in full template type-checking mode, DOM binding checks are not quite ready yet."* Fix: there is
none, and inventing a flag name will not help. Assert the type on the component side if it matters.

## Interview questions

**★ Why does `<input matInput disabled>` error under `strictTemplates`, and is the compiler right?**
Yes, it is right, and this is the clearest case in the whole feature. The attribute is consumed as an
input declared `boolean`, but at runtime the input receives the *attribute's string value*, which for
a valueless attribute is the empty string — falsy. The template says "disabled" and delivers something
that means "not disabled". The fix is `[disabled]="true"`, a property binding, which delivers an actual
boolean. Nothing had ever reported this before; the check did not create the bug, it revealed it.

**★ What is `fullTemplateTypeCheck` and should you set it?**
It selected the intermediate mode between basic and strict: embedded views checked, input bindings not
checked against directive field types. angular.dev still documents it and notes it was *"deprecated in
Angular 13"*, and that `strictTemplates` is *"a superset of full mode"* which *"supersedes the
`fullTemplateTypeCheck` flag"*. At v22 it is gone from the public option surface and setting it does
nothing at all. Recognise it in an old tsconfig, delete it, and — importantly — do not plan a migration
around occupying that middle tier, because there are now two modes, not three.

**★ Your team was on basic mode and errors appear only inside `@if` and `@for` bodies. Is that a
regression?**
No. Basic mode, in the guide's own words, *"doesn't check embedded views"* — so the contents of every
structural block in the application have never been type-checked. What looks like a regression
concentrated in control-flow blocks is a first check, and the error density is a rough map of how long
each block has gone unexamined. The corollary matters for planning: you cannot estimate the migration
from the number of errors at the top level, because that is the part that was already being checked.

**★ What type does `a?.b` have, exactly?**
Under `strictSafeNavigationTypes` — which `strictTemplates` implies — it is *"the same as the type of
the ternary expression `a != null ? a.b : a`"*. That is a union including the short-circuit result, not
simply "the type of `b`". With the flag off it is `any`, and the `any` propagates down the rest of the
chain, which is why a long `?.` chain can swallow a genuine error several hops later. The practical
advice is to narrow once with `@if` rather than repeat `?.` at every level.

**Which template checks are on no matter what you configure?**
Pipe return types and non-DOM references are hard-coded on in both the strict and non-strict branches,
because both were checked before the strictness flags existed and never acquired one. DOM property
bindings are hard-coded *off* in both, with a source comment saying the check is *"not quite ready
yet"*. And host bindings are governed by a separate option, `typeCheckHostBindings`, which defaults to
`true` and is unaffected by `strictTemplates` — so a project that opted out of strict templates is
still having its `host` expressions and `@HostListener` arguments checked.
[14k](../01-compiler-with-a-framework-attached/14k-the-checks-with-no-switch.md) is the full inventory.

---

← Prev: [The escape hatches are ranked](07c-the-escape-hatches-are-ranked.md) · Index: [Topic index](README.md) · Next → [Where the opt-out goes](07e-where-the-opt-out-goes.md)
