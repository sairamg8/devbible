---
title: "01 — The one-file compiler"
sidebar_label: "01 · The one-file compiler"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** for `isolatedModules`, and
> from the option record and `transpileWorker` read out of the installed
> **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

`isolatedModules` is the one compiler flag that is not about your code at all. It
is about **a different tool**, and it makes sense only once you know which tool
and what that tool cannot see.

## Two ways to turn TypeScript into JavaScript

**`tsc` builds a program.** It reads your entry points, follows every import,
resolves every specifier to a file, and holds the whole graph in memory. When it
reaches a line it does not understand in isolation, it looks the answer up
somewhere else.

**Everything else transpiles one file at a time.** Babel, esbuild, SWC, ts-jest,
Vite's dev server, Next.js's compiler, `ts.transpileModule` itself — each takes
a single file's text, strips the types, and writes JavaScript. It never opens the
file next door. It cannot, because opening the file next door is what makes `tsc`
slow, and being fast is the entire reason those tools exist.

**`isolatedModules` is `tsc` agreeing to only accept code the second kind of tool
can also handle correctly.** The compiler's own description of the flag says
exactly that:

> Ensure that each file can be safely transpiled without relying on other
> imports.

## The line that shows the problem

```ts
// types.ts
export type User = { id: string };

// re-export.ts
export { User } from "./types";
```

`tsc` compiles this. It resolves `./types`, sees that `User` is a type, and
**erases the whole statement** — types do not exist at runtime, so nothing is
emitted.

A single-file transpiler looking only at `re-export.ts` sees
`export { User } from "./types"` and has **no way to know** what `User` is. It
has two options and both are wrong:

- **Emit it.** The output does `export { User } from "./types.js"`, and at
  runtime `./types.js` has no `User` binding. Some bundlers throw; ESM throws at
  link time; CommonJS silently gives you `undefined`.
- **Erase it.** Now every genuine value re-export vanishes too.

There is no third option, because the information needed to choose is **in
another file**.

Under `isolatedModules`, `tsc` refuses the line instead:

**TS1205** — *"Re-exporting a type when 'isolatedModules' is enabled requires
using 'export type'."*

```ts
export type { User } from "./types";   // ✅ unambiguous in one file
```

Now every tool can tell, from the text alone, that this statement produces
nothing.

## That is the whole design

Every rule in the next chunk is an instance of the same pattern, and once you see
it you can predict them:

> **If a transpiler would have to know something about another file to emit this
> line correctly, the line is banned.**

The rules are not stylistic and they are not about safety in the usual sense.
They are about a specific, mechanical property: **each statement must be
emittable from its own text**.

## `tsc` forces the flag on when it transpiles

The compiler's own single-file API proves the framing. `ts.transpileModule` —
the function every one of those tools reaches for, directly or by imitation —
overwrites the options you passed it:

```js
for (const option of transpileOptionValueCompilerOptions) {
  if (options.verbatimModuleSyntax && optionsRedundantWithVerbatimModuleSyntax.has(option.name)) {
    continue;
  }
  options[option.name] = option.transpileOptionValue;
}
```

`isolatedModules`'s option record carries `transpileOptionValue: true`, so
**`transpileModule` always runs as if `isolatedModules` were on**, whatever you
asked for. The flag is not a preference in that mode; it is a description of what
the mode can do.

⚠️ **The `optionsRedundantWithVerbatimModuleSyntax` set contains exactly one
name — `"isolatedModules"`.** The skip exists because `verbatimModuleSyntax`
already implies it, which is chunk 04's subject.

## What the flag does *not* do

Three things it is regularly mistaken for:

- **It does not change emit.** Its option record has no `affectsEmit`. Turning it
  on and off does not alter one byte of `tsc`'s output for code that is legal
  under both.
- **It does not make your build faster.** It makes your code *compatible* with a
  faster build. Adding the flag and changing nothing else buys you nothing.
- **It does not check that a transpiler is actually being used.** You can enable
  it in a pure `tsc` project, and many people should — it is a portability
  guarantee, not a coupling.

## Why you want it even on a pure `tsc` build

Because it converts a **future migration** into **present, local errors**.

The code `isolatedModules` bans is not code that is wrong today. It is code that
silently becomes wrong the day somebody puts esbuild in front of it — and when
that day comes, the failure mode is a runtime `undefined`, in production, a long
way from the config change that caused it.

Each error the flag reports has a two-token fix (`export type`), takes seconds,
and never has to be thought about again. Deferring them means discovering them
all at once, under time pressure, in a migration that has other problems.

🔴 **And you may already be transpiling without having decided to.** Jest via
`@swc/jest` or `babel-jest`, a Vite dev server, Next.js, Bun's runtime, `tsx`,
and Node's own `--experimental-strip-types` are all single-file transpilers. A
project can easily type-check with `tsc` and *run* through one of these, in which
case the flag is not hypothetical at all.

## Gotchas

**Symptom:** enabling `isolatedModules` produced no errors, so you assume it did
nothing.
**Cause:** it very possibly did nothing — the flag reports only on patterns that
are actually present, and a modern codebase written with `import type` may have
none.
**Fix:** none. Leave it on; it is a ratchet against the patterns coming back.

**Symptom:** you enabled it hoping for a speed-up.
**Cause:** the flag constrains the source so a faster tool *can* be used. It is
not the faster tool.
**Fix:** adopt the tool. The flag is the prerequisite, not the payoff.

**Symptom:** the errors appeared only after switching to esbuild, despite `tsc`
being clean.
**Cause:** `isolatedModules` was off, so `tsc` was accepting code esbuild cannot
handle.
**Fix:** turn it on and fix the errors *before* the tooling change, not after.

**Symptom:** a re-export "works" through Babel but is `undefined` at runtime.
**Cause:** exactly the case above — the transpiler guessed, and guessed emit.
**Fix:** `export type`. And enable the flag so the next one is caught at build.

**Symptom:** `ts.transpileModule` behaves differently from `tsc` on the same
file, with the same `tsconfig.json`.
**Cause:** it forces `isolatedModules` and several other options regardless of
what you passed.
**Fix:** expected. Options with a `transpileOptionValue` are not yours to set in
that API.

## Interview questions

**What problem does `isolatedModules` solve?**
Single-file transpilers cannot see other files, so some TypeScript statements are
impossible to emit correctly from their own text. The flag makes `tsc` reject
exactly those statements.

**Give the canonical example.**
`export { SomeType } from "./types"`. `tsc` resolves it and erases it; a
transpiler cannot tell whether to emit or erase, and both choices are wrong in
some case. `export type { SomeType }` is unambiguous.

**Does it change the emitted JavaScript?**
No. Its option record has no `affectsEmit`. It only restricts what source is
accepted.

**Does it make builds faster?**
No. It makes the codebase compatible with tools that are faster. Enabling it
alone changes nothing about build time.

**Should you enable it in a project that only ever runs `tsc`?**
Yes, in almost every case. It costs a handful of two-token fixes now and prevents
a class of silent runtime bug if the toolchain ever changes — and toolchains
change more often than the code does.

**How does `ts.transpileModule` treat it?**
It forces it on. `isolatedModules` carries `transpileOptionValue: true`, so the
single-file API overwrites whatever you passed.

**Name four tools that transpile one file at a time.**
Babel, esbuild, SWC and ts-jest — plus Vite's dev server, Next.js's compiler,
`tsx`, Bun, and Node's own type-stripping mode, all of which are the same shape.

---

← [Topic index](./README.md) · Next → [02 · Every rule it enforces](./02-every-rule.md)
