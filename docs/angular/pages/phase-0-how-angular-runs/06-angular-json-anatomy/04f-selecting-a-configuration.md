---
title: "The configuration in play is the flag, or `defaultConfiguration`, or nothing — an unknown name throws instead of falling back, and a comma-separated list is applied left to right with the same shallow spread each time"
sidebar_label: "04f · Selecting a configuration"
sidebar_position: 4.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> `getOptionsForTarget` and `getOptions` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> at tag `v22.1.7`, and
> [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments) plus the
> alternate-configurations section of
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Three questions decide what a command actually runs: which configuration was selected, what happens
when none was, and what happens when the name is wrong.** All three are answered in a few lines of
the Architect host, and none of the answers is forgiving. There is no fuzzy matching, no fallback to
`options`, and no warning — an unknown configuration name is a thrown error naming the target and the
project. Getting this right is what makes `ng build` predictable. The separate question of why `ng serve
--configuration production` so often changes nothing is
[04g](04g-configurations-are-per-target.md).

## The selection, in code

```ts
const targetConfiguration =
  target.configuration ||
  (await this.workspaceHost.getDefaultConfigurationName(target.project, target.target));

if (targetConfiguration) {
  const configurations = targetConfiguration.split(',').map((c) => c.trim());
  for (const configuration of configurations) {
    options = {
      ...options,
      ...(await this.workspaceHost.getOptions(target.project, target.target, configuration)),
    };
  }
}
```

Four facts in five lines:

1. **An explicit selection wins.** `target.configuration` comes from the command line or from the
   third segment of a target reference.
2. **Otherwise `defaultConfiguration` on that target is used.** It is looked up on the target, not on
   the project or the workspace.
3. **If neither exists, no configuration is applied** and `options` is used as-is — which is exactly
   what the documentation says: *"When `defaultConfiguration` is not set, `options` are used directly
   without modification."*
4. **A comma-separated list is split and trimmed**, then applied in order, each one spread over the
   accumulated result. Whitespace around a name is therefore harmless.

## Left to right, last wins

> *"You can also pass in more than one configuration name as a comma-separated list. For example, to
> apply both `staging` and `french` build configurations, use the command `ng build --configuration
> staging,french`. In this case, the command parses the named configurations from left to right. If
> multiple configurations change the same setting, the last-set value is the final one. In this
> example, if both `staging` and `french` configurations set the output path, the value in `french`
> would get used."*
> — [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)

> *"Configurations can be applied to any Angular CLI builder. Multiple configurations can be
> specified with a comma separator. The configurations are applied in order, with conflicting options
> using the value from the last configuration."*
> — [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments)

🔴 **Each application in that loop is the same shallow spread**
([04b](04b-the-merge-is-shallow.md)). So composing `staging,french` composes scalars cleanly and
destroys structure exactly as a single configuration does — if both name `assets`, `french` wins the
whole array, and `staging`'s entries are gone.

## An unknown name throws

```ts
async getOptions(project, target, configuration) {
  const targetDefinition = findProjectTarget(workspaceOrHost, project, target);

  if (configuration === undefined) {
    return (targetDefinition.options ?? {}) as json.JsonObject;
  }

  if (!targetDefinition.configurations?.[configuration]) {
    throw new Error(
      `Configuration '${configuration}' for target '${target}' in project '${project}' is not set in the workspace.`,
    );
  }

  return (targetDefinition.configurations?.[configuration] ?? {}) as json.JsonObject;
}
```

The message is worth memorising because it names all three coordinates:

> `Configuration '<name>' for target '<target>' in project '<project>' is not set in the workspace.`

⚠️ **There is no fallback and no fuzzy matching.** `prod` is not `production`. `Production` is not
`production`. A name that does not exist is an error, not a silent no-op — which is the right
behaviour, and it is also why a `defaultConfiguration` pointing at a deleted configuration breaks
every bare invocation of that target at once.

Note also the `?? {}` on the no-configuration branch: `options` is optional, and its absence means an
empty object rather than an error.

## Gotchas

**★ Symptom: `Configuration 'prod' for target 'build' in project 'storefront' is not set in the
workspace.`** Cause: the configuration is named `production`. There is no fuzzy matching and no
fallback to `options`. Fix: use the exact name — the message tells you the target and project to look
in:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": { "tsConfig": "tsconfig.app.json" },
    "configurations": { "production": { "outputHashing": "all" } }
  }
}
```

**★ Symptom: every bare `ng build` suddenly fails with a configuration-not-set error after a
cleanup.** Cause: `defaultConfiguration` still names a configuration that was deleted or renamed. The
default is resolved on every invocation that does not pass a flag, so removing a configuration breaks
the command for everyone at once. Fix: keep the two in step:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "defaultConfiguration": "production",
    "options": { "tsConfig": "tsconfig.app.json" },
    "configurations": { "production": { "outputHashing": "all" } }
  }
}
```

**★ Symptom: `ng build --configuration staging,french` applies only part of what you expected.**
Cause: they are applied left to right and the later one wins any key both name — including whole
arrays and objects. Fix: keep composed configurations orthogonal, so no two of them set the same key:

```json
{
  "configurations": {
    "staging": { "outputHashing": "all", "sourceMap": true },
    "french": { "baseHref": "/fr/", "localize": ["fr"] }
  }
}
```

**Symptom: a configuration list written with spaces is assumed to be invalid.** Cause: it is not —
the names are split on the comma and each is trimmed, so `production, eu` behaves identically to
`production,eu`. Fix: nothing; both forms work, and quoting the argument is only needed because of
the shell:

```json
{
  "scripts": {
    "build:prod-eu": "ng run storefront:build:production,eu"
  }
}
```

**Symptom: removing `defaultConfiguration` changes what a bare command does, and nobody expected a
removal to change behaviour.** Cause: with no default, no configuration is applied at all and
`options` is used unmodified — so a bare `ng build` stops optimising, stops hashing and stops
enforcing budgets. Fix: if you want a bare command to be unconfigured, that is the way to do it; if
not, keep the key and be explicit at call sites that need something else:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "defaultConfiguration": "production",
    "options": { "tsConfig": "tsconfig.app.json" },
    "configurations": {
      "production": { "outputHashing": "all" },
      "development": { "optimization": false }
    }
  }
}
```

## Interview questions

**★ How does the CLI decide which configuration applies when you do not pass `--configuration`?**
It takes the target's `defaultConfiguration`. The selection is `target.configuration ||
getDefaultConfigurationName(project, target)`, so an explicit selection wins and the target's default
is the fallback — and if there is no default either, no configuration is applied and `options` is used
unmodified, which is exactly what the documentation states. The key detail is that the default is a
property of the *target*: a generated workspace sets `production` on `build` and `development` on
`serve`, which is why the two bare commands behave so differently.

**★ What happens if you pass a configuration name that does not exist?**
It throws: `Configuration '<name>' for target '<target>' in project '<project>' is not set in the
workspace.` There is no fuzzy matching, no case-insensitive lookup and no fallback to `options`. That
strictness is a feature — silently building with the wrong settings is far worse than failing — but it
has a consequence people meet unexpectedly: a `defaultConfiguration` pointing at a configuration that
has been renamed or deleted makes every invocation without a flag fail, not just the ones that name
it.

**★ How do multiple configurations combine?**
They are split on commas, trimmed, and applied left to right, each one spread over the result so far.
The documentation says the same thing: configurations are parsed left to right and *"if multiple
configurations change the same setting, the last-set value is the final one"*. The important addition
is that each application is the same shallow spread as a single configuration, so composing two
configurations that both set an array does not combine the arrays — the later one replaces the earlier
one entirely.

**Does whitespace in a configuration list matter?**
No. The names are produced by `targetConfiguration.split(',').map((c) => c.trim())`, so each name is
trimmed before lookup and `production, eu` is identical to `production,eu`. Whitespace only matters to
your shell, which is why the argument usually ends up quoted. It is a small detail, but it is the kind
that gets blamed when something else is wrong.

**A target has `"options": {}` and no `defaultConfiguration`. What does a bare invocation run with?**
An empty options object. The no-configuration branch returns `targetDefinition.options ?? {}`, so an
empty or absent `options` yields `{}`, and with no default configuration nothing is spread over it.
Whether that works depends entirely on the builder: one whose required options are all supplied on the
command line will run, and the application builder will fail for want of `tsConfig`. This is the
literal reading of *"`options` are used directly without modification"* — there is no hidden layer of
defaults coming from the workspace file.

{/* FOOTER */}
