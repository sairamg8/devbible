---
title: "04 — `lib`, `target` and the ambient environment"
sidebar_label: "04 · `lib`, `target` and the ambient environment"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** and the **4.5 / 5.8 / 6.0
> release notes** for `libReplacement`; every option default, diagnostic message
> and lib-file composition below is **read out of the installed TypeScript 5.9.3
> build** and the 100 `lib.*.d.ts` files shipped with it, and the Node globals
> from **`@types/node` 26.2.0** as installed in this repository. **No sandbox, no
> console blocks** — a plausible-looking `tsc` transcript written from memory is
> not evidence.

`target` and `lib` sit on adjacent lines of the same config, take overlapping
values, and one silently changes the other. They answer completely different
questions, and almost every "why does this resolve here and not there?" report
comes from the gap between them.

## The one-sentence version

**`target` decides what the runtime has to be able to parse. `lib` decides what
the compiler believes the runtime already has** — and nothing checks either claim
against reality.

## The three facts this topic is built on

1. 🔴 **If you do not set `lib`, you get the DOM.** At every `target`, including
   in a Node service, because the default lib is a `.full` file that references
   `dom`, `dom.iterable`, `dom.asynciterable`, `webworker.importscripts` and
   `scripthost`.
2. 🔴 **Therefore writing `lib` *removes* things.** It is a replacement, not an
   addition — `"lib": ["es2022"]` selects the non-`.full` file and the DOM leaves
   with it. So does `types`, for `@types` packages.
3. 🔴 **`console`, `setTimeout`, `fetch`, `URL` and `structuredClone` are not
   JavaScript.** Among all 100 shipped lib files they appear only in
   `lib.dom.d.ts` and `lib.webworker.d.ts`; `process` appears in none. On Node
   they come from `@types/node`, which is a `types` concern.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Two different jobs](./01-two-different-jobs.md) | Emit vs checking, and why the `target`-derived `lib` hides the distinction |
| 02 | [What a lib file actually is](./02-what-a-lib-file-is.md) | 100 files on disk, `/// <reference lib>`, and why `lib.es2015.d.ts` is 28 lines |
| 03 | [The default `lib`, and the `.full` files](./03-the-default-lib.md) | 🔴 the DOM-by-default trap, `targetToLibMap`, and the ES2015 exception |
| 04 | [Every value `lib` accepts](./04-every-lib-value.md) | the four groups, `dom` vs `webworker`, `libReplacement`, `noLib` |
| 05 | [The ambient environment is not the language](./05-ambient-not-language.md) | the `structuredClone` question, answered three ways, and the `Timeout`/`number` collision |
| 06 | [`types`, `typeRoots` and the four sources of a global](./06-types-and-typeroots.md) | auto-inclusion, the replacement cliff, and the global you cannot remove |
| 07 | [The diagnostics, and why only some of them help](./07-the-diagnostics.md) | 🔴 the advice is a hardcoded 27-name switch, not a heuristic |
| 08 | [Choosing](./08-choosing.md) | the four recipes, the polyfill case, and what to check in an inherited config |

## The syllabus question, answered

> *Why is `structuredClone` missing from your types but present at runtime?*

Because it is a **web API, not a JavaScript one**. It is declared in
`lib.dom.d.ts`, in `lib.webworker.d.ts`, and in `@types/node`'s
`web-globals/messaging.d.ts` — and in **no** `lib.es20NN.d.ts`, at any version,
ever. A Node project that tightened `lib` to drop the browser dropped it too, and
no `target` bump will bring it back. The fix is `@types/node`.

Chunk 05 carries the full three-way answer and the reason `@types/node` actively
detects whether the DOM lib is loaded.

## Four sentences to keep

1. **`lib` is a promise, and the compiler believes it.** Nothing verifies that
   the environment you declared is the one the code will meet.
2. **Both `lib` and `types` replace their defaults.** Being explicit removes
   things; that is the trap, and it catches people doing the right thing.
3. **The absence of advice in an error carries no information.** 27 identifiers
   get help; every other name gets a bare `Cannot find name`, including the ones
   that actually confuse people.
4. **A global from a dependency's `declare global` cannot be configured away.**
   It is the one source with no `lib` or `types` answer.

## Where this connects

- **← [Topic 01 · The two questions](../01-module-and-moduleresolution/01-the-two-questions.md)**
  — the same shape one level down: `module` and `moduleResolution` are also two
  settings people read as one.
- **← [Phase 4 · Global augmentation](../../phase-4-classes-declarations/06-global-augmentation.md)**
  — writing a `declare global` yourself, and why `var` is the only correct
  spelling inside one.
- **→ [Phase 7 · `target`, `lib` and `types` for a Node service](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)**
  — the applied case with concrete values for a real Node 24 service. This topic
  owns the mechanism; that page owns the recommendation.
- **→ [Phase 6 · 08 · Typing an untyped dependency](../08-typing-an-untyped-dependency/01-reading-the-symptom.md)**
  — what to do when the package has no types at all, and the `TS2591`/`TS2580`
  pair from the other direction.
- **Deliberately not here:** how a bundler's own `target` interacts with `tsc`'s
  (chunk 08 names the hazard and stops), and declaration authoring, which is
  topic 07's.

---

← [Phase 6 index](../README.md) · Next → [01 · Two different jobs](./01-two-different-jobs.md)
