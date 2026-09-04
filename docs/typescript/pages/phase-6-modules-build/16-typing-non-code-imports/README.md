---
title: "Typing non-code imports"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the `resolveJsonModule` and `allowArbitraryExtensions`
> option records and the `TS6262`, `TS6263` and `TS2732` messages are read out of
> the compiler's own tables in the installed **TypeScript 5.9.3** build; the
> ambient-declaration conditions are
> [topic 07](../07-authoring-d-ts-files/README.md)'s and the asset-subpath note
> is quoted from `arethetypeswrong`'s `NoResolution.md`. **No sandbox, no console
> blocks.**

## The one-sentence version

> **None of these mechanisms makes the import work — each one tells the type
> system that a bundler will handle it**, so the deciding question is only
> whether the file's *contents* should affect the type.

## Three sentences worth keeping

1. **The wildcard `declare module '*.css'` is the general answer** and needs no
   flag — one shape for every matching file, which is *correct* for anything
   opaque.
2. **`allowArbitraryExtensions` buys per-file precision** by looking for
   `foo.d.css.ts`, narrated by `TS6262`; `TS6263` means the file was found and
   the flag is missing.
3. 🔴 **JSON is the exception** — TypeScript reads it and infers a type. But
   everything widens, so a JSON import can never give you literal types.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The three mechanisms](./01-the-three-mechanisms.md) | Wildcard vs `allowArbitraryExtensions` vs `resolveJsonModule`, and when each is right |
| 02 | [JSON](./02-json.md) | What the inference gives you, what it widens away, and what it costs |
| 03 | [Suffixes and choosing](./03-choosing.md) | `?raw`/`?url`, why only the wildcard matches them, and the one-file rule |

## 🔴 What this topic settles

1. **All three mechanisms are type-level assertions about a bundler**, so all
   three keep type-checking after the bundler changes (chunk 01).
2. **`allowArbitraryExtensions` substitutes the extension** — `foo.css` →
   `foo.d.css.ts` — which is exactly why it cannot match a query suffix
   (chunks 01 and 03).
3. **`TS6263` is the good error** — the declaration was found, the flag is
   missing (chunk 01).
4. **`TS2732` names its flag** where the CSS errors do not, because JSON has one
   right answer (chunks 01 and 02).
5. **JSON inference widens everything** and there is no `as const` for it, so
   configuration needing literals belongs in a `.ts` file (chunk 02).
6. **`resolveJsonModule` carries `affectsModuleResolution`** — the file becomes a
   program input, which is the real cost on large data (chunk 02).

## Where this connects

- **← [Topic 07 · `declare module`](../07-authoring-d-ts-files/07-declare-module-and-choosing.md)**
  — the wildcard form, and the two conditions (script file, in the program) that
  explain most "my declaration does nothing" reports.
- **← [Topic 03 · Path aliases](../03-path-aliases/README.md)** and
  **[Topic 09 · `esModuleInterop`](../09-esmoduleinterop-and-default-imports/README.md)**
  — the same shape: a type-level claim about somebody else's runtime behaviour.
- **← [Topic 11 · The problem catalogue](../11-publishing-a-typed-package/07-the-problem-catalogue.md)**
  — the documented false positive when a published package exposes a `.css`
  subpath.
- **← [Topic 01 · `module` and `moduleResolution`](../01-module-and-moduleresolution/README.md)**
  — the JSON import attribute (`with { type: 'json' }`) is that topic's
  compiler-models-the-runtime problem in miniature.

---

**This closes phase 6.** ← [Phase 6 index](../README.md) · Start → [01 · The three mechanisms](./01-the-three-mechanisms.md)
