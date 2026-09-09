---
title: "The default `test` target of a new v22 application names a builder whose own manifest labels it `[EXPERIMENTAL]` — and the option the migration guide tells you to set for Karma does not exist on the builder it implies"
sidebar_label: "12 · The test builders"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/build/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/builders.json),
> [`packages/angular/build/src/builders/unit-test/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/unit-test/schema.json),
> both karma schemas, and `addAppToWorkspaceFile()` in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> all at tag `v22.1.7`, plus the `22.0.0` breaking-changes section of
> [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md).
> ⚠️ **No angular.dev page stating `unit-test`'s stability level was found**; this page reports the
> manifest label and the schematic default and does not infer intent from them.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two verifiable facts sit in tension, and a reader choosing a test strategy needs both.** The
application schematic writes `@angular/build:unit-test` as the `test` target of every new
application, with Vitest as the runner. That same builder's entry in `builders.json` describes
itself as `[EXPERIMENTAL]`. Neither fact is hidden, both are one file away, and no documentation
page reconciles them — so this page states them side by side rather than deciding which one is the
real signal.

## What `ng new` writes

```ts
test:
  options.skipTests || options.minimal
    ? undefined
    : {
        builder: Builders.BuildUnitTest,   // '@angular/build:unit-test'
        options:
          options.testRunner === TestRunner.Vitest ? {} : { runner: 'karma' },
      },
```

`testRunner` defaults to `"vitest"` in the application schema, and the Vitest branch writes **empty
options** — because `runner` already defaults to `vitest` on the builder. Choosing Karma is what
produces a visible option:

```json
{
  "targets": {
    "test": {
      "builder": "@angular/build:unit-test",
      "options": { "runner": "karma" }
    }
  }
}
```

So an absent `runner` key means Vitest. A generated `test` target with no options at all is not
under-configured; it is the default path.

## The `[EXPERIMENTAL]` label

```json
"unit-test": {
  "implementation": "./src/builders/unit-test",
  "schema": "./src/builders/unit-test/schema.json",
  "description": "[EXPERIMENTAL] Run application unit tests."
}
```

🔴 **The default `test` target of a new v22 application is a builder whose own manifest labels it
experimental.** Both halves are checkable in two files, and the honest position is to report them
without resolving the tension: **the documentation does not state a stability level for this
builder.** What can be said is what the label conventionally implies for options and behaviour —
that they may change without the usual guarantees — and that Angular nonetheless ships it as the
generated default, which is a stronger signal of intent than a label alone.

For a team deciding, the useful framing is not "is it safe" but "what does churn cost you here". A
test target's options change rarely and a broken one fails loudly and locally, which is a much
cheaper class of breakage than a build option changing under a deployment.

## `runner`, and what is actually installed

```json
"runner": {
  "type": "string",
  "description": "Specifies the test runner to use for test execution.",
  "default": "vitest",
  "enum": ["karma", "vitest"]
}
```

The builder's full option surface at 22.1.7, names only — how to *write* tests belongs to a later
phase: `buildTarget`, `tsConfig`, `runner`, `runnerConfig`, `browsers`, `browserViewport`,
`include`, `exclude`, `filter`, `watch`, `headless`, `debug`, `ui`, `isolate`, `splitting`, `quiet`,
`coverage`, `coverageInclude`, `coverageExclude`, `coverageReporters`, `coverageThresholds`,
`coverageWatermarks`, `reporters`, `outputFile`, `providersFile`, `setupFiles`, `progress`,
`listTests`, `dumpVirtualFiles`.

🔴 **Both runners are optional peers of `@angular/build`** — `vitest: "^4.0.8"` and
`karma: "^6.4.0"` — so neither is installed by depending on the build system. The schematic adds
whichever the `testRunner` option selected, via `addTestRunnerDependencies` in the application
schematic. That is the mechanism behind the most common failure on this page: a `test` target copied
between projects arrives without its runner.

## `builderMode` does not exist where the guide implies it does

The migration guide says:

> *"IMPORTANT: The new features of the `application` builder described here are incompatible with
> the `karma` test builder by default because it is using the `browser` builder internally. Users
> can opt-in to use the `application` builder by setting the `builderMode` option to `application`
> for the `karma` builder. This option is currently in developer preview."*

Reading both karma schemas at `v22.1.7`:

- `packages/angular/build/src/builders/karma/schema.json` — **no `builderMode` property.**
- `packages/angular_devkit/build_angular/src/builders/karma/schema.json`:

```json
"builderMode": {
  "type": "string",
  "description": "Determines how to build the code under test. If set to 'detect', attempts to follow the development builder.",
  "enum": ["detect", "browser", "application"],
  "default": "browser"
}
```

🔴 **So `builderMode` exists only on the deprecated `@angular-devkit/build-angular:karma` builder.**
A project on `@angular/build` cannot set it, and following that paragraph produces an unknown-option
error rather than the opt-in it describes. This is a documentation-versus-schema gap of the same
family as `deployUrl` in [08b · The option renames](08b-the-option-renames.md), and it is recorded
here rather than reconciled.

## Removed in v22.0.0

> *"The experimental `@angular-devkit/build-angular:jest` and
> `@angular-devkit/build-angular:web-test-runner` builders have been removed."*

Both were experimental and both are gone — which is the clearest available data point about what the
`[EXPERIMENTAL]` label has historically meant in this codebase: not "will be removed", but "may be",
and with a major release as the boundary.

## Gotchas

**★ Symptom: `ng test` fails with a missing-module error for `vitest` after copying a `test` target
between projects.** Cause: the runner is an *optional peer* of `@angular/build`; the schematic
installs it when it generates the target, and a copy-paste does not. Fix: install the runner
explicitly:

```bash
npm install --save-dev vitest@^4.0.8
```

**★ Symptom: `builderMode` is rejected as an unknown option, though the migration guide tells you to
set it.** Cause: the option exists only on `@angular-devkit/build-angular:karma`; the
`@angular/build:karma` schema has no such property. Fix: on the new builder, drop the option — there
is nothing to opt into because the coupling it worked around does not exist there.

**★ Symptom: a v21-era `angular.json` naming `@angular-devkit/build-angular:jest` stops working
after upgrading to v22.** Cause: removed in v22.0.0, along with `web-test-runner`. Fix: move to the
`unit-test` builder and pick a runner:

```json
{ "targets": { "test": { "builder": "@angular/build:unit-test", "options": {} } } }
```

**★ Symptom: a generated `test` target has an empty `options` object and you assume it is
misconfigured.** Cause: `runner` already defaults to `vitest`, so the Vitest path needs no options
at all. Fix: nothing — an absent `runner` means Vitest, and only Karma produces a visible key.

**★ Symptom: `ng new --minimal` produced no `test` target.** Cause: the schematic writes `undefined`
for `test` when `skipTests` or `minimal` is set. Fix: expected; add the target when you add tests.

**★ Symptom: switching `runner` from `vitest` to `karma` leaves the build passing and the tests not
running.** Cause: changing the option does not install the other runner, and Karma is likewise an
optional peer. Fix: install it alongside the change:

```bash
npm install --save-dev karma@^6.4.0
```

**★ Symptom: a team rejected the `unit-test` builder on seeing `[EXPERIMENTAL]` and could not find
what to use instead.** Cause: the alternatives are the deprecated `@angular-devkit/build-angular`
karma builder, or the two builders v22.0.0 removed. Fix: weigh the label against what churn costs
in a test target specifically — options change rarely and failures are local and loud — rather than
against an alternative that does not exist.

**★ Symptom: coverage options in the schema do not behave as a Vitest user expects.** Cause: this
page deliberately stops at the option *names*; their semantics belong to the testing phase and vary
by runner. Fix: read the builder's own schema for the version you are on, which is the only
authority that tracks the runner split.

## Interview questions

**★ Which builder runs `ng test` in a new v22 application, and what should you know about it?**
`@angular/build:unit-test`, written by the application schematic with Vitest as the default runner
— the generated target has empty options precisely because `runner` already defaults to `vitest`.
The thing to know is that the same builder's entry in `builders.json` describes itself as
`[EXPERIMENTAL]`. Both facts are verifiable in two files and no documentation page reconciles them,
so the honest answer states both. The judgement to add is about blast radius: a test target's
options changing is a cheap, local, loud failure, which is a very different risk from a build option
changing under a deployment.

**★ Why does `ng test` fail with a missing runner after you copy a `test` target between
projects?**
Because `vitest` and `karma` are both *optional* peer dependencies of `@angular/build`, so depending
on the build system installs neither. The application schematic adds whichever runner `testRunner`
selected, through `addTestRunnerDependencies`. Copying the target copies the configuration and not
the dependency, so the builder resolves and the runner does not. The same thing happens when you
switch `runner` from `vitest` to `karma` in an existing project.

**★ The migration guide tells you to set `builderMode` for the Karma builder. What happens if you
do?**
On `@angular/build:karma`, an unknown-option error — the property does not exist in that schema at
22.1.7. It exists only on the deprecated `@angular-devkit/build-angular:karma` builder, where it is
an enum of `detect`, `browser` and `application` defaulting to `browser`. The paragraph is written
against the older builder and does not carry over. It is worth naming as a class of problem rather
than a one-off: the guide and the schemas are separate artefacts, and where they disagree the schema
is what actually rejects your file.

**What does the removal of the `jest` and `web-test-runner` builders tell you about the
`[EXPERIMENTAL]` label?**
That it is a real signal and not a formality — both were experimental and both were removed in
v22.0.0. What it also shows is the boundary: they went in a major release, not a patch or a minor.
So the label reasonably reads as "may be removed, at a major" rather than "will be removed" or
"could vanish under you". That is the most defensible thing to say about `unit-test`'s label in the
absence of any documentation stating its stability level.

---

← Prev: [The `NG_BUILD_*` surface](11b-the-ng-build-environment-surface.md) · Index: [Topic index](README.md) · Next topic → [06 · `angular.json` anatomy](../06-angular-json-anatomy/README.md)
