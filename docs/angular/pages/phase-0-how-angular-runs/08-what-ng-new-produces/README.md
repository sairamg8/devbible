---
title: "None of the files `ng new` writes is an API — every one is the output of an EJS template a schematic chose to render, so the filenames, the folder layout and even the `.catch` are conventions a template author picked and you can change"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `ng-new`, `workspace` and `application`
> schematic directories of `angular/angular-cli` at tag `v22.1.7`, read from the repository tree.
> Documentation-validated; **no sandbox run** — every file described here is read from its
> `.template` source, not captured from a generated project.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The single most useful thing to know about a generated Angular project is that almost none of it
is required.** The framework's actual contracts are small: `bootstrapApplication`'s signature and
the `ApplicationConfig` shape. Everything else — where `main.ts` sits, that `app.config.ts` exists
at all, the `.catch` on the bootstrap call, the placeholder markup, the folder names — is a
**convention a template author picked**, rendered from an EJS template by a schematic. Knowing which
is which is the difference between adapting a project confidently and treating a scaffold as
scripture.

🔴 **`ng new` is not one schematic.** It runs `ng-new`, which runs `workspace` and then
`application` — three directories in the CLI repository, each owning a different part of the tree.
Knowing which file comes from which is the organising principle of this topic.

⚠️ **This is the tour of the tree, not the explanation of what is in it.** Topic
[03](../03-the-provider-array/README.md) closed at 90 pages and already teaches `app.config.ts`,
`main.ts`, `bootstrapApplication` and `provideRouter` in depth; topic
[07](../07-the-typescript-setup/README.md) owns the `tsconfig` trio. This topic says *here is every
file, here is what it is, here is why it exists, and here is where the deep explanation lives.*

## Chunks

🚧 **Being written.** Chunks land one at a time and every row below links to a page that exists;
planned chunks appear as plain text until they do, because a link to a page that does not exist
fails the build for the whole site.

| # | Chunk | Covers |
|---|---|---|
| 01 | **`ng new` is two schematics** *(not written yet)* | 🔴 `ng-new` runs `workspace` then `application` — and which file comes from which |
| 02 | **The workspace layer** *(not written yet)* | What the outer schematic writes, before any application exists |
| 03 | **The `src` directory** *(not written yet)* | The application's own files, and which are conventions |
| 04 | **The root component** *(not written yet)* | `signal`, `protected`, `readonly` — and the zoneless spec |

⚠️ **Chunks past 04 are not yet planned**, because the research bank for this topic was cut off
before them. They will be added once the remainder is banked; writing them from an incomplete bank
is how a page ends up asserting something nobody checked.

## Where this sits

The last of Phase 0's toolchain topics. [05](../05-the-build-angular-build/README.md) covered the
build, [06](../06-angular-json-anatomy/README.md) the file that configures it, and
[07](../07-the-typescript-setup/README.md) the compiler settings both depend on. This one is what
you actually get when you type the command.

## Phase gate

You are done with this topic when you can point at any file in a generated project and say which
schematic wrote it, whether the framework requires it, and what would break if you moved or deleted
it.

---

← Prev: [07 · The TypeScript setup Angular requires](../07-the-typescript-setup/README.md) · Index: [Phase 0](../README.md) · Next topic → **09 · The release train** *(not written yet)*
