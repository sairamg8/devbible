---
title: "`cli.packageManager` names the installer the CLI shells out to, and it is the only key in the block a schematic ever writes — but the schema allows four values where angular.dev documents five, and nothing read here reconciles them"
sidebar_label: "13c · `packageManager`"
sidebar_position: 13.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template),
> both at tag `v22.1.7`, cross-read against
> [angular.dev — Angular CLI configuration options](https://angular.dev/reference/configs/workspace-config#angular-cli-configuration-options).
> 🔴 The schema's enum and the published table disagree about the allowed values; both are quoted
> below and the disagreement is named rather than resolved. Documentation-validated;
> **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`packageManager` is the one key in the whole `cli` block that generation ever writes, and it is
the one whose allowed values two primary sources describe differently.** It decides which binary the
CLI invokes when a command has to install something for you — not what a build produces, not how
your own scripts run, and not what your CI does. Getting it right is cheap; getting it *definite* is
where the interesting part is, because angular.dev lists a fifth value the schema does not.

## What the key is, from the schema

Verbatim from `workspace-schema.json` at `v22.1.7`:

```json
"packageManager": {
  "description": "Specify which package manager tool to use.",
  "type": "string",
  "enum": ["npm", "yarn", "pnpm", "bun"]
}
```

A plain string, constrained by a four-value enum, with a one-line description. There is no version
range in the type, and no object form.

## What it actually changes

The value is consulted when the CLI itself has to install packages on your behalf. In practice that
means two commands: `ng add`, which installs a package before running its schematic, and the install
step of `ng update` — [04](../04-ng-update-not-npm-install/README.md) owns that command end to end,
including what it installs and when it rolls back.

It does **not** affect `ng build`, `ng serve` or `ng test`. None of them install anything, so none
of them has any reason to read the key. And it cannot reach your own tooling: the CLI has no
visibility into your `package.json` scripts, your Dockerfile or your CI job definition, so setting
this key is a statement about the CLI's behaviour, not a project-wide declaration of tooling.

## It is the only key generation writes

The workspace schematic's template carries exactly one `cli` property, behind a guard:

```
  "version": 1,<% if (packageManager) { %>
  "cli": {
    "packageManager": "<%= packageManager %>"
  },<% } %>
```

So if a `cli` block exists in a generated workspace at all, `packageManager` is what is in it, and
if the block does not exist it is because no package manager was named at generation time.
[13b](13b-where-the-cli-block-comes-from.md) has the full template and what follows from it.

## ⚠️ The value list the two sources disagree about

The schema declares four values. angular.dev's configuration-options table lists five, adding
`cnpm` to the same set.

**Whether `cnpm` is supported at 22.1.7 could not be settled from the sources read for this page.**
It is in the published documentation and it is not in the schema that ships inside `@angular/cli`,
and no third source was found that reconciles them. Do not read this as "the docs are wrong" or as
"the schema is stale" — neither claim has evidence behind it here.

The safe reading does not require settling it: use a value the schema names. Then the file
validates, both sources agree about it, and the behaviour is not in question. A schema-aware editor
will flag `cnpm`, and that flag is correct about the schema whatever the documentation says about
the CLI.

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {}
}
```

## The other `packageManager`, in `package.json`

Two fields with the same name and different grammars sit two files apart, and mixing them up
produces an error that reads like a typo.

| | `angular.json` → `cli.packageManager` | `package.json` → `packageManager` |
|---|---|---|
| Owned by | Angular CLI's workspace schema | the Corepack convention, not Angular |
| Grammar | a bare tool name from a four-value enum | `name@version` |
| Example | `"pnpm"` | `"pnpm@10.4.1"` |
| Read by | the CLI's own install steps | the Node toolchain that honours Corepack |

Both can be set, and in a team repository both usually should be — to consistent values. Neither
substitutes for the other.

```json
{ "cli": { "packageManager": "pnpm" } }
```

```json
{ "name": "my-app", "packageManager": "pnpm@10.4.1" }
```

## Gotchas

**★ Symptom: `"packageManager": "cnpm"` is underlined by your editor even though angular.dev lists it
as a valid value.** Cause: the schema enum at `v22.1.7` has four values and `cnpm` is not one of
them; the published table has five and includes it. The discrepancy is real and no source read for
this page resolves it. Fix: use a value that is in the schema, so both sources agree about your
file:

```json
{ "cli": { "packageManager": "npm" } }
```

**★ Symptom: `"packageManager": "pnpm@10.4.1"` is rejected.** Cause: the key is a plain string
constrained by a four-value enum and carries no version range; the field that takes `name@version`
is the identically named one in `package.json`. Fix: keep the two apart, and set both:

```json
{ "cli": { "packageManager": "pnpm" } }
```

```json
{ "name": "my-app", "packageManager": "pnpm@10.4.1" }
```

**★ Symptom: `ng build` still runs `npm` somewhere in your pipeline after you set
`cli.packageManager`.** Cause: the key governs installs the CLI itself performs; it does not rewrite
your scripts, your Dockerfile or your CI steps, none of which the CLI can see, and `ng build` does
not install anything in the first place. Fix: change the pipeline as well as the config — two
separate decisions that have to be made to agree:

```json
{
  "scripts": {
    "ci": "pnpm install --frozen-lockfile && pnpm exec ng build --configuration production"
  }
}
```

**Symptom: you set `cli.packageManager` at the workspace level and the CLI still uses a different
one.** Cause: a project-level `cli` block sets it too, and the project-level value is consulted
first. Fix: settle it at one level — the precedence rule and the source that proves it are on
[13f](13f-two-levels-of-cli.md):

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {
    "my-app": { "root": "", "projectType": "application" }
  }
}
```

**Symptom: `"packagemanager"` (lower-case `m`) silently does nothing.** Cause: the reader stores the
whole `cli` object as an extension without inspecting its keys, so nothing at read time objects; the
CLI then looks the value up by its real name and does not find it. Fix: correct the case and keep
`$schema` so an editor catches the next one:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "packageManager": "pnpm" }
}
```

**Symptom: a colleague's generated workspace has a `cli` block and yours does not, with the same CLI
version.** Cause: the template's `if (packageManager)` guard — a package manager was named at
generation time in one case and not the other. Fix: nothing to repair; if the choice should be
pinned for everyone, write it explicitly instead of depending on how the workspace happened to be
created:

```json
{ "cli": { "packageManager": "pnpm" } }
```

## Interview questions

**★ Your editor flags `"packageManager": "cnpm"` but angular.dev documents it. Which do you
believe?**
Neither, without further evidence — and saying so is the correct answer rather than a hedge. The
schema shipped inside `@angular/cli` at 22.1.7 has a four-value enum that does not include `cnpm`;
angular.dev's table has five values and does include it. The sources disagree and nothing read here
settles which reflects the CLI's behaviour. The engineering decision is unaffected: pick a value
that is in the schema, because then both sources agree about your file and neither the editor nor a
validation step has an opinion about it.

**★ What does `packageManager` actually change, and what does it not?**
It changes which installer the CLI shells out to when a command has to install something for you —
`ng add`, and the install step of `ng update`. It does not change how `ng build`, `ng serve` or
`ng test` behave, because none of them install anything, and it does not touch your own scripts,
your Dockerfile or your CI configuration, which the CLI never sees. Treat it as configuration for
the CLI's own install steps, not as a project-wide declaration of tooling.

**★ Both `angular.json` and `package.json` have a `packageManager` field. Are they the same thing?**
No, and confusing them produces a schema error that reads like a typo. Angular's key is a plain
string constrained to an enum of tool names, so it takes `"pnpm"`. The `package.json` field is a
Corepack convention that takes `name@version`, so it takes `"pnpm@10.4.1"`. Putting a version range
into Angular's key fails the enum; putting a bare tool name into the Corepack field defeats the
point of pinning a version. They can and usually should both be set, to consistent values.

**If you wanted to guarantee every developer on a team used the same package manager, would setting
this key be enough?**
No. It is the right place to record the decision and it is what the CLI's own install steps consult,
but it is not enforcement: it lives in a file people edit, a project-level `cli` block overrides it,
and the machine-wide config file carries a value of its own that is not in version control. Put the
enforcement where enforcement lives — a committed lockfile, a `packageManager` field in
`package.json` for Corepack, and a CI job that fails when the lockfile changes unexpectedly.

**Why is this the only key any schematic writes into `cli`?**
Because it is the only one of the five that the generation command already knows the answer to.
`ng new` is told, or infers, which package manager it is running under, so it can record that
choice; it has no basis for deciding whether you want analytics, what your cache policy should be,
which schematic collections you will install, or whether you want a version-mismatch warning. Those
are decisions about a project that does not exist yet, so the template leaves them out, which is why
every other `cli` key in every repository was added by a person.

{/* FOOTER */}
