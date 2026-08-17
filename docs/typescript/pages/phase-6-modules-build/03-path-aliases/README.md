---
title: "03 — Path aliases (`paths`)"
sidebar_label: "03 · Path aliases — `paths`"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the `paths` and `baseUrl` sections, quoted verbatim including the compiler's
> own crash example) and the **TSConfig reference**. `TS5090`, `TS2792`, `TS6091`
> and `TS6106` are verbatim from the compiler's message table in the installed
> **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

This is the trap that defines the phase, and the handbook says so in a single
sentence that is worth reading before anything else:

> The `paths` option does *not* change the import path in the code emitted by
> TypeScript.

Everything people find confusing about path aliases follows from that.

## The one-sentence version

**`paths` teaches the compiler a mapping the runtime has never heard of.** `tsc`
resolves `@/lib/db`; Node receives `require("@/lib/db")` and has no idea what
that is. Something else has to close the gap, and if nothing does, the code
type-checks and crashes.

## Why this is a Master topic

Because it is the most common way a TypeScript codebase acquires a
compile-passes-runtime-fails bug, and because the usual fixes are a menu of four
options with genuinely different costs — not a single right answer. Choosing
badly means either a build step nobody understands or a runtime loader in
production.

It is also the one place where [topic 01's rule](../01-module-and-moduleresolution/01-the-two-questions.md)
— the specifier is emitted as written — is broken on purpose, which makes it the
best test of whether you actually absorbed that rule.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What `paths` does, and what it does not](./01-what-paths-does.md) | The mapping, the syntax, and the compiler's own crash example |
| 02 | [`baseUrl`, and why you probably do not need it](./02-baseurl.md) | What it actually changes, its precedence over `node_modules`, and `TS5090` |
| 03 | [Closing the gap at runtime](./03-closing-the-gap.md) | The four ways to make an alias real, and what each costs |
| 04 | [`package.json` `"imports"` — the standard replacement](./04-subpath-imports.md) | The one option the runtime already understands, and its `rootDir` requirement |
| 05 | [The decision](./05-the-decision.md) | When aliases earn their keep, when they do not, and the monorepo case |

## Three sentences to keep

1. **`paths` is a compile-time fiction.** It changes lookup and nothing else; the
   emitted string is what you wrote.
2. **The handbook's own recommendation is to replace convenience aliases with
   `package.json` `"imports"`** — *"Both libraries and apps can consider
   package.json `"imports"` as a standard replacement for convenience `paths`
   aliases."*
3. **A library must never ship unresolved aliases**, because its consumers have
   no `tsconfig.json` of yours to read.

## Where this connects

- **← [Topic 01 · The two questions](../01-module-and-moduleresolution/01-the-two-questions.md)**
  — the as-written rule this topic deliberately breaks.
- **← [Topic 01 · The bundler resolver](../01-module-and-moduleresolution/06-the-bundler-resolver.md)**
  — `"imports"` resolution in your own package needs an explicit `rootDir`, which
  chunk 04 pays off.
- **→ Phase 6 · 12 · Sharing types across a monorepo** *(not written yet, lane
  D)* — the case where aliases are most tempting and most expensive.
- **→ Phase 6 · 11 · Publishing a typed package** *(not written yet, lane D)* —
  why a published `.d.ts` containing an alias is broken for every consumer.

---

← [Phase 6 index](../README.md) · Next → [01 · What `paths` does](./01-what-paths-does.md)
