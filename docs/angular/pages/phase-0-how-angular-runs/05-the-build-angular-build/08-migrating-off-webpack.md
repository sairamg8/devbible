---
title: "There are three ways off the webpack builders — one command, one builder-string swap, and one full manual conversion — and they are not three amounts of the same work but three different destinations"
sidebar_label: "08 · Migrating off webpack"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)
> (every quoted list below is verbatim from that page), cross-checked against
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular gives you three migration paths off webpack, and choosing between them is most of the
job.** The automated migration converts you to the `application` builder and rewrites the config,
the SSR bootstrapping and the stylesheet syntax for you. Swapping the builder string to
`browser-esbuild` is a one-word change that keeps every existing option working. Converting to
`application` by hand means applying a rename list — which is [08b · The option renames](08b-the-option-renames.md).
This page is about which of the three you should be doing, and what the automated one actually
touches when you let it.

## The automated path

> *"Starting with v18, the update process will ask if you would like to migrate existing
> applications to use the new build system via the automated migration."*
>
> *"When updating to Angular v18 via `ng update`, you will be asked to execute the migration. This
> migration is entirely optional for v18 and can also be run manually at anytime after an update
> via the following command:"*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

```bash
ng update @angular/cli --name use-application-builder
```

That is the same migration described in
[04 · 07 The v22 migration inventory](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md) —
`optional: true`, `recommended: true`, so its checkbox arrives pre-ticked during an upgrade you
started for some other reason. 🔴 **Which also means a CI upgrade never runs it**, because optional
migrations need a prompt and CI has no terminal.

**What it changes**, verbatim, and this is the best available answer to *"what will this do to my
repo?"*:

> *"- Converts existing `browser` or `browser-esbuild` target to `application`*
> *- Removes any previous SSR builders (because `application` does that now).*
> *- Updates configuration accordingly.*
> *- Merges `tsconfig.server.json` with `tsconfig.app.json` and adds the TypeScript option
>   `"esModuleInterop": true` to ensure `express` imports are ESM compliant.*
> *- Updates application server code to use new bootstrapping and output directory structure.*
> *- Removes any webpack-specific builder stylesheet usage such as the tilde or caret in
>   `@import`/`url()` and updates the configuration to provide equivalent behavior*
> *- Converts to use the new lower dependency `@angular/build` Node.js package if no other
>   `@angular-devkit/build-angular` usage is found."*

Read the last line carefully: **the package swap is conditional.** If anything else in the
workspace still uses `@angular-devkit/build-angular` — one library project, one leftover `karma`
target — the migration leaves the heavier package in place. You get the new builder and keep the
webpack dependency tree.

And the caveat the page itself puts on the whole thing:

> *"While many changes can be automated and most applications will not require any further changes,
> each application is unique and there may be some manual changes required. After the migration,
> please attempt a build of the application as there could be new errors that will require
> adjustments within the code."*

## The two manual paths, and how to choose

> *"- The `browser-esbuild` builder builds only the client-side bundle of an application designed to
> be compatible with the existing `browser` builder that provides the preexisting build system.
> This builder provides equivalent build options, and in many cases, it serves as a drop-in
> replacement for existing `browser` applications.*
> *- The `application` builder covers an entire application, such as the client-side bundle, as well
> as optionally building a server for server-side rendering and performing build-time prerendering
> of static pages."*

The recommendation, and its honest hedge:

> *"The `application` builder is generally preferred as it improves server-side rendered (SSR)
> builds, and makes it easier for client-side rendered projects to adopt SSR in the future. However
> it requires a little more migration effort, particularly for existing SSR applications if
> performed manually. If the `application` builder is difficult for your project to adopt,
> `browser-esbuild` can be an easier solution which gives most of the build performance benefits
> with fewer breaking changes."*

For `browser-esbuild` the whole procedure is one line:

> *"Changing the `builder` field is the only change you will need to make."*

```json
{
  "targets": {
    "build": {
      "builder": "@angular-devkit/build-angular:browser-esbuild"
    }
  }
}
```

⚠️ **`browser-esbuild` is itself deprecated.** It buys you esbuild's build performance without the
option churn, and it does so from inside the package v22.0.0 deprecated. Treat it as a staging post
with a decision attached, not a destination — the details are
[07 · The webpack builders are deprecated](07-the-webpack-builders-are-deprecated.md).

## Gotchas

**★ Symptom: the migration ran and your `package.json` still has `@angular-devkit/build-angular`.**
Cause: the package swap is conditional — *"if no other `@angular-devkit/build-angular` usage is
found"* — and one leftover target anywhere in the workspace blocks it. Fix: find the holdout, then
remove the dependency by hand:

```bash
grep -rn 'build-angular' angular.json
```

**★ Symptom: your CI upgrade never offered the migration.** Cause: `use-application-builder` is an
optional migration, and optional migrations require a prompt. Fix: run it as an explicit pipeline
step — it is safe to run at any time after the update, and `--name` implies `--migrate-only`:

```bash
ng update @angular/cli --name use-application-builder
```

**★ Symptom: you took the `browser-esbuild` path and consider the migration finished.** Cause:
`browser-esbuild` lives in `@angular-devkit/build-angular`, the package v22.0.0 deprecated — you
have changed bundler without leaving the deprecated package. Fix: treat it as a staging post with a
decision attached, and record the follow-up rather than letting it become permanent:

```bash
node -p "require('./angular.json').projects['my-app'].targets.build.builder"
```

**★ Symptom: the automated migration reported success and the build now fails.** Cause: expected and
documented — *"there may be some manual changes required. After the migration, please attempt a
build of the application as there could be new errors."* Fix: build immediately after migrating,
while the change is still one reviewable commit:

```bash
ng update @angular/cli --name use-application-builder && ng build
```

## Interview questions

**★ What are the ways off the webpack `browser` builder, and how do you choose between them?**
Three. The automated migration, `ng update @angular/cli --name use-application-builder`, converts
you to `application` and rewrites the configuration, SSR bootstrapping and stylesheet syntax for
you. Swapping the builder string to `browser-esbuild` is described by the docs as a drop-in —
*"Changing the `builder` field is the only change you will need to make"* — and gives you esbuild's
performance with essentially no option churn. Converting to `application` by hand means applying an
eight-item rename list. The choice is really about SSR: `application` covers the client bundle, the
server and build-time prerendering in one builder, which is why it is preferred, and it is also why
it is the harder manual migration for an app that already server-renders. `browser-esbuild` is the
pragmatic answer for a project that cannot absorb that now — with the caveat that it lives in the
deprecated package.

**★ Why might the migration leave `@angular-devkit/build-angular` in your `package.json`?**
Because the package swap is conditional on nothing else in the workspace using it — the migration's
own description ends *"if no other `@angular-devkit/build-angular` usage is found"*. A single
remaining target, often a `karma` target or a second project, keeps the heavier package installed.
The result is a workspace that has the new builder and still carries the whole webpack dependency
tree, which is worth checking for explicitly because nothing reports it.

**Why is the automated migration optional rather than required?**
Because it changes the build system rather than fixing a correctness problem, and a project can run
correctly on the `browser` builder indefinitely. Making it optional is what lets a team upgrade
Angular without also absorbing a build migration on the same day. The cost of that choice is the one
worth naming: optional migrations need a prompt, so a pipeline upgrade never offers it, and a
project can sit several majors past a migration nothing ever brought up again.

---

← Prev: [What still ships, what was removed](07b-what-still-ships-and-what-was-removed.md) · Index: [Topic index](README.md) · Next → [The option renames](08b-the-option-renames.md)
