---
title: "`skipLibCheck`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** (`skipLibCheck`,
> `skipDefaultLibCheck`, `tsBuildInfoFile`) and — for everything the reference
> does not say — the compiler's own **option records, `skipTypeCheckingWorker`
> predicate, grammar-check call sites, `--init` template, `jsconfig.json`
> implicit options and incremental-builder state setup**, read out of the
> installed **TypeScript 5.9.3** build and cross-checked against the **7.0.2**
> native binary. The **5.4 release notes** were checked for the disputed default.
> **No sandbox, no console blocks** — and no timing figure is claimed anywhere in
> this topic, because none was measured.

## The one-sentence version

> **For every file in the program that is a declaration file, the checker does
> not run — parsing still does.** Everything surprising about this flag follows
> from the fact that "declaration file" includes the ones *you* wrote and the
> ones your own build emits.

## Five sentences worth keeping

1. **The predicate is `options.skipLibCheck && sourceFile.isDeclarationFile`.**
   No path test, nothing about `node_modules` — so your `globals.d.ts`, your
   shims and your published `dist/*.d.ts` are skipped identically to a
   dependency's.
2. 🔴 **It also silences the rules that define the `.d.ts` file format.**
   `checkSourceFileWorker` returns before `checkGrammarSourceFile`, so `TS1036`,
   `TS1038`, `TS1039`, `TS1046` and `TS1183` are never computed for a declaration
   file. This is documented nowhere.
3. **It helps when *their* `.d.ts` fails to compile internally, and does nothing
   when their types are wrong *about* the API.** That is the difference between
   the case it is for and the case it gets proposed for.
4. **Syntax still fails.** `getSyntacticDiagnosticsForFile` is ungated, so the
   real boundary is parser-versus-checker, not "syntax versus semantics".
5. **Nearly everyone has it because TypeScript writes it.** `tsc --init` emits it
   under a header literally called `Recommended_Options`, next to `strict`.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What it actually skips](./01-what-it-actually-skips.md) | The option record, the predicate, the six call sites, and what stays ungated |
| 02 | [It skips your declarations too](./02-it-skips-your-declarations-too.md) | The four populations of `.d.ts`, and why this is a library author's problem |
| 03 | [The file-format rules go quiet](./03-the-file-format-rules-go-quiet.md) | 🔴 The ambient-context grammar diagnostics are skipped too — undocumented |
| 04 | [What it does not do](./04-what-it-does-not-do.md) | Seven negatives, led by assignability at your call sites |
| 05 | [`skipDefaultLibCheck` and the neighbours](./05-skipdefaultlibcheck-and-neighbours.md) | The other four clauses, and the pragma that really drives `skipDefaultLibCheck` |
| 06 | [Who turns it on for you](./06-who-turns-it-on-for-you.md) | `--init`, `jsconfig.json`, the TS server, the bases — and the disputed default |
| 07 | [The `.tsbuildinfo` interaction](./07-the-tsbuildinfo-interaction.md) | Why flipping it invalidates a slice of the incremental cache, and the CI trap |
| 08 | [Choosing it](./08-choosing-it.md) | The two-config split, triaging the flood, and a reviewable team rule |

## 🔴 The compiler behaviours this topic settles

Each is read from the 5.9.3 build rather than recalled, and none of them appears
in the documentation:

1. **The gate is per source file and tests `isDeclarationFile` only** — chunk 01.
2. **`checkSourceFileWorker` early-returns before the grammar checks**, so the
   `.d.ts` file-format rules are unenforced — chunk 03.
3. **`getSyntacticDiagnosticsForFile` has no skip check**, so parse errors always
   survive — chunks 01 and 03.
4. **`getDeclarationDiagnosticsForFile` returns early for declaration files**, so
   the flag has nothing to do with declaration-*emit* failures — chunk 04.
5. **`skipDefaultLibCheck` tests `sourceFile.hasNoDefaultLib`**, set by the
   `no-default-lib` pragma — not "files shipped with TypeScript" — chunk 05.
6. **`tsc --init` files it under `Recommended_Options`**, and `jsconfig.json`
   implies it from its filename — chunk 06.
7. **`copyDeclarationFileDiagnostics` requires `!skipLibCheck ===
   !oldSkipLibCheck`**, which is what `affectsBuildInfo` is for — chunk 07.

## The decision, in one place

```
what is this build FOR?
  ├─ the dev loop / an app you deploy        → skipLibCheck: true
  ├─ the job that emits published .d.ts      → skipLibCheck: false  🔴
  ├─ you hand-write .d.ts files              → at least one build with false
  └─ monorepo consuming built dist/*.d.ts    → false in the producing package
```

## Where this connects

- **← [Topic 07 · Authoring `.d.ts` files](../07-authoring-d-ts-files/README.md)**
  — the file format this flag stops enforcing. 🔴 If you are writing declarations
  by hand, do it with `skipLibCheck: false` or the whole diagnostic vocabulary
  that topic teaches is unavailable to you.
- **← [Topic 08 · Typing an untyped dependency](../08-typing-an-untyped-dependency/README.md)**
  — chunk 05 there drew the line this topic completes: the flag helps with a
  `.d.ts` that will not compile, never with one that is simply wrong.
- **← [Phase 10 · The suppression tiers](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)**
  — where it is placed **outside** the ladder, because it suppresses nothing in
  code you wrote.
- **→ [Phase 7 · `target`, `lib` and types](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)**
  — the applied case on a real Node service, and the correctness trade in
  context. **This topic owns the general rule; that page owns the worked
  config.**
- **→ 11 · Publishing a typed package** *(not written yet)* — checking your
  declarations is not the same as testing that consumers can resolve them.
- **→ [14 · Incremental builds](../14-incremental-builds/README.md)** — `.tsbuildinfo` in general;
  chunk 07 owns only this flag's part of it.
- **→ Phase 12 · Tooling, performance and testing** *(not written yet)* — **the
  performance question belongs there**, and it is why no timing figure appears
  anywhere in this topic.

---

← [Phase 6 index](../README.md) · Start → [01 · What it actually skips](./01-what-it-actually-skips.md)
