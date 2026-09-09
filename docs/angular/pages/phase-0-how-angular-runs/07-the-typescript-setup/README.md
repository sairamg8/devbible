---
title: "Angular's TypeScript pin is enforced twice by two independent mechanisms, and the one people silence with `--force` is the one that did not matter — the compiler re-checks the version from inside its own constructor on every build"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** and **TypeScript peer `>=6.0 <6.1`** — the
> `peerDependencies` of `@angular/compiler-cli` and `@angular/build` on
> `registry.npmjs.org`, and
> [`packages/compiler-cli/src/typescript_support.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/typescript_support.ts)
> at tag `v22.1.5`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular is the rare framework that pins its compiler dependency to a single TypeScript minor, and
the reason that pin holds is not the one most people assume.** `>=6.0 <6.1` looks like a packaging
constraint — an npm peer warning, silenced with `--force` or `--legacy-peer-deps` and forgotten.
It is enforced a second time, by the Angular compiler itself, from inside `NgtscProgram`'s
constructor, on **every compilation**.

🔴 **The asymmetry is the whole topic.** The install-time check can be silenced by exactly the flags
people reach for when a peer conflict blocks them. The compile-time check cannot. So a developer who
"fixed" the peer conflict has not fixed anything — they have moved the error from `npm install`,
where it names the problem, to `ng build`, where it does not.

| | `peerDependencies` | The in-compiler check |
|---|---|---|
| Fires at | **install time** | **every compilation** |
| Enforced by | npm / yarn / pnpm | Angular itself, unconditionally |
| Failure | `ERESOLVE`, a warning, or nothing | a thrown `Error` that fails the build |
| Escape hatch | `--legacy-peer-deps`, `--force`, `resolutions` | `angularCompilerOptions.disableTypeScriptVersionCheck` |

⚠️ **Topic [01](../01-compiler-with-a-framework-attached/README.md) already owns some of this
ground at Master tier** — the pin itself and `strictTemplates` are covered there as compiler
concerns. This topic is the *setup*: the files, the inheritance, and what each option switches on.
Where they meet, this topic links rather than re-argues.

## Chunks

Thirty pages across nine concepts. Every concept that outgrew the 300-line cap split on a
concept boundary into lettered siblings.

| # | Chunk |
|---|---|
| 01 | **[The TypeScript peer pin](01-the-typescript-peer-pin.md)** |
| 01b | [The check inside the compiler](01b-the-check-inside-the-compiler.md) |
| 02 | **[Why the pin is one minor wide](02-why-the-pin-is-one-minor-wide.md)** |
| 03 | **[The three tsconfig files](03-the-three-tsconfig-files.md)** |
| 03b | [The app and spec configs](03b-the-app-and-spec-configs.md) |
| 03c | [The solution root and references](03c-the-solution-root-and-project-references.md) |
| 04 | **[angularCompilerOptions inheritance](04-angularcompileroptions-and-how-it-inherits.md)** |
| 04b | [Reading the merge](04b-reading-the-merge.md) |
| 04c | [What the shallow merge costs](04c-what-the-shallow-merge-costs.md) |
| 04d | [The second implementation](04d-the-second-implementation.md) |
| 05 | **[strictTemplates is the default](05-stricttemplates-is-the-default-in-v22.md)** |
| 05b | [What the CLI writes](05b-what-the-cli-writes-and-does-not-write.md) |
| 05c | [What the upgrade wrote](05c-what-the-upgrade-wrote-into-your-file.md) |
| 05d | [The opt-out is a dated TODO](05d-the-opt-out-is-a-dated-todo.md) |
| 05e | [The three guards](05e-the-three-guards.md) |
| 06 | **[What strictTemplates switches on](06-what-stricttemplates-switches-on.md)** |
| 06b | [The two branches](06b-the-two-branches.md) |
| 06c | [The override layer](06c-the-override-layer.md) |
| 06d | [The options outside the switch](06d-the-options-outside-the-switch.md) |
| 07 | **[What strictTemplates rejects](07-what-stricttemplates-rejects.md)** |
| 07b | [The $event.target rejection](07b-the-dollar-event-target-rejection.md) |
| 07c | [The escape hatches are ranked](07c-the-escape-hatches-are-ranked.md) |
| 07d | [The other rejection classes](07d-the-other-rejection-classes.md) |
| 07e | [Where the opt-out goes](07e-where-the-opt-out-goes.md) |
| 08 | **[The other angularCompilerOptions](08-the-other-angular-compiler-options.md)** |
| 08b | [The options you add yourself](08b-the-options-you-add-yourself.md) |
| 08c | [Configuring extended diagnostics](08c-configuring-extended-diagnostics.md) |
| 08d | […and the upgrade](08d-extended-diagnostics-and-the-upgrade.md) |
| 09 | **[TypeScript 6 defaults](09-typescript-6-defaults-and-what-ng-new-writes.md)** |
| 09b | [The generated compilerOptions](09b-the-generated-compileroptions-line-by-line.md) |

## Where this sits

[05](../05-the-build-angular-build/README.md) explained the build system and
[06](../06-angular-json-anatomy/README.md) the file that configures it. This topic covers the
compiler settings both of them depend on — the `tsConfig` that every build target names.

## Phase gate

You are done with this topic when you can explain why a peer-dependency override does not make a
TypeScript version work, say which file an `angularCompilerOptions` key belongs in and what inherits
it, and decide — with reasons — whether to keep the `strictTemplates: false` an upgrade wrote into
your project.

---

← Prev: [06 · `angular.json` anatomy](../06-angular-json-anatomy/README.md) · Index: [Phase 0](../README.md) · Start → [01 · The TypeScript peer pin](01-the-typescript-peer-pin.md) · Next topic → **08 · What `ng new` produces in v22** *(not written yet)*
