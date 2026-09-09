---
title: "A configuration does not merge into `options` — it is a shallow object spread, so for every key a configuration names, the entire value is replaced however deep it goes, and this is documented nowhere on angular.dev"
sidebar_label: "04b · The merge is shallow"
sidebar_position: 4.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> `getOptionsForTarget` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> at tag `v22.1.7`, cross-read against
> [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments).
> Documentation-validated; **no sandbox run** — the effective-option behaviour described below is
> derived from the spread in the source, not captured from a build.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Almost everyone believes a configuration is merged into `options`. It is not. It is spread over
it.** The difference is invisible for a boolean or a string and destructive for an array or an
object: for every key a configuration names, the base value is **thrown away entirely** and replaced,
no matter how deeply structured it was. You cannot add one budget and keep the others. You cannot
switch off optimisation without discarding the `optimization` object you configured. **This rule is
stated nowhere on angular.dev** — it exists in eighteen lines of the Architect host, and it is the
single highest-value thing to know about `angular.json`. This page is the mechanism itself;
[04c](04c-the-two-canonical-cases.md) works the two cases everyone meets first, and
[04d](04d-every-option-shape-the-rule-bites.md) inventories the rest of the blast radius.

## The eighteen lines

```ts
async getOptionsForTarget(target: Target): Promise<json.JsonObject | null> {
  if (!(await this.workspaceHost.hasTarget(target.project, target.target))) {
    return null;
  }

  let options = await this.workspaceHost.getOptions(target.project, target.target);
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

  return clone(options) as json.JsonObject;
}
```
— [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts) at `v22.1.7`

The load-bearing expression is `{ ...options, ...configOptions }`. That is JavaScript's object
spread, and object spread copies **own enumerable top-level properties**. It does not descend. It
does not concatenate arrays. It does not merge objects. It assigns.

## The rule, stated exactly

Two halves, and both matter:

1. **A configuration only affects the keys it actually names.** A configuration setting
   `outputHashing` does not disturb `assets`, `styles` or anything else — those keys are simply not
   in the spread's right-hand side, so the left-hand value survives.
2. 🔴 **For every key it does name, the entire value is replaced.** An array replaces an array
   wholesale. An object replaces an object wholesale. A boolean replaces an object.

So the correct mental model is **per-key assignment**, not merging. Say it out loud when reading a
configuration: *"production assigns `budgets`; production assigns `outputHashing`."*

## What is *not* affected

Say the second half of the rule as clearly as the first, because over-correcting is its own bug: a
configuration that names only `outputHashing` leaves every other option exactly as `options` set it.

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "browser": "src/main.ts",
      "assets": [{ "glob": "**/*", "input": "public" }],
      "styles": ["src/styles.css"]
    },
    "configurations": {
      "production": { "outputHashing": "all" }
    }
  }
}
```

Effective options under production: all four base options, plus `outputHashing`. **Replacement is per
top-level key, not whole-object** — there is no need to restate anything a configuration does not
mention.

## One more detail: the builder gets a clone

The function ends with `return clone(options)`, so the builder receives its own copy rather than a
reference into the parsed workspace. That matters if you are writing a builder: mutating your options
object cannot leak into another target's options within the same process.

## Gotchas

**★ Symptom: an option set in `options` is ignored under exactly one configuration and honoured under
every other.** Cause: that one configuration names the same key, so the spread's right-hand side
overwrites it. Every other configuration is silent about the key, so the base value survives there.
Fix: remove the key from the configuration that should not be changing it:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "styles": ["src/styles.css"] },
  "configurations": {
    "production": { "outputHashing": "all" },
    "staging": { "outputHashing": "all", "sourceMap": true }
  }
}
```

**★ Symptom: an option is set in `options` *and* in the configuration, and the `options` value never
wins.** Cause: the spread puts the configuration on the right, so it always wins for any key it
names. There is no precedence rule to tune, no priority field and no way to make a base value
authoritative. Fix: if a value must not be overridable, it can only live in one place — remove it
from the configuration:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "aot": true },
  "configurations": {
    "development": { "optimization": false, "sourceMap": true }
  }
}
```

**★ Symptom: reading the file top to bottom gives the wrong answer about what a build will do.**
Cause: `angular.json` is not read in document order — the effective options are `options` with the
selected configuration spread over it, so a value further down the file replaces one further up.
Fix: read it as an assignment sequence. Write out the base, then apply the configuration key by key:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "outputHashing": "none", "sourceMap": false },
  "configurations": {
    "production": { "outputHashing": "all" }
  }
}
```

**Symptom: `null` is used in a configuration to "unset" an option and restore the base value.**
Cause: the spread assigns whatever the configuration holds, including `null`. It does not delete the
key and it does not fall back — the builder receives `null` and validates it against the option's
declared type. Fix: there is no unset; omit the key instead, and the base value survives untouched:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "baseHref": "/shop/" },
  "configurations": {
    "development": { "optimization": false }
  }
}
```

**Symptom: a configuration restates a value identical to the one in `options`.** Cause: usually
defensive copying, occasionally a leftover. It is harmless to the build and harmful to the reader —
it makes a configuration look like it changes something when it does not, and the next person edits
`options` and cannot work out why nothing moved. Fix: delete the redundant key:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "aot": true },
  "configurations": { "production": { "outputHashing": "all" } }
}
```

**Symptom: two configurations combined with a comma both name the same key and only one takes
effect.** Cause: the loop applies them left to right with the same spread each time, so the last one
wins that key entirely. Fix: keep composed configurations orthogonal — one axis each, with no key
appearing in two of them ([04f](04f-selecting-a-configuration.md)):

```json
{
  "configurations": {
    "staging": { "outputHashing": "all", "sourceMap": true },
    "eu": { "baseHref": "/eu/" }
  }
}
```

## Interview questions

**★ Is a configuration merged into `options`, or does it replace them?**
Neither exactly, and the precise answer is what matters: it is a shallow object spread,
`{ ...options, ...configurationOptions }`. Keys the configuration does not mention are untouched;
keys it does mention have their entire value replaced, however deeply structured. So it is a merge at
the top level and a replacement below it. Object spread copies own enumerable top-level properties
and does not descend, concatenate arrays or combine objects.

**★ If an option appears in both `options` and the selected configuration, which wins?**
The configuration, always. It is the right-hand operand of the spread, so it overwrites for every key
it names. There is no precedence mechanism, no priority field and no way to mark a base value as
authoritative — the only way to prevent an option from being overridden is for it not to appear in
any configuration. This also means the answer never depends on ordering within the file, only on
which side of the spread a key sits.

**What happens if a configuration sets an option to `null`?**
The builder receives `null`. The spread assigns whatever value the configuration holds; it does not
treat `null` as "remove this key" and it does not fall back to the base value. What happens next is
the builder's own option validation — `null` against a declared string or object type. There is no
unset operation in this file, so the way to leave a base value alone is to not mention the key.

**Does a configuration that sets only one option lose the others?**
No, and stating this half of the rule matters as much as the first. The spread's right-hand side only
contains the keys the configuration wrote, so every other key in `options` survives untouched. A
`staging` configuration that sets only `outputHashing` keeps `tsConfig`, `browser`, `assets` and
`styles` exactly as the base defined them. Over-correcting by restating everything in every
configuration is a real and common response to learning about the merge, and it produces a file that
is harder to read and harder to keep consistent.

**Why is this rule so widely misunderstood?**
Because the word "configuration" implies layering, because most other build tools do deep-merge their
environment overrides, and because angular.dev does not state the behaviour anywhere. The
documentation describes what configurations are for and how to select them, and leaves the combination
semantics implicit. The only authoritative statement is the code, and the eighteen lines that contain
it are in the Architect host rather than anywhere a reader of the workspace-configuration page would
think to look.

{/* FOOTER */}
