---
title: "`ng update` is not a faster `npm install` — it runs code that rewrites your source, one major at a time, and the rule that you cannot skip a major is enforced by a guard in the CLI rather than by convention"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — [angular.dev/update-guide](https://angular.dev/update-guide), [angular.dev/reference/releases](https://angular.dev/reference/releases), and `angular/angular-cli` at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every other package manager command in your project moves files around. `ng update` runs
programs — *schematics* — that open your TypeScript and rewrite it.** That is the whole difference,
and it is why the upgrade advice for Angular is not the upgrade advice for anything else in
`package.json`. The mistake this topic exists to prevent is the cheap-looking one: bumping the
version numbers by hand, or jumping two majors in a single command, and discovering months later
that the migrations that would have rewritten your source never ran and now cannot.

🔴 **The release cadence changed at v22, and most advice you will find online predates it.**
angular.dev now states *"A major release every 12 months"* and *"All major releases are typically
supported for 24 months"*, with an explicit callout that *"Until Angular v22, Angular had a 6-month
major release cycle."* Anything asserting the six-month rhythm — including earlier revisions of
this corpus, corrected on 2026-09-09 — is describing the old schedule.

## Chunks

🚧 **Being written.** Chunks land one at a time and every row below links to a page that exists;
planned chunks appear as plain text until they do, because a link to a page that does not exist
fails the build for the whole site.

| # | Chunk | Covers |
|---|---|---|
| 01 | **Why `npm install` is not an upgrade** *(not written yet)* | Schematics rewrite source; the version numbers are the least of it |
| 02 | **One major at a time** *(not written yet)* | 🔴 The guard that refuses a two-major jump, and `angularMajorCompatGuarantee` |
| 03 | **What `ng update` actually does, step by step** *(not written yet)* | The command's real sequence, start to finish |
| 04 | **The `ng-update` metadata contract** *(not written yet)* | How a package declares its own migrations |
| 05 | **The peer-dependency gate** *(not written yet)* | What blocks an update before any migration runs |
| 06 | **Required and optional migrations** *(not written yet)* | The two kinds, and why the optional ones are the ones that rot |
| 07 | **The v22 migration inventory** *(not written yet)* | Both v22 collections, in full |

## Where this sits

This is the first of the toolchain topics in Phase 0. The three before it explain what Angular
*is* — a compiler ([01](../01-compiler-with-a-framework-attached/README.md)), an application
without modules ([02](../02-standalone-by-default/README.md)), and the array that wires it
([03](../03-the-provider-array/README.md)). This one and the eight after it explain the machinery
around that: the build, the config, the TypeScript setup, and the release train you are on whether
or not you chose it.

⚠️ **The deep `ng update` mechanics belong to Phase 15**, where the tooling topics live at Master
tier. This topic is Understand: enough to upgrade correctly and to know what went wrong when an
upgrade did not.

---

← Prev topic: [03 · The provider array is the wiring](../03-the-provider-array/README.md) · Index: [Phase 0](../README.md) · Next topic → **05 · The build: `@angular/build`** *(not written yet)*
