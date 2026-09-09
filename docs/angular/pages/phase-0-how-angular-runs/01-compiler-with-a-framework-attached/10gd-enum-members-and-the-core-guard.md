---
title: "`encapsulation must be a member of ViewEncapsulation enum from @angular/core` is enforced by a guard that checks which package the enum came from, not what it is called — which is why an identical local enum is rejected, a renamed import is accepted, a bare `0` is rejected, and local compilation silently accepts neither"
sidebar_label: "10gd · Enum members and the core guard"
sidebar_position: 10.63
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/result.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/result.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/imports/src/references.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/imports/src/references.ts),
> [`packages/core/src/metadata/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/view.ts),
> [`packages/core/src/change_detection/constants.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/constants.ts).
> Documentation-validated; **no sandbox run** — no build was executed. Every message string below is a string literal or template literal read from a named file at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Nothing on this page is daggered — the enum error throws `VALUE_HAS_WRONG_TYPE = 1010`, read from the assigning line of `error_code.ts` ([10g](10g-calls-enums-and-the-values-in-between.md)).

**`encapsulation` and `changeDetection` are the only two `@Component` fields checked against an enum, and they are checked by one function whose test is not "is this the right value" but "is this an `EnumValue` whose declaring enum belongs to `@angular/core`". That single design choice explains a set of outcomes that look contradictory from the outside: a numeric literal equal to the right member is rejected, a locally-declared enum with the same name and the same members is rejected with a message that repeats the name back at you, and an import renamed to `VE` is accepted. Underneath it is `visitEnumDeclaration`, twelve lines that fold an enum into a `Map` and contain one arithmetic decision that does not match TypeScript's. And above it is a local-compilation branch that replaces the whole check with a string comparison on source text and defaults silently when it misses.**

## `visitEnumDeclaration` — twelve lines, and one of them disagrees with TypeScript

An enum is not special-cased at the field. It is resolved like any other declaration, into a `Map` of member name to `EnumValue`:

```ts
private visitEnumDeclaration(node: ts.EnumDeclaration, context: Context): ResolvedValue {
  const enumRef = this.getReference(node, context);
  const map = new Map<string, EnumValue>();
  node.members.forEach((member, index) => {
    const name = this.stringNameFromPropertyName(member.name, context);
    if (name !== undefined) {
      const resolved = member.initializer ? this.visit(member.initializer, context) : index;
      map.set(name, new EnumValue(enumRef, name, resolved));
    }
  });
  return map;
}
```

and `EnumValue` keeps three things — the reference to the enum declaration, the member name, and the folded value:

```ts
export class EnumValue {
  constructor(
    readonly enumRef: Reference<ts.Declaration>,
    readonly name: string,
    readonly resolved: ResolvedValue,
  ) {}
}
```

`ViewEncapsulation.Emulated` therefore resolves as: identifier → declaration → this `Map`, then `.Emulated` through `accessHelper`'s `lhs instanceof Map` branch. Element access works identically, so `ViewEncapsulation['None']` is legal.

Three consequences fall straight out of those twelve lines.

**A member whose name does not fold is silently dropped, not reported.** The guard is `if (name !== undefined)`. A computed member name that is not a static string never enters the map, so the failure surfaces much later and somewhere else as a *missing key* — `accessHelper` returns `undefined` for a `Map` miss, and you get `Value is of type 'undefined'.` pointing at your usage rather than at the enum. There is no diagnostic at the enum at all.

**An initialised member folds only if its initialiser folds.** `member.initializer ? this.visit(member.initializer, context) : index` — so `Mode.A = buildName()` inherits whatever the call produced, including a `DynamicValue`.

🔴 **An un-initialised member folds to its positional `index`, which is not what TypeScript computes.** TypeScript gives an un-initialised member *the previous member's value plus one*. The evaluator gives it the member's position in `node.members`. The two agree only while every preceding member is un-initialised:

```ts
// TypeScript:      A = 10, B = 11, C = 12
// the evaluator:   A = 10, B = 1,  C = 2     (positional index)
export enum Mode {
  A = 10,
  B,
  C,
}
```

⚠️ **Stated with its limits.** The arithmetic above is read directly from the line quoted, and I have no sandbox with which to observe a build that consumes `Mode.B` in metadata; the divergence is an inference from the source, not an observed diagnostic. It cannot affect `encapsulation` or `changeDetection`, because both `@angular/core` enums initialise *every* member — `ViewEncapsulation` is `Emulated = 0, None = 2, ShadowDom = 3, ExperimentalIsolatedShadowDom = 4` (there is no `1`; the comment in `view.ts` records that *"Historically the 1 value was for `Native` encapsulation which has been removed as of v11"*), and `ChangeDetectionStrategy` is `OnPush = 0, Eager = 1, Default = 1`. It can affect *your* enums when one of their members reaches an evaluated metadata position. **Initialise every member of an enum you use in metadata.**

## The enum gate: `resolveEnumValue`

Two `@Component` fields are checked against an enum, and both go through one function. `resolveEnumValue`, verbatim:

```ts
const value = evaluator.evaluate(expr) as any;
if (
  value instanceof EnumValue &&
  isAngularCoreReferenceWithPotentialAliasing(value.enumRef, enumSymbolName, isCore)
) {
  resolved = value.resolved as number;
} else {
  throw createValueHasWrongTypeError(
    expr,
    value,
    `${field} must be a member of ${enumSymbolName} enum from @angular/core`,
  );
}
```

The `field` and `enumSymbolName` come from the two call sites in `component/src/handler.ts`, so the only two messages this template can produce are:

- `encapsulation must be a member of ViewEncapsulation enum from @angular/core`
- `changeDetection must be a member of ChangeDetectionStrategy enum from @angular/core`

**Two conditions, not one.** It must be an `EnumValue` *and* the enum it came from must be `@angular/core`'s. The guard:

```ts
export function isAngularCoreReferenceWithPotentialAliasing(
  reference: Reference,
  symbolName: string,
  isCore: boolean,
): boolean {
  return (
    (reference.ownedByModuleGuess === CORE_MODULE || isCore) &&
    reference.debugName?.replace(/\$\d+$/, '') === symbolName
  );
}
```

`debugName` is the identifier of the *declaration* node, not of your import:

```ts
get debugName(): string | null {
  const id = identifierOfNode(this.node);
  return id !== null ? id.text : null;
}
```

Three things follow, and they explain every confusing outcome in this field:

| You wrote | Outcome | Why |
|---|---|---|
| `encapsulation: ViewEncapsulation.None` | ✅ | `EnumValue`, owning module `@angular/core`, `debugName` matches |
| `import {ViewEncapsulation as VE}` then `encapsulation: VE.None` | ✅ | `debugName` is the declaration's name, not the local alias |
| `encapsulation: 2` | ⛔ `Value is of type 'number'.` | a number is not an `EnumValue`, even though `None === 2` |
| a local `enum ViewEncapsulation` in your own file | ⛔ `Value is of type 'ViewEncapsulation'.` | `ownedByModuleGuess` is not `@angular/core` |
| an enum re-exported from your own barrel | ⚠️ depends on what the reference's owning-module guess resolves to; if it is your barrel rather than `@angular/core`, it fails |

That fourth row is the one worth staring at, because `describeResolvedType` renders an `EnumValue` as `value.enumRef.debugName ?? '(anonymous)'` — so the message reads *"must be a member of ViewEncapsulation … Value is of type 'ViewEncapsulation'."* The two names are identical and the error still fires. It is not a compiler bug; it is telling you the *provenance* is wrong, and the message has no vocabulary for saying so.

The `replace(/\$\d+$/, '')` exists because a bundled or downlevelled `@angular/core` can rename the declaration to `ViewEncapsulation$1`. The guard strips a trailing `$` plus digits before comparing.

## Local compilation treats the two fields completely differently

`component/src/handler.ts` branches on `CompilationMode.LOCAL` for both fields, and the two branches are not symmetrical:

```ts
const encapsulation: number =
  (this.compilationMode !== CompilationMode.LOCAL
    ? resolveEnumValue(this.evaluator, component, 'encapsulation', 'ViewEncapsulation', this.isCore)
    : resolveEncapsulationEnumValueLocally(component.get('encapsulation'))) ??
  ViewEncapsulation.Emulated;
```

```ts
if (this.compilationMode !== CompilationMode.LOCAL) {
  changeDetection = resolveEnumValue(
    this.evaluator, component, 'changeDetection', 'ChangeDetectionStrategy', this.isCore,
  );
} else if (component.has('changeDetection')) {
  changeDetection = new o.WrappedNodeExpr(component.get('changeDetection')!);
}
```

**`changeDetection` in local mode is not evaluated at all** — the expression is wrapped and emitted verbatim, so anything you write there compiles. **`encapsulation` in local mode is matched as text**, and the function is startlingly literal:

```ts
const exprText = expr.getText().trim();

for (const key in ViewEncapsulation) {
  if (!Number.isNaN(Number(key))) {
    continue;
  }

  const suffix = `ViewEncapsulation.${key}`;

  // Check whether the enum is imported by name or used by import namespace (e.g.,
  // core.ViewEncapsulation.None)
  if (exprText === suffix || exprText.endsWith(`.${suffix}`)) {
```

🔴 **It returns `null` when nothing matches, and `null` is then coalesced to `ViewEncapsulation.Emulated`.** There is no error. So under `compilationMode: 'experimental-local'`, `encapsulation: VE.None` — a perfectly ordinary renamed import, which the full compiler accepts — is **silently compiled as `Emulated`**, and your `:host` styles start leaking with a green build. The same is true of `encapsulation: MY_ENCAPSULATION` for any constant. Local compilation generally is [10d](10d-import-cycles-and-local-compilation.md) and [13d](13d-compilation-mode-and-the-local-portability-trap.md); this is its sharpest silent-difference case.

The two forms the text matcher accepts are exactly `ViewEncapsulation.<Key>` and anything ending `.ViewEncapsulation.<Key>` — the second covers `core.ViewEncapsulation.None` from a namespace import. Write one of those two and the mode makes no difference.

## Gotchas

**★ Symptom: `encapsulation must be a member of ViewEncapsulation enum from @angular/core` followed by `Value is of type 'ViewEncapsulation'.`** Cause: you have a second `ViewEncapsulation` — a local enum, a test double, or one re-exported through a barrel whose owning-module guess is not `@angular/core`. The names match; the provenance does not, and `isAngularCoreReferenceWithPotentialAliasing` checks provenance first. Fix: import the enum from `@angular/core` directly at the point of use:

```ts
import {Component, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'app-card',
  encapsulation: ViewEncapsulation.None,
  template: '<h2>Card</h2>',
})
export class Card {}
```

**★ Symptom: `encapsulation: 0` is rejected even though `ViewEncapsulation.Emulated` is 0.** Cause: `resolveEnumValue` tests `value instanceof EnumValue` before it looks at any number. A numeric literal folds to `0`, which is not an `EnumValue`, so the guard fails and you get `Value is of type 'number'.` Fix: there is no numeric shortcut — name the member. The same applies to `changeDetection: 1`.

**★ Symptom: your app builds with `compilationMode: 'experimental-local'`, no error appears, and component styles leak globally.** Cause: `resolveEncapsulationEnumValueLocally` compares `expr.getText().trim()` against the literal text `ViewEncapsulation.<Key>`, returns `null` on no match, and the caller coalesces `null` to `ViewEncapsulation.Emulated`. A renamed import or a constant produces no diagnostic and the wrong encapsulation. Fix: write the canonical text form, which both modes accept:

```ts
import {Component, ViewEncapsulation} from '@angular/core';

// ✅ full-mode resolution and the local text matcher both accept exactly this shape.
@Component({
  selector: 'app-shell',
  encapsulation: ViewEncapsulation.None,
  template: '<router-outlet />',
})
export class Shell {}
```

**★ Symptom: an enum member you can see in the source behaves as `undefined` in metadata.** Cause: `visitEnumDeclaration` drops any member whose name did not fold to a string — `if (name !== undefined)` — with no diagnostic at the enum. A `Map` miss then returns `undefined` from `accessHelper`, so the error lands at your usage as `Value is of type 'undefined'.` Fix: never use a computed member name on an enum that reaches metadata:

```ts
// ⛔ a computed member name that is not a static string is dropped from the map entirely.
// const KEY = Symbol('mode');
// export enum Mode { [KEY as any]: 'x' }

// ✅ plain identifiers, every member initialised.
export enum Mode {
  Compact = 'compact',
  Wide = 'wide',
}
```

**Symptom: an enum member's value in metadata is not the value TypeScript reports for it.** Cause: the evaluator's fallback for an un-initialised member is the member's positional `index`, while TypeScript's is the previous member's value plus one; they diverge as soon as an initialised member precedes an un-initialised one. Fix: initialise every member explicitly, which makes the two rules agree by construction:

```ts
// ✅ no member relies on the fallback, so nothing can diverge.
export enum Priority {
  Low = 10,
  Medium = 11,
  High = 12,
}
```

**Symptom: `changeDetection: SOME_CONST` fails in your app's build and passes in a library's.** Cause: the library is being built with `compilationMode: 'experimental-local'` (or `'partial'` routing through it), where the `changeDetection` expression is wrapped as `WrappedNodeExpr` and never evaluated. Fix: do not treat a green local-mode build as evidence the metadata is analysable; the asymmetry between the two `changeDetection` branches is not visible from the outside.

## Interview questions

**★ Why is `encapsulation: 0` rejected when `ViewEncapsulation.Emulated` is 0?**
Because `resolveEnumValue` never compares numbers. Its guard is `value instanceof EnumValue && isAngularCoreReferenceWithPotentialAliasing(value.enumRef, 'ViewEncapsulation', isCore)` — the resolved value must be an *enum member object*, carrying a reference to the enum it came from, and that enum must be `@angular/core`'s. A numeric literal folds to the primitive `0`, which is not an `EnumValue`, so the guard fails before the number is ever looked at and you get `Value is of type 'number'.` The design reason is that the compiler wants to know you named a documented member, not that you happened to write a number that currently matches one; the numbers are an implementation detail that has already changed once — `ViewEncapsulation` has no `1` because `Native` was removed in v11.

**★ A local enum with the same name and the same members is rejected. What exactly is being checked, and why is a renamed import accepted?**
Provenance, in two parts. `reference.ownedByModuleGuess === CORE_MODULE` asks which module the reference is believed to come from, and `reference.debugName?.replace(/\$\d+$/, '') === symbolName` asks what the *declaration* is called. `debugName` reads the identifier of the declaration node, not of your import, so `import {ViewEncapsulation as VE}` still yields `debugName === 'ViewEncapsulation'` and passes. A local enum passes the name test and fails the module test. The confusing part is the diagnostic: `describeResolvedType` renders an `EnumValue` as its enum's `debugName`, so the message reads *"must be a member of ViewEncapsulation … Value is of type 'ViewEncapsulation'."* — two identical names and an error. That is the compiler saying the package is wrong with a message that can only talk about names.

**★ Under local compilation, `encapsulation: VE.None` compiles and your styles leak. Explain.**
Local compilation replaces `resolveEnumValue` with `resolveEncapsulationEnumValueLocally`, which does not evaluate anything — it takes `expr.getText().trim()` and compares it against the literal string `ViewEncapsulation.<Key>` for each key, also accepting anything that *ends with* `.ViewEncapsulation.<Key>` to cover a namespace import. `VE.None` matches neither, so the function returns `null`, and the call site coalesces `null` to `ViewEncapsulation.Emulated`. No diagnostic is produced at any point. It is the sharpest silent behavioural difference between the two compilation modes: the same source, the same Angular version, two different runtime style-scoping strategies, and a green build in both. The defence is to write the canonical `ViewEncapsulation.<Key>` text, which both paths accept.

**★ How does an enum become a value the evaluator can index, and what is the one place its arithmetic differs from TypeScript's?**
`visitEnumDeclaration` folds the declaration into a `Map` from member name to `EnumValue`, where each `EnumValue` carries a `Reference` to the enum declaration, the member's name, and its resolved value. Member access then goes through `accessHelper`'s `Map` branch, which is why both `E.Member` and `E['Member']` work. The arithmetic difference is the fallback for a member with no initialiser: the evaluator uses the member's positional index in `node.members`, while TypeScript uses the previous member's value plus one. They agree while every preceding member is un-initialised and diverge the moment one is not — `enum Mode { A = 10, B }` is `11` to TypeScript and `1` to the evaluator. It cannot bite on `ViewEncapsulation` or `ChangeDetectionStrategy` because both initialise every member, but it can on yours, and the fix is to initialise every member of any enum that reaches metadata.

← Prev: [Dynamic strings and computed keys](10gc-dynamic-strings-and-computed-keys.md) · Index: [Topic index](README.md) · Next → [Syntax the evaluator cannot read](10h-syntax-the-evaluator-cannot-read.md)
