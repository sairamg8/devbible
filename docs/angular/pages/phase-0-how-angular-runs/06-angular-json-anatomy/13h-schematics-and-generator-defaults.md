---
title: "The `schematics` block maps a schematic's fully qualified name to defaults for its own options — and it is the one object in `angular.json` the schema deliberately leaves open, so every mistake inside it is silent"
sidebar_label: "13h · `schematics` defaults"
sidebar_position: 13.7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `schematicOptions` definition of
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> at tag `v22.1.7`, cross-read against
> [angular.dev — Workspace configuration](https://angular.dev/reference/configs/workspace-config).
> One precedence claim is marked as unsettled below rather than asserted.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`schematics` is a map from a schematic's fully qualified name to defaults for that schematic's own
options, and it is the single place in `angular.json` where the schema says `additionalProperties:
true`.** That openness is deliberate — the schema cannot know the names of third-party schematics —
and it is also why this block is the least forgiving part of the file to get wrong: nothing validates
it, nothing warns about it, and a misspelling produces silence rather than an error. The neighbouring
key with the confusingly similar name, `cli.schematicCollections`, does something else entirely and
is [13i](13i-schematic-collections.md).

## `schematics` — defaults for generator options

angular.dev's own framing, verbatim:

> *"Angular schematics are instructions for modifying a project by adding new files or modifying
> existing files. These can be configured by mapping the schematic name to a set of default
> options."*

The naming rule, also verbatim, and the reason every key in the block is a two-part string:

> *"The "name" of a schematic is in the format: `<schematic-package>:<schematic-name>`. Schematics
> for the default Angular CLI `ng generate` sub-commands are collected in the package
> `@schematics/angular`. For example, the schematic for generating a component with `ng generate
> component` is `@schematics/angular:component`."*

And what the values inside each block may be:

> *"The fields given in the schematic's schema correspond to the allowed command-line argument
> values and defaults for the Angular CLI sub-command options. You can update your workspace schema
> file to set a different default for a sub-command option."*

That last sentence is the whole mechanism. The keys under a schematic name are **that schematic's
own option names**, and their meanings come from the schematic's `schema.json` — not from
`angular.json`'s schema, which only knows that a mapping exists.

```json
{
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "standalone": false
        }
      }
    }
  }
}
```

⚠️ **The option names are `camelCase` here even when the command line uses `dash-case`.** The
documentation states the rule for the configuration file as a whole:

> *"HELPFUL: All options in the configuration file must use `camelCase`, rather than `dash-case` as
> used on the command line."*

## The one open door in a file full of closed ones

The `schematicOptions` definition `$ref`s each built-in schematic's own schema —
`@schematics/angular:application`, `:class`, `:component`, `:directive`, `:enum`, `:guard`,
`:interceptor`, `:interface`, `:library`, `:pipe`, `:ng-new`, `:resolver`, `:service`,
`:web-worker` — and then declares `"additionalProperties": true`.

🔴 **That `true` is the only place in `angular.json` where unknown keys are welcome, and it is
deliberate.** A third-party schematic package can be configured here and the schema will not
complain, because the schema cannot possibly know the names of schematics that are not part of
Angular. Everything else in the file — the top level, the project object, `cliOptions`, `warnings`,
`cache`, every builder's option schema — is `additionalProperties: false`.

The trade-off is exactly what you would expect: no validation. A misspelled schematic name and a
misspelled option name inside a third-party block both sit in the file doing nothing, and nothing
will tell you.

```json
{
  "schematics": {
    "@angular/material:navigation": {
      "style": "scss"
    }
  }
}
```

## ⚠️ One precedence claim this page will not make

`schematics` is declared at both the workspace level and the project level, and angular.dev's own
example places it inside a project. **Which one wins when both declare a default for the same option
was not settled by the sources read for this page** — the resolution code for `schematics` was not
traced, unlike the `cli` block's, whose precedence is proven on
[13f](13f-two-levels-of-cli.md).

The safe practice does not depend on the answer: set a given default at exactly one level. If you
need per-project variation, put the block on each project and leave the workspace level empty rather
than relying on an override rule you cannot cite.

## Gotchas

**★ Symptom: `ng generate component` ignores the defaults you set in the workspace-level `schematics`
block.** Cause: a project-level `schematics` block is also present, and which project's block is in
play comes from the working directory. Fix: set the default at one level only, and prefer the project
level when projects genuinely differ:

```json
{
  "version": 1,
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": { "style": "scss" }
      }
    }
  }
}
```

**★ Symptom: a typo inside a `schematics` block does nothing and nothing flags it.** Cause:
`schematicOptions` is `additionalProperties: true` — the one open door in the file — so a misspelled
schematic name or a misspelled option name is accepted and then never matched. Fix: check the name
against the schematic it belongs to; for the built-ins the two-part form is
`@schematics/angular:<name>`:

```json
{
  "schematics": {
    "@schematics/angular:component": { "style": "scss", "changeDetection": "OnPush" }
  }
}
```

**★ Symptom: `"change-detection": "OnPush"` in a `schematics` block is ignored.** Cause: the
configuration file uses `camelCase` option names even where the command line uses `dash-case`, and
the open `additionalProperties: true` means the wrong spelling is not rejected either. Fix:

```json
{
  "schematics": {
    "@schematics/angular:component": { "changeDetection": "OnPush" }
  }
}
```

**Symptom: `"component": { "style": "scss" }` in a `schematics` block does nothing.** Cause: the key
must be the full schematic name in `package:name` form; a bare sub-command name matches nothing.
Fix: qualify it:

```json
{
  "schematics": {
    "@schematics/angular:component": { "style": "scss" }
  }
}
```

**Symptom: `schematics` placed inside a target, or inside `options`, has no effect.** Cause: it is a
top-level key and a project-level key — the reader names it in both extension lists — and a target
object is closed around `builder`, `defaultConfiguration`, `options` and `configurations`. Fix:

```json
{
  "version": 1,
  "schematics": { "@schematics/angular:component": { "style": "scss" } },
  "projects": {
    "my-app": { "root": "", "projectType": "application" }
  }
}
```

**Symptom: a `schematics` block full of `skipTests` or `standalone` settings appears in a generated
project object and nobody added it.** Cause: the application schematic writes a `schematics` block
when non-default generation options were chosen, so it is generated output rather than configuration
someone forgot to remove. Fix: nothing to repair; what each condition writes is
[05b](05b-the-five-project-level-fields.md):

```json
{
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "schematics": { "@schematics/angular:component": { "style": "scss" } }
    }
  }
}
```

**Symptom: a `schematics` default appears to work for `ng generate component` and not for
`ng g c`.** Cause: nothing to do with the alias — both resolve to the same schematic, so a default
that applies to one applies to the other. The real cause is elsewhere, usually the block being at a
level that the current working directory does not select. Fix: check which level the block is on
before suspecting the command form:

```json
{
  "version": 1,
  "schematics": { "@schematics/angular:component": { "style": "scss" } },
  "projects": { "web": { "root": "", "projectType": "application" } }
}
```

## Interview questions

**★ Why is `schematicOptions` the only `additionalProperties: true` in a file that is otherwise
closed everywhere?**
Because the schema cannot know the names of schematics that are not part of Angular. The definition
`$ref`s each built-in schematic's own schema — component, directive, service, library and the rest —
but a third-party package such as a component library ships schematics whose names and option sets
were unknown when `angular.json`'s schema was written. Leaving the map open is what makes those
packages configurable at all. The cost is exactly the validation you lose everywhere else: a
misspelled schematic name or option name inside that block is accepted and then never matched, so it
fails silently rather than loudly.

**★ Where do the allowed keys inside a `schematics` entry come from?**
From the schematic's own `schema.json`, not from `angular.json`'s schema. The documentation says so
directly — the fields correspond to the allowed command-line argument values and defaults for the
sub-command — so the way to find out what you may set for `@schematics/angular:component` is to read
that schematic's schema or its command help, not to look in the workspace schema. `angular.json`'s
schema only knows that a mapping from a name to an options object exists, which is also why it
cannot validate the inside of that mapping.

**Why is this block read by the CLI rather than by a builder?**
Because it configures generation, and generation never runs a builder. `ng generate` resolves a
schematic and executes it against a virtual file tree; no target is selected, no `builder` string is
looked up, and Architect is not involved at all. That is the same reason `cli` is read by the CLI
process — both blocks belong to the half of `angular.json` that shapes commands rather than builds,
which is why neither can be overridden with `--configuration` and why neither appears in any
builder's option schema.

**If a colleague asks whether a workspace-level `schematics` default overrides a project-level one,
what is the honest answer?**
That the schema declares the key at both levels and angular.dev's example uses the project level,
but the resolution code for `schematics` specifically was not traced here, so the precedence is not
something to assert. The `cli` block's precedence *is* proven — project first, workspace as a
per-setting fallback — and it is reasonable to expect the same shape, but expecting is not knowing.
The practical answer is that it does not need to be settled: set a given default at exactly one
level and the question never arises.

**Why is "my generator defaults are ignored" such a hard symptom to diagnose in this part of the
file?**
Because every layer that could tell you something is silent. The reader stores `schematics` as an
extension without inspecting it, so nothing is validated at read time. The schema deliberately opens
the map with `additionalProperties: true`, so a wrong schematic name or option name is not flagged.
The `camelCase` requirement means a command-line-shaped name looks right and matches nothing. And
which block applies depends on the working directory. Four independent silent failure modes for one
symptom is why the practical advice is to reduce the surface: one level, fully qualified names,
`camelCase` throughout.

{/* FOOTER */}
