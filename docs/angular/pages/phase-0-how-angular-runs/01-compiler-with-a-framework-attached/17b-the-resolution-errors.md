---
title: "NG8001, NG8002, NG8003 and NG8023 are all one question — does this name resolve in this component's compilation scope — and each has a runtime twin it was promoted from, which is the clearest evidence of what moving work to build time actually buys"
sidebar_label: "17b · The resolution errors"
sidebar_position: 17.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts);
> angular.dev error pages [NG8001](https://angular.dev/errors/NG8001), [NG8002](https://angular.dev/errors/NG8002), [NG8003](https://angular.dev/errors/NG8003), [NG8023](https://angular.dev/errors/NG8023);
> and the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) (breaking changes, compiler-cli).
> Documentation-validated; **no sandbox run** — no build was executed; every message below is read from the named source file or doc page.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Four error codes account for most of the compiler's refusals, and they are the same question asked
about four different kinds of name: an element, a property, a template reference, and — new in v22 —
a selector that matches twice. Every one of them has a runtime error it was promoted from, and
reading the pairs side by side is the most direct evidence there is for what this topic has been
arguing since [12](12-ivy-and-locality.md): the compiler knows the component's dependency list, so it
can answer at build time what the runtime used to discover on first render.**

## NG8001 — the message that adapts three ways

The compile-time text is assembled, not fixed. From `dom.ts`, verbatim:

```ts
const schemas = `'${hostIsStandalone ? '@Component' : '@NgModule'}.schemas'`;
let errorMsg = `'${name}' is not a known element:\n`;
errorMsg += `1. If '${name}' is an Angular component, then verify that it is ${
  hostIsStandalone
    ? "included in the '@Component.imports' of this component"
    : 'part of this module'
}.\n`;
if (name.indexOf('-') > -1) {
  errorMsg += `2. If '${name}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.`;
} else {
  errorMsg += `2. To allow any element add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
}
```

🔴 **Two independent branches, so four possible messages.** Standalone or NgModule decides whether it
says `@Component.imports` or *"part of this module"*; a hyphen in the tag name decides whether it
suggests `CUSTOM_ELEMENTS_SCHEMA` or `NO_ERRORS_SCHEMA`. That is why two developers quoting *"the
NG8001 message"* quote different text and both are right — and it is why the hyphen matters: a
hyphenated name is assumed to be a custom element, an unhyphenated one is assumed to be a typo or a
missing import.

One subtlety runs before all of it, verbatim:

```ts
// HTML elements inside an SVG `foreignObject` are declared in the `xhtml` namespace.
// We need to strip it before handing it over to the registry because all HTML tag names
// in the registry are without a namespace.
const name = tagName.replace(REMOVE_XHTML_REGEX, '');
```

The doc page states the rule: > *"One or more elements cannot be resolved during compilation because
the element is not defined by the HTML spec, or there is no component or directive with such element
selector."*

⚠️ **Take the suggestions in order and prefer the first.** `NO_ERRORS_SCHEMA` in particular silences
the entire class of check for that component — it is the message offering you a way to stop being
told, not a fix.

## NG8002 — and the branch people miss

Same file, same shape:

```ts
const decorator = hostIsStandalone ? '@Component' : '@NgModule';
const schemas = `'${decorator}.schemas'`;
let errorMsg = `Can't bind to '${name}' since it isn't a known property of '${tagName}'.`;
```

with the hyphenated-tag branch adding three numbered suggestions — verify it is in
`@Component.imports`, add `CUSTOM_ELEMENTS_SCHEMA` for a Web Component, or add `NO_ERRORS_SCHEMA` to
allow any property.

🔴 **`REGISTRY.validateProperty(name)` runs first, and reports under the same code.** So NG8002 covers
two different failures: *this element has no such property* and *this property name is not valid at
all*. The message text differs; the code does not. When the message does not read like a missing
input, check the property name itself before you check your imports.

The doc page draws the boundary precisely: > *"This error arises when attempting to bind to a
property that does not exist. Any property binding must correspond to either: A native property on
the HTML element, or An `input()`/`@Input()` property of a component or directive applied to the
element."*

## NG8003 — the reference target

> *"Angular can't find a directive with `{{ PLACEHOLDER }}` export name. This is common with a
> missing import or a missing `exportAs` on a directive."*

The same resolution question, asked about `#ref="someExportAs"`. Its runtime twin is named on the
page itself: > *"This is the compiler equivalent of a common runtime error NG0301: Export Not Found."*

## NG8023 — new in v22, and the thesis in one code

The 22.0.0 CHANGELOG lists it as a **breaking change**, verbatim: > *"Elements with multiple matching
selectors will now throw at compile time."* — introduced by *"introduce NG8023 compile-time diagnostic
for duplicate selectors"* (commit `ca67828ee2`).

The doc page: > *"Two or more components in the compilation scope match the same element in a
template. Because Angular can associate only one component with a given element, selectors must be
unique enough to prevent ambiguity."* and, explicitly: > *"NOTE: This is the build-time equivalent of
the runtime error NG0300: Selector Collision. Detecting this at compile time means the error surfaces
immediately."*

🔴 **Nothing about the underlying rule changed in v22 — only when you are told.** A template with two
components matching one element was always ambiguous; before v22 you found out at runtime, if you
found out at all. The compiler could always have known, because the compilation scope is exactly the
local dependency list [12](12-ivy-and-locality.md) describes. v22 simply spent that knowledge.

The page's debugging hint is worth carrying: > *"If you're having trouble finding multiple components
with this selector tag name, check for components from imported component libraries, such as Angular
Material."*

## The pairs, side by side

| Compile-time | Runtime equivalent | What moved |
|---|---|---|
| NG8001 · invalid element | NG0304 unknown element | element resolution |
| NG8002 · invalid attribute | the NG0304 family | property / input resolution |
| NG8003 · missing reference target | NG0301 Export Not Found | `#ref="exportAs"` resolution |
| NG8004 · missing pipe | NG0302 Pipe Not Found | pipe resolution |
| **NG8023 · multiple components match** | **NG0300 Selector Collision** | directive matching — **new in v22** |

⚠️ **Do not go looking for NG0304's documentation.** `RuntimeErrorCode.UNKNOWN_ELEMENT = 304` exists
in `packages/core/src/errors.ts` and NG8001's page cross-references it, but the error encyclopedia has
no page for it and no runtime path that reaches it under default v22 settings was traced for this
corpus — with `strictTemplates` on, NG8001 fires at build time first. The code exists; the
documentation does not; whether you can still trigger it is not established here.

## NG3003 — the error in a file you did not touch

Import cycles get their own treatment in [10d](10d-import-cycles-and-local-compilation.md); what
belongs here is its shape as an *experience*. It is the one error whose cause is neither in the file
you edited nor, usefully, in the file it names — the compiler renders the whole cycle for you:

> *"The component Child is used in the template but importing it would create a cycle:
> /parent.ts -> /child.ts -> /parent.ts"*

Every other code on this page is answered by editing one file. This one is answered by changing which
file imports which, which is why it reads as architectural feedback rather than as a mistake.

## NG5002 and the errors that exist only because the template is a language

`NG5002 TEMPLATE_PARSE_ERROR` — *"Raised when the compiler cannot parse a component's template."* The
framing is [01](01-the-template-is-a-separate-language.md) in one sentence: the class body is
TypeScript and the template is not, so `Math.max(a, b)` compiles one line above and fails to parse one
line below. What is legal in a template expression is [02](02-what-a-template-expression-may-contain.md);
this is only where you meet it.

Below NG8004 sits a family that has no equivalent anywhere in TypeScript, because it is about
constructs only a template has. Doc comments verbatim from `error_code.ts`:

| Code | Name | What it catches |
|---|---|---|
| NG8005 | `WRITE_TO_READ_ONLY_VARIABLE` | *"The left-hand side of an assignment expression was a template variable. … Template variables are read-only."* |
| NG8006 | `DUPLICATE_VARIABLE_DECLARATION` | *"A template variable was declared twice."* |
| NG8007 | `SPLIT_TWO_WAY_BINDING` | *"A template has a two way binding (two bindings created by a single syntactical element) in which the input and output are going to different places."* |
| NG8008 | `MISSING_REQUIRED_INPUTS` | *"A directive usage isn't binding to one or more required inputs."* |
| NG8009 | `ILLEGAL_FOR_LOOP_TRACK_ACCESS` | *"The tracking expression of a `for` loop block is accessing a variable that is unavailable"* |
| NG8015 | `ILLEGAL_LET_WRITE` | *"An expression is trying to write to an `@let` declaration."* |
| NG8016 | `LET_USED_BEFORE_DEFINITION` | *"An expression is trying to read an `@let` before it has been defined."* |
| NG8017 | `CONFLICTING_LET_DECLARATION` | *"A `@let` declaration conflicts with another symbol in the same scope."* |
| NG8018 | `UNCLAIMED_DIRECTIVE_BINDING` | *"A binding inside selectorless directive syntax did not match any inputs/outputs of the directive."* |
| NG8022 | `FORM_FIELD_UNSUPPORTED_BINDING` | *"Raised when the user has an unsupported binding on a `FormField` directive."* — v22, signal forms |
| NG8024 | `CONFLICTING_HOST_DIRECTIVE_BINDING` | *"Raised when a host directive input/output is exposed multiple times under the same name."* |
| NG8025–8029 | the foreign-component family | *"Raised when a foreign component node has an unsupported Angular binding"*, *"Raised when a `@content` block is not used as a direct child of a foreign component"*, and three more — all new in v22 |

The `@let` codes are [03](03-declarations-and-the-let-block.md); the point of listing them together is
the pattern. **Every construct the template language gains arrives with its own error codes**, because
a construct the compiler understands is a construct the compiler can refuse.

## Gotchas

**★ Symptom: NG8001 tells one colleague to add `CUSTOM_ELEMENTS_SCHEMA` and another to add
`NO_ERRORS_SCHEMA`, for what looks like the same problem.** Cause: the message branches on whether the
tag name contains a hyphen — hyphenated names are assumed to be custom elements. Fix: ignore
suggestion 2 in both cases and read suggestion 1. A missing entry in `imports` is the cause the
overwhelming majority of the time:

```ts
@Component({
  selector: 'app-dashboard',
  imports: [UserCardComponent],   // ← the fix NG8001 lists first
  template: `<app-user-card [user]="user()" />`,
})
export class Dashboard {}
```

**★ Symptom: you added `NO_ERRORS_SCHEMA` and the error went away — along with several you wanted.**
Cause: the schema suppresses the entire class of unknown-element and unknown-property checking for
that component, which is what the message means by *"to suppress this message"*. Fix: remove it and
fix the import. Reserve schemas for genuine third-party custom elements, where they are correct.

**★ Symptom: NG8002 whose text does not look like a missing input at all.** Cause: `validateProperty`
runs before the element/property lookup and reports under the same code, so NG8002 covers both *"this
element has no such property"* and *"this property name is not valid"*. Fix: read which of the two
messages you got before touching `imports` — a typo in the property name is a different fix from a
missing component.

**★ Symptom: upgrading to v22 produced NG8023 on markup that has worked for years.** Cause: nothing
about the markup changed. Two components in scope match that element, which was always ambiguous; it
was runtime error NG0300 before, and nobody noticed because whichever component won was consistently
the one that won. Fix: narrow one selector, or stop importing one of the two into that component's
scope — and check imported libraries first, per the doc's own hint.

**★ Symptom: NG8003 on a `#ref` that names something you can see in the file.** Cause: `#ref="name"`
resolves against a directive's `exportAs`, not against a class name or a selector. Fix: check that the
directive declares `exportAs: 'name'` and that it is in this component's `imports` — both are
required, and the message names only the second.

**★ Symptom: an element inside an SVG `foreignObject` reports as unknown with an odd name.** Cause:
HTML elements in a `foreignObject` are in the `xhtml` namespace, and the compiler strips it before
consulting the registry precisely so this works. Fix: if you see a namespaced name in the message, it
is worth reporting — the stripping is deliberate and the registry holds unnamespaced tags only.

**Symptom: NG3003 after adding one import, in two files you were not editing.** Cause: the import
completed a cycle. The error names the component and renders the whole path — *"/parent.ts ->
/child.ts -> /parent.ts"* — because no single file in a cycle is the culprit. Fix: break the cycle
architecturally; [10d](10d-import-cycles-and-local-compilation.md) has the options and their runtime
cost, which is none.

**Symptom: an expression works in the class and fails to parse in the template.** Cause: NG5002 — they
are different languages, which is the topic's opening claim and not a limitation to work around. Fix:
move the computation into the class and bind its result, which is the shape Angular is asking for.

## Interview questions

**★ What is the difference between NG8001 and NG0304, and why does Angular have both?**
They are the same question — *is this element known?* — asked at two different times. NG8001 is the
compile-time diagnostic produced by the template type-checker, which can answer it because it has the
component's compilation scope: the local `imports` array, plus the element registry. NG0304 is the
runtime code for the same condition, from the era when element resolution could only be discovered
while rendering. Angular has both because compile-time checking is gated behind `strictTemplates`,
which was not always the default, and because the runtime cannot assume the build performed the check.
In practice, on v22, NG8001 fires first and the runtime code is close to unreachable — though note that
NG0304 has no documentation page at all, so its current status is not something the docs settle.

**★ Why can Angular report a duplicate-selector collision at build time in v22 when it could not
before?**
Because nothing was ever missing except the decision to check. Since Ivy, a component's dependency set
is local — the `imports` array is the compilation scope — so the compiler always had the complete list
of components that could match an element in that template. Matching two of them is ambiguous, and
Angular associates exactly one component with an element, so the ambiguity was detectable statically
all along. v22 spent that knowledge and added NG8023, listed as a breaking change precisely because
code that compiled before now does not. The runtime twin, NG0300 Selector Collision, is the same
condition found later and less usefully.

**★ Someone pastes an NG8001 message that differs from the one you remember. Who is misquoting?**
Neither. The message is assembled from two independent branches: standalone versus NgModule decides
between *"included in the `@Component.imports` of this component"* and *"part of this module"*, and the
presence of a hyphen in the tag name decides between suggesting `CUSTOM_ELEMENTS_SCHEMA` and
`NO_ERRORS_SCHEMA`. Four texts, one code. The variation is deliberate — a hyphenated tag is probably a
web component, an unhyphenated one is probably a typo or a missing import — and it is a good example of
why quoting an error message verbatim is weaker evidence than reading the branch that produced it.

**★ You changed one file and got NG3003 in another. Explain the mechanism and give a fix that costs
nothing at runtime.**
The import you added completed a cycle, and Angular refuses to generate code that would require one:
the component is used in a template, so its class must be imported, and importing it closes a loop
through the file that imports yours. The compiler prints the whole path rather than one location
because no single edge is wrong on its own. The zero-runtime-cost fix is to import only the *type* — a
`import type` or a type-only reference does not survive to JavaScript, so it cannot participate in a
runtime cycle — or to restructure so one direction goes through a shared file. Both are build-time
changes with no runtime footprint.

**Why does a family of error codes exist for `@let`, template variables and two-way bindings, when
TypeScript has nothing equivalent?**
Because those are constructs of the template language, not of TypeScript, so nothing else can have an
opinion about them. A template variable being read-only, an `@let` being read before its definition, a
two-way binding whose input and output resolve to different places — none of these has a JavaScript
counterpart for `tsc` to check. It is the same pattern each time Angular adds a template construct: the
construct arrives with its own diagnostics, because a language feature the compiler understands is one
it can also refuse. v22's signal-forms and foreign-component codes are the most recent instance.

---

← Prev: [17 · The filename in the error](17-the-filename-in-the-error.md) · Index: [Topic index](README.md) · Next → [17c · The v22 upgrade wall](17c-the-v22-upgrade-wall.md)
