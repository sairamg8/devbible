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

Twenty pages across seven concepts. Each concept that outgrew the 300-line cap split on a concept
boundary into lettered siblings; the numbering is the concept, the letter is the page.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Why `npm install` is not an upgrade](01-why-npm-install-is-not-an-upgrade.md)** | Schematics rewrite source; the version numbers are the least of it |
| 01b | [What a migration rewrites](01b-what-a-migration-rewrites.md) | What a schematic actually touches in your project |
| 01c | [The CLI's own collection](01c-the-clis-own-collection.md) | Why `@angular/cli` migrates separately from `@angular/core` |
| 01d | [A bare `ng update` is a report](01d-a-bare-ng-update-is-a-report.md) | 🔴 `everything seems to be in order` means "no `ng-update`-aware package is behind" |
| 02 | **[One major at a time](02-one-major-at-a-time.md)** | 🔴 The guard that refuses a two-major jump |
| 02b | [Running the ladder](02b-running-the-ladder.md) | The worked v20 → v22 climb, rung by rung |
| 02c | [How the CLI keeps its promise](02c-how-the-cli-keeps-its-own-promise.md) | `angularMajorCompatGuarantee` from the framework's side |
| 03 | **[What `ng update` actually does](03-what-ng-update-actually-does.md)** | The twelve steps, in the fixed order they run |
| 03b | [What it writes to `package.json`](03b-what-it-writes-to-your-project.md) | The dependency edits, and what they are computed from |
| 03c | [The install step](03c-the-install-step-and-the-rollback.md) | 🔴 The version moves before any migration runs — which is what recovery has to work around |
| 03d | [The option surface](03d-the-option-surface.md) | Ten flags; the four that `imply` and `conflict` are the whole recovery surface |
| 04 | **[The `ng-update` metadata contract](04-the-ng-update-metadata-contract.md)** | `packageGroup` in both published shapes, and the `0.MAJORMINOR.PATCH` devkit scheme |
| 04b | [Finding the migrations](04b-finding-the-migrations.md) | Four validation errors, two resolution shapes, and the private-registry fallback |
| 05 | **[The peer-dependency gate](05-the-peer-dependency-gate.md)** | 🔴 `angularMajorCompatGuarantee` is a CLI allowance, not a library's promise |
| 05b | [What else shapes the plan](05b-what-else-shapes-the-plan.md) | The `catalog:` refusal, deprecated versions installed anyway, `minReleaseAge` |
| 06 | **[Required and optional migrations](06-required-and-optional-migrations.md)** | 🔴 No TTY means every optional migration is skipped — CI and a laptop diverge silently |
| 06b | [Running one migration](06b-running-one-migration.md) | The four steps, and why step four is Prettier |
| 06c | [`--create-commits`](06c-create-commits.md) | 🔴 `git add -A` and `--no-verify`, which is why the clean tree is a precondition |
| 07 | **[The v22 migration inventory](07-the-v22-migration-inventory.md)** | Both collections complete; eleven of thirteen run without asking |
| 07b | [The on-demand migrations](07b-the-on-demand-migrations.md) | The fifteen `ng generate` generators nothing will ever offer you |

## Phase gate

You are done with this topic when you can take a project two majors behind, plan the climb, run each
rung, read the output well enough to say which of the twelve steps a failure happened in, recover
from a migration that died halfway without re-running the update, and say — before running anything
— which migrations a CI pipeline will skip and what you will do about them.

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

← Prev: [03 · The provider array is the wiring](../03-the-provider-array/README.md) · Index: [Phase 0](../README.md) · Start → [01 · Why `npm install` is not an upgrade](01-why-npm-install-is-not-an-upgrade.md) · Next topic → [05 · The build: `@angular/build`](../05-the-build-angular-build/README.md)
