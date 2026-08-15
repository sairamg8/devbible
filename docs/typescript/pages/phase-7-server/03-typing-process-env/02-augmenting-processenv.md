---
title: "Augmenting ProcessEnv"
sidebar_label: "02 · Augmenting ProcessEnv"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging* —
> interface merging and global augmentation; *Modules → Reference* for the
> script-vs-module distinction) and the **DefinitelyTyped** `@types/node`
> sources, where `ProcessEnv` is declared. `TS2669`, `TS2688` and `TS2591` and
> their exact `{0}` message text were read out of the **compiler's own
> diagnostic table** — codes from the numbered table in the **5.9.3** build,
> and `TS2669`'s wording confirmed present verbatim in the **TypeScript 7.0.2**
> native binary.
> **No sandbox, no console block.**

[Chunk 01](./01-what-process-env-actually-is.md) established that
`process.env.X` is `string | undefined` and that this is *correct*. This chunk
is about the most popular way of making it stop being correct.

## The technique

`ProcessEnv` is an `interface`, and interfaces merge. So you can declare more
members for it from your own code:

```ts
// src/types/env.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      PORT: string;
      NODE_ENV: 'development' | 'test' | 'production';
    }
  }
}

export {};
```

The effect is immediate and pleasant:

```ts
const url: string = process.env.DATABASE_URL;   // no error, no `!`, no check
```

It is genuinely clever — it uses
[declaration merging](../../phase-1-type-vocabulary/07-type-vs-interface.md) to
add members to a third-party interface, from outside that package, without
patching anything. And it is the first thing almost every TypeScript service
does.

## 🔴 Why it lies

**Nothing checked.** The augmentation is a *declaration*: it tells the compiler
what to believe. It does not read the environment, it does not run at startup,
and it emits no code — it is erased entirely.

> `declare global { … ProcessEnv { DATABASE_URL: string } }` is exactly
> `process.env.DATABASE_URL as string`, applied automatically at every read site
> in the codebase, forever, invisibly.

That is a stronger claim than it looks, so make it concrete. Deploy with
`DATABASE_URL` unset:

- `process.env.DATABASE_URL` evaluates to `undefined`.
- Its static type is `string`, so nothing guards it.
- It flows into `new Pool({ connectionString: url })`.
- The failure surfaces as a driver error about a malformed connection string,
  in a request handler, minutes later — **arbitrarily far from the missing
  variable**, with a stack trace that names the database code.

Compare with no augmentation at all: `process.env.DATABASE_URL` is
`string | undefined`, the compiler refuses to pass it where a `string` is
required, and you are *forced* to decide what happens when it is absent. The
"annoying" version is the one that prevents the outage.

📌 This is the phase's thesis in miniature and worth naming as a general rule:
**a type annotation on external data is a claim, not a check.** The same shape
returns for [`query<T>()`](../README.md) in topic 07 and for `fetch` in phase 9.
The augmentation just makes it ambient, which makes it *harder to see*.

### The `?` question is a trap either way

The obvious refinement is to declare them optional:

```ts
interface ProcessEnv {
  DATABASE_URL?: string;      // honest…
}
```

This is honest, and it is also **exactly what you already had** —
`Dict<string>`'s index signature already gives you `string | undefined` for
every key. You have written a lot of ceremony to arrive back at the default.

So the real choice is between *lying usefully* (required, and unchecked) and
*not lying* (optional, and identical to doing nothing). Neither is a validation
strategy. That is [chunk 03](./03-why-parsing-wins.md)'s point.

## What augmentation *is* good for

Two things, both real:

1. **Autocomplete and discoverability.** Typing `process.env.` and seeing the
   project's variables is genuinely useful, and a declaration file listing them
   doubles as documentation that cannot drift out of the repo.
2. **Narrowing a value's shape**, e.g. `NODE_ENV: 'development' | 'test' |
   'production'`, which turns a comparison against a typo into a compile error.

Both survive if you keep the augmentation *and* parse. The mistake is treating
it as the safety mechanism rather than as the index.

## 🔴 The way it silently does not apply

This is the failure the syllabus row calls out, and it is nastier than being
wrong — the augmentation simply has no effect, with no error, and
`process.env.DATABASE_URL` stays `string | undefined` while you are certain you
fixed it.

### Cause 1 — the file is not in the program

A `.d.ts` that no `include` glob matches, and that nothing imports, is not part
of the compilation. It affects nothing.

```json
{ "include": ["src"] }
```

If the file is at `types/env.d.ts` — outside `src/` — it is not in the program.
Remember from
[topic 01 chunk 03](../01-tsconfig-for-a-node-service/03-target-lib-and-types.md)
that `include` defaults to `**/*`, so this bites precisely the projects that
*did* the right thing and made `include` explicit.

**Fix:** put it under `src/`, or add its directory to `include`. Do not reach
for `typeRoots` — that governs automatic `@types` package inclusion, and
pointing it at your own folder breaks `@types/node` while producing:

```text
error TS2688: Cannot find type definition file for '{0}'.
```

### Cause 2 — script vs module, and the `export {}` line

This is the one that catches everyone once, and it is worth understanding rather
than memorising.

A `.d.ts` with **no** top-level `import` or `export` is a **script**: its
declarations are already global. So you write the augmentation bare:

```ts
// a script — no imports, no exports
declare namespace NodeJS {
  interface ProcessEnv { DATABASE_URL: string }
}
```

The moment the file gains **any** top-level `import` or `export`, it becomes a
**module**, its declarations are scoped to it, and the bare form stops reaching
the global scope. Now you need `declare global`:

```ts
import type { Pool } from 'pg';     // ← this line changed the file's nature

declare global {
  namespace NodeJS {
    interface ProcessEnv { DATABASE_URL: string }
  }
}
```

And `declare global` is only legal *in a module*, which is why the idiomatic
file ends with a bare `export {}` — a no-op export whose entire job is to make
the file a module so `declare global` is allowed.

The compiler does tell you when you get it backwards:

```text
error TS2669: Augmentations for the global scope can only be directly nested in
external modules or ambient module declarations.
```

⚠️ **The dangerous direction is the other one**, and it produces no error at
all: a file that *was* a script and worked, which someone later adds an
`import type` to. It silently becomes a module, the augmentation silently stops
applying globally, and the only symptom is that `process.env.DATABASE_URL` goes
back to being `string | undefined` — which reads as "someone changed the types"
rather than "someone added an import".

📌 **The rule that avoids the whole class:** always write the `declare global` +
`export {}` form. It is correct whether or not the file later gains an import,
so it cannot decay.

### Cause 3 — `types` excluded it

Covered in
[topic 01 chunk 03](../01-tsconfig-for-a-node-service/03-target-lib-and-types.md):
specifying `types` turns automatic `@types` inclusion into an allowlist. If
`node` is not in it, `NodeJS.ProcessEnv` does not exist to be merged with, and
you get `TS2591` — the *"add 'node' to the types field in your tsconfig"*
variant — rather than anything mentioning your augmentation.

## Gotchas

**Symptom:** the augmentation file exists, is correct, and has no effect.
**Cause:** it is not in the program — `include` does not reach it and nothing
imports it.
**Fix:** move it inside an included root. Verify by introducing a deliberate
syntax error in the file: if the build stays green, the file is not being read.
That check takes ten seconds and settles it.

**Symptom:** the augmentation worked, then stopped, and the diff that broke it
only added an import.
**Cause:** the file changed from a script to a module, so the bare
`declare namespace` no longer reaches global scope.
**Fix:** the `declare global { … }` + `export {}` form, always.

**Symptom:** `TS2669` on the `declare global` block.
**Cause:** the opposite — the file is a script, and `declare global` requires a
module.
**Fix:** add `export {}`.

**Symptom:** every environment variable is `string`, and production crashed on a
missing one anyway.
**Cause:** working as designed. The augmentation asserts; it does not check.
**Fix:** [chunk 03](./03-why-parsing-wins.md).

**Symptom:** after adding `typeRoots` to make the augmentation resolve,
`process` and `Buffer` became unknown.
**Cause:** `typeRoots` restricts where automatic `@types` packages are found;
pointing it at your own directory excluded `node_modules/@types`.
**Fix:** remove `typeRoots`. It is not the mechanism for including your own
declaration files — `include` is.

## Interview questions

**How do you add `DATABASE_URL` to `process.env`'s type, and what does that
actually accomplish?**
Declaration merging, in a file that is part of the program:

```ts
declare global {
  namespace NodeJS {
    interface ProcessEnv { DATABASE_URL: string }
  }
}
export {};
```

What it accomplishes is autocomplete and a compile-time claim. What it does
*not* accomplish is any verification — it is a project-wide `as string` on data
that arrives from outside the process.

**Why does an augmentation file usually end with `export {}`?**
To make it a module. `declare global` is only legal inside a module, and a
`.d.ts` with no top-level import or export is a script. The bare export is a
no-op whose only purpose is to flip that classification.

**An augmentation stopped applying and the only change was a new `import type`.
Explain.**
The file was a script, so its `declare namespace NodeJS` was already global. The
import made it a module, scoping the declaration to the file. No error is
produced — the augmentation simply stops merging, and the types quietly revert.
Writing the `declare global` + `export {}` form from the start makes the file
immune.

**Is declaring the variables optional (`DATABASE_URL?: string`) the safe
compromise?**
It is honest but pointless: `ProcessEnv extends Dict<string>` already gives
every key `string | undefined`, so the optional augmentation reproduces the
default with extra steps. The genuine choice is between an unchecked assertion
and actually parsing the environment.

---

← [01 · What it actually is](./01-what-process-env-actually-is.md) · Next → [03 · Why parsing wins](./03-why-parsing-wins.md)
