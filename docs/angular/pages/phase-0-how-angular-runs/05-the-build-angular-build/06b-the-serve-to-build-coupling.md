---
title: "One `ng serve` performs two independent configuration selections — the flag picks a serve configuration, and that configuration's `buildTarget` string picks a build configuration, which is why `--configuration production` can serve an unoptimised bundle"
sidebar_label: "06b · The serve-to-build coupling"
sidebar_position: 6.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `buildTarget` description from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`; the generated `serve` target transcribed from `addAppToWorkspaceFile()` in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts);
> the configuration-resolution error text from `getOptions()` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts);
> the missing-target guard from
> [`packages/angular/build/src/builders/dev-server/builder.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/builder.ts);
> plus [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments).
> Documentation-validated against source; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`--configuration production` on `ng serve` does not select a production build. It selects a
*serve* configuration, which then names a build configuration in a string — and those are two
separate decisions that can disagree.** Almost every "the flag did nothing" report about the dev
server reduces to this: someone added a `production` entry to the serve target and did not point its
`buildTarget` at the build target's `production`. The mechanism is one option, one string format,
and two lookups, and once you can see all three the failure stops being mysterious.

## `buildTarget` is the entire coupling

The generated `serve` target sets **no options at all** in `options`. Transcribed from the CLI's
own application schematic at `v22.1.7` — not captured from a terminal:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "defaultConfiguration": "development",
  "options": {},
  "configurations": {
    "production": { "buildTarget": "my-app:build:production" },
    "development": { "buildTarget": "my-app:build:development" }
  }
}
```

`buildTarget` is the only structural option the dev server has, and its schema description spells
out a format worth reading twice:

> *"A build builder target to serve in the format of `project:target[:configuration]`. You can also
> pass in more than one configuration name as a comma-separated list. Example:
> `project:target:production,staging`."*

Three parts, and only the third is optional. The project name is embedded as a literal string —
which is why renaming a project in a workspace means editing every `buildTarget` that referenced it,
and why nothing warns you if you miss one until the command fails.

## Two selections, in order

Running `ng serve --configuration production`:

1. **The CLI selects the serve target's `production` configuration.** If the serve target has no
   entry by that name, this step throws.
2. **That entry's `buildTarget` string selects a build configuration** — the third segment of
   `my-app:build:production`. If the string ends at `my-app:build`, no build configuration is
   selected at all and the build target's plain `options` are used.

The two steps read different objects. Nothing propagates the word `production` from step 1 to step 2
— the only link is the text you wrote in the string. That is the whole bug class.

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "configurations": {
      "production": { "buildTarget": "my-app:build:development" }
    }
  }
}
```

That fragment is syntactically perfect, passes schema validation, and serves a development build
from a configuration called `production`.

## The comma list composes, and order decides conflicts

angular.dev states the rule for configurations generally:

> *"Configurations can be applied to any Angular CLI builder. Multiple configurations can be
> specified with a comma separator. The configurations are applied in order, with conflicting
> options using the value from the last configuration."*
> — [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments)

So `my-app:build:production,staging` gives `staging` the last word on any key both set. How that
merge actually works — and 🔴 that it is **shallow**, per top-level key, so a configuration that
names `budgets` replaces the whole array rather than appending to it — belongs to topic 06's chunk
on options and configurations, **06 · `angular.json` anatomy** *(not written yet)*.

## An unknown configuration throws — there is no fallback

Architect resolves a named configuration by direct lookup and rejects a miss rather than falling
back to `options`. From `getOptions()` in the Architect host:

```ts
if (!targetDefinition.configurations?.[configuration]) {
  throw new Error(
    `Configuration '${configuration}' for target '${target}' in project '${project}' is not set in the workspace.`,
  );
}
```

The message is `Configuration '<name>' for target '<target>' in project '<project>' is not set in
the workspace.` — quoted from the source's template literal. **There is no fuzzy matching**, so
`prod` does not find `production`, and there is no silent degradation to the target's plain options.
That is a good design: a typo in a configuration name fails immediately rather than quietly
building something else.

Note which target the message names. If it says `for target 'build'`, the failure is in the
`buildTarget` string's third segment; if it says `for target 'serve'`, it is the `--configuration`
flag you passed.

## Gotchas

**★ Symptom: `ng serve --configuration production` serves an unoptimised bundle.** Cause: two
configuration selections, one edited. The flag picks the serve target's `production` entry; that
entry's `buildTarget` string picks the build configuration. If the serve entry still points at
`:build:development`, the flag did nothing you can see. Fix: make both ends say the same word:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "configurations": {
    "production": { "buildTarget": "my-app:build:production" },
    "development": { "buildTarget": "my-app:build:development" }
  }
}
```

**★ Symptom: `Configuration 'prod' for target 'build' in project 'my-app' is not set in the
workspace.`** Cause: the third segment of a `buildTarget` string names a configuration the *build*
target does not have — the generated names are `production` and `development`, and there is no fuzzy
matching or fallback. Fix: use the exact name, and read which target the message blames before
editing anything:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "configurations": {
    "production": { "buildTarget": "my-app:build:production" }
  }
}
```

**★ Symptom: `ng serve` errors that a target is required.** Cause: the serve target has no
`buildTarget` anywhere the selected configuration can see it — the builder guards for this
explicitly and logs `The "dev-server" builder requires a target to be specified.` Fix: put a
`buildTarget` in the configuration you are running, or in `options` so every configuration inherits
it:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "buildTarget": "my-app:build" },
  "configurations": {
    "production": { "buildTarget": "my-app:build:production" }
  }
}
```

**★ Symptom: `ng serve` picks up a change to `angular.json` build options while a `ng build --watch`
in another terminal does not, or the reverse.** Cause: serve and build select different
configurations by default. The application schematic writes `defaultConfiguration: "production"` on
`build` and `"development"` on `serve`, so a setting placed in `configurations.production` is
invisible to a bare `ng serve` and a setting in `configurations.development` is invisible to a bare
`ng build`. Fix: put anything that must apply to both in `options`, not in a configuration, and use
configurations only for the deliberate differences.

**★ Symptom: you added a `staging` configuration to `build` and `ng serve --configuration staging`
says the serve target has no such configuration.** Cause: configurations are per target. Adding one
to `build` does not create one on `serve`; the serve side needs its own entry whose `buildTarget`
points at the build side's. Fix: add both halves:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "configurations": {
    "staging": { "buildTarget": "my-app:build:staging" }
  }
}
```

**Symptom: after renaming a project, `ng serve` fails to find the build target.** Cause: the project
name is a literal segment of every `buildTarget` string, and nothing rewrites it for you. Fix: find
every occurrence before assuming one:

```bash
grep -n '"buildTarget"' angular.json
```

**Symptom: a second developer's `ng serve` uses a different build configuration than yours on the
same commit.** Cause: `--configuration` on the command line, or a `defaultConfiguration` edited in
a branch. There is no environment variable that selects a configuration, so the difference is
always in the file or the invocation. Fix: print what the target actually says before arguing about
behaviour:

```bash
node -p "JSON.stringify(require('./angular.json').projects['my-app'].targets.serve, null, 2)"
```

**Symptom: `buildTarget` written as `build:production` is rejected or resolves to nothing.** Cause:
the format is `project:target[:configuration]` — the project segment is not optional, even in a
single-project workspace. Fix: name the project explicitly:

```json
"configurations": {
  "production": { "buildTarget": "my-app:build:production" }
}
```

## Interview questions

**★ Why does the `serve` target in a generated `angular.json` have an empty `options` object?**
Because the dev server does not build anything. It resolves the `buildTarget` string, asks that
builder for an in-memory build, and serves the result — so every build decision belongs to the
build target and is reached indirectly. The generated serve target therefore sets nothing in
`options` and puts a `buildTarget` in each configuration instead. The practical payoff is that
there is exactly one place a build setting can live, so "why does serve behave differently from
build" is always answerable by reading which configuration each one selected.

**★ `ng serve --configuration production` still serves an unoptimised bundle. Where do you look?**
At both configuration selections, in order. The flag chooses the `production` entry on the *serve*
target; that entry contains a `buildTarget` string of the form `project:target[:configuration]`,
and the configuration segment of that string is what selects the *build* configuration. If someone
added a `production` entry to `serve` without setting its `buildTarget`, or left it pointing at
`:build:development`, the command names production and builds development. Reading the serve
target's `configurations` block settles it in seconds.

**★ Why is a wrong configuration name an error rather than a fallback to the target's options?**
Because a fallback would be indistinguishable from success. Architect looks the name up directly and
throws `Configuration '<name>' for target '<target>' in project '<project>' is not set in the
workspace.` if it is missing — no fuzzy matching, no degradation. If it fell back, a typo like
`prod` for `production` would build the unconfigured target and produce output that looks plausible,
and you would ship it. The design choice is the same one behind `additionalProperties: false` on the
schemas: make configuration mistakes loud, because the alternative is a silent wrong build.

**Why can a comma-separated list appear in `buildTarget`, and what decides conflicts?**
Because Architect lets configurations compose: `project:target:production,staging` applies both, in
the order written. angular.dev's rule is that *"conflicting options using the value from the last
configuration"* — so `staging` overrides `production` for any key both name, and the composition is
resolved before the builder ever runs. It is a useful mechanism for layering a small
environment-specific delta on top of a large shared one, and a dangerous one if the two
configurations both set an array or an object, because the merge replaces per top-level key rather
than merging inside it.

**What breaks when you rename a project in a multi-project workspace?**
Every `buildTarget` string that named it, plus any other target reference of the same
`project:target[:configuration]` shape. The project name is embedded as literal text, not resolved
through an alias, so nothing detects the mismatch until a command that uses that string runs — and
in a workspace with several apps and libraries, that can be a target nobody runs locally. The
practical defence is to grep for `"buildTarget"` after any rename rather than trusting an
editor-wide find and replace to have caught the JSON.

**If you had to explain this coupling to someone in one sentence, what would you say?**
That the serve target does not have build settings; it has a *pointer* to build settings, and the
pointer is a string you maintain by hand. Everything else follows: the two selections can disagree,
a project rename invalidates the pointer, an unknown configuration name in the pointer throws, and
the fastest diagnosis for any of it is to print the serve target and read the string.

{/* FOOTER */}
