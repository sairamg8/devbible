---
title: "tsconfig.json for a Node 24 service"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules → Reference*),
> the **`tsconfig` reference** on typescriptlang.org, the **Node.js API docs**
> (*Modules: TypeScript*) and the **`@tsconfig/bases`** repository. Diagnostic
> codes and their exact `{0}` message text were read out of the **compiler's own
> diagnostic table** — the strings compiled into the **TypeScript 7.0.2** native
> binary, with codes from the numbered table in the **5.9.3** JavaScript build.
> **No sandbox, no console block on any chunk**; the one measured claim on these
> pages (`strict` defaults to `true`) is
> [phase 0's](../../phase-0-how-typescript-runs/05-strict.md), cited rather than
> repeated.

The first topic of the phase, and the one that decides whether the other
fourteen are pleasant or miserable. A wrong `tsconfig.json` does not usually
fail — it *succeeds differently* from what you expect, and you find out in
production.

The claim the three chunks are built around:

> **The file is two decisions and their consequences.** Who produces the
> JavaScript that runs — `tsc`, or Node's own type stripper? And what module
> format is each file — which, under `module: "nodenext"`, you stop deciding and
> let Node's rules decide per file.
>
> Every remaining option is either a consequence of those two, or a thing you
> want on regardless.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [Decision 1 — who compiles](./01-who-compiles.md) | `tsc`-emits vs Node-strips, everything Path B costs, the choose-a-path table, and the `TS5096` precondition whose wording changed between 5.9 and 7.0 |
| 02 | [Decision 2 — the module format](./02-the-module-format.md) | `module: nodenext`, what it implies *and enforces*, per-file format detection, mandatory extensions (`TS2834`/`TS2835`), and `require(esm)`'s top-level-`await` trap |
| 03 | [`target`, `lib` and where types come from](./03-target-lib-and-types.md) | Why `target` still defaults to `ES5`; `lib` as a promise about the runtime; never `dom` on a server; `@types/node` and the `TS2580`/`TS2591` distinction; `types` as an allowlist; `skipLibCheck`'s honest trade; `include`/`exclude` and the empty program |
| 04 | [The annotated configs](./04-the-annotated-configs.md) | Both complete files, line by line, plus the strict block and the flags `strict` omits — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` |
| 05 | [Emit, layout and programs](./05-emit-layout-and-programs.md) | `verbatimModuleSyntax` and import elision; `rootDir` and the output layout that moves under you; one `tsconfig.json` per program, and how `extends` merges |

## Phase gate

You are done with this topic when you can **write the file from an empty
buffer** for either path and defend every line — and when, shown a
`tsconfig.json`, you can say what it implies about how the project is run,
without being told.

Two specific tells worth being able to name on sight: `"target": "es5"` in a
Node service (a copied config, dragging a `dom` `lib` and a `commonjs` `module`
default behind it), and `"types": ["node"]` added to fix one error (an allowlist
that has silently dropped everything else).

## Where this connects

- **← [Phase 0 · `tsconfig.json` anatomy](../../phase-0-how-typescript-runs/06-tsconfig-anatomy.md)**
  — the option-by-option tour of the file. This topic is the service-shaped
  version: fewer options, each one argued for.
- **← [Phase 0 · Three ways to run TypeScript](../../phase-0-how-typescript-runs/03-three-ways-to-run.md)**
  — `tsc`, a bundler, or the runtime. Decision 1 is that page's choice, made.
- **← [Phase 0 · Strip-only and `erasableSyntaxOnly`](../../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md)**
  — what Node's stripper refuses, and why `TS1294` exists.
- **← [Phase 0 · `strict`](../../phase-0-how-typescript-runs/05-strict.md)** —
  the sandbox-proven default, and the seven flags it turns on.
- **← [Phase 0 · Erasure](../../phase-0-how-typescript-runs/02-erasure.md)** —
  the reason an import in a `.ts` file points at a `.js` file.
- **→ 02 · Shipping TypeScript to production** *(not written yet)* — the runtime
  half: source maps, `--enable-source-maps`, and readable stack traces on both
  paths.

---

← [Phase 7 index](../README.md) · Start → [01 · Decision 1 — who compiles](./01-who-compiles.md)
