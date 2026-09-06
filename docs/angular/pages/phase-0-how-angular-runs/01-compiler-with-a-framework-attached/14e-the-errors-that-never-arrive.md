---
title: "Four TypeScript codes are discarded because they are complaints about the generator rather than about you — and a much larger class of expected errors never exists at all, because for whole categories of binding the compiler generates no statement to be wrong"
sidebar_label: "14e · Errors that never arrive"
sidebar_position: 14.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/typecheck/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/diagnostics.ts),
> [`packages/compiler/src/typecheck/ops/inputs.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/inputs.ts),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"My template is wrong and the build is green" is the single most common confusion about Angular's
type checking, and it has three answers of wildly different frequency. This chunk covers the two that
matter. The famous one is a hand-written list of four TypeScript error codes that Angular discards,
because generated code provokes complaints that are true of the generator and false of you. The
important one is much bigger and much less discussed: for entire categories of binding the compiler
**never generates a statement at all**, so there is nothing for TypeScript to be wrong about. No
suppression is involved, no diagnostic is dropped — the check simply does not exist. Learning to tell
these apart, in the right order, is what turns a green build from a mystery into a fact you can
reason about.**

## The suppressions: four codes that are artefacts

Because the block is machine-written, TypeScript notices things that are true of the generator and
false of your template. Angular filters those by numeric code, in a function whose doc comment states
the rule and whose body is a flat chain:

```ts
/**
 * Determines if the diagnostic should be reported. Some diagnostics are produced because of the
 * way TCBs are generated; those diagnostics should not be reported as type check errors of the
 * template.
 */
export function shouldReportDiagnostic(diagnostic: ts.Diagnostic): boolean {
  const {code} = diagnostic;
  if (code === 6133 /* $var is declared but its value is never read. */) {
    return false;
  } else if (code === 6199 /* All variables are unused. */) {
    return false;
  } else if (code === 2695 /* Left side of comma operator is unused and has no side effects. */) {
    return false;
  } else if (code === 7006 /* Parameter '$event' implicitly has an 'any' type. */) {
    return false;
  }
  return true;
}
```

Each of the four has a specific generator behaviour behind it, and knowing which turns the list from
trivia into a diagnostic tool:

| Code | TypeScript's message | Why the block provokes it |
|---|---|---|
| **6133** | `$var is declared but its value is never read.` | A template variable — a `#ref`, a `@let`, an `@if (… as x)` alias — becomes a real `const` in the block. Declaring one and not reading it is legal Angular and an unused variable to `tsc`. |
| **6199** | `All variables are unused.` | The block-level form of the same thing: a generated scope in which nothing declared is read. Easy to produce with a `@placeholder` or an empty branch. |
| **2695** | `Left side of comma operator is unused and has no side effects.` | The generator uses comma expressions to put several checks in one statement position. The left operand exists to be *checked*, not to produce a value. |
| **7006** | `Parameter '$event' implicitly has an 'any' type.` | When the flag that would type `$event` is off, the generated handler parameter is genuinely untyped — configured behaviour, not a mistake. |

⚠️ **The filter is by code, not by origin.** It runs over the diagnostics from the type-checking
program, so it removes those four codes from *that pass*. If your own source has a genuinely unused
variable, that is a different pass and you still get `TS6133` for it. This is not a project-wide
suppression of unused-variable checking and it does not touch `noUnusedLocals` in your files.

🔴 **The debugging use.** If you ever see `TS6133` or `TS7006` reported *against a template*, the
suppression did not run, which means the diagnostic did not arrive through the template
type-checking path at all. That is a strong signal about where the problem really is — a
misconfigured or stale language service, or a diagnostic reaching you from the main program rather
than the type-checking one.

## The bigger cause: nothing was generated

This one accounts for most real cases and has a completely different fix. If the compiler never
generated a statement, there is nothing for TypeScript to complain about and nothing to route home.
No filter runs. No diagnostic is dropped. The check does not exist.

`ops/inputs.ts` documents exactly this for bindings that no directive claimed, verbatim:

```ts
/**
 * A `TcbOp` which generates code to check "unclaimed inputs" - bindings on an element which were
 * not attributed to any directive or component, and are instead processed against the HTML element
 * itself.
 *
 * Currently, only the expressions of these bindings are checked. The targets of the bindings are
 * checked against the DOM schema via a `TcbDomSchemaCheckerOp`.
 *
 * Executing this operation returns nothing.
 */
```

*"Only the expressions … are checked."* So on a plain `<input>`:

```html
<!-- `count` is type-checked. The assignment to HTMLInputElement.value is NOT. -->
<input [value]="count" />
```

`count` must exist and must type-check as an expression. Whether a `number` may be assigned to
`HTMLInputElement.value` is never asked, because no assignment statement is generated. The internal
flag that would change this, `checkTypeOfDomBindings`, is hard-coded `false` — with a comment in the
compiler's own source saying DOM binding checks *"are not quite ready yet"*, which is covered with
the rest of the unswitchable checks in **14h · The checks with no switch** *(not written yet)*.

The element and attribute *names* are still validated, but by a schema checker rather than by the
type system. That is the mechanism behind NG8001 and NG8002 — the two template errors people meet
first, and the reason they feel different from type errors: they are.

**Beyond DOM bindings, every strictness flag that is off is another instance of this.** A flag does
not filter diagnostics; it changes what text gets generated. `strictNullInputTypes: false` does not
suppress null errors — it wraps binding expressions in non-null assertions so the errors are never
produced. That distinction is the whole subject of **14f · What `strictTemplates` actually switches**
*(not written yet)*.

## The order to check in

When an expected error does not appear:

1. **Was a statement generated at all?** A flag that is off, or an unchecked category like DOM
   bindings. Overwhelmingly the most likely, and the only one with a configuration fix.
2. **Was the diagnostic suppressed by code?** Only possible for those four artefact codes.
3. **Was it dropped as untranslatable?** Rarest;
   [14d](14d-how-a-diagnostic-gets-home.md) covers it.

Working in that order saves you from hunting a suppression that never applied to a diagnostic that
was never produced.

## Gotchas

**★ Symptom: a template is visibly wrong — a misspelled property, an obviously wrong type — and the
build is green.** Cause: almost always case 1, nothing generated. Fix: identify what kind of binding
it is. On a plain DOM element, only the expression is checked and the assignment never is:

```html
<!-- green: `count` exists, so the expression checks; the assignment is not generated -->
<input [value]="count" />
```

```ts
// make the assignment real by putting it somewhere a statement IS generated — your class
export class SearchBox {
  count = 0;
  get countText(): string {
    return String(this.count); // now `tsc` checks it, in ordinary source
  }
}
```

**★ Symptom: `TS6133 'x' is declared but its value is never read` and the `x` is a `@let` or a
`#ref`.** Cause: the suppression list did not run on this diagnostic, so it did not come from the
template type-checking pass. Fix: check `noUnusedLocals` and `noUnusedParameters` against your own
source — you are looking at an ordinary TypeScript diagnostic about a real file. A
template-originated 6133 is impossible by construction:

```jsonc
// tsconfig.json — this is a diagnostic about YOUR files, not your templates
{
  "compilerOptions": {
    "noUnusedLocals": true
  }
}
```

**★ Symptom: `(blur)="update($event.target.value)"` errors with `TS2531: Object is possibly 'null'`
or `TS2339: Property 'value' does not exist on type 'EventTarget'`.** Cause: `$event` for a DOM
event is typed from `HTMLElementEventMap`, and `Event.target` is `EventTarget | null` in the DOM
typings because events bubble — the element you attached to is not necessarily the element that
fired. Angular's own source comment predicts these two exact codes for this exact template. Fix:
narrow it where you can see the type, in the class rather than the template:

```ts
// component
rename(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.name = input.value;
}
```

```html
<!-- template: hand the whole event over, do not reach into it -->
<input (blur)="rename($event)" />
```

**★ Symptom: `$event` is `any` in one handler and properly typed in another.** Cause: two different
flags cover two different kinds of event — one for directive outputs and animation events, one for
DOM events — and when the relevant one is off, the generated parameter is untyped and `TS7006` about
it is suppressed. Fix: this is configuration, not a bug in your handler; see
**14g · The event and reference flags** *(not written yet)*. Recognise the shape: an implicitly-`any`
`$event` is the one case where a suppressed diagnostic and a disabled check meet.

**★ Symptom: a linter complains about comma operators in something with `.ngtypecheck` in its path.**
Cause: the generator uses comma expressions to place several checks in one statement position — which
is exactly what TypeScript's 2695 is about, and exactly why Angular suppresses 2695. Fix: nothing to
fix in the code; exclude `.ngtypecheck` paths from the tool. The file is not source and no style rule
applies to it.

**★ Symptom: two components with identical templates produce different numbers of errors.** Cause:
one is generic and the other is not. The component's own type parameters are copied onto the
generated function only when `useContextGenericType` is on; with it off they become `any` in the
context type, and whole families of errors stop being expressible. Fix: this is
`strictContextGenerics`, in **14g · The event and reference flags** *(not written yet)*. The point
here is that the *shape of the generated function* differs — case 1 again, at the level of the
function signature rather than a single statement.

**Symptom: adding `strictTemplates` produced a flood of errors in templates nobody changed.** Cause:
not new bugs — newly generated statements. The flag changes what text is produced, so code that was
never checked is now checked for the first time. Fix: treat the flood as a backlog rather than a
regression, and fix it by category. The categories are exactly the flags.

**Symptom: `NG8001`/`NG8002` feel unlike every other template error.** Cause: they are, and this page
explains why — element and attribute names are validated by a schema checker, not by the generated
TypeScript. They come from a different mechanism entirely, which is why they survive settings that
disable type checks. Fix: nothing, but stop expecting a strictness flag to affect them.

## Interview questions

**★ Why does Angular throw away four specific TypeScript error codes during template checking, and
what are they?**
Because the block is machine-written, so those four are complaints about the generator rather than
about the template. 6133 (`declared but its value is never read`) and 6199 (`all variables are
unused`) fire because template variables, `#ref`s and `@let`s become real `const`s a template need
not read. 2695 (`left side of comma operator is unused`) fires because the generator puts several
checks in one statement position with comma expressions, where the left operand exists to be checked
rather than to produce a value. 7006 (`parameter '$event' implicitly has an 'any' type`) fires when
the flag that would type `$event` is off, which is configured behaviour. The filter is
`shouldReportDiagnostic` and it matches on the numeric code, not on origin.

**★ Your template has an obvious type error and the build passes. Walk me through the possibilities
in order of likelihood.**
First and by a wide margin: no statement was generated. Whole categories are unchecked by design — a
binding no directive claimed has only its *expression* checked, never the assignment, because
`checkTypeOfDomBindings` is hard-coded `false`; and every strictness flag that is off changes what
text gets produced rather than filtering what gets reported. Second: the diagnostic was produced and
suppressed, which only applies to those four artefact codes. Third and rarest: it was produced, not
suppressed, and dropped because its position could not be mapped back to the template.

**★ What is the difference between a strictness flag being off and a diagnostic being suppressed?**
A suppressed diagnostic was produced by TypeScript and then discarded by Angular on the way out — it
happens for exactly four codes and nothing else. A flag being off means the statement that would have
produced the diagnostic was never generated, so TypeScript never had an opinion. The distinction
matters because only the second has a configuration fix, and because it explains why turning
`strictTemplates` on produces errors in code nobody touched: you are not un-suppressing anything, you
are generating checks that did not previously exist.

**You see `TS6133` reported against a template variable. What does that tell you?**
That the diagnostic did not come through the template type-checking path, because that path
suppresses 6133 unconditionally. So the interesting information is not the error — it is that
something is routing diagnostics you did not expect: a misconfigured or stale language service, or a
diagnostic from the main program surfacing where you assumed the type-checking program was speaking.

**Why do `NG8001` and `NG8002` behave differently from other template errors?**
Because they do not come from the generated TypeScript at all. Element and attribute names are
validated against the DOM schema by a separate schema checker, which is why the compiler's own doc
comment says of unclaimed inputs that *only the expressions* are checked while *the targets* go to
the schema checker. That is also why they are the first errors most people meet: name validation
applies broadly, while the type checks around it are gated behind flags.

**Is `[value]="someNumber"` on a plain `<input>` an error?**
No, and it is the cleanest demonstration of the "nothing was generated" case. `someNumber` is
type-checked as an expression, but no assignment against `HTMLInputElement.value` is generated, so
the type mismatch is never expressible. The flag that would change it, `checkTypeOfDomBindings`, is
hard-coded `false` with a source comment saying such checks are not ready. If you need that
guarantee, get it in the class rather than the template.

---

← Prev: [14d · How a diagnostic gets home](14d-how-a-diagnostic-gets-home.md) · Index: [Topic index](README.md) · Next → **14f · What `strictTemplates` actually switches** *(not written yet)*
