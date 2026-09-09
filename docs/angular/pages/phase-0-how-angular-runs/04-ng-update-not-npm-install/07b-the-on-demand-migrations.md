---
title: "The second, larger family of migrations is not triggered by a version at all — fifteen generators you run by name, whenever you decide, and every one of them is best-effort by design"
sidebar_label: "07b · The on-demand migrations"
sidebar_position: 7.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** —
> [`packages/core/schematics/collection.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/collection.json)
> at tag `v22.1.5`, with names, aliases and descriptions quoted exactly and the `factory` / `schema`
> keys elided for width; and the `22.1.0 (2026-07-29)` migrations section of
> [CHANGELOG.md](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md).
> Documentation-validated; **no sandbox run**. ⚠️ **[angular.dev/reference/migrations](https://angular.dev/reference/migrations)
> is client-rendered and could not be enumerated** — the `collection.json` above is the authority
> for this list, and the doc page is cited as *where a reader finds it with prose*, not as the
> source of the fifteen.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Everything in [07](07-the-v22-migration-inventory.md) is triggered by a version change. This
family is not triggered by anything.** These are generators — you run them by name with
`ng generate`, on the day you decide to adopt something, against a project already on whatever
version it is on. Nothing offers them, nothing tracks whether you have run them, and no upgrade
will ever bring them up. They are how a large codebase moves to standalone, to signals, to the
built-in control flow: not as part of an upgrade, but as a piece of scheduled work.

## The whole collection

Invocation is `ng generate @angular/core:<name>`, and any alias works in place of the name.

| Name | Aliases | Description (verbatim) |
|---|---|---|
| `standalone-migration` | `standalone` | *"Converts the entire application or a part of it to standalone"* |
| `inject-migration` | `inject` | *"Converts usages of constructor-based injection to the inject() function"* |
| `route-lazy-loading-migration` | `route-lazy-loading` | *"Updates route definitions to use lazy-loading of components instead of eagerly referencing them"* |
| `signal-input-migration` | `signal-inputs`, `signal-input` | *"Updates `@Input` declarations to signal inputs, while also migrating all relevant references."* |
| `signal-queries-migration` | `signal-queries`, `signal-query`, `signal-query-migration` | *"Updates query declarations to signal queries, while also migrating all relevant references."* |
| `output-migration` | `outputs` | *"Updates @output declarations to the functional equivalent, while also migrating all relevant references."* |
| `signals` | — | *"Combines all signals-related migrations into a single migration"* |
| `cleanup-unused-imports` | — | *"Removes unused imports from standalone components."* |
| `self-closing-tags-migration` | `self-closing-tag` | *"Updates the components templates to use self-closing tags where possible"* |
| `common-to-standalone-migration` | `common-to-standalone` | *"Replaces CommonModule with individual imports from @angular/common"* |
| `control-flow-migration` | `control-flow` | *"Converts the entire application to block control flow syntax"* |
| `ngclass-to-class-migration` | `ngclass-to-class` | *"Updates usages of `ngClass` directives to the `class` bindings where possible"* |
| `ngstyle-to-style-migration` | `ngstyle-to-style` | *"Updates usages of `ngStyle` directives to the `style` bindings where possible"* |
| `router-testing-module-migration` | — | *"Replaces deprecated RouterTestingModule with provideRouter() as recommended in the deprecation note"* |
| `service-migration` | `service` | *"Converts @Injectable to @Service where applicable"* |

```bash
ng generate @angular/core:control-flow      # by name
ng generate @angular/core:control-flow-migration
ng generate @angular/core:signals           # runs the signals family together
```

🔴 **`service-migration` is new in 22.1.** The CHANGELOG entry, verbatim, under
`22.1.0 (2026-07-29)` → migrations: *"feat | add migration from injectable to service"*. It converts
`@Injectable` to `@Service` where applicable. ⚠️ **`@Service` itself is Phase 6 material** — this
page names the migration and stops there.

## "where possible" is in four of the descriptions, and it is the point

`self-closing-tags-migration`, `ngclass-to-class-migration`, `ngstyle-to-style-migration` and
`service-migration` all qualify themselves with *where possible* or *where applicable*. That is not
hedging in the docs — it is the contract. These are static transformations over TypeScript and
template ASTs, and there are always constructs they cannot prove safe to rewrite: a `ngClass` bound
to an expression whose type they cannot narrow, a component referenced through a variable, an
injectable used in a way the migration does not model.

**So the workflow for every one of these is: run it, read the diff, finish the rest by hand.** A
generator that silently leaves a residue is behaving correctly; one that transformed everything
would be the one to distrust.

The corollary is that running one is not a decision you can make lazily on a big codebase. Run it on
a branch, with a clean tree, and review it as you would any large refactor:

```bash
git status --porcelain                                # clean, or the diff is unreadable
ng generate @angular/core:control-flow
git diff --stat
```

## Where the two families meet, and where they do not

| | Automatic ([07](07-the-v22-migration-inventory.md)) | On-demand (this page) |
|---|---|---|
| Lives in | `migrations.json` / `migration-collection.json` | `collection.json` |
| Triggered by | a version range during `ng update` | you, by name |
| Selected by | `version` + `optional` | nothing — you asked for it |
| Skipped in CI? | only the optional ones | not applicable; nothing offers them |
| Re-runnable | via `--name` | always |

They share an implementation directory, which is the source of a common miscount:
`packages/core/schematics/migrations/` on disk holds twelve directories and corresponds to **neither
list** — it is where the code lives for entries in both collections. The two `.json` files are the
authority for what exists; the directory listing is not a third inventory.

Two of the generators on this page have their own dedicated coverage elsewhere in Phase 0, and are
deliberately not re-argued here — `standalone-migration` and its modes are
[02 · 09 The standalone migration schematic](../02-standalone-by-default/09-the-standalone-migration-schematic.md).

## Gotchas

**★ Symptom: `ng generate @angular/core:signals` left several files untouched.** Cause: the
signals-family migrations are best-effort — they migrate the declarations and references they can
prove, and skip what they cannot. Fix: expected. Run it, review the diff, and finish the remainder
by hand; a residue is the migration being honest, not failing.

**★ Symptom: you waited for `ng update` to offer the control-flow migration and it never did.**
Cause: it is not in either automatic collection — it is an `ng generate` generator with no `version`
field and no trigger. Fix: nothing will ever offer it. Schedule it:

```bash
ng generate @angular/core:control-flow
```

**★ Symptom: `ng generate @angular/core:signal-inputs` is not found, but `signal-input-migration`
is.** Cause: several entries carry multiple aliases and it is easy to half-remember one. Fix: the
canonical names and every alias are in the table above; when in doubt, read the collection straight
out of `node_modules`:

```bash
node -p "Object.keys(require('@angular/core/schematics/collection.json').schematics).join('\n')"
```

**★ Symptom: a large control-flow or standalone migration produced an unreviewable diff.** Cause:
these transform the entire application by default. Fix: `standalone-migration` accepts a path so it
can be run a directory at a time — its modes are documented in
[02 · 09](../02-standalone-by-default/09-the-standalone-migration-schematic.md) — and every one of
them should be run against a clean tree on its own branch so the diff is exactly the migration.

**★ Symptom: you ran a generator, the result was wrong, and the change is tangled with other
work.** Cause: a dirty tree at the time you ran it. Fix: there is no `--create-commits` for
`ng generate`, so the clean tree *is* the isolation mechanism. Commit or stash first; then
`git checkout .` is a complete undo.

**★ Symptom: the team believes the migrations page on angular.dev is the full list, and it shows
three entries.** Cause: that page is client-rendered; a prerendered fetch surfaces only a few of
them. Fix: read the collection, not the page — this corpus could not enumerate the page and treats
`collection.json` as the authority for exactly that reason.

**★ Symptom: `ngstyle-to-style-migration` rewrote some bindings and left others.** Cause: the
description's *"where possible"* — a `ngStyle` bound to an object whose shape the migration cannot
narrow has no provably equivalent `style` binding. Fix: convert the remainder by hand, and treat the
ones it declined as the interesting cases rather than as failures.

## Interview questions

**★ Name the two kinds of Angular migration and how you invoke each.**
Version-triggered migrations live in a package's migration collection — `migrations.json` for
`@angular/core`, `migration-collection.json` for the CLI — carry a `version`, and are run by
`ng update` when that version falls in the range being applied. On-demand migrations live in the
`ng generate` collection, carry no version, and are run by name at any time with
`ng generate @angular/core:<name>`. The distinction matters operationally: the first family is what
an upgrade does to you, the second is work you schedule. Nothing will ever prompt you about the
second, so a codebase can sit five majors past a migration that was available the whole time.

**★ Why are so many of these described as working "where possible"?**
Because they are static transformations over an AST and there are always constructs whose safety
they cannot prove — a directive bound to an expression they cannot narrow, a component referenced
indirectly, an injectable used in a pattern the migration does not model. Leaving those alone is the
correct behaviour; a migration that rewrote everything would be one that guessed. The practical
consequence is that the workflow is always run, review, finish by hand, and that a partial result is
success rather than failure.

**★ How would you move a large application to the built-in control flow?**
`ng generate @angular/core:control-flow`, on its own branch, against a clean working tree, then read
the diff. Nothing about `ng update` will ever bring it up, so it has to be scheduled deliberately.
For a codebase large enough that a whole-application diff is unreviewable, the pattern is the same
one `standalone-migration` supports explicitly: scope the run, review, commit, repeat — because
there is no `--create-commits` for `ng generate` and the clean tree is the only isolation you get.

**What is in `packages/core/schematics/migrations/` on disk, and why is it not a third list?**
It is the shared implementation directory holding the code for entries in both collections, so its
twelve directories match neither the eight automatic migrations nor the fifteen generators. It comes
up because it looks authoritative in a file listing. The two `.json` collections are what define
what exists; the directory only shows where some of it is implemented.

---

← Prev: [The v22 migration inventory](07-the-v22-migration-inventory.md) · Index: [Topic index](README.md) · Next topic → **05 · The build: `@angular/build`** *(not written yet)*
