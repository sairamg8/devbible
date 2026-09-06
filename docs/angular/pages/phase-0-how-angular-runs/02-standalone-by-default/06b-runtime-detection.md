---
title: "NG0304 and NG0303 are the runtime twins of NG8001 and NG8002, they only exist in JIT-compiled code, and by default they log instead of throwing — which is why the browser stays quiet and the test fails"
sidebar_label: "06b · Compile time vs runtime"
sidebar_position: 6.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8001 Invalid Element](https://angular.dev/errors/NG8001),
> [NG8002 Invalid Attribute](https://angular.dev/errors/NG8002) — and `angular/angular` at tag
> `v22.1.5`:
> [`core/src/render3/instructions/element_validation.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/element_validation.ts),
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts),
> [`compiler-cli/src/ngtsc/typecheck/src/dom.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The same mistake is a hard build failure in one project and a red console line in another, and
nothing about the message tells you why. The answer is that Angular checks tags twice, in two
different code bases, under mutually exclusive conditions: `ngtsc` checks AOT-compiled templates at
build time and stops the build, while `element_validation.ts` checks JIT-compiled templates as they
render and — by default — merely logs. The switch between them is one field, `tView.schemas`, whose
`null` value is the AOT marker. Because `ng build` and `ng serve` are AOT in Angular 22, the runtime
codes are effectively a `TestBed` phenomenon, and `TestBed` is also the thing that turns the log into
a throw. Knowing which of the four codes you are holding is the difference between reading a build
log and reading a browser console.**

## One field decides which check runs

`element_validation.ts` opens with a guard and a comment that is the clearest statement of the whole
arrangement, verbatim:

```ts
// If `schemas` is set to `null`, that's an indication that this Component was compiled in AOT
// mode where this check happens at compile time. In JIT mode, `schemas` is always present and
// defined as an array (as an empty array in case `schemas` field is not defined) and we should
// execute the check below.
if (tView.schemas === null) return;
```

and the surrounding doc comment says it again in words:

> *"This check is relevant for JIT-compiled components (for AOT-compiled ones this check happens at
> build time)."*

So the runtime validator is not a second opinion on the compiler's work — it is the *substitute* for
it, used only where the compiler never ran. An AOT-compiled component definition carries
`schemas: null`, and every unknown-element instruction returns immediately.

| | Runs when | Severity | Where you read it |
|---|---|---|---|
| **NG8001 / NG8002** | `ngtsc` compiles the template | `ts.DiagnosticCategory.Error` — build stops | build log, editor squiggle |
| **NG0304 / NG0303** | JIT rendering, `tView.schemas !== null` | `console.error` by default | browser console, test output |

## The default is a log, not a throw

```ts
if (shouldThrowErrorOnUnknownElement) {
  throw new RuntimeError(RuntimeErrorCode.UNKNOWN_ELEMENT, message);
} else {
  console.error(formatRuntimeError(RuntimeErrorCode.UNKNOWN_ELEMENT, message));
}
```

The flag is module-level state with an exported setter, verbatim:

```ts
let shouldThrowErrorOnUnknownElement = false;

/**
 * Sets a strict mode for JIT-compiled components to throw an error on unknown elements,
 * instead of just logging the error.
 * (for AOT-compiled ones this check happens at build time).
 */
export function ɵsetUnknownElementStrictMode(shouldThrow: boolean) {
  shouldThrowErrorOnUnknownElement = shouldThrow;
}
```

There is an identical pair for properties, `ɵsetUnknownPropertyStrictMode` and
`ɵgetUnknownPropertyStrictMode`. **These two setters are what `TestBed`'s `errorOnUnknownElements` and
`errorOnUnknownProperties` options drive.** That is the entire mechanism behind the most confusing
report in Angular triage — "it renders fine but the spec fails" — and it is not a bug in either place.

```ts
import { TestBed } from '@angular/core/testing';
import { TeamPage } from './team-page';

describe('TeamPage', () => {
  it('renders the card', async () => {
    TestBed.configureTestingModule({
      imports: [TeamPage],
      errorOnUnknownElements: true,
      errorOnUnknownProperties: true,
    });

    const fixture = TestBed.createComponent(TeamPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ada');
  });
});
```

## The runtime message is not the compile-time message

The element text is built the same way, with two differences that matter when you are searching for a
phrase:

```ts
let message = `'${tagName}' is not a known element${templateLocation}:\n`;
message += `1. If '${tagName}' is an Angular component, then verify that it is ${
  isHostStandalone
    ? "included in the '@Component.imports' of this component"
    : 'a part of an @NgModule where this component is declared'
}.\n`;
if (tagName && tagName.indexOf('-') > -1) {
  message += `2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.`;
} else {
  message += `2. To allow any element add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
}
```

1. `${templateLocation}` is interpolated **between the tag name and the colon**. The compile-time
   message has no equivalent, because a `ts.Diagnostic` already carries a file and a span.
2. The non-standalone branch reads *"a part of an @NgModule where this component is declared"*,
   where the compiler says *"part of this module"*. Same meaning, different string.

The property message has a branch the compiler's version does not — a dedicated control-flow hint:

```ts
let message = `Can't bind to '${propName}' since it isn't a known property of '${tagName}'${templateLocation}.`;

const schemas = `'${isHostStandalone ? '@Component' : '@NgModule'}.schemas'`;
const importLocation = isHostStandalone
  ? "included in the '@Component.imports' of this component"
  : 'a part of an @NgModule where this component is declared';
if (KNOWN_CONTROL_FLOW_DIRECTIVES.has(propName)) {
  // Most likely this is a control flow directive (such as `*ngIf`) used in
  // a template, but the directive or the `CommonModule` is not imported.
  const correspondingImport = KNOWN_CONTROL_FLOW_DIRECTIVES.get(propName);
  message +=
    `\nIf the '${propName}' is an Angular control flow directive, ` +
    `please make sure that either the '${correspondingImport}' directive or the 'CommonModule' is ${importLocation}.`;
}
```

and a special case whose comment explains a shape that otherwise looks like a compiler bug, verbatim:

> *"Special-case a situation when a structural directive is applied to an `<ng-template>` element, for
> example: `<ng-template *ngIf="true">`. In this case the compiler generates the `ɵɵtemplate`
> instruction with the `null` as the tagName."*

## 🔴 angular.dev names the wrong runtime code for NG8002

Verbatim from `adev/src/content/reference/errors/NG8002.md`:

> *"The runtime error for this is `NG0304: '${tagName}' is not a known element: …'`."*

That is the **element** error. The runtime counterpart of an unknown *property* is
`UNKNOWN_BINDING = 303` → **NG0303**, `Can't bind to 'x' since it isn't a known property of 'y'`.
NG8001's page cites NG0304 correctly:

> *"This is the compiler equivalent of a common runtime error `NG0304: '${tagName}' is not a known
> element: ...`."*

So the correct pairing is NG8001 ↔ NG0304 and NG8002 ↔ NG0303, and the NG8002 page carries a line
copied from its neighbour. **Where angular.dev and the v22.1.5 source disagree, the source is right,
and this page says so rather than repeating the doc.** There is no `NG0303.md` or `NG0304.md` in the
adev error reference at all — the listing runs NG0300, NG0301, NG0302, then jumps to NG0318, so
neither runtime code has a guide page to correct the record.

## Gotchas

**★ Symptom: it only logs a red console line in the browser, but the same template fails the unit
test.** Cause: `shouldThrowErrorOnUnknownElement` defaults to `false`, so JIT rendering calls
`console.error`; `TestBed` flips it through `ɵsetUnknownElementStrictMode` via `errorOnUnknownElements`.
Fix: treat the test as authoritative and add the missing import to the component under test — not to
the `TestBed` configuration, which only hides the failure inside that one spec:

```ts
@Component({
  selector: 'app-team-page',
  imports: [UserCard],
  template: `<app-user-card name="Ada" />`,
})
export class TeamPage {}
```

**★ Symptom: you paste the exact phrase from your console into a code search and find nothing.**
Cause: the runtime message interpolates `${templateLocation}` between the tag name and the colon, and
its non-standalone wording differs from the compile-time wording. Fix: search only the stable
prefix — `is not a known element` or `since it isn't a known property of` — and decide which of the
four codes you have from the leading zero after `NG`.

**★ Symptom: you never see NG0304 no matter how badly you break a template.** Cause: `ng build` and
`ng serve` are AOT in v22, so every component definition carries `schemas: null` and the runtime check
returns immediately. Fix: nothing is wrong — look for NG8001 in the build output instead. The runtime
code is reachable only from JIT compilation, which in practice means `TestBed` or a deliberately
JIT-configured harness.

**★ Symptom: the runtime error names `null` as the tag.** Cause: a structural directive on an
`<ng-template>` (`<ng-template *ngIf="ready()">`) compiles to a `ɵɵtemplate` instruction whose
`tagName` is `null`, which the validator special-cases. Fix: it is a genuine missing control-flow
directive; use the built-in block, which needs no import at all:

```ts
@Component({
  selector: 'app-panel',
  template: `
    @if (ready()) {
      <section class="panel">Ready</section>
    }
  `,
})
export class Panel {
  readonly ready = input(false);
}
```

**★ Symptom: a `TestBed` spec passes while the production build fails on the same template.** Cause:
the two checks read different scopes at different times, and a `TestBed` configuration that lists a
component in its own `imports` can satisfy the runtime check while the component under test still
lacks the import in its decorator. Fix: put the import where the template is, then let the test
configure only what the *spec* needs.

**★ Symptom: an unknown element renders as an empty tag and the app carries on.** Cause: the runtime
check is diagnostic only — with `shouldThrowErrorOnUnknownElement` false it logs and rendering
continues, leaving a literal `<app-user-card></app-user-card>` in the DOM with no component behind it.
Fix: do not rely on visual inspection to catch this class of bug; the AOT build is the check that
cannot be ignored, which is another argument for never shipping JIT.

## Interview questions

**★ Why is the same mistake a build failure in one project and a red console line in another?**
Two different code paths under mutually exclusive conditions. AOT compilation runs
`RegistryDomSchemaChecker` and produces NG8001 as a `ts.DiagnosticCategory.Error`, so the build stops.
JIT rendering runs `element_validation.ts`, which returns immediately when `tView.schemas === null`
— the marker AOT leaves behind — and otherwise calls `console.error` unless the strict flag was set.
Because `ng build` and `ng serve` are AOT in v22, an application meets the compile-time code and a
`TestBed` spec meets a throwing runtime one.

**★ Why does `TestBed` throw where the browser only logs?**
Because `TestBed`'s `errorOnUnknownElements` and `errorOnUnknownProperties` options call
`ɵsetUnknownElementStrictMode` and `ɵsetUnknownPropertyStrictMode`, flipping module-level flags that
default to `false`. The decision is deliberate: a log keeps a running application usable while a throw
makes a test deterministic. The asymmetry is not a bug and cannot be observed from the message text,
which is identical either way.

**angular.dev says NG8002's runtime counterpart is NG0304. Is that correct?**
No. NG0304 is `UNKNOWN_ELEMENT`; the runtime counterpart of an unknown *property* is NG0303,
`UNKNOWN_BINDING`. NG8001's page cites NG0304 correctly and the NG8002 page carries the same sentence,
evidently copied. The v22.1.5 source is unambiguous, and neither NG0303 nor NG0304 has a page in the
error reference to correct it. When angular.dev and the source disagree, the source is authoritative.

**What does `tView.schemas === null` actually tell the runtime?**
That this component was compiled ahead of time, so the schema check has already happened and must not
happen again. In JIT mode the field is always an array — an empty one when the component declares no
`schemas` — so `null` is unambiguous as a marker rather than as "no schemas configured". It is a
single field doing the job of a compilation-mode flag, and it is the only thing separating the two
validators.

**If the runtime check only logs, why does it exist at all?**
For the compilation modes the AOT compiler never sees: components compiled in the browser, dynamically
constructed test modules, and anything a tool builds at runtime. In those cases there is no build step
to fail, so the choice is between a silent broken render and a console message. Angular picked the
message, and exposed the setters so that a test runner — which *can* afford to fail hard — turns it
into an error.

---

← Prev: [`'x' is not a known element`](06-not-a-known-element.md) · Index: [Topic index](README.md) · Next → [The five causes, and the fix for each](06c-the-five-causes.md)
