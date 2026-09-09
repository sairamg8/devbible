---
title: "v22.0.0 deprecated the webpack builders in three separate packages on the same day, and the release notes name no removal version — so the correct thing to say about the deadline is that there is not one"
sidebar_label: "07 · The webpack builders are deprecated"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the Deprecations block and its commit hashes
> are quoted verbatim from the `22.0.0 (2026-06-03)` section of
> [`CHANGELOG.md`](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md) at tag
> `v22.1.7`; the status statement from
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration);
> the surviving builder list from
> [`packages/angular_devkit/build_angular/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/builders.json)
> at the same tag. 🔴 **Deliberately unresolved on this page: when the deprecated builders are
> removed. The release notes do not state a version and this page does not guess one.**
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"Legacy" and "deprecated" are different words with different consequences, and on 2026-06-03 the
webpack builders crossed from one to the other in three packages at once.** Before v22 you could
reasonably describe `@angular-devkit/build-angular:browser` as the older path. Since v22.0.0 the
release notes describe it, `@angular-devkit/build-webpack`'s builders, and `@ngtools/webpack`'s
loader and plugin as deprecated in so many words. Nothing was removed, everything still works at
22.1.7, and 🔴 **no removal version is named anywhere** — which is itself the most
useful fact on this page, because it is the one people invent an answer to.

## The Deprecations block, verbatim

The `22.0.0 (2026-06-03)` section of the CLI changelog contains a `## Deprecations` block with four
`###` sub-sections. Here they are complete, each sentence quoted verbatim and attributed to the
package heading it appeared under:

| Package | The deprecation, verbatim |
|---|---|
| `@angular-devkit/build-angular` | *"Webpack builders in build-angular are deprecated. Use @angular/build builders instead."* |
| `@angular-devkit/build-webpack` | *"Webpack builders in build-webpack are deprecated. Use @angular/build builders instead."* |
| `@ngtools/webpack` | *"@ngtools/webpack loader and plugin are deprecated. Use @angular/build instead."* |
| `@angular/ssr` | *"CommonEngine APIs are deprecated in favor of AngularNodeAppEngine or AngularAppEngine."* |

Three of the four are the webpack build path. The commits behind them, from the same section:

| Commit | Message, verbatim |
|---|---|
| `b7940dbcb` | *"refactor \| deprecate Webpack builders"* |
| `3d5daa45e` | *"refactor \| deprecate webpack and webpack-dev-server builders"* |
| `547ca515b` | *"refactor \| deprecate @ngtools/webpack loader and plugin"* |
| `50b16a65b` | *"refactor \| deprecate CommonEngine APIs"* |

**Four commits, one release.** That is the shape of a decision, not a drift — the team deprecated
the builder facade, the webpack-devkit builders underneath it, and the compiler's webpack
integration in a single pass.

⚠️ The `@angular/ssr` entry is about server-rendering APIs rather than about building, and it is
listed here only because it is part of the same block. `CommonEngine`, `AngularNodeAppEngine` and
`AngularAppEngine` belong to the server-rendering material, not to this topic.

## What the migration guide says about status

angular.dev states the position directly, and the wording repays attention:

> *"IMPORTANT: The existing webpack-based build system and `browser` builder are deprecated.
> Applications can temporarily continue to use the `browser` builder and projects can opt-out of
> migrating during an update, but the Angular team recommends migrating to the new build system."*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

Three things are in that paragraph and all three matter.

**"deprecated"**, not "legacy" and not "removed". The word is chosen and it is the same word the
changelog uses.

**"temporarily"** is the strongest scheduling language available anywhere, and it is not a date.
This is the sentence people read as a deadline; it is not one.

**"projects can opt-out of migrating during an update"** — the migration is offered, not applied.
That is why a v21 to v22 update can complete successfully and leave `angular.json` still naming a
deprecated builder, which surprises teams who assume `ng update` fixes what it warns about.

For new work the guide is equally direct:

> *"For new applications*
> *New applications will use this new build system by default via the `application` builder."*

## 🔴 When are they removed? The release notes do not say

No removal version is published. The v22.0.0 changelog deprecates the builders in
three packages and **names no target version for their removal**. The migration guide's *"temporarily
continue"* is the strongest statement available and it is not a schedule. There is no
deprecation-timeline document for CLI builders analogous to the framework's own deprecation guide.

**So the honest sentence, and the one to use: deprecated in v22; the release notes do not state a
removal version.**

Do not predict v23. Do not predict v24. Do not say "the next major" or "probably one or two
releases". A confident guess here is worse than no answer, because a team will plan a quarter around
it — and the observable pattern in this release is the opposite of aggressive: the builders were
deprecated and *left in place*, with the alias, the schema entries and the whole webpack dependency
tree still shipping in 22.1.7.

What you *can* say with evidence is what the deprecation means for planning: the path is closed
going forward, the migration is a single named migration rather than a rewrite, and the cost of
moving will not get lower by waiting. That is an argument for migrating on your own schedule rather
than a scramble against someone else's.

## Deprecated does not mean broken, and the evidence is in the package

At `v22.1.7`, every deprecated builder is still declared, still resolvable and still documented:

- `@angular-devkit/build-angular`'s own `builders.json` still declares `app-shell`, `browser`,
  `browser-esbuild`, `dev-server`, `extract-i18n`, `karma`, `server`, `ng-packagr`,
  `ssr-dev-server` and `prerender`.
- The workspace schema still enumerates the legacy builder strings by name, so a `angular.json`
  naming one still gets its real option schema rather than loose typing.
- angular.dev's build page still lists `@angular-devkit/build-angular:browser` and
  `browser-esbuild` in its table of builders a `build` target can name — **without a deprecation
  marker**.

That last point is worth holding on to: the documentation page most people read about builders does
not mention the deprecation at all. The full inventory of what still ships, and the one-line alias
that makes the legacy package look identical to the new one, is
[07b](07b-what-still-ships-and-what-was-removed.md).

## How to tell whether this is about you

Three checks, in order of how much they tell you.

```bash
# 1. Which builder does each target actually name?
grep -n '"builder"' angular.json
```

```bash
# 2. Is the deprecated package a dependency at all?
node -p "require('./package.json').devDependencies['@angular-devkit/build-angular'] ?? '(absent)'"
```

```bash
# 3. Is anything reaching @ngtools/webpack — a custom webpack setup, or a third-party builder?
node -p "Object.keys(require('./package.json').devDependencies).join('\n')"
```

Check 1 is the one that decides. A project whose `build` target says `@angular/build:application`
has already moved, whatever is still installed. A project whose target says
`@angular-devkit/build-angular:browser` is on the deprecated path regardless of what its
`package.json` looks like.

Check 3 matters because `@ngtools/webpack` is the loader and plugin that a webpack-based Angular
build is assembled from — so a project using a third-party builder that wraps webpack may be
depending on a deprecated package without naming any `@angular-devkit/build-angular` builder at all.
Whether a specific third-party builder does that is a question for that builder's own
documentation, not something to assume.

## Gotchas

**★ Symptom: `ng update` completed successfully and `angular.json` still names
`@angular-devkit/build-angular`.** Cause: the builder migration is opt-in — *"projects can opt-out
of migrating during an update"*. A clean update and an unmigrated builder are not in conflict. Fix:
run the named migration deliberately, which topic 04 covers in
[the v22 migration inventory](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md):

```bash
ng update @angular/cli --name use-application-builder
```

**★ Symptom: nothing in your build output or your documentation reading tells you the builder is
deprecated.** Cause: the deprecation is recorded in the changelog, and angular.dev's build page
still lists the webpack builders in its table without a deprecation marker. Fix: do not wait to be
told — check the target string against the list above, and check the changelog of the major you are
on:

```bash
grep -n '"builder"' angular.json
```

**★ Symptom: someone asks when the webpack builders will be removed and you need an answer for a
planning document.** Cause: there isn't one. The release notes deprecate without naming a removal
version, and *"temporarily"* is the strongest scheduling word available. Fix: write the accurate
sentence — *"deprecated in v22; the release notes do not state a removal version"* — and plan the
migration on the project's own schedule, on the grounds that the cost will not fall by waiting.

**★ Symptom: you removed `@angular-devkit/build-angular` from `package.json` to "clean up" and the
build stopped resolving its builder.** Cause: a target still names a builder from that package, and
the builder string is resolved by package lookup at run time. Removing the package removes the
builder. Fix: migrate the target first, then remove the dependency — in that order, and verify with
the target string rather than with a successful install:

```bash
grep -n '"builder"' angular.json
```

**★ Symptom: a project uses a custom webpack configuration through a third-party builder and none of
the `@angular-devkit/build-angular` deprecations look relevant.** Cause: the third deprecation —
*"@ngtools/webpack loader and plugin are deprecated"* — reaches anything assembled from Angular's
webpack integration, whoever wrapped it. Fix: read that builder's own documentation for its plan;
what it depends on is not something to infer. Start by listing what is actually installed:

```bash
node -p "Object.keys(require('./package.json').devDependencies).join('\n')"
```

**Symptom: a colleague insists the builders are "legacy but fine" and a v22 release note says
otherwise.** Cause: both statements were true at different times — "legacy" described the position
before v22.0.0, and the changelog moved it to "deprecated" on 2026-06-03. Fix: cite the changelog
line rather than arguing about vocabulary; *"Webpack builders in build-angular are deprecated. Use
@angular/build builders instead."* ends the discussion.

**Symptom: an SSR project sees a `CommonEngine` deprecation and assumes it is part of the builder
deprecation.** Cause: it is a fourth, separate entry in the same v22.0.0 Deprecations block —
*"CommonEngine APIs are deprecated in favor of AngularNodeAppEngine or AngularAppEngine."* It is
about server-rendering APIs, not about which builder you use. Fix: treat them as two migrations that
happen to have been announced together, and do not expect the builder migration to resolve the
`CommonEngine` one.

## Interview questions

**★ What changed for the webpack builders in Angular 22, exactly?**
They were formally deprecated, in three packages, in one release. The v22.0.0 changelog's
Deprecations block says *"Webpack builders in build-angular are deprecated. Use @angular/build
builders instead."*, the same for `@angular-devkit/build-webpack`, and *"@ngtools/webpack loader and
plugin are deprecated. Use @angular/build instead."* Four commits landed it. Nothing was removed —
every one of those builders still ships and still works at 22.1.7 — so the change is one of status
and intent rather than of capability. The precision matters because "legacy" and "deprecated" lead
to different decisions: the first is a preference, the second is a published position you can plan
against.

**★ When will the webpack builders be removed?**
The release notes do not state a removal version, and none could be found. The changelog deprecates
them without naming a target release, and the migration guide's strongest scheduling language is
*"Applications can temporarily continue to use the `browser` builder"* — which is a word, not a date.
There is no deprecation-timeline document for CLI builders equivalent to the framework's own. The
correct answer is therefore "deprecated in v22, with no stated removal version", and the correct
follow-up is that the absence of a date is not a reason to defer: the migration is a single named
migration today and will not get cheaper.

**★ Why can `ng update` finish cleanly and leave a project on a deprecated builder?**
Because the builder migration is optional by design — angular.dev says *"projects can opt-out of
migrating during an update"*. It is presented during the update rather than applied silently,
because it can require manual follow-up in applications with unusual configurations, and forcing it
would break updates for exactly the projects least able to absorb the change. The practical
consequence is that a green `ng update` tells you nothing about your builder; the only thing that
does is reading the `builder` string in `angular.json`.

**★ How would you tell whether a project you have just been handed is affected?**
Read the `builder` string on every target — `grep -n '"builder"' angular.json` — because that, not
the dependency list, decides which code runs. A project can have `@angular-devkit/build-angular`
installed and use none of its builders, or use one of its builders while most of the workspace has
moved. Then check `package.json` for `@ngtools/webpack`, directly or through a third-party builder
that wraps webpack, because the third deprecation covers that path too and it is easy to miss when
no `@angular-devkit/build-angular` builder is named anywhere.

**Why is "the deprecation isn't in the documentation I read" a recurring complaint here?**
Because it is accurate. angular.dev's build page still lists `@angular-devkit/build-angular:browser`
and `browser-esbuild` in its table of builders a `build` target can name, with no deprecation
marker; the deprecation lives in the changelog and in the migration guide. Someone reading the page
that is *about builders* will not learn it. That is worth internalising as a general habit rather
than a complaint: for status changes — deprecations, removals, default flips — the changelog of the
major release is the primary source, and the reference pages catch up afterwards.

{/* FOOTER */}
