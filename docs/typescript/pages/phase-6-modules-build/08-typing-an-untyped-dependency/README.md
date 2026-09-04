---
title: "Typing an untyped dependency"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Files →
> Find and Install Declaration Files, Do's and Don'ts, Declaration Merging,
> Templates → module.d.ts*; *Modules*), the **TSConfig reference** for `types`,
> `typeRoots` and `maxNodeModuleJsDepth`, and the compiler's own **option
> records, diagnostic table and checker source** — read out of the installed
> **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

## The one-sentence version

> **A shim is the third option, not the first** — and the shim is not the goal
> either. The goal is that the untyped edge is *named, contained and eventually
> gone.*

## Three sentences worth keeping

1. **Read the code before writing anything.** `TS2307` and `TS2792` are
   resolution problems where a declaration file is the wrong tool entirely; only
   `TS7016` — the one that *names the JavaScript file it found* — means "the code
   is there, the types are not".
2. **A shim is unverified by construction.** Nothing checks it against the
   package. So declare only what you call, and put one wrapper module between it
   and the rest of your codebase — that caps the blast radius of a wrong
   declaration to a single file and gives the runtime check somewhere to live.
3. **A shim file is a record; the alternatives are not.** `@ts-ignore`, a cast,
   `noImplicitAny: false` and `allowJs` all silence the same error and leave
   nothing to inventory — which is why an untyped surface handled that way never
   gets paid down.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Reading the symptom](./01-reading-the-symptom.md) | `TS2307` vs `TS7016` vs `TS2688` vs `TS2792`, and the two flags that suppress the error |
| 02 | [Look for types first](./02-look-for-types-first.md) | Does it ship types? Does `@types` exist? — including the scoped-name mangling |
| 03 | [The shim](./03-the-shim.md) | `declare module 'x'`, and the two silent conditions on where the file lives |
| 04 | [Growing the shim, and containing it](./04-growing-the-shim.md) | `any` → `unknown` → real types, and the wrapper module that bounds it |
| 05 | [When the shipped types are wrong](./05-when-the-shipped-types-are-wrong.md) | Augment, override with `paths`, or assert — and what each costs |
| 06 | [The upstream fix](./06-the-upstream-fix.md) | The only option that removes the cost instead of relocating it |

## 🔴 The three compiler behaviours this topic settles

Read from the compiler rather than recalled, because each one changes what you
do next:

1. **`TS7016` is suppressed when `allowJs` is on *or* `noImplicitAny` is off.**
   That is the literal condition in the checker. So a project with no
   untyped-dependency errors may simply have turned the question off, and
   enabling `allowJs` — which looks unrelated — silences it too (chunk 01).
2. **The `@types` name for a scoped package is mangled**: the leading `@` is
   dropped and the `/` becomes `__`, so `@babel/core` is `@types/babel__core`.
   Searching npm for the unmangled name is a common route to writing an
   unnecessary shim (chunk 02).
3. **`compilerOptions.types` *replaces* the default inclusion rather than adding
   to it** — and the compiler tells you it is set, by choosing `TS2591` over
   `TS2580` (*"…and then add 'node' to the types field in your tsconfig"*)
   (chunks 01 and 02).

## The decision, end to end

```
TS2307 / TS2792 ─────────────► resolution problem. Not this topic.
TS7016
  │
  ├─ package ships its own types?  ──► use them; do NOT also install @types
  ├─ @types/<mangled-name> exists? ──► install it (and list it if `types` is set)
  └─ neither
       └─► declare module 'x';           (unblocked, everything any)
            └─► declare what you call    (unknown for the parts you have not read)
                 └─► wrap it in one module you own
                      └─► upstream it, then delete the shim
```

## Where this connects

- **← [Topic 07 · Authoring `.d.ts` files](../07-authoring-d-ts-files/README.md)**
  — the file format itself. In particular
  [module or global](../07-authoring-d-ts-files/05-module-or-global.md), because
  a shim must be a **script** file and an augmentation must be a **module** file,
  and that asymmetry is the most common way a shim breaks.
- **← [Phase 4 · Module augmentation](../../phase-4-classes-declarations/01-module-augmentation/README.md)**
  — the mechanism chunk 05 uses when the types exist but are incomplete.
- **→ 09 · `esModuleInterop` and default imports** *(not written yet)* — whether
  a consumer may write `import x from` against your `export =` shim.
- **→ 10 · `skipLibCheck`** *(not written yet)* — the full account of what chunk
  05 says it cannot do.
- **→ 03 · Path aliases** *(not written yet)* — the `paths` override in chunk 05,
  and the compiler-only redirect it relies on.
- **→ [Phase 10 · Suppression directives](../../phase-10-strictness/08-suppression-directives/README.md)**
  — why `@ts-expect-error` beats `@ts-ignore` for anything you expect to become
  unnecessary.

---

← [Phase 6 index](../README.md) · Start → [01 · Reading the symptom](./01-reading-the-symptom.md)
