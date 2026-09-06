---
title: "`'x' is not a known element` is four different errors wearing one sentence, and the compile-time pair — NG8001 and NG8002 — is a template literal you can read line by line"
sidebar_label: "06 · `'x' is not a known element`"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8001 Invalid Element](https://angular.dev/errors/NG8001),
> [NG8002 Invalid Attribute](https://angular.dev/errors/NG8002) — and `angular/angular` at tag
> `v22.1.5`:
> [`compiler-cli/src/ngtsc/typecheck/src/dom.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts),
> [`compiler/src/schema/dom_element_schema_registry.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/schema/dom_element_schema_registry.ts),
> [`typecheck/extended/api/format-extended-error.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/extended/api/format-extended-error.ts),
> [`ngtsc/diagnostics/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the error every Angular developer hits first and the one most often fixed by
superstition. The message is not a guess: it is a template literal in
`packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts` that fires when the DOM schema registry does
not recognise a tag *and* no directive selector in scope matched it either. Reading that literal
tells you three things the message never spells out — which file to open, whether the failing
component is standalone, and that its second numbered suggestion branches purely on whether your tag
contains a hyphen rather than on what actually went wrong. There are four distinct codes here, not
one. This chunk is the anatomy of the compile-time pair; the runtime pair is chunk 06b, the five
mistakes that produce the sentence are 06c and 06d, and the two escape hatches people reach for —
`CommonModule` and `schemas` — are 06e to 06g.**

## Four error codes hide behind one sentence

| | Unknown **element** | Unknown **property** |
|---|---|---|
| **Compile time** (AOT / `ngtsc`) | **NG8001** `SCHEMA_INVALID_ELEMENT` | **NG8002** `SCHEMA_INVALID_ATTRIBUTE` |
| **Runtime** (JIT only) | **NG0304** `UNKNOWN_ELEMENT` | **NG0303** `UNKNOWN_BINDING` |

The two families are numbered by different rules, and `format-extended-error.ts` states the scheme in
a comment, verbatim:

> *"Runtime error codes are prefixed with 0 (e.g., NG0100-999) while compiler errors use plain
> numbers (e.g., NG1001), keeping them distinct despite numerical overlap."*

So a leading zero after `NG` means the browser produced it; no leading zero means `ngtsc` produced it
while compiling. That one character tells you whether to look in your build log or your console.

Compiler codes reach you through TypeScript's diagnostic printer, which is why they start life as
*negative* numbers. `ngtsc`'s `diagnostics/src/util.ts` explains it, verbatim:

> *"During formatting of `ts.Diagnostic`s, the numeric code of each diagnostic is prefixed with the
> hard-coded "TS" prefix. For Angular's own error codes, a prefix of "NG" is desirable. To achieve
> this, all Angular error codes start with "-99" so that the sequence "TS-99" can be assumed to
> correspond with an Angular specific error code."*

🔴 **A negative value in that enum does not mean "warning."** It means the code has an error-guide
page on angular.dev. Severity is decided at the call site, and for `SCHEMA_INVALID_ELEMENT = -8001`
the call site passes `ts.DiagnosticCategory.Error`.

angular.dev's description of NG8001 is the correct mental model, verbatim from
`adev/src/content/reference/errors/NG8001.md`:

> *"One or more elements cannot be resolved during compilation because the element is not defined by
> the HTML spec, or there is no component or directive with such element selector."*

**Two independent lookups failed.** The tag is not in Angular's DOM schema *and* no directive in this
component's scope has a matching selector. The error is about the *host* component's scope — which is
why the file you must edit is never the one that defines the missing component.

## The compile-time element error, read off the code that builds it

`dom.ts`, `RegistryDomSchemaChecker.checkElement` — this is the whole of it:

```ts
if (!REGISTRY.hasElement(name, schemas)) {
  const mapping = this.resolver.getTemplateSourceMapping(id);

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

  const diag = makeTemplateDiagnostic(
    id, mapping, sourceSpanForDiagnostics,
    ts.DiagnosticCategory.Error,
    ngErrorCode(ErrorCode.SCHEMA_INVALID_ELEMENT),
    errorMsg,
  );
  this._diagnostics.push(diag);
}
```

Concatenating that template literal for a hyphenated selector in a v22 app gives exactly this —
**assembled from the source above, not captured from a run**:

```text
'app-user-card' is not a known element:
1. If 'app-user-card' is an Angular component, then verify that it is included in the '@Component.imports' of this component.
2. If 'app-user-card' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@Component.schemas' of this component to suppress this message.
```

Two details the message does not advertise:

- 🔴 **The wording of line `1.` tells you whether the failing host is standalone.** A v22 component
  always yields *"included in the `'@Component.imports'` of this component"*. If you are reading
  *"part of this module"*, the component whose template failed carries `standalone: false` — which
  changes the fix entirely.
- **Line `2.` branches on `name.indexOf('-')` alone.** A typo like `<dvi>` has no hyphen, so you are
  told about `NO_ERRORS_SCHEMA` — advice that would silence the typo instead of fixing it.

One preprocessing step happens before the lookup, and it is the reason SVG works:

```ts
const REMOVE_XHTML_REGEX = /^:xhtml:/;
// HTML elements inside an SVG `foreignObject` are declared in the `xhtml` namespace.
// We need to strip it before handing it over to the registry because all HTML tag names
// in the registry are without a namespace.
const name = tagName.replace(REMOVE_XHTML_REGEX, '');
```

The registry itself is not a heuristic. Its class doc, verbatim:

> *"Checks non-Angular elements and properties against the `DomElementSchemaRegistry`, a schema
> maintained by the Angular team via extraction from a browser IDL."*

## NG8002 is the same bug in property position

`checkTemplateElementProperty` builds a message with **three** branches instead of two:

```ts
if (!REGISTRY.hasProperty(tagName, name, schemas)) {
  const mapping = this.resolver.getTemplateSourceMapping(id);

  const decorator = hostIsStandalone ? '@Component' : '@NgModule';
  const schemas = `'${decorator}.schemas'`;
  let errorMsg = `Can't bind to '${name}' since it isn't a known property of '${tagName}'.`;
  if (tagName.startsWith('ng-')) {
    errorMsg +=
      `\n1. If '${name}' is an Angular directive, then add 'CommonModule' to the '${decorator}.imports' of this component.` +
      `\n2. To allow any property add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
  } else if (tagName.indexOf('-') > -1) {
    errorMsg +=
      `\n1. If '${tagName}' is an Angular component and it has '${name}' input, then verify that it is ${
        hostIsStandalone
          ? "included in the '@Component.imports' of this component"
          : 'part of this module'
      }.` +
      `\n2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.` +
      `\n3. To allow any property add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
  }
}
```

🔴 **There is no `else`.** A plain HTML tag with neither an `ng-` prefix nor a hyphen gets the bare
first sentence and no numbered advice at all: `<input [valu]="query">` yields only
`Can't bind to 'valu' since it isn't a known property of 'input'.`

🔴 **The `ng-` branch is where the `CommonModule` folklore comes from, and it ships in v22.1.5.** For
`<ng-container *ngIf="user()">` the compiler tells you to add `CommonModule`, while Angular's own
control-flow migration guide tells you that you no longer need it. That collision is chunk 06e's
subject.

A third method, `checkHostElementProperty`, emits the bare form with no numbered suggestions at all,
for a bad `host` binding on a directive:

```ts
const errorMessage = `Can't bind to '${name}' since it isn't a known property of '${tagName}'.`;
```

angular.dev's NG8002 page states the rule the check enforces, verbatim:

> *"This error arises when attempting to bind to a property that does not exist. Any property binding
> must correspond to either: - A native property on the HTML element, or - An `input()`/`@Input()`
> property of a component or directive applied to the element."*

That is the whole of it: native property, or an input on something whose selector matched. Nothing
else is bindable without a schema.

## Gotchas

**★ Symptom: `'dvi' is not a known element:` and line 2 tells you to add `NO_ERRORS_SCHEMA`.** Cause:
the second suggestion branches on `name.indexOf('-') > -1` and nothing else, so a plain typo gets the
"allow any element" advice. Fix: fix the tag; never take that suggestion for a hyphen-free name.
`<dvi>` becomes `<div>`, and the diagnostic disappears without any schema being touched.

**★ Symptom: the message says *"part of this module"* in an app you believe has no modules.** Cause:
`hostIsStandalone` is `false` for the component whose *template* failed — it carries
`standalone: false`, usually a leftover the v19 `explicit-standalone-flag` migration wrote. Fix:
delete the flag and move its template dependencies into its own `imports` array; the wording flips as
soon as you do:

```ts
@Component({
  selector: 'app-team-page',
  imports: [UserCard],
  template: `<app-user-card name="Ada" />`,
})
export class TeamPage {}
```

**★ Symptom: `Can't bind to 'label' since it isn't a known property of 'button'.` with no numbered
suggestions underneath.** Cause: two possibilities, and the absence of numbered lines distinguishes
them — either the tag is a plain HTML element with no `ng-` prefix and no hyphen, so neither branch of
`checkTemplateElementProperty` ran, or the failure is in a directive's `host` object rather than a
template, which goes through `checkHostElementProperty` and never emits suggestions. Fix: check the
`host` object first; it is the case people forget they wrote.

```ts
@Directive({
  selector: '[appIconButton]',
  host: { '[attr.aria-label]': 'label()' },
})
export class IconButton {
  readonly label = input.required<string>();
}
```

**★ Symptom: a build that passed on the previous major fails with NG8002 on a tag you did not touch.**
Cause: the DOM schema is *"maintained by the Angular team via extraction from a browser IDL"*, so an
upgrade can move a property in or out of that table. Fix: if the property is genuinely non-standard or
newer than the table, bind it as an attribute — attribute bindings are not schema-checked:

```html
<video [attr.playsinline]="true" src="/clip.mp4"></video>
```

**★ Symptom: an element inside `<svg><foreignObject>` reports as unknown even though it is a plain
`<div>`.** Cause: HTML elements inside `foreignObject` are parsed in the `xhtml` namespace, so the tag
arrives as `:xhtml:div`. Fix: nothing — `checkElement` strips the prefix with `REMOVE_XHTML_REGEX`
before the lookup, so a genuine `<div>` there passes. If you still see the error, the tag really is
unknown and the namespace is a red herring.

## Interview questions

**★ From the message text alone, how do you tell whether the failing component is standalone?**
Read line `1.`. *"included in the `'@Component.imports'` of this component"* means the host is
standalone; *"part of this module"* means it carries `standalone: false`. The schema name in the next
suggestion agrees — `'@Component.schemas'` versus `'@NgModule.schemas'`. That one phrase decides
whether your fix is an `imports` entry or a `declarations` entry, and it is the fastest way to spot a
half-finished migration.

**★ Why does the second numbered line of the message change depending on the tag name?**
Because the branch is `name.indexOf('-') > -1` and nothing more. A hyphen makes the compiler guess
"web component" and suggest `CUSTOM_ELEMENTS_SCHEMA`; no hyphen makes it suggest `NO_ERRORS_SCHEMA`.
It is a heuristic on spelling, not a diagnosis — which is why the advice is actively misleading for a
typo, and why a mis-cased tag like `<AppUserCard>` gets the `NO_ERRORS_SCHEMA` branch even though the
real fix is a rename.

**Why do Angular's compiler error codes start life as negative numbers?**
Because TypeScript's diagnostic formatter hard-codes a `TS` prefix in front of the numeric code.
Angular's codes all begin `-99` so the printed sequence reads `TS-99…`, which the tooling rewrites to
`NG…`. The sign carries a second meaning inside `ngtsc`: a negative value marks a code that has an
error-guide page on angular.dev. It never means the diagnostic is a warning — severity is passed
explicitly at the call site, and NG8001 passes `ts.DiagnosticCategory.Error`.

**What does it mean that the check runs against a schema extracted from a browser IDL?**
That Angular is not guessing which properties exist. `DomElementSchemaRegistry` holds a generated
table of tags and their properties, so `hasElement` and `hasProperty` are exact-membership tests
against a fixed list. The consequence is that a legitimate but newer DOM property can be absent from
the table your Angular version shipped with — and that binding it as an attribute (`[attr.foo]`)
bypasses the check entirely, because attribute bindings are not schema-validated.

**Why does NG8002 fire for a property that clearly exists on the component you are rendering?**
Because the property check only reaches component inputs *after* a selector matched. If nothing in
the host's scope matched the tag, the tag falls through to the DOM registry, and the registry knows
nothing about your input. That is why an unknown element and an unknown property usually arrive as a
pair from a single missing import, and why fixing the element error makes the property errors vanish
without being addressed individually.

---

← Prev: [The errors that reject an import](05d-the-errors-that-reject-an-import-outright.md) · Index: [Topic index](README.md) · Next → [Compile time vs runtime](06b-runtime-detection.md)
