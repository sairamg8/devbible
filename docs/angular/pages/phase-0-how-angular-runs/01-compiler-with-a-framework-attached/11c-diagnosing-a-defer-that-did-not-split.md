---
title: "There is no build error for a `@defer` block that did not defer, so diagnosis is a procedure — rule out HMR first, then turn the compiler's silence into a diagnostic by moving the dependency to `deferredImports`, and only then go looking at the bundler"
sidebar_label: "11c · Diagnosing a `@defer` that did not split"
sidebar_position: 11.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer) — and `angular/angular` at tag `v22.1.5`: [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts), [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts), [`packages/compiler-cli/src/ngtsc/imports/src/deferred_symbol_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/imports/src/deferred_symbol_tracker.ts), [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts), [`packages/core/src/defer/instructions.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/defer/instructions.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[11b](11b-the-nine-conditions-and-the-barrel-trap.md) listed nine ways a dependency fails to
qualify for deferral. None of them produces output, which leaves you inspecting a bundle to
answer a question the compiler already knows the answer to. There is a better order of
operations, and it starts by ruling out the single most common false alarm — a `@defer` block
that "loads immediately" in `ng serve` is usually HMR, not a mistake — and then makes the
compiler tell you, by moving the dependency into `@Component.deferredImports`, where the same
failure that is silent under `imports` becomes error NG8014.**

## Step 1 — rule out HMR, because it turns the feature off entirely

`handler.ts` at `v22.1.5`, verbatim:

```ts
// Dependencies can't be deferred during HMR, because the HMR update module can't have
// … are deferred, their imports will be deleted so we may lose the reference to them.
this.canDeferDeps = !enableHmr;
```

One assignment disables deferral for the whole compilation. The runtime says so out loud too —
`packages/core/src/defer/instructions.ts` carries a dev-mode warning, verbatim:

```ts
RuntimeErrorCode.DEFER_IN_HMR_MODE,
'Angular has detected that this application contains `@defer` blocks ' +
  'and the hot module replacement (HMR) mode is enabled. All `@defer` ' +
  'block dependencies will be loaded eagerly.',
```

and the guide states the workaround:

> *"When Hot Module Replacement (HMR) is active, all `@defer` block chunks are fetched eagerly,
> overriding any configured triggers. To restore the standard trigger behavior, you must disable
> HMR by serving your application with the `--no-hmr` flag."*

🔴 **This is the number-one false alarm.** Never diagnose a deferral problem from an `ng serve`
session with HMR on:

```bash
ng serve --no-hmr
```

## Step 2 — make the compiler talk, with `deferredImports`

`@Component.deferredImports` is the explicit form of the same feature. Its behaviour when the
import cannot be removed is the opposite of `imports`: it produces a diagnostic.
`handler.ts`, verbatim:

```ts
const diagnostic = makeDiagnostic(
  ErrorCode.DEFERRED_DEPENDENCY_IMPORTED_EAGERLY,
  importDecl,
  `This import contains symbols that are used both inside and outside of the ` +
    `\`@Component.deferredImports\` fields in the file. This renders all these ` +
    `defer imports useless as this import remains and its module is eagerly loaded. ` +
    `To fix this, make sure that all symbols from the import are *only* used within ` +
    `\`@Component.deferredImports\` arrays and there are no other references to those ` +
    `symbols present in this file.`,
);
```

🔴 **That message is `canDefer` speaking out loud.** It is the ninth condition from
[11b](11b-the-nine-conditions-and-the-barrel-trap.md), reported as an error instead of swallowed.
So the diagnostic procedure is: move the suspect dependency from `imports` to `deferredImports`,
rebuild, and read what the compiler says.

```ts
import {Component} from '@angular/core';
import {HeavyChart} from './heavy-chart';

@Component({
  selector: 'app-dashboard',
  // Temporarily, to diagnose: the same failure that is silent under `imports`
  // is reported here as NG8014.
  deferredImports: [HeavyChart],
  template: `@defer (on viewport) { <heavy-chart /> }`,
})
export class Dashboard {}
```

The companion codes, from `error_code.ts` doc comments, verbatim:

- **NG8012** `DEFERRED_PIPE_USED_EAGERLY` — *"A pipe imported via `@Component.deferredImports` is
  used outside of a `@defer` block in a template."*
- **NG8013** `DEFERRED_DIRECTIVE_USED_EAGERLY` — *"A directive/component imported via
  `@Component.deferredImports` is used outside of a `@defer` block in a template."*
- **NG8014** `DEFERRED_DEPENDENCY_IMPORTED_EAGERLY` — *"A directive/component/pipe imported via
  `@Component.deferredImports` is also included into the `@Component.imports` list."*

There is also a project-wide switch that makes `deferredImports` the *only* source of deferral.
`public_options.ts`, verbatim:

> *"Specifies whether Angular compiler should rely on explicit imports via
> `@Component.deferredImports` field for `@defer` blocks and generate dynamic imports only for
> types from that list. This flag is needed to enable stricter behavior internally to make sure
> that local compilation with specific internal configuration can support `@defer` blocks."*

⚠️ Read that description before reaching for `onlyExplicitDeferDependencyImports`: it is
described as existing for internal local-compilation configurations, not as a general strictness
knob. Turning it on makes every `@defer` dependency you did *not* list in `deferredImports` stop
being deferred.

## Step 3 — only now, look at the bundler

If HMR is off and `deferredImports` reports nothing, the compiler did emit the dynamic import and
the failure is downstream. That is the barrel case the guide describes:

> *"If you're using `@defer` but not seeing a separate lazy chunk in your build output, check how
> you're importing the deferred component. Importing through a barrel file (`index.ts`) is a common
> culprit — bundlers see the barrel as a single module and keep all its exports together, so your
> component ends up in the main bundle regardless of `@defer`."*

> *"The fix is straightforward — import directly from the component's own file… That's enough for
> the bundler to split it into its own chunk and load it lazily when the trigger fires."*

Read the chunk *graph*, not the chunk list:

```bash
ng build --configuration production --stats-json
npx esbuild-visualizer --metadata dist/stats.json --open
```

## Two subtleties that decide whether a reference counts as eager

`deferred_symbol_tracker.ts` records references per symbol, and two comments in it change what
"referenced in this file" means.

A whole type-only import can never hold an eager reference:

```ts
// If the entire import is a type-only import, none of the symbols can be eager.
if (importDecl.importClause.phaseModifier === ts.SyntaxKind.TypeKeyword) {
  return symbolMap;
}
```

And, in `lookupIdentifiersInSourceFile`, the distinction between the two heritage clauses:

```ts
// Don't record references from the declaration itself or inside
// type nodes which will be stripped from the JS output.
// Note that `ts.isTypeNode` returns `true` for `ExpressionWithTypeArguments`,
// which is used for both `extends` and `implements` heritage clauses. An `extends`
// clause on a class is a value expression that survives in the emitted JavaScript,
// so references within it must be recorded.
```

**`implements Foo` does not block deferral; `extends Foo` does.** One is erased from the emitted
JavaScript and one is not, and the tracker records exactly the references that survive emit.

## Gotchas

**★ Symptom: `@defer` blocks load immediately in `ng serve`, whatever trigger you configure, and
behave correctly in a production build.** Cause: HMR. `handler.ts` sets
`this.canDeferDeps = !enableHmr`, so nothing is deferred at compile time, and the runtime prints a
dev-mode warning saying *"All `@defer` block dependencies will be loaded eagerly."* Fix: serve with
`ng serve --no-hmr` before drawing any conclusion about a trigger or a chunk.

**★ Symptom: a `@defer` block in a component that imports from a barrel produces no chunk, and
importing directly from the component's file fixes it — but the same fix does nothing in a
different component.** Cause: two different failures with one symptom. The barrel case the guide
documents is the *bundler* treating the barrel module as one unit; `canDefer` is the *compiler*
refusing to remove an import declaration that still has eager references. Fix: when the direct
import does not help, stop looking at the bundler and walk conditions 1–8 in
[11b](11b-the-nine-conditions-and-the-barrel-trap.md) — most often the class turns out to be named
in a `viewChild`, used once outside the block, or reached through a spread `imports` array.

**★ Symptom: a dependency that is only ever used inside `@defer` blocks still appears in the main
bundle, and moving it to its own file did not help.** Cause: it is not a component, directive or
pipe — `registerDeferrableCandidate`'s final bail-out, *"This is not a directive or a pipe."* The
resolver function is built from *template* dependencies; a service, a token, a type guard or a
plain function imported by the component class is a normal TypeScript import and `@defer` has no
opinion about it. Fix: for a service, let the injector do the splitting — `inject()` inside the
deferred component rather than the host, so the service's module is reachable only through the
deferred chunk.

**★ Symptom: a base class shared with a deferred component un-defers it, and an interface with the
same name does not.** Cause: `extends` survives into the emitted JavaScript and `implements` does
not, and the tracker's own comment says it records references *"within it"* for `extends`
precisely because it *"is a value expression that survives in the emitted JavaScript."* Fix: make
the shared contract an interface, or a `type`, or move the base class into the deferred file:

```ts
// blocks deferral of the import declaration `Base` came from
export class HeavyChart extends Base {}

// does not — erased before emit
export class HeavyChart implements Chartable {}
```

**Symptom: you wrap a deferred dependency in `forwardRef` to break a cycle and assume you have
just lost the chunk.** Cause: the assumption. `tryUnwrapForwardRef` runs *before* the identifier
check in `registerDeferrableCandidate`, so `forwardRef(() => HeavyChart)` still resolves to the
identifier and stays deferrable. Fix: nothing — but note that `forwardRef` is the *only* wrapper
with that treatment; any other call expression in the `imports` array trips condition 1.

**Symptom: you rename an import (`import {HeavyChart as Chart}`) and expect the resolver to break.**
Cause: the assumption again. The tracker stores the full `Import` record, and the comment says why
— *"Store the full `Import` info so that callers can correctly determine the exported name
(handling aliasing) and the module specifier."* The emitted callback uses the **exported** name,
not your local alias. Fix: none.

**Symptom: you import a deferred component with `import type` for a signature and it is still
deferred, contrary to the "referenced outside the block" rule.** Cause: the type-only check —
*"If the entire import is a type-only import, none of the symbols can be eager."* A type reference
is erased before emit and cannot keep a module alive. Fix: none needed; but note the check is on
the **entire** import clause, so a mixed `import {type A, B}` is not covered by it.

**Symptom: two `@defer` blocks in the same component both load the same dependency and you expect
two network requests.** Cause: expecting the resolver to own the fetch. It does not — it returns
`import(...)`, and the module registry deduplicates; a second `import()` of an already-resolved
specifier yields the same module. Fix: none needed. This also means splitting one big block into
two smaller ones with different triggers does not multiply the download cost of shared
dependencies.

**Symptom: `@defer` is used inside a component that is itself lazy-loaded by the router, and you
cannot tell which chunk anything landed in.** Cause: two independent splitting mechanisms are
stacked. The route boundary produces one chunk; the `@defer` resolver produces another *inside*
it. Fix: nothing is wrong — but read the chunk graph rather than the chunk list, because the
deferred chunk's parent is the route chunk, not the entry point.

## Interview questions

**★ Two people report "`@defer` isn't producing a chunk". One is on `ng serve`; one imports through
a barrel file. Diagnose both.**
The first is almost certainly HMR: `handler.ts` sets `this.canDeferDeps = !enableHmr`, so with HMR
on nothing is deferred at compile time at all, and the runtime prints a dev-mode warning saying so.
`ng serve --no-hmr` settles it in one command. The barrel case has two possible causes that look
identical: either `canDefer` returned `false` because another symbol from the same import
declaration is used eagerly — a compiler-side refusal to emit the dynamic import — or the compiler
emitted it correctly and the bundler kept the barrel module whole. Importing directly from the
component's file fixes both, which is why the guide can give one fix for a failure it describes
only in bundler terms.

**★ What is the difference in observable behaviour between `imports` and `deferredImports` when a
dependency cannot be deferred?**
Silence versus a build error. Under `imports`, `compileDeferResolverFunction` takes its `else`
branch, emits the class reference into the resolver array, and the build succeeds with no output at
all. Under `deferredImports`, the same situation produces NG8014 with a message that names the
import declaration and tells you the whole module is eagerly loaded. That asymmetry is a usable
tool: when you suspect a block is not splitting, move the dependency to `deferredImports` to turn
the silence into a diagnostic, then move it back.

**★ Why does `implements` not block deferral while `extends` does?**
Because the tracker records only references that survive emit. `implements` is erased by TypeScript
and leaves nothing in the JavaScript that could keep the module alive, so it is not an eager
reference. `extends` is a value expression — the emitted class really does reference the base class
at runtime — so it is recorded, and one such reference is enough for `canDefer` to refuse to remove
the whole import declaration. The source comment calls this out specifically because
`ts.isTypeNode` returns `true` for both clauses and the naive check would have got it wrong.

**You are told to turn on `onlyExplicitDeferDependencyImports` "for stricter deferral". What do you
say?**
That the option's own documentation does not describe it as a general strictness knob — it says the
flag *"is needed to enable stricter behavior internally to make sure that local compilation with
specific internal configuration can support `@defer` blocks."* Turning it on means the compiler
generates dynamic imports **only** for types listed in `@Component.deferredImports`, so every
`@defer` dependency declared the ordinary way in `imports` silently stops being deferred. That is a
larger behaviour change than "stricter", and it should be adopted deliberately with the whole
codebase moved to `deferredImports`, not as a lint-like default.

**Why is a bundle inspection the last step of this procedure rather than the first?**
Because it is the only step that cannot tell you *why*. A chunk graph shows you that `HeavyChart`
is in the main bundle; it cannot distinguish "HMR disabled deferral", "another symbol in the same
import statement is used eagerly", "the class is not standalone" and "the bundler kept the barrel
whole" — four causes with four different fixes. Ruling out HMR is one flag, and `deferredImports`
converts the compiler's silence into a diagnostic that names the import declaration. Both are
cheaper and more specific than reading a stats file.

---

← Prev: [11b · The nine conditions and the barrel trap](11b-the-nine-conditions-and-the-barrel-trap.md) · Index: [Topic index](README.md) · Next → [11d · What `@defer` never defers](11d-what-defer-never-defers.md)
