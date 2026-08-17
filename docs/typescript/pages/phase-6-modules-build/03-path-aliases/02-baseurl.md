---
title: "`baseUrl`, and why you probably do not need it"
sidebar_label: "02 · `baseUrl`"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*,
> the `baseUrl` and `paths` sections — quoted verbatim, including the precedence
> statement and the relationship between the two options. `TS5090`, `TS6106` and
> `TS6167` are verbatim from the compiler's message table in the installed
> **5.9.3** build. `paths` stopped requiring `baseUrl` in **TypeScript 4.1**.
> **No sandbox, no console block.**

`baseUrl` is in more configs than it belongs in, usually because it was copied
alongside `paths` from a template written before 2020.

## What it does

> The `baseUrl` compiler option can be combined with any `moduleResolution` mode
> and specifies a directory that bare specifiers (module specifiers that don't
> begin with `./`, `../`, or `/`) are resolved from.

So with `"baseUrl": "./src"`, this becomes legal:

```ts
import { pool } from "db/pool.js";     // resolves ./src/db/pool.ts
```

No `paths` entry involved. `baseUrl` alone turns every directory under it into
something importable by a bare specifier.

🔴 **And that is the first reason to be suspicious of it:** it makes *every* file
under `baseUrl` reachable by a name that looks exactly like an npm package. Which
brings us to the precedence rule.

## The precedence rule people do not know

> `baseUrl` has a higher precedence than `node_modules` package lookups in
> `moduleResolution` modes that support them.

⚠️ **Your source tree shadows your dependencies.** With `"baseUrl": "./src"`, a
directory `src/react/` makes `import … from "react"` resolve to *your* folder,
not the package. There is no warning; the compiler is doing exactly what it was
told.

That is a low-probability collision for `react` and a very high-probability one
for names like `utils`, `config`, `types`, `constants` and `test` — every one of
which is both a plausible directory name and an actual npm package.

The compiler will say so under trace:

```text
TS6106  'baseUrl' option is set to '{0}', using this value to resolve
        non-relative module name '{1}'.
```

## Two things `baseUrl` does not do

**It does not affect relative imports.**

> Resolution of relative module specifiers are never affected by the `baseUrl`
> option.

So `./thing` and `../thing` behave identically with and without it. `baseUrl` is
purely about bare specifiers.

**It does not change the emit.** Same as `paths`
([chunk 01](./01-what-paths-does.md)) — `import { pool } from "db/pool.js"` is
emitted verbatim, and Node will look for a *package* called `db`. `baseUrl` has
the identical runtime problem and gets discussed far less, because it does not
look like an alias.

📌 It also inherits the resolution mode's own rules:

> When performing a `baseUrl` lookup, resolution proceeds with the same rules as
> other relative path resolutions. For example, in a `moduleResolution` mode that
> supports extensionless relative paths a module specifier `"some-file"` may
> resolve to `/src/some-file.ts` if `baseUrl` is set to `/src`.

## Its relationship to `paths`

> When `baseUrl` is provided, the values in each `paths` array are resolved
> relative to the `baseUrl`. Otherwise, they are resolved relative to the
> `tsconfig.json` file that defines them.

That second clause is the modern behaviour, and it is why most configs can drop
`baseUrl` entirely. **`paths` has not required `baseUrl` since TypeScript 4.1.**

```jsonc
// Old — two options, one of which shadows node_modules
{ "baseUrl": "./src", "paths": { "@app/*": ["*"] } }

// Modern — one option, values relative to tsconfig.json
{ "paths": { "@app/*": ["./src/*"] } }
```

🔴 **The modern form is strictly better**, and not merely tidier: it removes the
`node_modules` shadowing, it makes the values readable without holding `baseUrl`
in your head, and it means moving `tsconfig.json` moves the paths with it.

⚠️ **Migrating is not a no-op.** Dropping `baseUrl` changes what the `paths`
values are relative to, so every value needs rewriting from `"*"` to `"./src/*"`.
Doing one without the other silently repoints every alias.

## The error that catches the half-migration

```text
TS5090  Non-relative paths are not allowed when 'baseUrl' is not set. Did you
        forget a leading './'?
```

📌 **This is a good error.** It fires when a `paths` *value* is a bare specifier
like `"*"` and there is no `baseUrl` to anchor it — exactly the half-migrated
state above. The suggestion in the message is the fix.

The option's own help text is a reminder of the assumption baked into the old
model:

```text
TS6167  A series of entries which re-map imports to lookup locations relative to
        the 'baseUrl'.
```

That description still says "relative to the `baseUrl`", which is now only
sometimes true — a small artefact of the 4.1 change worth knowing if you are
reading the compiler's own help and wondering why it disagrees with the
handbook.

## When `baseUrl` is still right

Narrow, but real:

- **You genuinely want bare-specifier imports of your own source** and accept the
  shadowing risk — some large monorepos do, deliberately.
- **You are following a bundler or runtime that resolves the same way**, which is
  `paths`' documented purpose applied to `baseUrl`.
- **A legacy AMD project**, which is what it was designed for.

For everything else, delete it and make the `paths` values relative.

## Gotchas

**`baseUrl` shadows `node_modules` and nothing warns you.** *Symptom:* an import
of a real package resolves to your source. *Cause:* documented precedence.
*Fix:* delete `baseUrl`, or never name a directory after a package. The
high-risk names are the boring ones: `utils`, `config`, `types`, `constants`.

**Removing `baseUrl` without rewriting `paths` values repoints every alias.**
*Symptom:* aliases resolve to the wrong place, or `TS5090`. *Cause:* values were
relative to `baseUrl` and are now relative to `tsconfig.json`. *Fix:* the two
edits are one change.

**`baseUrl` has the same runtime problem as `paths` and attracts none of the
suspicion.** *Symptom:* `ERR_MODULE_NOT_FOUND` for `db/pool.js`. *Cause:* it does
not look like an alias, so nobody applies the alias reasoning to it. *Fix:* the
same four options as `paths` — [chunk 03](./03-closing-the-gap.md).

**`extends` makes `baseUrl` relative to the file that declares it.** *Symptom:*
a base config's `baseUrl` pointing somewhere unexpected in a monorepo package.
*Cause:* path options resolve relative to their declaring file. *Fix:* set
`baseUrl` and `paths` in the leaf config, not the shared base.

**`TS6167`'s help text is out of date relative to the handbook.** *Symptom:*
confusion when reading `tsc --help`. *Cause:* it predates the 4.1 change. *Fix:*
trust the handbook; `paths` values are relative to `tsconfig.json` when there is
no `baseUrl`.

**A `baseUrl` of `"."` makes the whole repo importable by bare specifier.**
*Symptom:* imports like `"src/db/pool.js"` and `"node_modules/x/y.js"` that
resolve. *Cause:* `baseUrl` set at the root. *Fix:* if you want it at all, point
it at the source directory, not the repo root.

## Interview questions

**What does `baseUrl` do?**
It names a directory that bare specifiers resolve from, so `import … from
"db/pool.js"` can find `./src/db/pool.ts`. It affects only bare specifiers —
relative imports are never influenced by it — and, like `paths`, it changes
lookup and not emit.

**What is the precedence relationship between `baseUrl` and `node_modules`?**
`baseUrl` wins. Your source tree shadows your dependencies, so a directory named
`utils` or `config` under `baseUrl` will be resolved in preference to an npm
package of the same name, with no warning.

**Does `paths` require `baseUrl`?**
Not since TypeScript 4.1. Without `baseUrl`, `paths` values are resolved relative
to the `tsconfig.json` that declares them, which is the better modern form —
fewer options, no shadowing, and the values are readable on their own.

**What is `TS5090` telling you?**
That a `paths` value is a bare specifier — typically `"*"` — with no `baseUrl` to
anchor it. It is the signature of a half-completed migration where `baseUrl` was
deleted and the values were not rewritten. The message's own suggestion, a
leading `./`, is the fix.

**Does `baseUrl` have the same runtime problem as `paths`?**
Exactly the same one, and it attracts less suspicion because it does not look
like an alias. `import { pool } from "db/pool.js"` is emitted verbatim and Node
looks for a package called `db`. Everything true of `paths` at runtime is true of
`baseUrl`.

**Where should `baseUrl` and `paths` live in a monorepo with a shared base
config?**
In the leaf config. Path-valued options resolve relative to the file that
declares them, so a `baseUrl` in a shared base points relative to the base's
location, which is almost never what a package wants.

**When would you still set `baseUrl`?**
When you deliberately want bare-specifier imports of your own source and accept
the shadowing; when you are mirroring a bundler or runtime that resolves the same
way; or in a legacy AMD project, which is what it was designed for. Otherwise
delete it and make the `paths` values relative.

---

← [01 · What `paths` does](./01-what-paths-does.md) · Next → [03 · Closing the gap at runtime](./03-closing-the-gap.md)
