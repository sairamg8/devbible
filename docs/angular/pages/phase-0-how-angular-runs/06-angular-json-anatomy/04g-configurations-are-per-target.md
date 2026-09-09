---
title: "Configurations belong to a target, not to a workspace — so `production` on `serve` and `production` on `build` are unrelated objects that happen to share a name, and `ng serve` selects both of them separately"
sidebar_label: "04g · Configurations are per target"
sidebar_position: 4.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> `getOptionsForTarget` and `getOptions` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> at tag `v22.1.7`, the dev-server builder's `buildTarget` description at the same tag, and
> `addAppToWorkspaceFile()` in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**There is no such thing as "the production configuration" of a project.** A configuration is a key
inside one target's `configurations` map, and two targets that both have a key called `production`
have two unrelated objects with a coincidental name. Nothing links them — except a string you write
yourself. That is the whole explanation for the most reported confusion in `angular.json`:
`ng serve --configuration production` changing nothing at all.

## `ng serve` selects twice

The dev-server target does not carry build options; it carries a `buildTarget` string, and that
string has its own optional configuration segment. So a single `ng serve --configuration production`
involves **two independent selections**:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "defaultConfiguration": "development",
    "configurations": {
      "production": { "buildTarget": "storefront:build:production" },
      "development": { "buildTarget": "storefront:build:development" }
    }
  }
}
```

The flag picks the serve target's `production` entry; *that entry's* `buildTarget` then picks the
build target's `production` configuration. Change one and not the other and the flag appears to do
nothing. The full mechanics of that coupling are
[topic 05 · 06b](../05-the-build-angular-build/06b-the-serve-to-build-coupling.md).

## What the link actually is

The connection between the two targets is a `buildTarget` option value, and its documented format is
a three-part string:

> *"A build builder target to serve in the format of `project:target[:configuration]`. You can also
> pass in more than one configuration name as a comma-separated list. Example:
> `project:target:production,staging`."*
> — the `buildTarget` description in the dev-server builder schema at `v22.1.7`

So the serve side's configuration selection chooses **which `buildTarget` string is used**, and the
third segment of that string chooses the build side's configuration. Two selections, one flag, and
the second is data rather than a mechanism.

🔴 **Adding an environment means adding it twice.** A new `staging` configuration on `build` gives you
`ng build --configuration staging` and nothing else; `ng serve --configuration staging` needs its own
entry on `serve` whose `buildTarget` names `:build:staging`.

```json
{
  "build": {
    "builder": "@angular/build:application",
    "defaultConfiguration": "production",
    "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts" },
    "configurations": {
      "production": { "outputHashing": "all" },
      "staging": { "outputHashing": "all", "sourceMap": true },
      "development": { "optimization": false, "sourceMap": true }
    }
  },
  "serve": {
    "builder": "@angular/build:dev-server",
    "defaultConfiguration": "development",
    "options": {},
    "configurations": {
      "production": { "buildTarget": "storefront:build:production" },
      "staging": { "buildTarget": "storefront:build:staging" },
      "development": { "buildTarget": "storefront:build:development" }
    }
  }
}
```

## Gotchas

**★ Symptom: `ng serve --configuration production` still serves an unoptimised build.** Cause: two
selections. The flag chose the serve target's `production` entry, and that entry's `buildTarget`
still names `:build:development`. Fix: make both ends agree:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "configurations": {
      "production": { "buildTarget": "storefront:build:production" },
      "development": { "buildTarget": "storefront:build:development" }
    }
  }
}
```

**Symptom: a configuration named `production` on the `serve` target is assumed to be the same thing
as the one on `build`.** Cause: configurations are per target. Two targets may use the same name for
completely unrelated sets of options, and the only connection between them is one that you write —
a `buildTarget` string whose third segment names the build side's configuration. Fix: make the link
explicit and keep the names aligned so the coincidence becomes a convention:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "configurations": {
      "production": { "buildTarget": "storefront:build:production" },
      "development": { "buildTarget": "storefront:build:development" }
    }
  }
}
```

**Symptom: a new configuration was added to `build` and `ng serve --configuration staging` reports
that it does not exist.** Cause: same rule — adding a configuration to one target does not create it
on another. Fix: add both halves:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": { "tsConfig": "tsconfig.app.json" },
    "configurations": { "staging": { "outputHashing": "all" } }
  },
  "serve": {
    "builder": "@angular/build:dev-server",
    "configurations": { "staging": { "buildTarget": "storefront:build:staging" } }
  }
}
```

**★ Symptom: a `staging` configuration added to `serve` runs a *production* build.** Cause: the new
serve entry was copied from the production one and its `buildTarget` still says `:build:production`.
The serve-side name and the build-side name are independent, so nothing catches the mismatch. Fix:
read the string, not the key:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "configurations": {
      "staging": { "buildTarget": "storefront:build:staging" }
    }
  }
}
```

**Symptom: `ng serve` ignores an option added to the build target's `options`.** Cause: it does not —
`options` applies to every build, including the one the dev server runs. If a change really is not
reaching the served output, the cause is elsewhere: a configuration on the build side naming the same
key and replacing it ([04b](04b-the-merge-is-shallow.md)). Fix: check whether the selected build
configuration names that key:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": { "tsConfig": "tsconfig.app.json", "define": { "API_BASE": "\"/api\"" } },
    "configurations": {
      "development": { "optimization": false }
    }
  }
}
```

**Symptom: a project rename breaks `ng serve` with a message about a project rather than a target.**
Cause: the project name is embedded in every `buildTarget` string, and those strings are not rewritten
by a rename. The failure surfaces during the second lookup
([03e](03e-the-error-ladder-of-an-invocation.md)). Fix: update every reference in the same edit:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "configurations": {
      "development": { "buildTarget": "shop:build:development" },
      "production": { "buildTarget": "shop:build:production" }
    }
  }
}
```

**Symptom: a `buildTarget` is written with two segments and the configuration selection appears to be
ignored.** Cause: `project:target` is a legal reference — the configuration segment is optional — so
the build target runs with its own `defaultConfiguration` rather than with anything the serve side
selected. Fix: name the configuration explicitly when you want one:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "options": { "buildTarget": "storefront:build" },
    "configurations": {
      "production": { "buildTarget": "storefront:build:production" }
    }
  }
}
```

**Symptom: `e2e` or a custom target that references a build target breaks when the build target's
configurations are reorganised.** Cause: the same coupling, in a target nobody thought to check —
any option whose value is a `project:target:configuration` string is a dependency on another target's
configuration names. Fix: treat those strings as references and grep for them before renaming a
configuration:

```bash
grep -n 'storefront:build' angular.json
```

## Interview questions

**★ Why does `ng serve --configuration production` sometimes appear to do nothing?**
Because the serve target and the build target are selected separately. The flag chooses which entry of
the *serve* target's `configurations` applies; that entry contains a `buildTarget` string whose third
segment chooses the *build* target's configuration. If someone edited only one of the two — a common
outcome when adding a new environment — the flag changes the serve side and the build still runs with
whatever the string names. Diagnosing it means reading the `buildTarget` value, not the flag.

**★ Are configurations scoped to a target or to a project?**
To a target. `configurations` is a key inside a target object, so `production` on `build` and
`production` on `serve` are two separate objects with no relationship beyond a shared name. Nothing
in the schema, the reader or the Architect host links them. The only link that exists is one you
write: a `buildTarget` string whose third segment names the build target's configuration. Teams that
keep the names aligned across targets are following a convention, not a rule, and the convention is
worth keeping precisely because it makes the coincidence predictable.

**★ What has to change to add a new environment to a workspace?**
At minimum, two things: a configuration on the `build` target describing what is different, and a
configuration on the `serve` target whose `buildTarget` points at it. If a `test`, `e2e` or custom
target also carries a target reference, each of those needs its own entry too. This is why adding an
environment is more error-prone than it looks — the build side is the part people remember, and the
symptom of forgetting the serve side is a flag that runs without error and changes nothing.

**What does a two-segment `buildTarget` mean?**
That the referenced target should run with its own default. The documented format is
`project:target[:configuration]` with the third part optional, so `storefront:build` resolves to the
build target and then applies that target's `defaultConfiguration`. It is a legitimate thing to write
— it is how you say "whatever build normally does" — but it makes the effective configuration depend
on a key in a different part of the file, which is worth being deliberate about rather than reaching
by accident.

**How would you find every place a configuration name is referenced before renaming it?**
Search for the target reference strings. Any value of the form `project:target:configuration` is a
dependency, and they appear in `buildTarget` on serve targets, in the equivalent options of e2e and
custom builders, in npm scripts and in CI commands. The rename is only safe when all four places have
been updated, and the file gives you no help — an out-of-date reference is a valid string that fails
at run time with a message about a configuration not being set in the workspace.

---

← Prev: [Selecting a configuration](04f-selecting-a-configuration.md) · Index: [Topic index](README.md) · Next → [The generated project](05-the-generated-project-line-by-line.md)
