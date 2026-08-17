---
title: "Resolution strategies — the two that cannot"
sidebar_label: "04 · The two that cannot"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the `classic` and `node10` sections, *node_modules package lookups*,
> *Directory modules*, *Extensionless relative paths*, *Relative file path
> resolution*). `TS6278`, `TS6279`, `TS6280`, `TS2792` and `TS5070` are verbatim
> from the compiler's message table in the installed **5.9.3** build,
> cross-checked in the **7.0.2** native binary. **No sandbox, no console block.**

Four strategies exist. The useful way to hold them is **two that can read a
modern package's `package.json` and two that cannot** — and this chunk is the
second pair. [Chunk 05](./05-the-node-resolver.md) is the first.

## What a resolution strategy actually decides

Not one thing — a **set** of capabilities. Each strategy is a bundle of answers
to about eight independent questions, and the reason `moduleResolution` feels
mysterious is that people think of it as a single switch when it is really a
preset.

The questions:

1. Are `node_modules` searched at all?
2. Is `package.json` `"exports"` honoured?
3. Is `package.json` `"imports"` (`#internal` specifiers) honoured?
4. May a relative import omit its extension?
5. May a directory be imported, resolving to `index`?
6. Does the answer depend on whether the importing file is ESM or CJS?
7. Which `"exports"` **conditions** match?
8. Are `paths` and `baseUrl` consulted?

## The matrix

| | `classic` | `node10` | `node16`/`nodenext` | `bundler` |
|---|---|---|---|---|
| `node_modules` lookups | ❌ (only `@types` fallback) | ✅ | ✅ | ✅ |
| `"exports"` | ❌ | ❌ | ✅ | ✅ |
| `"imports"` / self-name | ❌ | ❌ | ✅ | ✅ |
| `"typesVersions"` | — | ✅ | ✅ | ✅ |
| Extensionless relative | ✅ | ✅ | **only under `require`** | ✅ |
| Directory modules | ✅ | ✅ | **only under `require`** | ✅ |
| Depends on importing file's format | ❌ | ❌ | ✅ | ❌ |
| `paths` / `baseUrl` | ✅ | ✅ | ✅ | ✅ |

The `"exports"` row is the fault line. Everything else is detail.

## `classic` — the one that does not look in `node_modules`

The handbook's entire guidance is four words:

> Do not use `classic`.

It predates `node_modules`. The reference notes the single exception:

> All of TypeScript's `moduleResolution` options except `classic` support
> `node_modules` lookups. (`classic` supports lookups in `node_modules/@types`
> when other means of resolution fail, but never looks for packages in
> `node_modules` directly.)

🔴 **Nobody sets `classic` on purpose, and that is exactly why it matters.** It is
what you get by *default* for a whole family of `module` values — see
[chunk 07](./07-the-defaults-you-did-not-set.md), which is where this becomes an
actual bug people ship.

The `@types` carve-out is what makes the resulting failure so disorienting. A
package with a bundled `@types` entry can half-resolve — the compiler finds the
declaration and never finds the implementation — so you get types for something
the runtime will not have. That is worse than a clean failure, and it is unique
to `classic`.

⚠️ `classic` also disables `resolveJsonModule` outright: `TS5070: Option
'--resolveJsonModule' cannot be specified when 'moduleResolution' is set to
'classic'.` If you meet that error, the real problem is not JSON.

## `node10` — correct for 2018, wrong for every package published since

> `--moduleResolution node` was renamed to `node10` (keeping `node` as an alias
> for backward compatibility) in TypeScript 5.0. It reflects the CommonJS module
> resolution algorithm as it existed in Node.js versions earlier than v12. It
> should no longer be used.

The rename is itself the message. `"moduleResolution": "node"` reads like "the
Node one" and is in fact "the Node-11-and-earlier one"; renaming it to `node10`
made a config line that looked current look dated, which was the point. Both
spellings still work — `node` is in the compiler's `deprecatedKeys` set — so no
build broke, and nothing forced anyone to notice.

**What `node10` does support**, per the reference: `paths`, `baseUrl`,
`node_modules` lookups, `"typesVersions"`, package-relative paths, full and
extensionless relative paths, and directory modules.

**What it does not:** `"exports"`, and `"imports"` / self-name imports.

Those two omissions are the whole problem, because `"exports"` is how every
package published in the last several years describes itself. Without it,
`node10` falls back to guessing from `"main"` and `"types"` — which usually finds
the right main entry point and usually finds the *wrong* thing for a subpath, or
nothing at all. And it means this, from the reference, is invisible to it:

> Note that the presence of `"exports"` prevents any subpaths not explicitly
> listed or matched by a pattern in `"exports"` from being resolved.

So `node10` will happily resolve `some-lib/dist/internal/thing` that the package
author has deliberately made private, give you types for it, and let you ship a
dependency on a path the package does not promise to keep.

### The compiler tells you, in two different ways

```text
TS6280  There are types at '{0}', but this result could not be resolved under
        your current 'moduleResolution' setting. Consider updating to 'node16',
        'nodenext', or 'bundler'.

TS6278  There are types at '{0}', but this result could not be resolved when
        respecting package.json "exports". The '{1}' library may need to update
        its package.json or typings.
```

🔴 **`TS6280` means the fault is yours; `TS6278` means the fault is the
library's.** That distinction is not obvious from either message alone, and it
decides whether you edit `tsconfig.json` or open an issue upstream. `TS6280` even
names the three settings worth moving to.

There is also the blunter one you meet first:

```text
TS2792  Cannot find module '{0}'. Did you mean to set the 'moduleResolution'
        option to 'nodenext', or to add aliases to the 'paths' option?
```

📌 The compiler goes further than reporting. Internally it re-runs the failed
resolution under `bundler` purely to produce a better message — `TS6279:
"Resolution of non-relative name failed; trying with '--moduleResolution bundler'
to see if project may need configuration update."` The compiler is doing your
troubleshooting for you, in a trace-level message most people never see.

## Gotchas

**`"moduleResolution": "node"` in a 2026 config is a dated setting wearing a
current name.** *Symptom:* nothing, for years — then one dependency upgrade and
a subpath import stops resolving. *Cause:* `node` is an alias for `node10`, which
cannot read `"exports"`. *Fix:* move to `bundler` or the Node family. It is the
highest-value single line most legacy configs can change.

**`classic` gives you types without an implementation.** *Symptom:* an import
type-checks and the value is `undefined` at runtime. *Cause:* `classic` searches
`node_modules/@types` as a fallback but never `node_modules` itself, so the
declaration resolved and the module did not. *Fix:* never use `classic` — and
check [chunk 07](./07-the-defaults-you-did-not-set.md), because you probably did
not choose it.

**`TS5070` about `resolveJsonModule` is a `classic` diagnosis in disguise.**
*Symptom:* a JSON import fails with a message about `resolveJsonModule`.
*Cause:* the flag cannot be set under `classic` at all. *Fix:* fix
`moduleResolution`; the JSON was never the issue.

**`node10` lets you import paths the package has made private.** *Symptom:* an
import of `pkg/dist/internal/x` works locally and breaks for a colleague on a
stricter config, or after a minor version bump of the dependency. *Cause:*
`"exports"` seals subpaths and `node10` does not read it. *Fix:* switch strategy
— and expect the switch to surface these as errors, which is the point.

**Upgrading `moduleResolution` surfaces errors that were always true.**
*Symptom:* moving `node` → `bundler` produces a wave of new `TS2307`s. *Cause:*
the previous setting was resolving things your runtime never would. *Fix:* treat
them as a backlog of real defects, not a regression. Any of them that fails at
compile time now would have failed at runtime eventually.

**`TS6278` is not actionable in your repo, and people spend hours on it anyway.**
*Symptom:* an upstream package resolves to types the compiler then refuses.
*Cause:* the library's `"exports"` does not list a `types` condition for the
subpath. *Fix:* a `paths` alias as a stopgap, and an upstream issue as the real
fix. Do not switch your whole project back to `node10` to make it go away.

**`node16`/`nodenext` is not a drop-in replacement for `node10`.** *Symptom:*
switching produces hundreds of `TS2834`s. *Cause:* the Node family forbids
extensionless relative imports in ESM files. *Fix:* if you need modern package
resolution without that constraint, `bundler` is the gentler move — chunk 05.

## Interview questions

**What is `moduleResolution: "node"` and why should it worry you?**
It is an alias for `node10`, the CommonJS algorithm as Node implemented it before
v12. It cannot read `package.json` `"exports"` or `"imports"`, so for any modern
package it guesses. It is the most common setting in old configs and the most
common cause of "the types are wrong for this subpath".

**How does `classic` differ from every other strategy?**
It does not search `node_modules` for packages at all — only `node_modules/@types`
as a last-resort fallback. That produces a distinctive failure where types
resolve and the implementation does not, which is worse than a clean miss.

**You see `TS6278` and `TS6280` in the same build. Are they the same problem?**
No, and they need different owners. `TS6280` says your `moduleResolution` is too
old to reach types that exist — your config, your fix. `TS6278` says the types
exist but the package's own `"exports"` does not expose them — the library's
`package.json`, an upstream fix. Mixing them up sends people to the wrong file.

**Why did TypeScript rename `node` to `node10` rather than deprecating it?**
Because a rename is a documentation change that costs nobody a build. `node`
still works and is listed in the compiler's deprecated keys; the new name simply
makes it obvious, on sight, that the setting is pinned to a decade-old runtime.
Deprecating it outright would have broken an enormous number of projects for no
immediate correctness gain.

**What does `"exports"` actually buy you that `"main"` does not?**
Subpath control and conditions. `"main"` names one entry point and leaves every
internal file reachable; `"exports"` enumerates exactly which subpaths are
public and can serve different files for `import`, `require`, `node`, `browser`
and `types`. A strategy that cannot read it is resolving a package the author
never described.

**Your build breaks with a hundred new errors after changing
`moduleResolution`. How do you argue for keeping the change?**
By pointing out that the errors are not new facts, only newly visible ones. The
old setting resolved specifiers your runtime would not have, so every one of
those errors is a latent runtime failure or a dependency on a private path.
Reverting restores the silence, not the correctness.

---

← [03 · `preserve` and the Node family](./03-preserve-and-the-node-family.md) · Next → [05 · The two that can](./05-the-node-resolver.md)
