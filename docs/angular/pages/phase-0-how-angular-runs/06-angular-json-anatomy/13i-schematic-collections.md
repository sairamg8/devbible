---
title: "`cli.schematicCollections` decides which packages a bare generator name is searched in, and it changes no defaults at all — which is why setting it when you meant `schematics` fails silently in both directions"
sidebar_label: "13i · `schematicCollections`"
sidebar_position: 13.8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `cliOptions` and `project` definitions of
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> at tag `v22.1.7`, cross-read against
> [angular.dev — Angular CLI configuration options](https://angular.dev/reference/configs/workspace-config#angular-cli-configuration-options).
> Search-order behaviour across multiple collections is **not** stated by either source and is marked
> as unsettled below. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`schematicCollections` and `schematics` sit within a few lines of each other in a real
`angular.json`, have names that differ by one word, and do entirely unrelated jobs.** This one is an
array of package names that decides *which packages are searched* when you type a bare generator
name; it never changes a default. The other is a map of defaults keyed by fully qualified schematic
name; it never changes which package is searched. Using either where you meant the other produces no
error, which is why the pair is worth separating deliberately.

## The declaration

From `cliOptions`, verbatim:

```json
"schematicCollections": {
  "type": "array",
  "description": "The list of schematic collections to use.",
  "items": { "type": "string", "uniqueItems": true }
}
```

and angular.dev's row, which supplies both the scope and the default:

> *"| `schematicCollections` | List schematics collections to use in `ng generate`. | `string[]` |
> `[]` |"*

Three things to take from those two fragments. It is an **array of package names**, not a map. It
carries **`uniqueItems`**, so a duplicated entry is a violation rather than a harmless repeat. And
the documented scope is **`ng generate`** — the row says so explicitly, which is a useful boundary
when you are wondering whether it explains something another command did.

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "schematicCollections": ["@angular/material"] },
  "projects": {}
}
```

## The distinction, stated flatly

| | `cli.schematicCollections` | `schematics` |
|---|---|---|
| Answers | which **package** a bare name is searched in | what a schematic's **options** default to |
| Shape | array of package names | map of `package:name` to an options object |
| Affects | which schematic runs | how the schematic that ran behaves |
| Lives in | the `cli` block | its own top-level or project-level key |
| Validation | `string[]` with `uniqueItems` | open — `additionalProperties: true` |
| Documented scope | `ng generate` | the sub-command the schematic backs |

The two symptoms that follow are worth memorising, because they point at different keys: *"my
defaults are ignored"* is a `schematics` problem, and *"the wrong generator ran"* — or *"the CLI
cannot find that generator"* — is a `schematicCollections` problem. Neither key produces an error
when it is the wrong one to have reached for.

## Where it may live

Both levels. At the workspace level it is one of the five properties of `cliOptions`. At the project
level, `schematicCollections` is **the only key the project's inline `cli` fragment names at all** —
which is a reasonable signal that per-project collections are the use case the design had in mind,
even though that fragment is missing its own wrapper ([13g](13g-the-project-level-cli-block.md)).

```json
{
  "version": 1,
  "cli": { "schematicCollections": ["@angular/material"] },
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/cdk"] }
    }
  }
}
```

Which of those two applies depends on the working directory, exactly as it does for every other
`cli` setting — [13f](13f-two-levels-of-cli.md) for the precedence rule and
[14](14-multi-project-workspaces.md) for the resolution algorithm.

## ⚠️ What the sources do not say

The key is an **ordered array** in JSON, but **neither the schema nor the published option table
states how the CLI searches across multiple collections** — whether the first match wins, whether
Angular's own collection is always consulted, or what happens when two collections declare a
schematic with the same name. No source read for this page settles it.

The practical response is to remove the ambiguity rather than to guess at it: when it matters, type
the fully qualified name, which is the same `package:name` form the `schematics` block uses and is
never ambiguous.

## It is never written by generation

The workspace template writes at most `packageManager` into the `cli` block
([13b](13b-where-the-cli-block-comes-from.md)), so `schematicCollections` in a repository was always
added afterwards — by a person, or by a package's own installation schematic. That matters when you
are auditing an unfamiliar workspace: an entry here is a deliberate change to how generator names
resolve, and it is worth knowing which package put it there.

## Gotchas

**★ Symptom: you added a package to `schematicCollections` and its generators still use Angular's
defaults.** Cause: the two keys do different jobs — this one decides which package a bare name is
searched in and changes no defaults whatsoever. Fix: add a `schematics` block for the schematic you
actually want to configure:

```json
{
  "version": 1,
  "cli": { "schematicCollections": ["@angular/material"] },
  "schematics": {
    "@angular/material:navigation": { "style": "scss" }
  },
  "projects": {}
}
```

**★ Symptom: after adding a collection, a bare `ng generate` name resolves to a generator you did not
expect.** Cause: more than one collection is now being searched, and the order in which they are
consulted is not documented by the schema or the option table. Fix: qualify the name rather than
depending on search order — the fully qualified form is unambiguous:

```bash
ng generate @schematics/angular:component checkout-form
ng generate @angular/material:navigation shell
```

**★ Symptom: `"schematicCollections": "@angular/material"` is rejected.** Cause: the key is an array
of package names, not a single string; there is no scalar shorthand. Fix:

```json
{ "cli": { "schematicCollections": ["@angular/material"] } }
```

**Symptom: `["@angular/material", "@angular/material"]` is flagged.** Cause: the array declares
`uniqueItems`, so a duplicate is a schema violation rather than a harmless repeat — and duplicates
typically arrive by merging two branches that each added the same collection. Fix: list each once:

```json
{ "cli": { "schematicCollections": ["@angular/material", "@angular/cdk"] } }
```

**Symptom: `schematicCollections` placed at the top level, outside `cli`, does nothing.** Cause: it
is a property of `cliOptions`, and the top level is `additionalProperties: false` with six permitted
keys — so at best it is a validation error and at worst it is inert. Fix: nest it:

```json
{
  "version": 1,
  "cli": { "schematicCollections": ["@angular/material"] },
  "projects": {}
}
```

**Symptom: you expected the key to change what `ng add` or `ng update` does.** Cause: the documented
scope is `ng generate`; the option table says so in the row itself. Fix: nothing here to change —
`ng add` takes the package name on the command line, and `ng update`'s migration behaviour is
[04](../04-ng-update-not-npm-install/README.md):

```json
{ "cli": { "schematicCollections": ["@angular/material"] } }
```

**Symptom: a project-level `schematicCollections` seems to apply only sometimes.** Cause: the
project-level `cli` block is selected by the working directory, so it applies when the CLI resolves
to that project and not otherwise. Fix: if the collection should always be searched, put it at the
workspace level:

```json
{
  "version": 1,
  "cli": { "schematicCollections": ["@angular/material"] },
  "projects": {
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

## Interview questions

**★ What is the difference between `cli.schematicCollections` and `schematics`?**
They answer different questions and neither substitutes for the other. `schematicCollections` is an
array of package names that decides which packages a bare generator name is searched in — it changes
*which schematic runs*. `schematics` is a map from a fully qualified `package:name` to an options
object, and it changes *what the options default to* once a schematic has been found. What makes the
confusion expensive is that using the wrong one produces no error at all: adding a package here when
you meant to set a default changes nothing about defaults, and adding a `schematics` block for a
package that is not being searched changes nothing at all.

**★ Two collections declare a schematic with the same name. Which one runs?**
The honest answer is that neither the workspace schema nor angular.dev's option table states the
search order, and no source read for this page settles it — so it is not something to assert from
memory. The engineering answer is that you do not have to know: the fully qualified
`package:name` form is accepted on the command line and in the `schematics` block, so naming the
collection explicitly removes the ambiguity. When a repository has more than one collection
configured, qualifying names in scripts and documentation is cheap insurance.

**★ Where can `schematicCollections` live, and what does the schema's placement tell you?**
At the workspace level, as one of the five properties of `cliOptions`, and at the project level,
where it is the only key the project's inline `cli` fragment names. That second fact is a signal
worth reading: of everything in the `cli` block, this is the one the schema authors expected to vary
per project — which makes sense, since different applications in one workspace legitimately generate
from different component libraries. Everything else in the block is workspace-wide by nature.

**If a workspace has an entry in `schematicCollections`, what do you know about how it got there?**
That it was not generation. The workspace template writes at most `packageManager` into the `cli`
block, so any `schematicCollections` entry was added deliberately — by a developer, or by a
package's own installation schematic when it was added to the project. When auditing an unfamiliar
workspace this is useful: the entry is a deliberate change to how generator names resolve, and
finding out which package introduced it usually explains a set of generated files that do not look
like Angular's own.

**Which symptom points at this key rather than at `schematics`?**
"The wrong generator ran", or "the CLI cannot find that generator". Both are about *resolution* —
which package a name was looked up in — and that is this key's job. "My defaults are ignored" is the
other key's symptom, because defaults are applied after a schematic has already been found. Keeping
the two symptoms apart is what stops a debugging session from editing the wrong block for twenty
minutes, since neither key complains when it is not the one at fault.

{/* FOOTER */}
