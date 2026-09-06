---
title: "The most concrete demonstration of locality in Angular's codebase is that the template language itself is decided per program by the resolved `@angular/core` version — five feature gates in `NgCompiler` ask what version of Angular this file's package actually resolved to, so whether `@let` parses is not a property of the compiler you are running"
sidebar_label: "12g · Version skew is a coded concern"
sidebar_position: 12.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts) — the `implicitStandaloneValue` gate and the signals comment quoted verbatim, and the five version-gated fields read from `NgCompiler` and `getTypeCheckingConfig`.
> Documentation-validated; **no sandbox run**. The gate table below was produced by counting the version-gated fields in the source, not by running a build.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Locality is usually explained with libraries and rebuilds. The sharpest evidence for it is
somewhere else entirely: inside `NgCompiler`, five configuration fields are decided by asking what
version of `@angular/core` *this program actually resolved to* — not what version the compiler
itself is. Whether `@if` and `@for` parse, whether `@let` parses, whether a component is standalone
without saying so, whether a signal may sit in a two-way binding, and whether a DOM event assertion
is allowed are all conditional on a version number read out of the resolved dependency. A package
pinned to Angular 18 inside a monorepo running the v22 compiler is compiled *as an Angular 18
package*. That is locality applied to the language itself, and it is the thing that turns "which
Angular version is this file on?" from a packaging question into a debugging question.**

## The gate, verbatim

`packages/compiler-cli/src/ngtsc/core/src/compiler.ts` at `v22.1.5`:

```ts
    // Standalone by default is enabled since v19. We need to toggle it here,
    // because the language service extension may be running with the latest
    // version of the compiler against an older version of Angular.
    this.implicitStandaloneValue =
      this.angularCoreVersion === null ||
      coreVersionSupportsFeature(this.angularCoreVersion, '>= 19.0.0');
```

Two facts sit in those five lines.

1. **`this.angularCoreVersion`** — the compiler holds the resolved core version as state and
   consults it. It is not comparing against its own version, and it is not reading a tsconfig flag.
2. **The comment names the scenario out loud**: *"the language service extension may be running with
   the latest version of the compiler against an older version of Angular."* Version skew is not an
   accident the code tolerates; it is a case it was written for.

Note also the `=== null` branch: when no core version can be determined, the newer behaviour is
assumed.

## The five gates

Read from `NgCompiler` and `getTypeCheckingConfig` at `v22.1.5`. Counted from the source, there are
five:

| Field | Gate | What it decides |
|---|---|---|
| `enableBlockSyntax` | `>= 17.0.0` | whether `@if`, `@for` and `@switch` are *parsed as syntax* rather than treated as text |
| `enableLetSyntax` | `>= 18.1.0` | whether `@let` is a block the parser knows ([03](03-declarations-and-the-let-block.md)) |
| `allowSignalsInTwoWayBindings` | `>= 17.2.0-0` | whether the type-checker unwraps a writable signal in a two-way binding |
| `implicitStandaloneValue` | `>= 19.0.0` | whether a component with no `standalone` field is standalone |
| `allowDomEventAssertion` | `>= 20.2.0` | whether a DOM event assertion is permitted in template type-checking |

The comment attached to the signals gate is worth having in full, verbatim:

> *"Check whether the loaded version of `@angular/core` in the `ts.Program` supports unwrapping
> writable signals for type-checking. Only Angular versions greater than 17.2 have the necessary
> symbols to type check signals in two-way bindings. We also allow version 0.0.0 in case somebody is
> using Angular at head."*

🔴 **"the loaded version of `@angular/core` in the `ts.Program`".** The compiler is asking about the
program it was handed, which is per compilation unit. Two packages in one repository, each with
their own resolved `@angular/core`, get two different answers — from the same compiler binary, in
the same build.

## Why the compiler asks instead of assuming

Two reasons, and both are locality.

**The generated code has to run against the runtime that is actually there.** Compiled output calls
instructions that ship in `@angular/core`; if the resolved core predates a feature, its instructions
do not exist. `enableBlockSyntax` is the clearest case — emitting `ɵɵconditional` into a program
whose `@angular/core` has never heard of it produces code that cannot execute. The compiler is not
being polite about old versions, it is refusing to emit calls to functions that are not there.

**Type-checking needs symbols that may not exist.** The signals comment says it directly: *"Only
Angular versions greater than 17.2 have the necessary symbols to type check signals in two-way
bindings."* The type-check block is generated TypeScript ([06d](06d-the-factory-and-the-d-ts-declaration.md)
for the declaration side; chunk **14 · Template type checking** *(not written yet)* for the block
itself), and generated TypeScript can only reference types the resolved packages export.

The mechanism this is possible *through* is exactly the one in
[12](12-ivy-and-locality.md): because a class compiles from its own file and its declared
dependencies, "which Angular is this compilation on?" is a well-formed, per-program question. A
whole-program compiler that had flattened everything together would have had one answer for the
whole build.

Where and how `ngtsc` itself executes — the transformer, `ngc`, and the hard TypeScript peer range
that is a *different* version-coupling problem — belongs to chunk
**13 · Where the compiler runs: `ngtsc`** *(not written yet)*.

## Gotchas

**★ Symptom: `@let` — or `@if` — is a syntax error in one package of a monorepo and works perfectly in another, with one compiler and one CLI.** Cause: `enableLetSyntax` is gated on the resolved `@angular/core` being `>= 18.1.0` and `enableBlockSyntax` on `>= 17.0.0`, per *program*. The failing package resolves an older core, so for that compilation the block genuinely is not part of the language. Fix: find out what it resolved to before changing any code — the answer is usually a nested duplicate rather than a declared pin:

```bash
# Every copy of @angular/core in the tree, and who asked for it.
npm ls @angular/core --all

# The version a specific package actually resolves at runtime.
node -p "require('./packages/order-widgets/node_modules/@angular/core/package.json').version"
```

**★ Symptom: a component with no `standalone` field behaves as though `standalone: false` in one package, and standalone in the rest of the repo.** Cause: `implicitStandaloneValue` is `coreVersionSupportsFeature(this.angularCoreVersion, '>= 19.0.0')`. A package resolving Angular 18 gets the pre-19 default, from the same compiler that gives every other package the v19+ default. Fix: while any package is pinned below 19, say it explicitly rather than relying on a default that varies across your own repository:

```ts
// packages/legacy-reports/src/report-card.ts
import {Component} from '@angular/core';

@Component({
  selector: 'lib-report-card',
  // Explicit because this package's resolved @angular/core decides the default,
  // and it is not the same version the rest of the workspace resolves.
  standalone: true,
  template: `<ng-content />`,
})
export class ReportCard {}
```

**★ Symptom: your editor reports template errors the CLI build does not, or accepts syntax the build rejects.** Cause: the comment in `compiler.ts` describes this exact case — *"the language service extension may be running with the latest version of the compiler against an older version of Angular"*. The editor extension may bundle its own compiler; the build uses the workspace's. Fix: force the editor onto the workspace's TypeScript and Angular so both sides read the same resolved versions:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

**Symptom: a two-way binding on a signal — `[(value)]="count"` — type-checks in the application and errors in one library.** Cause: `allowSignalsInTwoWayBindings` is gated on `>= 17.2.0-0`, and the check is about whether the *resolved* `@angular/core` exports *"the necessary symbols to type check signals in two-way bindings"*. Fix: raise that package's `@angular/core` rather than working around the diagnostic, and dedupe if a transitive dependency pinned it:

```json
{
  "overrides": {
    "@angular/core": "22.1.5"
  }
}
```

**Symptom: everything compiles, but a package's behaviour matches an Angular version nobody in the team remembers choosing.** Cause: `angularCoreVersion` can be `null` — when no version is determinable the newest behaviour is assumed (`this.angularCoreVersion === null || …`), so a broken or missing resolution does not fail loudly, it silently picks modern semantics. Fix: make the resolution explicit and assert it in CI rather than trusting the fallback:

```bash
# Fails the pipeline if any package resolves an @angular/core other than the pinned one.
npm ls @angular/core --all --json \
  | grep -o '"version": "[0-9][^"]*"' \
  | sort -u
```

## Interview questions

**★ A monorepo has one package pinned to Angular 18 and another on 22. Which compiler runs, and what decides whether `@let` is legal in the v18 package's templates?**
One compiler runs — whichever `@angular/compiler-cli` the build invokes, so in practice the newest
one in the workspace. What decides the language is *not* that compiler's version but the resolved
`@angular/core` of the program being compiled: `enableLetSyntax` is gated on `>= 18.1.0`, read from
`this.angularCoreVersion`, which the compiler takes from *"the loaded version of `@angular/core` in
the `ts.Program`"*. So the v18 package is compiled as an Angular 18 package — `@let` is not part of
its language, `@if` and `@for` are (gated at 17.0.0), and its components are not standalone by
default (gated at 19.0.0). The same binary produces two different languages in the same build, on
purpose.

**★ Why does the compiler read the resolved `@angular/core` version rather than simply using its own?**
Because the code it generates has to run against the runtime that is actually installed, and the
types it generates for type-checking have to reference symbols that actually exist. Emitting
`ɵɵconditional` into a program whose `@angular/core` predates block syntax produces a call to a
function that is not there; generating a type-check block that unwraps a writable signal requires
symbols the comment says *"only Angular versions greater than 17.2 have"*. Using its own version
would mean the compiler assuming a runtime it has no evidence for. This is the locality principle
applied one level up: just as a class is compiled from what its own file declares, a program is
compiled against what that program actually resolved.

**The comment in `compiler.ts` names the language service explicitly. What does that tell you about the design?**
That skew between the compiler and the framework is a supported, designed-for state rather than a
misconfiguration. The comment reads *"the language service extension may be running with the latest
version of the compiler against an older version of Angular"* — an editor plugin ships its own
compiler and points it at whatever the user's project resolved, so the mismatch is the normal case,
not the exception. The practical consequence is that "my editor and my build disagree" has a
specific, checkable cause: two compilers reading two version answers. It also tells you the feature
gates are not legacy cruft to be removed at the next major; they are the mechanism that makes the
editor usable at all.

**Is a template language that varies with a version number a bug or a feature?**
It is the price of a genuinely honest compiler, and it is a feature in the same way that a peer
dependency range is. The alternative designs are worse: assume the newest runtime and emit calls
that do not exist, or refuse to compile anything whose Angular version is not the compiler's own,
which would make incremental upgrades of a large monorepo impossible. What makes the variation
tolerable is that it is *declared* — the gate is a version comparison against a resolved package,
visible in the dependency tree, and reproducible. What makes it dangerous is the fallback: when the
version cannot be determined at all, the newest behaviour is assumed, so a broken resolution
degrades silently rather than loudly.

---

← Prev: [12f · Partial compilation and the linker](12f-partial-compilation-and-the-linker.md) · Index: [Topic index](README.md) · Next → **12h · What locality bought the ecosystem** *(not written yet)*
