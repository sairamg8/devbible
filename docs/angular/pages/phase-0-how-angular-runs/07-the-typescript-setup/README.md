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

🚧 **Being written.** Chunks land one at a time and every row below links to a page that exists;
planned chunks appear as plain text until they do, because a link to a page that does not exist
fails the build for the whole site.

| # | Chunk | Covers |
|---|---|---|
| 01 | **The TypeScript peer pin** *(not written yet)* | 🔴 Two mechanisms, two failure surfaces, one escape hatch that works |
| 02 | **Why the pin is one minor wide** *(not written yet)* | What Angular depends on that moves between TypeScript minors |
| 03 | **The three `tsconfig` files** *(not written yet)* | The base, the app, the spec — and what each is for |
| 04 | **`angularCompilerOptions` and how it inherits** *(not written yet)* | The inheritance rule that is not TypeScript's |
| 05 | **`strictTemplates` is the default in v22** *(not written yet)* | 🔴 And a migration writes `false` into your file to keep you building |
| 06 | **What `strictTemplates` actually switches on** *(not written yet)* | The individual flags it is shorthand for |
| 07 | **What `strictTemplates` rejects** *(not written yet)* | The errors, and which are worth suppressing |
| 08 | **The other `angularCompilerOptions`** *(not written yet)* | The rest of the surface, option by option |
| 09 | **TypeScript 6 defaults and the generated options** *(not written yet)* | What `ng new` writes and what it no longer needs to |

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

← Prev: [06 · `angular.json` anatomy](../06-angular-json-anatomy/README.md) · Index: [Phase 0](../README.md) · Next topic → **08 · What `ng new` produces in v22** *(not written yet)*
